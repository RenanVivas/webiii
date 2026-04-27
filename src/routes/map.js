import { Router } from 'express';
import mapService from '../services/mapService.js';

const router = Router();

/**
 * POST /v1/map
 * Discover all URLs on a website.
 */
router.post('/', async (req, res, next) => {
  try {
    const { url, search, limit, ignoreSitemap } = req.body;

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

    const links = await mapService.map(url, {
      search,
      limit,
      ignoreSitemap,
    });

    res.json({
      success: true,
      links,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
