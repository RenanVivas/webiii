import { Router } from 'express';
import scraperService from '../services/scraperService.js';

const router = Router();

/**
 * POST /v1/scrape
 * Scrape a single URL and return content in requested formats.
 */
router.post('/', async (req, res, next) => {
  try {
    const { url, formats, onlyMainContent, waitFor, headers, includeTags, excludeTags, timeout, fullPage } = req.body;

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

    const validFormats = ['markdown', 'html', 'rawHtml', 'screenshot', 'links'];
    const requestedFormats = formats || ['markdown'];
    const invalidFormats = requestedFormats.filter(f => !validFormats.includes(f));
    if (invalidFormats.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid formats: ${invalidFormats.join(', ')}. Valid formats: ${validFormats.join(', ')}`,
      });
    }

    // Scrape
    const result = await scraperService.scrape(url, {
      formats: requestedFormats,
      onlyMainContent,
      waitFor,
      headers,
      includeTags,
      excludeTags,
      timeout,
      fullPage,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
