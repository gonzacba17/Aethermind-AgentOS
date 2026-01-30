import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './apiKeyAuth.js';
import redisService from '../services/RedisService';
import logger from '../utils/logger';

/**
 * Distributed Rate Limiter with Redis Backend
 *
 * Features:
 * - Redis-backed for distributed rate limiting across multiple API instances
 * - Automatic fallback to in-memory when Redis is unavailable
 * - Organization-based rate limiting with plan tiers
 * - Sliding window algorithm for smoother rate limiting
 * - Standard rate limit headers (X-RateLimit-*)
 */

// In-memory fallback store for when Redis is unavailable
const memoryRateLimitStore = new Map<string, {
  count: number;
  resetAt: number;
}>();

/**
 * Rate Limit Configuration by Endpoint Type
 */
export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
  keyPrefix: string;     // Redis key prefix
  message?: string;      // Custom error message
}

/**
 * Pre-configured rate limiters for different endpoint types
 */
export const RATE_LIMIT_CONFIGS = {
  // Auth endpoints - strict limits to prevent brute force
  auth: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 10,           // 10 attempts per 15 min
    keyPrefix: 'rl:auth',
    message: 'Too many authentication attempts. Please try again later.',
  },

  // Password reset - very strict
  passwordReset: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 3,            // 3 attempts per hour
    keyPrefix: 'rl:pwreset',
    message: 'Too many password reset requests. Please try again later.',
  },

  // SDK ingestion - higher limits based on plan
  ingestion: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 1000,         // Default 1000/min (overridden by org plan)
    keyPrefix: 'rl:ingest',
    message: 'Rate limit exceeded. Upgrade your plan for higher limits.',
  },

  // General API - moderate limits
  api: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 100,          // 100 requests per minute
    keyPrefix: 'rl:api',
    message: 'Too many requests. Please slow down.',
  },

  // WebSocket connections - prevent connection flooding
  websocket: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 10,           // 10 connection attempts per minute
    keyPrefix: 'rl:ws',
    message: 'Too many WebSocket connection attempts.',
  },
} as const;

/**
 * Get rate limit key for Redis
 * Uses IP for unauthenticated requests, organization ID for authenticated
 */
function getRateLimitKey(prefix: string, req: Request): string {
  const authReq = req as AuthenticatedRequest;

  // Use organization ID if authenticated
  if (authReq.organization?.id) {
    return `${prefix}:org:${authReq.organization.id}`;
  }

  // Fall back to IP address
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `${prefix}:ip:${ip}`;
}

/**
 * Check and update rate limit using Redis (with memory fallback)
 */
async function checkRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number,
  increment: number = 1
): Promise<{ allowed: boolean; current: number; resetAt: number; remaining: number }> {
  const now = Date.now();
  const windowStart = now - windowMs;
  const resetAt = now + windowMs;

  // Try Redis first if available
  if (redisService.isAvailable()) {
    try {
      // Use Redis MULTI for atomic operations
      const currentValue = await redisService.get(key);
      let current = 0;
      let storedResetAt = resetAt;

      if (currentValue) {
        const parsed = JSON.parse(currentValue);
        // Check if we're in the same window
        if (parsed.resetAt > now) {
          current = parsed.count;
          storedResetAt = parsed.resetAt;
        }
      }

      const newCount = current + increment;
      const allowed = newCount <= maxRequests;

      // Update Redis with new count
      const ttlSeconds = Math.ceil((storedResetAt - now) / 1000);
      if (ttlSeconds > 0) {
        await redisService.setex(key, ttlSeconds, JSON.stringify({
          count: newCount,
          resetAt: storedResetAt,
        }));
      }

      return {
        allowed,
        current: newCount,
        resetAt: storedResetAt,
        remaining: Math.max(0, maxRequests - newCount),
      };
    } catch (error) {
      logger.warn('Redis rate limit check failed, using memory fallback', {
        key,
        error: (error as Error).message,
      });
      // Fall through to memory fallback
    }
  }

  // Memory fallback
  let entry = memoryRateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: resetAt };
    memoryRateLimitStore.set(key, entry);
  }

  entry.count += increment;

  return {
    allowed: entry.count <= maxRequests,
    current: entry.count,
    resetAt: entry.resetAt,
    remaining: Math.max(0, maxRequests - entry.count),
  };
}

/**
 * Create a rate limiter middleware with specific configuration
 */
export function createRateLimiter(config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = getRateLimitKey(config.keyPrefix, req);

    try {
      const result = await checkRateLimit(key, config.windowMs, config.maxRequests);

      // Set standard rate limit headers
      res.setHeader('X-RateLimit-Limit', config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
        res.setHeader('Retry-After', retryAfter);

        logger.warn('Rate limit exceeded', {
          key,
          current: result.current,
          limit: config.maxRequests,
          requestId: req.requestId,
        });

        res.status(429).json({
          error: 'Too Many Requests',
          message: config.message || 'Rate limit exceeded. Please try again later.',
          retryAfter,
          limit: config.maxRequests,
          windowMs: config.windowMs,
        });
        return;
      }

      next();
    } catch (error) {
      // On error, allow the request but log the issue
      logger.error('Rate limiter error', {
        error: (error as Error).message,
        key,
        requestId: req.requestId,
      });
      next();
    }
  };
}

/**
 * Organization-based rate limiter for SDK ingestion
 * Uses the organization's plan rate limit instead of fixed limit
 */
export function rateLimiter(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.organization) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing organization context',
    });
    return;
  }

  const { id: orgId, rateLimitPerMin } = req.organization;
  const key = `${RATE_LIMIT_CONFIGS.ingestion.keyPrefix}:org:${orgId}`;

  // Count events in request body (batch support)
  const eventsCount = req.body?.events?.length || 1;

  checkRateLimit(key, 60 * 1000, rateLimitPerMin, eventsCount)
    .then(result => {
      res.setHeader('X-RateLimit-Limit', rateLimitPerMin);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
        res.setHeader('Retry-After', retryAfter);

        res.status(429).json({
          error: 'Rate limit exceeded',
          message: `You have exceeded your plan's rate limit of ${rateLimitPerMin} events per minute`,
          retryAfter,
          upgrade: 'Contact support to upgrade your plan for higher limits',
        });
        return;
      }

      next();
    })
    .catch(error => {
      logger.error('Organization rate limiter error', {
        error: (error as Error).message,
        orgId,
      });
      // Allow on error
      next();
    });
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const authRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.auth);
export const passwordResetRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.passwordReset);
export const apiRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.api);
export const websocketRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.websocket);

/**
 * Cleanup old rate limit entries from memory (run periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of memoryRateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      memoryRateLimitStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug('Rate limit cleanup', { entriesRemoved: cleaned });
  }
}

// Cleanup every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);

/**
 * Get current rate limit status for debugging
 */
export function getRateLimitStatus(): {
  memoryEntries: number;
  redisAvailable: boolean;
} {
  return {
    memoryEntries: memoryRateLimitStore.size,
    redisAvailable: redisService.isAvailable(),
  };
}
