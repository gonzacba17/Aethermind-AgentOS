/**
 * Centralized error handling middleware
 * Eliminates try-catch duplication across route handlers
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import logger from '../utils/logger';

// =============================================================================
// Custom Error Types
// =============================================================================

export class AppError extends Error {
  public statusCode: number;
  public code?: string;
  public details?: unknown;

  constructor(
    statusCode: number,
    message: string,
    code?: string,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, message, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(429, message, 'RATE_LIMITED');
  }
}

export class InternalError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(500, message, 'INTERNAL_ERROR');
  }
}

// =============================================================================
// Async Handler Wrapper
// =============================================================================

/**
 * Wraps async route handlers to automatically catch errors
 * Eliminates the need for try-catch in every route
 *
 * @example
 * router.get('/', asyncHandler(async (req, res) => {
 *   const data = await someAsyncOperation();
 *   res.json(data);
 * }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// =============================================================================
// Error Handler Middleware
// =============================================================================

/**
 * Global error handler middleware
 * Should be registered after all routes
 *
 * @example
 * app.use(errorHandler);
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Determine if this is a known AppError or an unexpected error
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_ERROR';

  // Log the error
  const logData = {
    requestId: (req as any).requestId,
    method: req.method,
    path: req.path,
    statusCode,
    code,
    message: err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  };

  if (statusCode >= 500) {
    logger.error('Server error', logData);
  } else if (statusCode >= 400) {
    logger.warn('Client error', logData);
  }

  // Build response
  const response: {
    error: string;
    code?: string;
    message: string;
    details?: unknown;
    stack?: string;
  } = {
    error: isAppError ? err.name : 'InternalError',
    code,
    message: process.env.NODE_ENV === 'production' && !isAppError
      ? 'An internal error occurred'
      : err.message,
  };

  // Include details if available (for validation errors, etc.)
  if (isAppError && err.details) {
    response.details = err.details;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

// =============================================================================
// Not Found Handler
// =============================================================================

/**
 * 404 handler for unmatched routes
 * Should be registered after all routes but before errorHandler
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route ${req.method} ${req.path}`));
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Assert a condition, throwing an error if false
 */
export function assert(
  condition: boolean,
  message: string,
  statusCode: number = 400
): asserts condition {
  if (!condition) {
    throw new ValidationError(message);
  }
}

/**
 * Assert that a value exists, throwing NotFoundError if null/undefined
 */
export function assertExists<T>(
  value: T | null | undefined,
  resource: string = 'Resource'
): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundError(resource);
  }
}
