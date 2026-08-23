// Typed errors carrying the status/code the error handler maps to the response envelope.
class AppError extends Error {
  constructor(code, message, status, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(details) {
    super('VALIDATION_ERROR', 'Request failed validation', 422, details);
  }
}

class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super('NOT_FOUND', message, 404);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super('CONFLICT', message, 409);
  }
}

class RateLimitError extends AppError {
  constructor(retryAfterSeconds) {
    super('RATE_LIMITED', 'Too many requests', 429);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
};
