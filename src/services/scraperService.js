import browserService from './browserService.js';
import converterService from './converterService.js';
import { cleanHtml, extractMetadata, extractLinks } from '../utils/contentCleaner.js';
import logger from '../utils/logger.js';

/**
 * Core scraping service.
 * Renders a page with Playwright and extracts content in multiple formats.
 */
class ScraperService {
  /**
   * Scrape a single URL.
   * @param {string} url - URL to scrape
   * @param {object} options
   * @param {string[]} options.formats - Output formats: markdown, html, rawHtml, screenshot, links
   * @param {boolean} options.onlyMainContent - Remove nav, header, footer
   * @param {number|string} options.waitFor - Wait time (ms) or CSS selector
   * @param {object} options.headers - Custom HTTP headers
   * @param {string[]} options.includeTags - Only keep these tags
   * @param {string[]} options.excludeTags - Remove these tags
   * @param {number} options.timeout - Navigation timeout
   * @returns {object} Scraped data
   */
  async scrape(url, options = {}) {
    const formats = options.formats || ['markdown'];
    const startTime = Date.now();
    let page = null;

    try {
      logger.info(`🔍 Scraping: ${url}`);

      // Get a browser page
      page = await browserService.getPage({
        headers: options.headers,
        loadImages: formats.includes('screenshot'),
      });

      // Navigate to URL
      const response = await browserService.navigateAndWait(page, url, {
        timeout: options.timeout,
        waitFor: options.waitFor,
      });

      const statusCode = response?.status() || 0;

      // Get raw HTML
      const rawHtml = await page.content();

      // Clean HTML
      const cleanedHtml = cleanHtml(rawHtml, {
        onlyMainContent: options.onlyMainContent !== false,
        includeTags: options.includeTags,
        excludeTags: options.excludeTags,
      });

      // Extract metadata from raw HTML (before cleaning)
      const metadata = extractMetadata(rawHtml, url);
      metadata.statusCode = statusCode;

      // Build response based on requested formats
      const result = { metadata };

      if (formats.includes('markdown')) {
        result.markdown = converterService.htmlToMarkdown(cleanedHtml);
      }

      if (formats.includes('html')) {
        result.html = cleanedHtml;
      }

      if (formats.includes('rawHtml')) {
        result.rawHtml = rawHtml;
      }

      if (formats.includes('links')) {
        result.links = extractLinks(rawHtml, url);
      }

      if (formats.includes('screenshot')) {
        const screenshotBuffer = await browserService.takeScreenshot(page, {
          fullPage: options.fullPage || false,
        });
        result.screenshot = screenshotBuffer.toString('base64');
      }

      const elapsed = Date.now() - startTime;
      logger.info(`✅ Scraped ${url} in ${elapsed}ms (${statusCode})`);

      return result;
    } catch (err) {
      logger.error(`❌ Scrape failed for ${url}: ${err.message}`);
      throw err;
    } finally {
      if (page) {
        await browserService.releasePage(page);
      }
    }
  }

  /**
   * Quick scrape using Cheerio only (no browser).
   * Much faster but won't work on JS-rendered pages.
   */
  async quickScrape(url, options = {}) {
    const startTime = Date.now();
    logger.info(`⚡ Quick scraping: ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Webiii/1.0 (compatible; web scraping API)',
          ...(options.headers || {}),
        },
        signal: AbortSignal.timeout(options.timeout || 15000),
      });

      const rawHtml = await response.text();

      const cleanedHtml = cleanHtml(rawHtml, {
        onlyMainContent: options.onlyMainContent !== false,
        includeTags: options.includeTags,
        excludeTags: options.excludeTags,
      });

      const metadata = extractMetadata(rawHtml, url);
      metadata.statusCode = response.status;

      const result = { metadata };
      const formats = options.formats || ['markdown'];

      if (formats.includes('markdown')) {
        result.markdown = converterService.htmlToMarkdown(cleanedHtml);
      }
      if (formats.includes('html')) {
        result.html = cleanedHtml;
      }
      if (formats.includes('rawHtml')) {
        result.rawHtml = rawHtml;
      }
      if (formats.includes('links')) {
        result.links = extractLinks(rawHtml, url);
      }

      const elapsed = Date.now() - startTime;
      logger.info(`✅ Quick scraped ${url} in ${elapsed}ms`);

      return result;
    } catch (err) {
      logger.error(`❌ Quick scrape failed for ${url}: ${err.message}`);
      throw err;
    }
  }
}

const scraperService = new ScraperService();
export default scraperService;
