import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production-min-32-chars';

/**
 * Middleware: Require Email Verified
 * 
 * Ensures the authenticated user has verified their email address.
 * Returns 403 Forbidden if email is not verified.
 * 
 * Usage:
 *   router.post('/sensitive-endpoint', authMiddleware, requireEmailVerified, handler);
 *   router.post('/stripe/checkout', authMiddleware, requireEmailVerified, createCheckout);
 */
export async function requireEmailVerified(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing authentication token',
      });
      return;
    }

    // Verify JWT token
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
      return;
    }

    const userId = decoded.userId || decoded.id;

    // Get user from database
    const [user] = await db.select({
      emailVerified: users.emailVerified,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

    if (!user) {
      res.status(404).json({
        error: 'User not found',
      });
      return;
    }

    // Check if email is verified
    if (!user.emailVerified) {
      res.status(403).json({
        error: 'Email verification required',
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email address to access this feature',
        email: user.email,
      });
      return;
    }

    // Email is verified, proceed to next middleware
    next();
  } catch (error) {
    console.error('Email verification check error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
}

export default requireEmailVerified;
