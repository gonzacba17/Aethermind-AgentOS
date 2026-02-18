/**
 * Auth routes — plan management (update-plan, convert-temp-user)
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { db } from '../../db';
import { users, subscriptionLogs } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { StripeService } from '../../services/StripeService';
import { convertTemporaryUser, getTemporaryUser, removeTemporaryUser } from '../../services/OAuthService';
import logger from '../../utils/logger';
import { JWT_EXPIRES_IN } from '../../config/constants';
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

// Zod validation for plan field
const PlanSchema = z.enum(['free', 'starter', 'pro', 'enterprise']);

/**
 * POST /auth/update-plan
 * Update user's subscription plan
 * CRITICAL ENDPOINT - Required by frontend
 */
router.post('/update-plan', async (req: Request, res: Response) => {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing authentication token'
      });
    }

    let decoded: JWTPayload;
    try {
      decoded = verifyJWT(token);
    } catch (error) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }

    let userId = getUserIdFromPayload(decoded);
    const { plan: rawPlan } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token payload'
      });
    }

    // Validate plan with Zod
    const planResult = PlanSchema.safeParse(rawPlan);
    if (!planResult.success) {
      return res.status(400).json({
        error: 'Invalid plan',
        message: 'Plan must be one of: free, starter, pro, enterprise'
      });
    }
    const plan = planResult.data;

    // Handle temporary users: attempt to convert to permanent before rejecting
    if (userId.startsWith('temp-')) {
      logger.info('Temporary user attempting plan update', { userId });
      
      const tempUserData = getTemporaryUser(userId);
      if (!tempUserData) {
        logger.error('Temporary user not found in memory', { userId });
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'Session expired. Please log out and sign in again.',
          code: 'TEMPORARY_USER_NOT_FOUND'
        });
      }

      logger.info('Attempting to convert temporary user to permanent', { userId });
      const convertedUser = await convertTemporaryUser(userId);

      if (convertedUser) {
        logger.info('Successfully converted temporary user to permanent', { userId, newId: convertedUser.id });
        userId = convertedUser.id;
      } else {
        logger.error('Cannot convert temporary user - database still unavailable', { userId });
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'Database connection issue. Please try again in a few moments, or log out and sign in again.',
          code: 'TEMPORARY_USER_DETECTED',
          retryAfter: 30
        });
      }
    }

    // Get current user
    const [user] = await db.select().from(users).where(eq(users.id, userId!)).limit(1);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // SECURITY: Validate plan upgrade permissions
    if (plan !== 'free') {
      const now = new Date();
      const isTrialActive = user.trialStartedAt && user.trialEndsAt && now < user.trialEndsAt;
      const hasActiveSubscription = user.stripeSubscriptionId &&
        ['active', 'trialing'].includes(user.subscriptionStatus || '');

      if (!isTrialActive && !hasActiveSubscription) {
        if (user.stripeCustomerId) {
          try {
            const subscription = await stripeService.getActiveSubscription(user.stripeCustomerId);
            if (!subscription) {
              logger.warn('Plan upgrade rejected: no active subscription', {
                userId,
                requestedPlan: plan,
                stripeCustomerId: user.stripeCustomerId,
              });
              return res.status(403).json({
                error: 'Subscription required',
                message: 'An active subscription is required for this plan. Please upgrade via the billing page.',
                code: 'SUBSCRIPTION_REQUIRED'
              });
            }
          } catch (stripeError) {
            logger.error('Stripe verification failed during plan update', {
              userId,
              error: (stripeError as Error).message,
            });
            if (!user.stripeSubscriptionId) {
              return res.status(403).json({
                error: 'Subscription required',
                message: 'Unable to verify subscription. Please try again.',
                code: 'SUBSCRIPTION_VERIFICATION_FAILED'
              });
            }
          }
        } else {
          logger.warn('Plan upgrade rejected: no subscription or trial', {
            userId,
            requestedPlan: plan,
          });
          return res.status(403).json({
            error: 'Subscription required',
            message: 'An active subscription is required for this plan. Please upgrade via the billing page.',
            code: 'SUBSCRIPTION_REQUIRED'
          });
        }
      }
    }

    // Check if downgrading from paid to free with active subscription
    if (plan === 'free' && user.stripeSubscriptionId) {
      return res.status(400).json({
        error: 'Cannot downgrade to free',
        message: 'Please cancel your Stripe subscription first via the billing portal'
      });
    }

    // Update user plan
    const [updatedUser] = await db.update(users)
      .set({
        plan,
        subscriptionStatus: plan === 'free' ? 'free' : user.subscriptionStatus,
      })
      .where(eq(users.id, userId!))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        plan: users.plan,
        apiKeyHash: users.apiKeyHash,
        emailVerified: users.emailVerified,
        usageCount: users.usageCount,
        usageLimit: users.usageLimit,
        subscriptionStatus: users.subscriptionStatus,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
        hasCompletedOnboarding: users.hasCompletedOnboarding,
        onboardingStep: users.onboardingStep,
        trialStartedAt: users.trialStartedAt,
        trialEndsAt: users.trialEndsAt,
        maxAgents: users.maxAgents,
        logRetentionDays: users.logRetentionDays,
        createdAt: users.createdAt,
      });

    // Log plan change
    await db.insert(subscriptionLogs).values({
      userId: userId!,
      event: 'plan_updated',
      metadata: {
        oldPlan: user.plan,
        newPlan: plan,
        timestamp: new Date().toISOString(),
      },
    }).catch((error) => {
      logger.error('Failed to log plan change', { error: (error as Error).message });
    });

    logger.info('Plan updated for user', { email: user.email, oldPlan: user.plan, newPlan: plan });

    if (!updatedUser) {
      return res.status(500).json({ error: 'Failed to update user plan' });
    }

    // Calculate trial status for response
    const now = new Date();
    const isTrialActive = updatedUser.trialStartedAt && updatedUser.trialEndsAt && now < updatedUser.trialEndsAt;
    const daysLeftInTrial = isTrialActive && updatedUser.trialEndsAt
      ? Math.ceil((updatedUser.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    res.json({
      success: true,
      user: {
        ...updatedUser,
        subscription: {
          status: updatedUser.subscriptionStatus,
          plan: updatedUser.plan,
          isTrialActive,
          daysLeftInTrial,
          trialEndsAt: updatedUser.trialEndsAt,
          stripe_subscription_id: updatedUser.stripeSubscriptionId,
          stripe_customer_id: updatedUser.stripeCustomerId,
        },
      },
    });
  } catch (error) {
    logger.error('Update plan error', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
