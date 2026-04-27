import { chromium } from 'playwright';
import config from '../config.js';
import logger from '../utils/logger.js';

/**
 * Manages a pool of Playwright browser instances.
 * Re-uses browsers and pages to minimize overhead.
 */
class BrowserService {
  constructor() {
    this.browser = null;
    this.activePages = 0;
    this.maxPages = config.maxConcurrentBrowsers;
    this.queue = [];
    this.isShuttingDown = false;
  }

  /**
   * Initialize the browser instance.
   */
  async init() {
    if (this.browser) return;

    logger.info('🚀 Launching Playwright browser...');
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });

    this.browser.on('disconnected', () => {
      logger.warn('Browser disconnected');
      this.browser = null;
      this.activePages = 0;
    });

    logger.info('✅ Playwright browser ready');
  }

  /**
   * Get a new page from the browser pool.
   * Waits if max concurrent pages are in use.
   */
  async getPage(options = {}) {
    if (this.isShuttingDown) {
      throw new Error('Browser service is shutting down');
    }

    // Initialize browser if needed
    if (!this.browser) {
      await this.init();
    }

    // Wait if at capacity
    if (this.activePages >= this.maxPages) {
      await new Promise((resolve) => {
        this.queue.push(resolve);
      });
    }

    this.activePages++;

    const context = await this.browser.newContext({
      userAgent: options.userAgent || config.scraping.userAgent,
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
      ...(options.headers && {
        extraHTTPHeaders: options.headers,
      }),
    });

    const page = await context.newPage();

    // Block unnecessary resources for faster loading
    if (!options.loadImages) {
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'media', 'font'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });
    }

    return page;
  }

  /**
   * Release a page back to the pool.
   */
  async releasePage(page) {
    try {
      const context = page.context();
      await page.close();
      await context.close();
    } catch (err) {
      logger.warn(`Error releasing page: ${err.message}`);
    }

    this.activePages--;

    // Wake up next waiting request
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next();
    }
  }

  /**
   * Navigate to a URL and wait for content to load.
   */
  async navigateAndWait(page, url, options = {}) {
    const timeout = options.timeout || config.scraping.defaultTimeout;
    const waitFor = options.waitFor || config.scraping.defaultWaitFor;

    try {
      const response = await page.goto(url, {
        waitUntil: 'networkidle',
        timeout,
      });

      // Additional wait if specified
      if (typeof waitFor === 'number' && waitFor > 0) {
        await page.waitForTimeout(waitFor);
      } else if (typeof waitFor === 'string') {
        // waitFor is a CSS selector
        await page.waitForSelector(waitFor, { timeout: 10000 }).catch(() => {});
      }

      return response;
    } catch (err) {
      // Fallback: try with domcontentloaded
      logger.warn(`networkidle timeout for ${url}, falling back to domcontentloaded`);
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout,
      });
      await page.waitForTimeout(Math.max(waitFor || 3000, 3000));
      return response;
    }
  }

  /**
   * Take a screenshot of the current page.
   */
  async takeScreenshot(page, options = {}) {
    return page.screenshot({
      fullPage: options.fullPage || false,
      type: 'png',
      ...(options.quality && { quality: options.quality }),
    });
  }

  /**
   * Gracefully shut down all browser instances.
   */
  async shutdown() {
    this.isShuttingDown = true;
    logger.info('Shutting down browser service...');

    // Reject all queued requests
    this.queue.forEach((resolve) => resolve());
    this.queue = [];

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    this.activePages = 0;
    logger.info('Browser service shut down');
  }
}

// Singleton
const browserService = new BrowserService();
export default browserService;
