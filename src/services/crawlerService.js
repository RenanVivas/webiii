import { v4 as uuidv4 } from 'uuid';
import scraperService from './scraperService.js';
import { normalizeUrl, isSameDomain, shouldIncludeUrl, getDomain } from '../utils/urlUtils.js';
import { extractLinks } from '../utils/contentCleaner.js';
import config from '../config.js';
import logger from '../utils/logger.js';

/**
 * In-memory job store for crawl jobs.
 * In production, this would use Redis.
 */
const jobs = new Map();

/**
 * Async crawler service with BFS traversal and job management.
 */
class CrawlerService {
  /**
   * Start a new crawl job.
   * Returns immediately with a job ID.
   */
  async startCrawl(url, options = {}) {
    const jobId = uuidv4();
    const limit = Math.min(options.limit || config.crawling.defaultLimit, config.crawling.maxLimit);
    const maxDepth = options.maxDepth || config.crawling.defaultMaxDepth;

    const job = {
      id: jobId,
      url,
      status: 'scraping',
      completed: 0,
      total: 0,
      data: [],
      options: {
        limit,
        maxDepth,
        includePaths: options.includePaths || [],
        excludePaths: options.excludePaths || [],
        scrapeOptions: options.scrapeOptions || { formats: ['markdown'], onlyMainContent: true },
      },
      createdAt: new Date().toISOString(),
      error: null,
    };

    jobs.set(jobId, job);

    // Start crawling in background
    this._executeCrawl(jobId).catch(err => {
      logger.error(`Crawl job ${jobId} failed: ${err.message}`);
      const j = jobs.get(jobId);
      if (j) {
        j.status = 'failed';
        j.error = err.message;
      }
    });

    return {
      id: jobId,
      url: `/v1/crawl/${jobId}`,
    };
  }

  /**
   * Get the status of a crawl job.
   */
  getJobStatus(jobId) {
    const job = jobs.get(jobId);
    if (!job) return null;

    return {
      status: job.status,
      completed: job.completed,
      total: job.total,
      data: job.data,
      error: job.error,
      createdAt: job.createdAt,
    };
  }

  /**
   * Execute the crawl using BFS.
   */
  async _executeCrawl(jobId) {
    const job = jobs.get(jobId);
    if (!job) return;

    const { url, options } = job;
    const visited = new Set();
    const queue = [{ url: normalizeUrl(url), depth: 0 }];
    const baseDomain = getDomain(url);

    logger.info(`🕷️ Starting crawl: ${url} (limit: ${options.limit}, maxDepth: ${options.maxDepth})`);

    while (queue.length > 0 && job.data.length < options.limit) {
      const { url: currentUrl, depth } = queue.shift();
      const normalized = normalizeUrl(currentUrl);

      // Skip if already visited
      if (visited.has(normalized)) continue;
      visited.add(normalized);

      // Skip if exceeds max depth
      if (depth > options.maxDepth) continue;

      // Skip if not same domain
      if (!isSameDomain(currentUrl, url)) continue;

      // Check include/exclude paths
      if (!shouldIncludeUrl(currentUrl, options.includePaths, options.excludePaths)) continue;

      try {
        // Update job total
        job.total = Math.min(visited.size + queue.length, options.limit);

        // Scrape the page
        const result = await scraperService.scrape(currentUrl, options.scrapeOptions);

        job.data.push({
          ...result,
          metadata: {
            ...result.metadata,
            sourceURL: currentUrl,
            depth,
          },
        });
        job.completed = job.data.length;

        logger.info(`🕷️ Crawled [${job.completed}/${options.limit}]: ${currentUrl} (depth: ${depth})`);

        // Extract links and add to queue
        if (depth < options.maxDepth && result.links) {
          for (const link of result.links) {
            const normalizedLink = normalizeUrl(link);
            if (!visited.has(normalizedLink) && isSameDomain(link, url)) {
              queue.push({ url: link, depth: depth + 1 });
            }
          }
        } else if (depth < options.maxDepth && result.html) {
          // Extract links from HTML if links format wasn't requested
          const links = extractLinks(result.html, currentUrl);
          for (const link of links) {
            const normalizedLink = normalizeUrl(link);
            if (!visited.has(normalizedLink) && isSameDomain(link, url)) {
              queue.push({ url: link, depth: depth + 1 });
            }
          }
        }

        // Small delay to be respectful
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        logger.warn(`⚠️ Failed to scrape ${currentUrl}: ${err.message}`);
      }
    }

    job.status = 'completed';
    job.total = job.completed;
    logger.info(`✅ Crawl completed: ${url} — ${job.completed} pages`);
  }

  /**
   * Clean up old jobs (>1 hour).
   */
  cleanupOldJobs() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [id, job] of jobs) {
      if (new Date(job.createdAt).getTime() < oneHourAgo) {
        jobs.delete(id);
        logger.info(`🧹 Cleaned up old crawl job: ${id}`);
      }
    }
  }
}

const crawlerService = new CrawlerService();

// Cleanup old jobs every 30 minutes
setInterval(() => crawlerService.cleanupOldJobs(), 30 * 60 * 1000);

export default crawlerService;
