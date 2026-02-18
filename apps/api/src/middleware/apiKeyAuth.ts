import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { organizations } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { LRUCache } from 'lru-cache';

/**
 * Extended request with organization context
 */
export interface AuthenticatedRequest extends Request {
  organizationId?: string;
  organization?: {
    id: string;
    name: string;
    plan: string;
    rateLimitPerMin: number;
  };
}

/**
 * Extract prefix from an API key for indexed lookup.
 * API keys follow the format "aether_XXXXXXXX..."
 * We use the first 8 characters after the prefix as the lookup key.
 */
function extractKeyPrefix(apiKey: string): string {
  // Remove "aether_" prefix, take first 8 chars
  const withoutPrefix = apiKey.replace(/^aether_/, '');
  return withoutPrefix.substring(0, 8);
}

/**
 * Hash an API key for use as a cache key (never store plaintext).
 */
function hashForCache(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * API Key authentication middleware for ingestion endpoint
 * 
 * Validates API key from X-API-Key header and loads organization context.
 * Uses indexed prefix lookup (O(1)) instead of full table scan.
 * 
 * @example
 * router.post('/v1/ingest', apiKeyAuth, handler);
 */
export async function apiKeyAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract API key from header
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing X-API-Key header',
      });
      return;
    }

    // Validate API key format
    if (!apiKey.startsWith('aether_')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key format',
      });
      return;
    }

    // Extract prefix for indexed lookup
    const prefix = extractKeyPrefix(apiKey);

    // Find organization by prefix (indexed, O(1) lookup)
    const candidates = await db.select({
      id: organizations.id,
      name: organizations.name,
      apiKeyHash: organizations.apiKeyHash,
      plan: organizations.plan,
      rateLimitPerMin: organizations.rateLimitPerMin,
    })
    .from(organizations)
    .where(eq(organizations.apiKeyPrefix, prefix));

    // Bcrypt compare only against matched candidates (typically 1)
    let matchedOrg = null;
    for (const org of candidates) {
      const matches = await bcrypt.compare(apiKey, org.apiKeyHash);
      if (matches) {
        matchedOrg = org;
        break;
      }
    }

    if (!matchedOrg) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key',
      });
      return;
    }

    // Inject organization context into request
    req.organizationId = matchedOrg.id;
    req.organization = {
      id: matchedOrg.id,
      name: matchedOrg.name,
      plan: matchedOrg.plan,
      rateLimitPerMin: matchedOrg.rateLimitPerMin,
    };

    next();
  } catch (error) {
    console.error('[API Key Auth] Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed',
    });
  }
}

/**
 * LRU cache for API key lookups.
 * - Key: SHA-256 hash of the API key (never plaintext)
 * - Value: organization context
 * - Max 1000 entries, 5 minute TTL
 */
const apiKeyCache = new LRUCache<string, {
  organizationId: string;
  organization: {
    id: string;
    name: string;
    plan: string;
    rateLimitPerMin: number;
  };
}>({
  max: 1000,
  ttl: 5 * 60 * 1000, // 5 minutes
});

/**
 * Optimized API key auth with LRU caching.
 * Cache keys are SHA-256 hashes, never plaintext API keys.
 */
export async function apiKeyAuthCached(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing X-API-Key header',
      });
      return;
    }

    // Use hashed key for cache lookup (not plaintext)
    const cacheKey = hashForCache(apiKey);

    // Check cache first
    const cached = apiKeyCache.get(cacheKey);
    if (cached) {
      req.organizationId = cached.organizationId;
      req.organization = cached.organization;
      next();
      return;
    }

    // Cache miss - validate via database
    await apiKeyAuth(req, res, () => {
      // Cache the result using hashed key
      if (req.organizationId && req.organization) {
        apiKeyCache.set(cacheKey, {
          organizationId: req.organizationId,
          organization: req.organization,
        });
      }
      next();
    });
  } catch (error) {
    console.error('[API Key Auth Cached] Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed',
    });
  }
}

// Export for testing
export { extractKeyPrefix, hashForCache, apiKeyCache };
