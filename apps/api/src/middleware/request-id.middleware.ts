import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Request ID Header Names
 * X-Request-ID is the standard header name used by most systems
 * We also check X-Correlation-ID for compatibility with distributed tracing
 */
const REQUEST_ID_HEADER = 'x-request-id';
const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Extend Express Request type to include requestId
 */
declare global {
  namespace Express {
    interface Request {
      /** Unique identifier for this request (UUID v4) */
      requestId: string;
    }
  }
}

/**
 * Request ID Middleware
 *
 * Assigns a unique identifier to each incoming request for:
 * - Distributed tracing and debugging
 * - Log correlation across services
 * - Error tracking and support tickets
 *
 * If client provides X-Request-ID or X-Correlation-ID header,
 * it will be validated and reused. Otherwise, a new UUID is generated.
 *
 * The request ID is:
 * - Attached to req.requestId for use in handlers
 * - Set as X-Request-ID response header for client correlation
 *
 * @example
 * // Usage in route handlers:
 * app.get('/api/data', (req, res) => {
 *   logger.info('Processing request', { requestId: req.requestId });
 *   // ...
 * });
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Check for existing request ID from client (validated)
  let requestId = req.headers[REQUEST_ID_HEADER] as string | undefined;

  // Fallback to correlation ID if request ID not provided
  if (!requestId) {
    requestId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
  }

  // Validate format: must be a valid UUID v4 or similar identifier
  // Accepts: UUID, ULID, or alphanumeric with hyphens (max 64 chars)
  const isValidFormat = requestId && /^[a-zA-Z0-9-]{1,64}$/.test(requestId);

  if (!isValidFormat) {
    // Generate new UUID v4 if not provided or invalid
    requestId = randomUUID();
  }

  // Attach to request object for use in handlers
  req.requestId = requestId!;

  // Set response header for client correlation
  res.setHeader('X-Request-ID', requestId!);

  next();
}

/**
 * Creates a child logger context with request ID
 * Useful for creating request-scoped logging
 *
 * @param requestId - The request ID from req.requestId
 * @returns Object with requestId for spreading into log metadata
 *
 * @example
 * logger.info('User authenticated', {
 *   ...withRequestId(req.requestId),
 *   userId: user.id
 * });
 */
export function withRequestId(requestId: string): { requestId: string } {
  return { requestId };
}

export default requestIdMiddleware;
