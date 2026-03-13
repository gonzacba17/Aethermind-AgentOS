import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { clients } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { LRUCache } from 'lru-cache';
import { hashForCache } from '../utils/crypto';

/**
 * Client data attached to authenticated requests.
 */
export interface ClientData {
  id: string;
  companyName: string;
  sdkApiKey: string;
  organizationId: string | null;
  rateLimitPerMin: number;
}

/**
 * Extended request with client context.
 */
export interface ClientAuthenticatedRequest extends Request {
  client?: ClientData;
}



/**
 * LRU cache for client token lookups.
 * - Key: SHA-256 hash of the access token (never plaintext)
 * - Value: client context
 * - Max 1000 entries, 2 minute TTL
 */
const clientCache = new LRUCache<string, ClientData>({
  max: 1000,
  ttl: 2 * 60 * 1000, // 2 minutes (reduced from 5 for faster revocation)
});

/**
 * Invalidate a cached client token (call on logout/rotation).
 * Accepts the plaintext token to compute the cache key.
 */
export function invalidateClientCache(token: string): void {
  const cacheKey = hashForCache(token);
  clientCache.delete(cacheKey);
}

/**
 * Client authentication middleware for B2B beta.
 *
 * Token resolution order:
 *   1. `X-Client-Token` header (primary)
 *   2. `?token=` query param
 *   3. `Authorization: Bearer <token>` — allows tools like Claude Code that
 *      can only set ANTHROPIC_API_KEY (mapped to Authorization header) to
 *      authenticate as an Aethermind client.
 *
 * Claude Code configuration:
 *   ANTHROPIC_BASE_URL=https://aethermind-agentos-production.up.railway.app/gateway/v1
 *   ANTHROPIC_API_KEY=<Aethermind access_token (ct_...)>
 *
 * Uses prefix-indexed lookup + bcrypt verify (same pattern as org API keys).
 * Falls back to plaintext lookup for tokens not yet backfilled with hashes.
 * Uses LRU cache (SHA-256 keyed) to avoid hitting DB on every request.
 */
export async function clientAuth(
  req: ClientAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token: X-Client-Token > ?token= > Authorization: Bearer
    let token =
      (req.headers['x-client-token'] as string) ||
      (req.query.token as string);

    if (!token) {
      // Fall back to Authorization: Bearer for clients like Claude Code
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      }
    }

    if (!token) {
      res.status(401).json({ error: 'Invalid or expired access token' });
      return;
    }

    // Check cache first (hashed key)
    const cacheKey = hashForCache(token);
    const cached = clientCache.get(cacheKey);
    if (cached) {
      req.client = cached;
      next();
      return;
    }

    // Cache miss — try prefix-indexed lookup + bcrypt verify first
    const prefix = token.slice(0, 16);
    const candidates = await db
      .select({
        id: clients.id,
        companyName: clients.companyName,
        sdkApiKey: clients.sdkApiKey,
        organizationId: clients.organizationId,
        rateLimitPerMin: clients.rateLimitPerMin,
        tokenExpiresAt: clients.tokenExpiresAt,
        accessTokenHash: clients.accessTokenHash,
      })
      .from(clients)
      .where(and(eq(clients.accessTokenPrefix, prefix), eq(clients.isActive, true)));

    let row: typeof candidates[0] | undefined;

    for (const candidate of candidates) {
      if (candidate.accessTokenHash && await bcrypt.compare(token, candidate.accessTokenHash)) {
        row = candidate;
        break;
      }
    }

    // Fallback: plaintext lookup for tokens not yet backfilled
    if (!row) {
      const fallbackRows = await db
        .select({
          id: clients.id,
          companyName: clients.companyName,
          sdkApiKey: clients.sdkApiKey,
          organizationId: clients.organizationId,
          rateLimitPerMin: clients.rateLimitPerMin,
          tokenExpiresAt: clients.tokenExpiresAt,
          accessTokenHash: clients.accessTokenHash,
        })
        .from(clients)
        .where(and(eq(clients.accessToken, token), eq(clients.isActive, true)));

      row = fallbackRows[0];
    }

    if (!row) {
      res.status(401).json({ error: 'Invalid or expired access token' });
      return;
    }

    // Check token expiration (null = legacy token, no expiry)
    if (row.tokenExpiresAt && new Date(row.tokenExpiresAt) < new Date()) {
      res.status(401).json({ error: 'Access token has expired. Please log in again.' });
      return;
    }

    const clientData: ClientData = {
      id: row.id,
      companyName: row.companyName,
      sdkApiKey: row.sdkApiKey,
      organizationId: row.organizationId,
      rateLimitPerMin: row.rateLimitPerMin,
    };

    // Store in cache
    clientCache.set(cacheKey, clientData);

    req.client = clientData;
    next();
  } catch (error) {
    console.error('[Client Auth] Error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}
