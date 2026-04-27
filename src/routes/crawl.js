import { Router } from 'express';
import crawlerService from '../services/crawlerService.js';

const router = Router();

/**
 * POST /v1/crawl
 * Start an async crawl job.
 */
router.post('/', async (req, res, next) => {
  try {
    const { url, limit, maxDepth, includePaths, excludePaths, scrapeOptions } = req.body;

    // Validate
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: "url"',
      });
    }

    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format',
      });
    }

    // Start crawl job
    const job = await crawlerService.startCrawl(url, {
      limit,
      maxDepth,
      includePaths,
      excludePaths,
      scrapeOptions,
    });

    res.status(202).json({
      success: true,
      id: job.id,
      url: job.url,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/crawl/:id
 * Get the status and results of a crawl job.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const status = crawlerService.getJobStatus(id);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: `Crawl job not found: ${id}`,
      });
    }

    res.json({
      success: true,
      ...status,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
