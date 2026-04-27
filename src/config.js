import dotenv from 'dotenv';
dotenv.config();

const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  apiKey: process.env.API_KEY || 'webiii-dev-key-2026',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  maxConcurrentBrowsers: parseInt(process.env.MAX_CONCURRENT_BROWSERS || '3', 10),
  logLevel: process.env.LOG_LEVEL || 'info',

  // Rate limiting
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
  },

  // Scraping defaults
  scraping: {
    defaultTimeout: 30000,
    defaultWaitFor: 2000,
    maxScreenshotWidth: 1920,
    maxScreenshotHeight: 1080,
    userAgent: 'Webiii/1.0 (compatible; web scraping API)',
  },

  // Crawling defaults
  crawling: {
    defaultLimit: 50,
    maxLimit: 500,
    defaultMaxDepth: 5,
    concurrency: 5,
  },

  // Map defaults
  map: {
    defaultLimit: 100,
    maxLimit: 5000,
    sitemapTimeout: 10000,
  },
};

export default config;
