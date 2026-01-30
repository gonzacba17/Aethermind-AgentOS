import { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';
import logger from '../utils/logger';

/**
 * CSRF Protection Configuration
 *
 * Uses the Double Submit Cookie pattern:
 * 1. Server generates a secret stored in httpOnly cookie
 * 2. Client receives a CSRF token to include in headers
 * 3. Server validates both match on state-changing requests
 *
 * This protects against CSRF attacks while supporting:
 * - SPA applications (token in header)
 * - Traditional form submissions (token in body)
 * - API clients (can obtain token via /csrf-token endpoint)
 */

// CSRF secret must be 32+ characters for security
const CSRF_SECRET = process.env.CSRF_SECRET || process.env.SESSION_SECRET || process.env.JWT_SECRET;

if (!CSRF_SECRET) {
  logger.error('CSRF_SECRET, SESSION_SECRET, or JWT_SECRET must be configured for CSRF protection');
}

/**
 * Routes that should be excluded from CSRF protection:
 * - Webhooks (verified via signature)
 * - Public read endpoints
 * - API key authenticated endpoints
 */
const CSRF_EXEMPT_ROUTES: RegExp[] = [
  /^\/stripe\/webhook$/,           // Stripe webhooks use signature verification
  /^\/v1\/events$/,                // SDK ingestion uses API key auth
  /^\/v1\/ingest$/,                // SDK ingestion uses API key auth
  /^\/health$/,                    // Health check is public
  /^\/metrics$/,                   // Prometheus metrics
  /^\/api\/openapi$/,              // OpenAPI spec
];

/**
 * Methods that require CSRF protection (state-changing)
 */
const CSRF_PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Check if a route should be exempt from CSRF protection
 */
function isExemptRoute(path: string): boolean {
  return CSRF_EXEMPT_ROUTES.some(pattern => pattern.test(path));
}

// Configure double CSRF protection
const csrfConfig = doubleCsrf({
  getSecret: () => CSRF_SECRET || 'fallback-secret-for-dev-only',
  getSessionIdentifier: (req: Request) => {
    // Use session ID, user ID, or fallback to a fingerprint
    return (req as any).sessionID || (req as any).user?.id || req.ip || 'anonymous';
  },
  cookieName: '__Host-csrf-token', // __Host- prefix requires HTTPS and no domain
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 1000, // 1 hour
  },
  size: 64, // Token size in bytes
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req: Request) => {
    // Check header first (preferred for SPAs)
    const headerToken = req.headers['x-csrf-token'] as string;
    if (headerToken) return headerToken;

    // Fallback to body (for traditional forms)
    const bodyToken = req.body?._csrf;
    if (bodyToken) return bodyToken;

    // Fallback to query parameter (not recommended but supported)
    const queryToken = req.query._csrf as string;
    return queryToken || '';
  },
});

const { doubleCsrfProtection, invalidCsrfTokenError } = csrfConfig;
// generateToken may be named differently in newer versions
const generateToken = (csrfConfig as any).generateToken || (csrfConfig as any).generateCsrfToken;

/**
 * CSRF Protection Middleware
 *
 * Applies double-submit cookie CSRF protection to state-changing requests.
 * Exempt routes (webhooks, SDK endpoints) bypass this check.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip CSRF for exempt routes
  if (isExemptRoute(req.path)) {
    return next();
  }

  // Skip CSRF for non-state-changing methods
  if (!CSRF_PROTECTED_METHODS.includes(req.method)) {
    return next();
  }

  // Skip CSRF if request uses API key authentication (machine-to-machine)
  if (req.headers['x-api-key']) {
    return next();
  }

  // Apply CSRF protection
  doubleCsrfProtection(req, res, (err) => {
    if (err) {
      logger.warn('CSRF validation failed', {
        path: req.path,
        method: req.method,
        requestId: req.requestId,
        error: err.message,
      });

      if (err === invalidCsrfTokenError) {
        return res.status(403).json({
          error: 'CSRF validation failed',
          message: 'Invalid or missing CSRF token',
          code: 'CSRF_TOKEN_INVALID',
        });
      }

      return res.status(403).json({
        error: 'CSRF validation failed',
        message: err.message,
        code: 'CSRF_ERROR',
      });
    }

    next();
  });
}

/**
 * CSRF Token Endpoint Handler
 *
 * Returns a new CSRF token for the client to use in subsequent requests.
 * Should be called before making state-changing requests.
 *
 * @example
 * // Client usage:
 * const { csrfToken } = await fetch('/csrf-token').then(r => r.json());
 * await fetch('/api/data', {
 *   method: 'POST',
 *   headers: { 'X-CSRF-Token': csrfToken },
 *   body: JSON.stringify(data)
 * });
 */
export function csrfTokenHandler(req: Request, res: Response): void {
  try {
    const token = generateToken(req, res);

    res.json({
      csrfToken: token,
      expiresIn: 3600, // 1 hour in seconds
      header: 'X-CSRF-Token', // Header name to use
    });
  } catch (error) {
    logger.error('Failed to generate CSRF token', {
      error: (error as Error).message,
      requestId: req.requestId,
    });

    res.status(500).json({
      error: 'Failed to generate CSRF token',
      message: 'Please try again',
    });
  }
}

/**
 * Generate CSRF token for embedding in templates
 * Useful for server-side rendered pages
 */
export function generateCsrfToken(req: Request, res: Response): string {
  return generateToken(req, res);
}

export default csrfProtection;
