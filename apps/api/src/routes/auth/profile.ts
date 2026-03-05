/**
 * Auth routes — profile management (GET /me, PATCH /me, POST /regenerate-api-key)
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { db } from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { StripeService } from '../../services/StripeService';
import { convertTemporaryUser, getTemporaryUser, removeTemporaryUser } from '../../services/OAuthService';
import { emailService } from '../../services/EmailService';
import logger from '../../utils/logger';
import { JWT_EXPIRES_IN, EMAIL_VERIFICATION_TTL_MS } from '../../config/constants';
import {
  getJWTSecret,
  extractTokenFromRequest,
  verifyJWT,
  JWTPayload,
  getUserIdFromPayload,
} from '../../utils/auth-helpers';

const router = Router();
const JWT_SECRET = getJWTSecret();
const stripeService = new StripeService();

/**
 * GET /auth/me
 * Returns current authenticated user information
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      logger.debug('/auth/me rejected: no token found');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing authentication token'
      });
    }

    let decoded: JWTPayload;
    try {
      decoded = verifyJWT(token);
      logger.debug('/auth/me token verified', { userId: getUserIdFromPayload(decoded) });
    } catch (error) {
      logger.debug('/auth/me JWT verification failed', { error: (error as Error).message });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }

    let userId = getUserIdFromPayload(decoded);
    const emailFromToken = decoded.email;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token payload'
      });
    }
    
    // Handle temporary users: attempt auto-conversion with new token
    if (userId.startsWith('temp-') || userId.startsWith('tmp-')) {
      logger.info('Temporary user accessing /auth/me', { userId, email: emailFromToken });
      
      // First, try to find if this user already exists in DB by email
      if (emailFromToken) {
        logger.info('Looking up existing user by email', { email: emailFromToken });
        try {
          const [existingUser] = await db.select()
            .from(users)
            .where(eq(users.email, emailFromToken))
            .limit(1);

          if (existingUser) {
            logger.info('User already exists in DB with this email', { userId: existingUser.id, email: emailFromToken });

            const newToken = jwt.sign(
              {
                userId: existingUser.id,
                id: existingUser.id,
                email: existingUser.email,
                plan: existingUser.plan,
              },
              JWT_SECRET,
              { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
            );

            removeTemporaryUser(userId);

            return res.json({
              id: existingUser.id,
              email: existingUser.email,
              name: existingUser.name,
              plan: existingUser.plan,
              usageCount: existingUser.usageCount,
              usageLimit: existingUser.usageLimit,
              emailVerified: existingUser.emailVerified,
              hasCompletedOnboarding: existingUser.hasCompletedOnboarding,
              isTemporaryUser: false,
              wasConverted: true,
              newToken,
              subscription: {
                status: existingUser.subscriptionStatus || 'free',
                plan: existingUser.plan || 'free',
                isTrialActive: false,
                daysLeftInTrial: 0,
              },
              createdAt: existingUser.createdAt,
            });
          } else {
            logger.info('No existing user found with this email', { email: emailFromToken });
          }
        } catch (dbError: any) {
          logger.error('DB lookup failed', {
            error: dbError.message,
            code: dbError.code,
            detail: dbError.detail,
            email: emailFromToken
          });
        }
      }
      
      // Try to convert using the temporary store data
      const convertedUser = await convertTemporaryUser(userId);
      
      if (convertedUser) {
        logger.info('Temporary user auto-converted during /auth/me', { userId: convertedUser.id });
        
        const newToken = jwt.sign(
          {
            userId: convertedUser.id,
            id: convertedUser.id,
            email: convertedUser.email,
            plan: convertedUser.plan,
          },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
        );
        
        removeTemporaryUser(userId);
        
        return res.json({
          id: convertedUser.id,
          email: convertedUser.email,
          name: convertedUser.name,
          plan: convertedUser.plan,
          usageCount: convertedUser.usageCount,
          usageLimit: convertedUser.usageLimit,
          emailVerified: true,
          hasCompletedOnboarding: false,
          isTemporaryUser: false,
          wasConverted: true,
          newToken,
          subscription: {
            status: 'free',
            plan: convertedUser.plan || 'free',
            isTrialActive: false,
            daysLeftInTrial: 0,
          },
          createdAt: convertedUser.createdAt,
        });
      }
      
      // If not in memory store, try to create user directly from JWT data
      if (emailFromToken) {
        logger.info('Creating new permanent user directly from JWT data', { email: emailFromToken });
        
        try {
          const newUserId = `user_${randomBytes(16).toString('hex')}`;
          const nameFromEmail = emailFromToken.split('@')[0];
          const now = new Date();
          
          // Use onConflictDoUpdate to atomically handle concurrent requests
          // for the same email — prevents duplicate user creation race condition.
          const [upsertedUser] = await db.insert(users)
            .values({
              id: newUserId,
              email: emailFromToken,
              name: decoded.name || nameFromEmail,
              plan: 'free',
              usageLimit: 100,
              usageCount: 0,
              apiKeyHash: await bcrypt.hash(`aethermind_${randomBytes(16).toString('hex')}`, 10),
              emailVerified: true,
              hasCompletedOnboarding: false,
              onboardingStep: 'welcome',
              subscriptionStatus: 'free',
              maxAgents: 3,
              logRetentionDays: 30,
              firstLoginAt: now,
              lastLoginAt: now,
            })
            .onConflictDoUpdate({
              target: users.email,
              set: {
                name: decoded.name || nameFromEmail,
                lastLoginAt: now,
                updatedAt: now,
              },
            })
            .returning();
          
          if (!upsertedUser) {
            throw new Error('Failed to create/upsert user in database');
          }
          
          logger.info('Created or found permanent user from JWT', { userId: upsertedUser.id });
          
          const newToken = jwt.sign(
            {
              userId: upsertedUser.id,
              id: upsertedUser.id,
              email: upsertedUser.email,
              plan: upsertedUser.plan,
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
          );
          
          removeTemporaryUser(userId);
          
          return res.json({
            id: upsertedUser.id,
            email: upsertedUser.email,
            name: upsertedUser.name,
            plan: upsertedUser.plan,
            usageCount: upsertedUser.usageCount,
            usageLimit: upsertedUser.usageLimit,
            emailVerified: upsertedUser.emailVerified ?? true,
            hasCompletedOnboarding: upsertedUser.hasCompletedOnboarding,
            isTemporaryUser: false,
            wasConverted: true,
            newToken,
            subscription: {
              status: upsertedUser.subscriptionStatus || 'free',
              plan: upsertedUser.plan || 'free',
              isTrialActive: false,
              daysLeftInTrial: 0,
            },
            createdAt: upsertedUser.createdAt,
          });
        } catch (createError: any) {
          logger.error('Failed to create permanent user from JWT', {
            error: createError.message,
            code: createError.code,
            detail: createError.detail,
            constraint: createError.constraint,
            email: emailFromToken,
          });
        }
      }
      
      // All conversion attempts failed - return temporary data or force logout
      const tempUserData = getTemporaryUser(userId);
      if (tempUserData) {
        logger.warn('Returning temporary user data - all conversions failed', { userId });
        return res.json({
          id: tempUserData.tempId,
          email: tempUserData.email,
          name: tempUserData.name,
          plan: tempUserData.plan,
          usageCount: tempUserData.usageCount,
          usageLimit: tempUserData.usageLimit,
          emailVerified: true,
          hasCompletedOnboarding: false,
          isTemporaryUser: true,
          wasConverted: false,
          temporaryUserWarning: 'Database issues persist. Please try again later.',
          subscription: {
            status: 'free',
            plan: 'free',
            isTrialActive: false,
            daysLeftInTrial: 0,
          },
          createdAt: tempUserData.createdAt,
        });
      }
      
      // No data anywhere - force re-login
      logger.error('Temporary user not in memory and no email in JWT', { userId });
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Session expired. Please log out and sign in again.',
        code: 'TEMPORARY_USER_NOT_FOUND',
        action: 'FORCE_LOGOUT'
      });
    }
    
    const [user] = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      plan: users.plan,
      apiKeyHash: users.apiKeyHash,
      emailVerified: users.emailVerified,
      usageCount: users.usageCount,
      usageLimit: users.usageLimit,
      stripeCustomerId: users.stripeCustomerId,
      stripeSubscriptionId: users.stripeSubscriptionId,
      createdAt: users.createdAt,
      hasCompletedOnboarding: users.hasCompletedOnboarding,
      onboardingStep: users.onboardingStep,
      trialStartedAt: users.trialStartedAt,
      trialEndsAt: users.trialEndsAt,
      subscriptionStatus: users.subscriptionStatus,
      firstLoginAt: users.firstLoginAt,
      lastLoginAt: users.lastLoginAt,
      maxAgents: users.maxAgents,
      logRetentionDays: users.logRetentionDays,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The user associated with this token does not exist'
      });
    }

    // Sync with Stripe if subscription exists
    let subscriptionStatus = user.subscriptionStatus;
    let currentPeriodEnd: Date | null = null;

    if (user.stripeSubscriptionId && stripeService.isConfigured()) {
      try {
        const stripeSubscription = await stripeService.getSubscription(user.stripeSubscriptionId);
        if (stripeSubscription) {
          if (stripeSubscription.status !== user.subscriptionStatus) {
            const newStatus = stripeSubscription.status === 'active' ? 'active' :
              stripeSubscription.status === 'trialing' ? 'trial' :
              stripeSubscription.status === 'past_due' ? 'past_due' :
              stripeSubscription.status === 'canceled' ? 'cancelled' : 'inactive';
            
            await db.update(users)
              .set({ subscriptionStatus: newStatus })
              .where(eq(users.id, userId));
            subscriptionStatus = newStatus;
          }
          currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
        }
      } catch (error) {
        logger.error('Failed to sync with Stripe', { error: (error as Error).message });
      }
    }

    // Calculate trial status
    const now = new Date();
    const isTrialActive = user.trialStartedAt && user.trialEndsAt && now < user.trialEndsAt;
    const daysLeftInTrial = isTrialActive && user.trialEndsAt 
      ? Math.ceil((user.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const isFirstTimeUser = user.createdAt ? 
      (now.getTime() - new Date(user.createdAt).getTime() < 24 * 60 * 60 * 1000) : false;

    // Update lastLoginAt asynchronously (non-blocking)
    db.update(users)
      .set({ lastLoginAt: now })
      .where(eq(users.id, userId))
      .catch((error) => {
        logger.error('Failed to update lastLoginAt', { error: (error as Error).message });
      });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      emailVerified: user.emailVerified,
      usageCount: user.usageCount,
      usageLimit: user.usageLimit,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      onboardingStep: user.onboardingStep,
      isFirstTimeUser,
      subscription: {
        status: subscriptionStatus,
        plan: user.plan,
        isTrialActive,
        daysLeftInTrial,
        trialEndsAt: user.trialEndsAt,
        currentPeriodEnd,
        stripe_subscription_id: user.stripeSubscriptionId,
        stripe_customer_id: user.stripeCustomerId,
      },
      firstLoginAt: user.firstLoginAt,
      lastLoginAt: user.lastLoginAt,
      maxAgents: user.maxAgents,
      logRetentionDays: user.logRetentionDays,
      createdAt: user.createdAt,
    });
  } catch (error) {
    logger.error('Error fetching user', { error: (error as Error).message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch user'
    });
  }
});

/**
 * PATCH /auth/me — Update user profile
 */
router.patch('/me', async (req: Request, res: Response) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Missing authentication token' });
    }

    let decoded: JWTPayload;
    try {
      decoded = verifyJWT(token);
    } catch {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
    }

    const userId = getUserIdFromPayload(decoded);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token payload' });
    }

    const { name, email, company } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };

    if (name && typeof name === 'string') {
      updates.name = name.trim().slice(0, 255);
    }

    let emailChanged = false;
    if (email && typeof email === 'string' && email !== decoded.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase()));
      if (existing) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      updates.email = email.toLowerCase().trim();
      updates.emailVerified = false;
      emailChanged = true;
    }

    const [updatedUser] = await db.update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        plan: users.plan,
        emailVerified: users.emailVerified,
      });

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (emailChanged) {
      try {
        const verificationToken = randomBytes(32).toString('hex');
        await db.update(users).set({
          verificationToken,
          verificationExpiry: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
        }).where(eq(users.id, userId));
        await emailService.sendVerificationEmail(updates.email, verificationToken);
      } catch (emailError) {
        logger.warn('Failed to send verification email after profile update', { error: (emailError as Error).message });
      }
    }

    logger.debug('Profile updated', { userId, emailChanged });

    res.json({
      success: true,
      user: updatedUser,
      emailChanged,
    });
  } catch (error) {
    logger.error('Failed to update profile', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * POST /regenerate-api-key — Generate new API key
 * Returns plaintext ONCE. Stores bcrypt hash.
 */
router.post('/regenerate-api-key', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.auth_token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Missing authentication token' });
    }

    let decoded: JWTPayload;
    try {
      decoded = verifyJWT(token);
    } catch {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
    }

    const userId = getUserIdFromPayload(decoded);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token payload' });
    }

    const apiKeyPlaintext = `aethermind_${randomBytes(32).toString('hex')}`;
    const apiKeyHash = await bcrypt.hash(apiKeyPlaintext, 10);

    const [updatedUser] = await db.update(users)
      .set({ apiKeyHash })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
      });

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info('API key regenerated', { userId });

    res.json({
      apiKey: apiKeyPlaintext,
      apiKeyShownOnce: true,
      message: 'New API key generated. Save it now — it will not be shown again.',
    });
  } catch (error) {
    logger.error('Failed to regenerate API key', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to regenerate API key' });
  }
});

export default router;
