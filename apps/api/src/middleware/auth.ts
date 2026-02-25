/**
 * Global auth middleware — mounted at app.use("/api", authMiddleware) in index.ts.
 *
 * AUDIT: Routes using this middleware (applied globally to /api/*):
 *   All routes under /api/* (agents, executions, logs, traces, costs, workflows, budgets,
 *   onboarding, stripe, user-api-keys, organizations, optimization, forecasting)
 *   EXCEPT: /auth/* and /v1/* which are mounted BEFORE this middleware.
 *
 * See also: middleware/jwt-auth.ts — per-route middleware used by:
 *   - routes/organizations.ts
 *   - routes/agents.ts
 * jwt-auth.ts loads fresh user data from DB and exports AuthRequest type.
 * This middleware (auth.ts) only decodes the JWT without DB lookup.
 * They have DISTINCT responsibilities and both should be kept.
 */

import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { RedisService } from '../services/RedisService.js';
import logger from '../utils/logger';
import { verifyJWT } from '../utils/auth-helpers';

const API_KEY_HEADER = 'x-api-key';
const AUTH_CACHE_TTL = 300;
const AUTH_COOKIE_NAME = 'auth_token';

export interface AuthConfig {
  apiKeyHash?: string;
  enabled?: boolean;
  cache?: RedisService;
}

let authConfig: AuthConfig = {
  apiKeyHash: undefined,
  enabled: true,
  cache: undefined,
};

export function configureAuth(config: AuthConfig): void {
  authConfig = { ...authConfig, ...config };
}

/**
 * Combined auth middleware that:
 * - Allows public routes (/health, /auth/*)
 * - Validates JWT for regular API routes (/api/agents, /api/costs, etc.)
 * - Validates API Key only for admin routes (/api/admin/*)
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Allow disabling auth for development ONLY — never in production
  if (process.env.DISABLE_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    next();
    return;
  }

  // Public routes - no auth required
  // Use originalUrl to catch full path including /api prefix
  const url = req.originalUrl || req.url;
  
  // Debug logging for auth routes
  if (url.includes('/auth/')) {
    logger.debug('Auth middleware processing auth route', {
      url,
      path: req.path,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
      method: req.method,
    });
  }
  
  const publicRoutes = ['/health', '/metrics'];
  const publicPathPrefixes = ['/api/auth/', '/auth/'];
  
  if (publicRoutes.includes(req.path) || 
      publicPathPrefixes.some(prefix => url.startsWith(prefix))) {
    logger.debug('Allowing public route', { url });
    next();
    return;
  }

  // Admin routes - require API key
  if (url.startsWith('/api/admin/') || req.path.startsWith('/admin/')) {
    await validateApiKey(req, res, next);
    return;
  }

  // All other /api routes - require JWT
  await validateJWT(req, res, next);
}

/**
 * JWT validation middleware for regular API routes
 * Reads token from httpOnly cookie (preferred) or Authorization header (fallback for API clients)
 */
async function validateJWT(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Try to get token from httpOnly cookie first (more secure for web clients)
  // Then fall back to Authorization header (for API clients/mobile apps)
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  const authHeader = req.headers.authorization;
  const headerToken = authHeader?.replace('Bearer ', '');
  const token = cookieToken || headerToken;

  if (!token) {
    logger.warn('JWT authentication failed: token missing', {
      reason: 'missing_jwt',
      ip: req.ip,
      path: req.path,
      hasCookie: !!req.cookies,
      hasAuthHeader: !!authHeader,
    });
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing authentication token. Please login.',
    });
    return;
  }

  try {
    // Use centralized verifyJWT which reads JWT_SECRET through the validated secrets.ts getter
    // All JWT_SECRET access MUST go through auth-helpers → secrets.ts (never process.env directly)
    const decoded = verifyJWT(token);
    
    // Attach user info to request
    // NOTE: usageCount/usageLimit are NOT in the JWT anymore (they became stale).
    // The usage-limiter middleware reads fresh values from the DB.
    req.user = {
      id: decoded.userId || decoded.id || '',
      email: decoded.email,
      plan: decoded.plan || 'free',
      usageCount: 0,   // Placeholder — fresh value loaded by usage-limiter
      usageLimit: 100,  // Placeholder — fresh value loaded by usage-limiter
    };
    
    next();
  } catch (error) {
    logger.warn('JWT authentication failed: invalid token', {
      reason: 'invalid_jwt',
      ip: req.ip,
      path: req.path,
      error: (error as Error).message,
    });
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or expired authentication token.',
    });
  }
}

/**
 * API Key validation middleware for admin routes
 */
async function validateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!authConfig.enabled) {
    next();
    return;
  }

  if (!authConfig.apiKeyHash) {
    logger.warn('API_KEY_HASH not configured - admin routes disabled');
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Admin authentication not configured.',
    });
    return;
  }

  const apiKey = req.header(API_KEY_HEADER);

  if (!apiKey) {
    logger.warn('API Key authentication failed: key missing', {
      reason: 'missing_api_key',
      ip: req.ip,
      path: req.path,
    });
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing API key. Include X-API-Key header.',
    });
    return;
  }

  try {
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const cacheKey = `auth:${keyHash}`;

    if (authConfig.cache) {
      const cached = await authConfig.cache.get(cacheKey);
      if (cached === '1') {
        next();
        return;
      }
    }

    const isValid = await bcrypt.compare(apiKey, authConfig.apiKeyHash);

    if (!isValid) {
      logger.warn('API Key authentication failed: invalid key', {
        reason: 'invalid_api_key',
        ip: req.ip,
        path: req.path,
      });
      res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid API key.',
      });
      return;
    }

    if (authConfig.cache) {
      await authConfig.cache.set(cacheKey, '1', AUTH_CACHE_TTL);
    }

    next();
  } catch (error) {
    logger.error('API Key authentication error', {
      reason: 'auth_error',
      ip: req.ip,
      path: req.path,
      error: (error as Error).message,
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed.',
    });
  }
}



export async function verifyApiKey(apiKey: string | undefined): Promise<boolean> {
  if (!authConfig.enabled) {
    return true;
  }

  if (!authConfig.apiKeyHash) {
    logger.warn('API_KEY_HASH not configured - rejecting authentication (deny by default)');
    return false;
  }

  if (!apiKey) {
    return false;
  }

  try {
    return await bcrypt.compare(apiKey, authConfig.apiKeyHash);
  } catch (error) {
    logger.error('verifyApiKey error', { error });
    return false;
  }
}
