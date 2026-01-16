import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { organizations } from '../db/schema';
import bcrypt from 'bcryptjs';

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
 * API Key authentication middleware for ingestion endpoint
 * 
 * Validates API key from X-API-Key header and loads organization context
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

    // Find organization by API key hash
    const orgs = await db.select({
      id: organizations.id,
      name: organizations.name,
      apiKeyHash: organizations.apiKeyHash,
      plan: organizations.plan,
      rateLimitPerMin: organizations.rateLimitPerMin,
    })
    .from(organizations);

    let matchedOrg = null;
    for (const org of orgs) {
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
 * Cache for API key lookups to improve performance
 * In production, use Redis for distributed caching
 */
const apiKeyCache = new Map<string, {
  organizationId: string;
  organization: {
    id: string;
    name: string;
    plan: string;
    rateLimitPerMin: number;
  };
  expiresAt: number;
}>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Optimized API key auth with caching
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

    // Check cache first
    const cached = apiKeyCache.get(apiKey);
    if (cached && cached.expiresAt > Date.now()) {
      req.organizationId = cached.organizationId;
      req.organization = cached.organization;
      next();
      return;
    }

    // Cache miss - validate via database
    await apiKeyAuth(req, res, () => {
      // Cache the result
      if (req.organizationId && req.organization) {
        apiKeyCache.set(apiKey, {
          organizationId: req.organizationId,
          organization: req.organization,
          expiresAt: Date.now() + CACHE_TTL,
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
