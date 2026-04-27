import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import logger from './utils/logger.js';
import auth from './middleware/auth.js';
import rateLimiter from './middleware/rateLimiter.js';
import errorHandler from './middleware/errorHandler.js';
import browserService from './services/browserService.js';

// Routes
import scrapeRouter from './routes/scrape.js';
import crawlRouter from './routes/crawl.js';
import mapRouter from './routes/map.js';
import extractRouter from './routes/extract.js';
import searchRouter from './routes/search.js';

const app = express();

// ─── Global Middleware ───
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(rateLimiter);

// ─── Serve Playground UI ───
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── Health Check (no auth) ───

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ─── API Routes (authenticated) ───
app.use('/v1/scrape', auth, scrapeRouter);
app.use('/v1/crawl', auth, crawlRouter);
app.use('/v1/map', auth, mapRouter);
app.use('/v1/extract', auth, extractRouter);
app.use('/v1/search', auth, searchRouter);

// ─── 404 Handler ───
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
  });
});

// ─── Error Handler ───
app.use(errorHandler);

// ─── Start Server ───
const server = app.listen(config.port, async () => {
  console.log('');
  console.log('  ╦ ╦╔═╗╔╗ ╦╦╦');
  console.log('  ║║║║╣ ╠╩╗║║║');
  console.log('  ╚╩╝╚═╝╚═╝╩╩╩');
  console.log('');
  logger.info(`🚀 Webiii API running on http://localhost:${config.port}`);
  logger.info(`📋 Endpoints:`);
  logger.info(`   POST /v1/scrape   — Scrape a single page`);
  logger.info(`   POST /v1/crawl    — Start async crawl`);
  logger.info(`   GET  /v1/crawl/:id — Check crawl status`);
  logger.info(`   POST /v1/map      — Discover URLs`);
  logger.info(`   POST /v1/extract  — LLM extraction`);
  logger.info(`   POST /v1/search   — Web search`);
  logger.info('');
  logger.info(`🔑 API Key: ${config.apiKey.substring(0, 10)}...`);
  logger.info(`🌐 Max browsers: ${config.maxConcurrentBrowsers}`);

  // Pre-warm browser
  try {
    await browserService.init();
  } catch (err) {
    logger.warn(`⚠️ Browser pre-warm failed: ${err.message}`);
    logger.warn('   Browsers will be launched on first request.');
  }
});

// ─── Graceful Shutdown ───
const shutdown = async (signal) => {
  logger.info(`\n${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    await browserService.shutdown();
    logger.info('👋 Webiii shut down. Goodbye!');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
