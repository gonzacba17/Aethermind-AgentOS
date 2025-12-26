import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './apiKeyAuth.js';

/**
 * Rate limit tracking
 * In production, use Redis for distributed rate limiting
 */
const rateLimitStore = new Map<string, {
  count: number;
  resetAt: number;
}>();

/**
 * Rate limiting middleware per organization
 * 
 * Limits based on organization plan:
 * - FREE: 100 events/min
 * - STARTUP: 1000 events/min  
 * - ENTERPRISE: custom (default 10000/min)
 */
export function rateLimiter(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.organization) {
    // Should not happen if auth middleware runs first
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing organization context',
    });
    return;
  }

  const { id: orgId, rateLimitPerMin } = req.organization;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window

  // Get or create rate limit entry
  let entry = rateLimitStore.get(orgId);
  
  if (!entry || entry.resetAt <= now) {
    // New window
    entry = {
      count: 0,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(orgId, entry);
  }

  // Count events in request body
  const eventsCount = req.body?.events?.length || 1;
  entry.count += eventsCount;

  // Check if limit exceeded
  if (entry.count > rateLimitPerMin) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: `You have exceeded your plan's rate limit of ${rateLimitPerMin} events per minute`,
      retryAfter,
    });
    return;
  }

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', rateLimitPerMin);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, rateLimitPerMin - entry.count));
  res.setHeader('X-RateLimit-Reset', entry.resetAt);

  next();
}

/**
 * Cleanup old rate limit entries (run periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);
