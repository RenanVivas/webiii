import * as cheerio from 'cheerio';
import { parseStringPromise } from 'xml2js';
import { normalizeUrl, getDomain, isSameDomain, resolveUrl } from '../utils/urlUtils.js';
import config from '../config.js';
import logger from '../utils/logger.js';

/**
 * URL discovery service.
 * Finds all URLs on a domain using sitemap + crawl.
 */
class MapService {
  /**
   * Map a website to discover all its URLs.
   * @param {string} url - Base URL of the website
   * @param {object} options
   * @param {string} options.search - Filter URLs by search query
   * @param {number} options.limit - Max URLs to return
   * @param {boolean} options.ignoreSitemap - Skip sitemap parsing
   * @returns {string[]} Array of discovered URLs
   */
  async map(url, options = {}) {
    const limit = Math.min(options.limit || config.map.defaultLimit, config.map.maxLimit);
    const allUrls = new Set();

    logger.info(`🗺️ Mapping: ${url}`);

    // 1. Try sitemap first (fastest)
    if (!options.ignoreSitemap) {
      try {
        const sitemapUrls = await this._parseSitemap(url);
        sitemapUrls.forEach(u => allUrls.add(normalizeUrl(u)));
        logger.info(`📋 Found ${sitemapUrls.length} URLs from sitemap`);
      } catch (err) {
        logger.warn(`⚠️ Sitemap parsing failed: ${err.message}`);
      }
    }

    // 2. Quick crawl for link discovery
    try {
      const crawledUrls = await this._quickCrawl(url, Math.min(limit, 50));
      crawledUrls.forEach(u => allUrls.add(normalizeUrl(u)));
      logger.info(`🔗 Found ${crawledUrls.length} URLs from crawl`);
    } catch (err) {
      logger.warn(`⚠️ Quick crawl failed: ${err.message}`);
    }

    // 3. Filter by same domain
    let urls = [...allUrls].filter(u => isSameDomain(u, url));

    // 4. Filter by search query if provided
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      urls = urls.filter(u => u.toLowerCase().includes(searchLower));
    }

    // 5. Sort and limit
    urls.sort();
    urls = urls.slice(0, limit);

    logger.info(`✅ Mapped ${url}: ${urls.length} URLs found`);
    return urls;
  }

  /**
   * Parse sitemap.xml (supports sitemap index).
   */
  async _parseSitemap(baseUrl) {
    const urls = [];
    const origin = new URL(baseUrl).origin;
    const sitemapUrls = [
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/sitemap-index.xml`,
    ];

    for (const sitemapUrl of sitemapUrls) {
      try {
        const response = await fetch(sitemapUrl, {
          headers: { 'User-Agent': config.scraping.userAgent },
          signal: AbortSignal.timeout(config.map.sitemapTimeout),
        });

        if (!response.ok) continue;

        const xml = await response.text();
        if (!xml.includes('<?xml') && !xml.includes('<urlset') && !xml.includes('<sitemapindex')) {
          continue;
        }

        const parsed = await parseStringPromise(xml, { explicitArray: false });

        // Sitemap index — contains references to other sitemaps
        if (parsed.sitemapindex && parsed.sitemapindex.sitemap) {
          const sitemaps = Array.isArray(parsed.sitemapindex.sitemap)
            ? parsed.sitemapindex.sitemap
            : [parsed.sitemapindex.sitemap];

          for (const sm of sitemaps.slice(0, 10)) { // Limit to 10 sub-sitemaps
            if (sm.loc) {
              try {
                const subUrls = await this._parseSingleSitemap(sm.loc);
                urls.push(...subUrls);
              } catch { /* skip failed sub-sitemaps */ }
            }
          }
        }

        // Regular sitemap
        if (parsed.urlset && parsed.urlset.url) {
          const entries = Array.isArray(parsed.urlset.url)
            ? parsed.urlset.url
            : [parsed.urlset.url];

          for (const entry of entries) {
            if (entry.loc) urls.push(entry.loc);
          }
        }

        if (urls.length > 0) break; // Found URLs, no need to try other sitemap paths
      } catch {
        continue;
      }
    }

    return urls;
  }

  /**
   * Parse a single sitemap XML file.
   */
  async _parseSingleSitemap(sitemapUrl) {
    const urls = [];

    const response = await fetch(sitemapUrl, {
      headers: { 'User-Agent': config.scraping.userAgent },
      signal: AbortSignal.timeout(config.map.sitemapTimeout),
    });

    if (!response.ok) return urls;

    const xml = await response.text();
    const parsed = await parseStringPromise(xml, { explicitArray: false });

    if (parsed.urlset && parsed.urlset.url) {
      const entries = Array.isArray(parsed.urlset.url)
        ? parsed.urlset.url
        : [parsed.urlset.url];

      for (const entry of entries) {
        if (entry.loc) urls.push(entry.loc);
      }
    }

    return urls;
  }

  /**
   * Quick crawl to discover links on a page and its immediate children.
   */
  async _quickCrawl(baseUrl, maxPages = 50) {
    const discovered = new Set();
    const visited = new Set();
    const queue = [baseUrl];

    while (queue.length > 0 && visited.size < maxPages) {
      const url = queue.shift();
      const normalized = normalizeUrl(url);
      if (visited.has(normalized)) continue;
      visited.add(normalized);

      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': config.scraping.userAgent },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) continue;

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) continue;

        const html = await response.text();
        const $ = cheerio.load(html);

        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (!href) return;
          if (href.startsWith('#') || href.startsWith('javascript:') ||
              href.startsWith('mailto:') || href.startsWith('tel:')) return;

          const resolved = resolveUrl(href, url);
          if (resolved && isSameDomain(resolved, baseUrl)) {
            discovered.add(normalizeUrl(resolved));
            if (visited.size + queue.length < maxPages) {
              queue.push(resolved);
            }
          }
        });

        // Small delay
        await new Promise(r => setTimeout(r, 200));
      } catch {
        continue;
      }
    }

    return [...discovered];
  }
}

const mapService = new MapService();
export default mapService;
