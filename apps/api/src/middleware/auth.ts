import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { RedisCache } from '../services/RedisCache.js';

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
  // Public routes - no auth required
  const publicRoutes = ['/health', '/metrics'];
  const publicPathPrefixes = ['/auth/'];
  
  if (publicRoutes.includes(req.path) || 
      publicPathPrefixes.some(prefix => req.path.startsWith(prefix))) {
    next();
    return;
  }

  // Admin routes - require API key
  if (req.path.startsWith('/admin/')) {
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
    console.warn('auth_failure', {
      reason: 'missing_jwt',
      ip: req.ip,
      path: req.path,
      timestamp: new Date().toISOString(),
    });
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing authentication token. Please login.',
    });
    return;
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production-min-32-chars';
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
    console.warn('auth_failure', {
      reason: 'invalid_jwt',
      ip: req.ip,
      path: req.path,
      error: (error as Error).message,
      timestamp: new Date().toISOString(),
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
    console.warn('API_KEY_HASH not configured - admin routes disabled');
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Admin authentication not configured.',
    });
    return;
  }

  const apiKey = req.header(API_KEY_HEADER);

  if (!apiKey) {
    console.warn('auth_failure', {
      reason: 'missing_api_key',
      ip: req.ip,
      path: req.path,
      timestamp: new Date().toISOString(),
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
      console.warn('auth_failure', {
        reason: 'invalid_api_key',
        ip: req.ip,
        path: req.path,
        timestamp: new Date().toISOString(),
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
    console.error('auth_failure', {
      reason: 'auth_error',
      ip: req.ip,
      path: req.path,
      error: (error as Error).message,
      timestamp: new Date().toISOString(),
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
    console.warn('API_KEY_HASH not configured - authentication disabled');
    return true;
  }

  if (!apiKey) {
    return false;
  }

  try {
    return await bcrypt.compare(apiKey, authConfig.apiKeyHash);
  } catch (error) {
    console.error('verifyApiKey error:', error);
    return false;
  }
}
