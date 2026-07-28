const logger = require("../lib/logger");

// 404 handler for unmatched routes.
function notFound(req, res, _next) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
}

// Centralized error handler. Never leaks stack traces in production.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  logger.error({ err: err.message, stack: err.stack, path: req.originalUrl }, "Request failed");
  res.status(status).json({
    error: status >= 500 ? "Internal server error" : err.message,
    ...(process.env.NODE_ENV !== "production" && status >= 500 ? { details: err.message } : {}),
  });
}

// Wrap async route handlers so rejected promises reach errorHandler.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { notFound, errorHandler, asyncHandler };
