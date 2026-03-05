import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { clients, organizations } from '../db/schema.js';
import { eq, and, isNotNull } from 'drizzle-orm';
import { LRUCache } from 'lru-cache';
import { hashForCache } from '../utils/crypto.js';
import { apiKeyAuthCached, type AuthenticatedRequest } from './apiKeyAuth.js';

/**
 * Cached auth context for ingestion keys
 */
interface IngestionAuthContext {
  organizationId: string;
  organization: {
    id: string;
    name: string;
    plan: string;
    rateLimitPerMin: number;
  };
}

/**
 * LRU cache for SDK key lookups.
 * Key: SHA-256 of API key, Value: organization context.
 * Max 1000 entries, 5min TTL.
 */
const sdkKeyCache = new LRUCache<string, IngestionAuthContext>({
  max: 1000,
  ttl: 5 * 60 * 1000,
});

/**
 * Unified ingestion auth middleware.
 *
 * Detects key format from X-API-Key header:
 * - `aether_sdk_*` → SDK client key → lookup in clients.sdkApiKey
 * - `aether_*`     → Org key → delegate to existing apiKeyAuthCached
 *
 * Both paths set req.organizationId and req.organization.
 */
export async function ingestionAuth(
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

    // SDK client keys use the `aether_sdk_` prefix
    if (apiKey.startsWith('aether_sdk_')) {
      await handleSdkKey(apiKey, req, res, next);
    } else if (apiKey.startsWith('aether_')) {
      // Delegate to existing org-key auth
      await apiKeyAuthCached(req, res, next);
    } else {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key format',
      });
    }
  } catch (error) {
    console.error('[Ingestion Auth] Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed',
    });
  }
}

/**
 * Resolve an SDK client key to an organization context.
 *
 * Strategy:
 * 1. Check LRU cache (keyed by SHA-256 of the API key)
 * 2. If the client has sdkApiKeyHash: prefix lookup → bcrypt compare (secure)
 * 3. Fallback: plaintext lookup for legacy clients without hash (migration compat)
 */
async function handleSdkKey(
  apiKey: string,
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const cacheKey = hashForCache(apiKey);

  // Check cache
  const cached = sdkKeyCache.get(cacheKey);
  if (cached) {
    req.organizationId = cached.organizationId;
    req.organization = cached.organization;
    next();
    return;
  }

  // Extract prefix for indexed lookup (first 20 chars)
  const prefix = apiKey.slice(0, 20);

  // Try secure path first: prefix match → bcrypt compare
  let row: { clientId: string; organizationId: string | null; rateLimitPerMin: number; sdkApiKeyHash: string | null } | undefined;

  const hashedRows = await db
    .select({
      clientId: clients.id,
      organizationId: clients.organizationId,
      rateLimitPerMin: clients.rateLimitPerMin,
      sdkApiKeyHash: clients.sdkApiKeyHash,
    })
    .from(clients)
    .where(and(
      eq(clients.sdkApiKeyPrefix, prefix),
      eq(clients.isActive, true),
      isNotNull(clients.sdkApiKeyHash),
    ));

  for (const candidate of hashedRows) {
    if (candidate.sdkApiKeyHash && await bcrypt.compare(apiKey, candidate.sdkApiKeyHash)) {
      row = candidate;
      break;
    }
  }

  // Fallback: plaintext lookup for legacy clients that haven't been migrated
  if (!row) {
    const legacyRows = await db
      .select({
        clientId: clients.id,
        organizationId: clients.organizationId,
        rateLimitPerMin: clients.rateLimitPerMin,
        sdkApiKeyHash: clients.sdkApiKeyHash,
      })
      .from(clients)
      .where(and(eq(clients.sdkApiKey, apiKey), eq(clients.isActive, true)));

    row = legacyRows[0];
  }

  if (!row) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or inactive SDK key',
    });
    return;
  }

  if (!row.organizationId) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'SDK key is not linked to an organization',
    });
    return;
  }

  // Load the linked organization
  const orgRows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      plan: organizations.plan,
      rateLimitPerMin: organizations.rateLimitPerMin,
    })
    .from(organizations)
    .where(eq(organizations.id, row.organizationId));

  const org = orgRows[0];
  if (!org) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Linked organization not found',
    });
    return;
  }

  // Use the client-level rate limit if set, otherwise fall back to org
  const rateLimitPerMin = row.rateLimitPerMin || org.rateLimitPerMin;

  const authContext: IngestionAuthContext = {
    organizationId: org.id,
    organization: {
      id: org.id,
      name: org.name,
      plan: org.plan,
      rateLimitPerMin,
    },
  };

  // Cache the result
  sdkKeyCache.set(cacheKey, authContext);

  req.organizationId = authContext.organizationId;
  req.organization = authContext.organization;
  next();
}
