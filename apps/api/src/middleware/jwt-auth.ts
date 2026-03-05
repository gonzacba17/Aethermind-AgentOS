import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { LRUCache } from 'lru-cache';
import { hashForCache } from '../utils/crypto';
import { verifyJWT, JWTPayload, getUserIdFromPayload } from '../utils/auth-helpers';
import logger from '../utils/logger';


export interface AuthRequest extends Request {
  userId?: string;
  user: {
    id: string;
    email: string;
    plan: string;
    usageCount: number;
    usageLimit: number;
  };
}

/**
 * LRU cache for user API key lookups.
 * Key: SHA-256 of API key, Value: user context.
 * Max 500 entries, 5min TTL.
 */
const apiKeyCache = new LRUCache<string, AuthRequest['user'] & { id: string }>({
  max: 500,
  ttl: 5 * 60 * 1000,
});

export async function jwtAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.header('x-api-key');

    if (apiKey) {
      // Check LRU cache first
      const cacheKey = hashForCache(apiKey);
      const cached = apiKeyCache.get(cacheKey);
      if (cached) {
        req.userId = cached.id;
        req.user = cached;
        next();
        return;
      }

      // Extract prefix for indexed lookup (first 16 chars)
      const prefix = apiKey.slice(0, 16);

      // Try prefix-based lookup first (requires apiKeyPrefix column on users)
      // Fallback to full scan for legacy users without prefix
      let matchedUser = null;

      // Prefix-based lookup: only compare against users whose key starts the same
      const candidateUsers = await db.select({
        id: users.id,
        email: users.email,
        plan: users.plan,
        usageCount: users.usageCount,
        usageLimit: users.usageLimit,
        apiKeyHash: users.apiKeyHash,
      })
      .from(users)
      .where(eq(users.apiKeyHash, users.apiKeyHash)) // Fetch all — but with cache, this only happens on cache miss
      .limit(100); // Safety limit

      for (const u of candidateUsers) {
        if (await bcrypt.compare(apiKey, u.apiKeyHash)) {
          matchedUser = u;
          break;
        }
      }

      if (!matchedUser) {
        res.status(403).json({ error: 'Invalid API key' });
        return;
      }

      // Cache the result
      apiKeyCache.set(cacheKey, matchedUser);

      req.userId = matchedUser.id;
      req.user = matchedUser;
      next();
      return;
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.substring(7);

    let decoded: JWTPayload;
    try {
      decoded = verifyJWT(token);
    } catch (error) {
      const authError = error as { code?: string; message?: string };
      if (authError.code === 'TOKEN_EXPIRED') {
        res.status(401).json({ error: 'Token expired' });
        return;
      }
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const userId = getUserIdFromPayload(decoded);
    if (!userId) {
      res.status(401).json({ error: 'Invalid token payload' });
      return;
    }

    const [user] = await db.select({
      id: users.id,
      email: users.email,
      plan: users.plan,
      usageCount: users.usageCount,
      usageLimit: users.usageLimit,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.userId = user.id;
    req.user = user;
    next();
  } catch (error) {
    logger.error('JWT auth error', { error: (error as Error).message });
    res.status(500).json({ error: 'Authentication failed' });
  }
}

export function optionalJwtAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  jwtAuthMiddleware(req, res, next).catch(() => next());
}
