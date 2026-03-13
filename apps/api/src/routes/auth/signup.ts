/**
 * Auth routes — signup + email verification
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import rateLimit from 'express-rate-limit';
import { db } from '../../db';
import { users, organizations, clients } from '../../db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { emailService } from '../../services/EmailService';
import logger from '../../utils/logger';
import {
  AUTH_RATE_LIMIT_WINDOW_MS,
  AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  EMAIL_VERIFY_RATE_LIMIT_WINDOW_MS,
  EMAIL_VERIFY_RATE_LIMIT_MAX_ATTEMPTS,
  JWT_EXPIRES_IN,
  PASSWORD_MIN_LENGTH,
  EMAIL_VERIFICATION_TTL_MS,
} from '../../config/constants';
import { getJWTSecret } from '../../utils/auth-helpers';

const router = Router();
const JWT_SECRET = getJWTSecret();

const authLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

const emailVerifyLimiter = rateLimit({
  windowMs: EMAIL_VERIFY_RATE_LIMIT_WINDOW_MS,
  max: EMAIL_VERIFY_RATE_LIMIT_MAX_ATTEMPTS,
  message: 'Too many verification attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

interface SignupBody {
  email: string;
  password: string;
}

router.post('/signup', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as SignupBody;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` });
    }

    const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const apiKeyPlaintext = `aethermind_${randomBytes(32).toString('hex')}`;
    const apiKeyHash = await bcrypt.hash(apiKeyPlaintext, 10);
    const verificationToken = randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

    const userId = `user_${randomBytes(16).toString('hex')}`;

    // Pre-generate all tokens before the transaction
    const orgSlug = `org_${randomBytes(8).toString('hex')}`;
    const orgApiKeyPlaintext = `aether_org_${randomBytes(32).toString('hex')}`;
    const orgApiKeyHash = await bcrypt.hash(orgApiKeyPlaintext, 10);
    const orgApiKeyPrefix = orgApiKeyPlaintext.slice(0, 16);
    const clientAccessToken = `ct_${randomBytes(32).toString('hex')}`;
    const sdkApiKey = `aether_sdk_${randomBytes(24).toString('hex')}`;
    // Token expires in 30 days (rotatable via dashboard)
    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Single transaction: user + org + client — all or nothing
    const result = await db.transaction(async (tx) => {
      // 1. Create organization first (we need its id)
      const [org] = await tx.insert(organizations).values({
        name: email,
        slug: orgSlug,
        apiKeyHash: orgApiKeyHash,
        apiKeyPrefix: orgApiKeyPrefix,
      }).returning();

      if (!org) throw new Error('Failed to create organization');

      // 2. Create user linked to organization
      const [user] = await tx.insert(users).values({
        id: userId,
        email,
        passwordHash,
        apiKeyHash,
        verificationToken,
        verificationExpiry,
        plan: 'free',
        usageLimit: 100,
        usageCount: 0,
        hasCompletedOnboarding: false,
        onboardingStep: 'welcome',
        subscriptionStatus: 'free',
        maxAgents: 3,
        logRetentionDays: 30,
        lastLoginAt: new Date(),
        organizationId: org.id,
      }).returning();

      if (!user) throw new Error('Failed to create user');

      // 3. Create client linked to same organization
      const [client] = await tx.insert(clients).values({
        companyName: email,
        accessToken: clientAccessToken,
        sdkApiKey,
        organizationId: org.id,
        isActive: true,
        tokenExpiresAt,
      }).returning();

      if (!client) throw new Error('Failed to create client');

      return { user, org, client };
    });

    // Send verification email (non-blocking, outside transaction)
    emailService.sendVerificationEmail(email, verificationToken).catch((error) => {
      logger.error('Failed to send verification email', { error: (error as Error).message });
    });

    const token = jwt.sign({ userId: result.user.id, email: result.user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    res.status(201).json({
      token,
      apiKey: apiKeyPlaintext,
      apiKeyShownOnce: true,
      clientAccessToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        plan: result.user.plan,
        emailVerified: result.user.emailVerified,
        hasCompletedOnboarding: result.user.hasCompletedOnboarding,
      },
    });
  } catch (error) {
    logger.error('Signup error', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SECURITY: Rate limited to prevent brute force attacks on verification tokens
router.post('/verify-email', emailVerifyLimiter, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    const [user] = await db.select()
      .from(users)
      .where(and(
        eq(users.verificationToken, token),
        gte(users.verificationExpiry, new Date())
      ))
      .limit(1);

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    await db.update(users)
      .set({
        emailVerified: true,
        verificationToken: null,
        verificationExpiry: null,
      })
      .where(eq(users.id, user.id));

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    logger.error('Verify email error', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/resend-verification', emailVerifyLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    // Always return success to prevent email enumeration
    if (!user || user.emailVerified) {
      return res.json({ success: true, message: 'If that email exists, a verification link has been sent.' });
    }

    // Generate new token
    const verificationToken = randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

    await db.update(users)
      .set({ verificationToken, verificationExpiry })
      .where(eq(users.id, user.id));

    // Send email (non-blocking)
    emailService.sendVerificationEmail(email, verificationToken).catch((error) => {
      logger.error('Failed to resend verification email', { error: (error as Error).message });
    });

    res.json({ success: true, message: 'If that email exists, a verification link has been sent.' });
  } catch (error) {
    logger.error('Resend verification error', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
