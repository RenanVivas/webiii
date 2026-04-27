import { Router } from 'express';
import extractService from '../services/extractService.js';

const router = Router();

/**
 * POST /v1/extract
 * Extract structured data from URLs using LLM.
 */
router.post('/', async (req, res, next) => {
  try {
    const { urls, prompt, schema } = req.body;

    // Validate
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: "urls" (must be a non-empty array)',
      });
    }

    if (!prompt && !schema) {
      return res.status(400).json({
        success: false,
        error: 'At least one of "prompt" or "schema" is required',
      });
    }

    // Validate all URLs
    for (const url of urls) {
      try {
        new URL(url);
      } catch {
        return res.status(400).json({
          success: false,
          error: `Invalid URL: "${url}"`,
        });
      }
    }

    // Limit URLs
    if (urls.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 URLs per extraction request',
      });
    }

    const data = await extractService.extract(urls, { prompt, schema });

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
