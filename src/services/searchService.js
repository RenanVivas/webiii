import * as cheerio from 'cheerio';
import scraperService from './scraperService.js';
import logger from '../utils/logger.js';

/**
 * Web search service using DuckDuckGo HTML.
 * Searches the web and optionally scrapes the results.
 */
class SearchService {
  /**
   * Search the web and return results.
   * @param {string} query - Search query
   * @param {object} options
   * @param {number} options.limit - Max results
   * @param {object} options.scrapeOptions - Options for scraping results
   * @returns {object[]} Search results
   */
  async search(query, options = {}) {
    const limit = options.limit || 5;

    logger.info(`🔎 Searching: "${query}" (limit: ${limit})`);

    // 1. Get search results from DuckDuckGo
    const searchResults = await this._duckDuckGoSearch(query, limit);

    if (searchResults.length === 0) {
      logger.warn('⚠️ No search results found');
      return [];
    }

    logger.info(`📋 Found ${searchResults.length} search results`);

    // 2. Optionally scrape each result
    if (options.scrapeOptions) {
      const scrapedResults = [];

      for (const result of searchResults) {
        try {
          const scraped = await scraperService.scrape(result.url, {
            ...options.scrapeOptions,
            timeout: 15000,
          });

          scrapedResults.push({
            ...result,
            ...scraped,
          });
        } catch (err) {
          logger.warn(`⚠️ Failed to scrape search result ${result.url}: ${err.message}`);
          scrapedResults.push(result);
        }

        // Small delay between scrapes
        await new Promise(r => setTimeout(r, 500));
      }

      return scrapedResults;
    }

    return searchResults;
  }

  /**
   * Search DuckDuckGo HTML version.
   */
  async _duckDuckGoSearch(query, limit) {
    const results = [];

    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`DuckDuckGo returned ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Parse DuckDuckGo HTML results
      $('.result').each((i, el) => {
        if (results.length >= limit) return false;

        const titleEl = $(el).find('.result__title a, .result__a');
        const snippetEl = $(el).find('.result__snippet');
        const urlEl = $(el).find('.result__url');

        let href = titleEl.attr('href') || '';
        const title = titleEl.text().trim();
        const description = snippetEl.text().trim();
        let displayUrl = urlEl.text().trim();

        // DuckDuckGo wraps URLs in a redirect — extract the actual URL
        if (href.includes('uddg=')) {
          try {
            const urlParam = new URL(href, 'https://duckduckgo.com').searchParams.get('uddg');
            if (urlParam) href = decodeURIComponent(urlParam);
          } catch { /* use href as-is */ }
        }

        // Clean up URL
        if (!href.startsWith('http')) {
          if (displayUrl) {
            href = displayUrl.startsWith('http') ? displayUrl : `https://${displayUrl}`;
          } else {
            return; // Skip invalid results
          }
        }

        if (title && href) {
          results.push({
            url: href,
            title,
            description: description || '',
          });
        }
      });

    } catch (err) {
      logger.error(`❌ DuckDuckGo search failed: ${err.message}`);
      // Fallback: try a simpler approach
      return this._fallbackSearch(query, limit);
    }

    return results;
  }

  /**
   * Fallback search using DuckDuckGo Lite.
   */
  async _fallbackSearch(query, limit) {
    const results = [];

    try {
      const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Webiii/1.0)',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) return results;

      const html = await response.text();
      const $ = cheerio.load(html);

      // Parse lite version results
      $('a.result-link').each((i, el) => {
        if (results.length >= limit) return false;

        const href = $(el).attr('href');
        const title = $(el).text().trim();

        if (href && title && href.startsWith('http')) {
          results.push({
            url: href,
            title,
            description: '',
          });
        }
      });

      // Alternative parsing for lite page
      if (results.length === 0) {
        $('table tr').each((i, el) => {
          if (results.length >= limit) return false;

          const link = $(el).find('a[href^="http"]').first();
          const href = link.attr('href');
          const title = link.text().trim();

          if (href && title) {
            results.push({
              url: href,
              title,
              description: '',
            });
          }
        });
      }
    } catch (err) {
      logger.error(`❌ Fallback search also failed: ${err.message}`);
    }

    return results;
  }
}

const searchService = new SearchService();
export default searchService;
