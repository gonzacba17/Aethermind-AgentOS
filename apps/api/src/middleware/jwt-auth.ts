import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
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
      const user = await prisma.user.findUnique({
        where: { apiKey },
        select: {
          id: true,
          email: true,
          plan: true,
          usageCount: true,
          usageLimit: true,
        },
      });

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

    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        plan: true,
        usageCount: true,
        usageLimit: true,
      },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.userId = user.id;
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    console.error('JWT auth error:', error);
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
