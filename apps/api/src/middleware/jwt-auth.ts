import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
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

export async function jwtAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.header('x-api-key');

    if (apiKey) {
      const [user] = await db.select({
        id: users.id,
        email: users.email,
        plan: users.plan,
        usageCount: users.usageCount,
        usageLimit: users.usageLimit,
      })
      .from(users)
      .where(eq(users.apiKey, apiKey))
      .limit(1);

      if (!user) {
        res.status(403).json({ error: 'Invalid API key' });
        return;
      }

      req.userId = user.id;
      req.user = user;
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
