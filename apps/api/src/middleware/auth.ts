import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { RedisCache } from '../services/RedisCache.js';
import logger from '../utils/logger';

const API_KEY_HEADER = 'x-api-key';
const AUTH_CACHE_TTL = 300;

export interface AuthConfig {
  apiKeyHash?: string;
  enabled?: boolean;
  cache?: RedisCache;
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
  // Security: DISABLE_API_AUTH removed for production safety
  // Authentication is now always required

  // Public routes - no auth required
  // Use originalUrl to catch full path including /api prefix
  const url = req.originalUrl || req.url;
  
  // Debug logging for OAuth routes
  if (url.includes('/auth/')) {
    logger.debug('Auth middleware processing OAuth route', {
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
 */
async function validateJWT(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    logger.warn('JWT authentication failed: token missing', {
      reason: 'missing_jwt',
      ip: req.ip,
      path: req.path,
    });
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing authentication token. Please login.',
    });
    return;
  }

  try {
    // Enforce JWT_SECRET requirement
    const JWT_SECRET = (() => {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error(
          'JWT_SECRET environment variable is required. Generate with: openssl rand -base64 32'
        );
      }
      if (secret.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters long');
      }
      return secret;
    })();
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Attach user info to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      plan: decoded.plan || 'free',
      usageCount: decoded.usageCount || 0,
      usageLimit: decoded.usageLimit || 100,
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

export function skipAuth(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

export async function verifyApiKey(apiKey: string | undefined): Promise<boolean> {
  if (!authConfig.enabled) {
    return true;
  }

  if (!authConfig.apiKeyHash) {
    logger.warn('API_KEY_HASH not configured - authentication disabled');
    return true;
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
