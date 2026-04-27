import { Router } from 'express';
import searchService from '../services/searchService.js';

const router = Router();

/**
 * POST /v1/search
 * Search the web and optionally scrape results.
 */
router.post('/', async (req, res, next) => {
  try {
    const { query, limit, scrapeOptions } = req.body;

    // Validate
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: "query"',
      });
    }

    if (typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '"query" must be a non-empty string',
      });
    }

    const data = await searchService.search(query, {
      limit: Math.min(limit || 5, 20),
      scrapeOptions,
    });

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
