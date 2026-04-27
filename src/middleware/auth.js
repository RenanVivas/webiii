import config from '../config.js';
import logger from '../utils/logger.js';

/**
 * API Key authentication middleware.
 * Expects: Authorization: Bearer <API_KEY>
 */
export default function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    logger.warn(`Auth failed: No authorization header from ${req.ip}`);
    return res.status(401).json({
      success: false,
      error: 'Missing Authorization header. Use: Authorization: Bearer <API_KEY>',
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    logger.warn(`Auth failed: Invalid format from ${req.ip}`);
    return res.status(401).json({
      success: false,
      error: 'Invalid Authorization format. Use: Authorization: Bearer <API_KEY>',
    });
  }

  const token = parts[1];
  if (token !== config.apiKey) {
    logger.warn(`Auth failed: Invalid API key from ${req.ip}`);
    return res.status(403).json({
      success: false,
      error: 'Invalid API key.',
    });
  }

  next();
}
