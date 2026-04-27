import logger from '../utils/logger.js';

/**
 * Global error handler middleware.
 */
export default function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  logger.error(`[${req.method}] ${req.originalUrl} → ${statusCode}: ${message}`, {
    stack: err.stack,
    body: req.body,
  });

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
