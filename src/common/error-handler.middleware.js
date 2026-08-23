// Central error handler: maps every thrown error to the PRD's response envelope.
// Must be mounted last, after every route.
const { AppError, RateLimitError } = require('./errors.js');

function errorHandler(err, req, res, _next) {
  if (err instanceof RateLimitError) {
    res.setHeader('Retry-After', String(err.retryAfterSeconds));
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details || {} },
      requestId: req.requestId,
    });
  }

  console.error(err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong', details: {} },
    requestId: req.requestId,
  });
}

module.exports = errorHandler;
