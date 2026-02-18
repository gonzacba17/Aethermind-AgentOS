/**
 * Auth routes — forgot password + reset password
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import rateLimit from 'express-rate-limit';
import { db } from '../../db';
import { users } from '../../db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { emailService } from '../../services/EmailService';
import logger from '../../utils/logger';
import {
  AUTH_RATE_LIMIT_WINDOW_MS,
  AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  PASSWORD_MIN_LENGTH,
} from '../../config/constants';

const router = Router();

const authLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

interface ResetRequestBody {
  email: string;
}

interface ResetPasswordBody {
  token: string;
  password: string;
}

router.post('/forgot-password', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body as ResetRequestBody;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ success: true, message: 'If that email exists, a reset link was sent' });
    }

    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.update(users)
      .set({
        resetToken,
        resetTokenExpiry,
      })
      .where(eq(users.id, user.id));

    // Send password reset email (non-blocking)
    emailService.sendPasswordResetEmail(user.email, resetToken).catch((error) => {
      logger.error('Failed to send password reset email', { error: (error as Error).message });
    });

    res.json({ success: true, message: 'If that email exists, a reset link was sent' });
  } catch (error) {
    logger.error('Password reset request error', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Legacy endpoint for backward compatibility
router.post('/reset-request', authLimiter, async (req: Request, res: Response) => {
  // Forward to forgot-password
  return router.stack.find(layer => layer.route?.path === '/forgot-password')?.handle(req, res, () => {});
});

router.post('/reset-password', authLimiter, async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body as ResetPasswordBody;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password required' });
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` });
    }

    const [user] = await db.select()
      .from(users)
      .where(and(
        eq(users.resetToken, token),
        gte(users.resetTokenExpiry, new Date())
      ))
      .limit(1);

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.update(users)
      .set({
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      })
      .where(eq(users.id, user.id));

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Password reset error', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
