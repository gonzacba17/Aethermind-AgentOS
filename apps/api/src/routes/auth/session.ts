/**
 * Auth routes — session exchange (temp sessions, exchange tokens, onboarding)
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import crypto from 'crypto';
import { db } from '../../db';
import { users, agents, budgets } from '../../db/schema';
import { eq } from 'drizzle-orm';
import redisService from '../../services/RedisService';
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

/**
 * POST /auth/create-temp-session
 * Creates a temporary session ID for secure cross-domain redirect
 */
router.post('/create-temp-session', async (req: Request, res: Response) => {
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

    const userId = getUserIdFromPayload(decoded);

    const sessionId = randomBytes(32).toString('hex');

    await redisService.setex(
      `temp_session:${sessionId}`,
      60,
      JSON.stringify({
        token,
        userId,
        createdAt: Date.now()
      })
    );

    logger.debug('Created temp session', { userId });

    res.json({ sessionId });
  } catch (error) {
    logger.error('Failed to create temp session', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * POST /auth/session
 * Exchanges a temporary session ID for JWT token and user data
 */
router.post('/session', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const sessionData = await redisService.get(`temp_session:${sessionId}`);

    if (!sessionData) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Delete session immediately (one-time use)
    await redisService.del(`temp_session:${sessionId}`);

    const { token, userId } = JSON.parse(sessionData);

    const [user] = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      plan: users.plan,
      apiKeyHash: users.apiKeyHash,
      emailVerified: users.emailVerified,
      usageCount: users.usageCount,
      usageLimit: users.usageLimit,
      hasCompletedOnboarding: users.hasCompletedOnboarding,
      onboardingStep: users.onboardingStep,
      subscriptionStatus: users.subscriptionStatus,
      maxAgents: users.maxAgents,
      logRetentionDays: users.logRetentionDays,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.debug('Session exchanged', { email: user.email });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        emailVerified: user.emailVerified,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        onboardingStep: user.onboardingStep,
        subscriptionStatus: user.subscriptionStatus,
        usageCount: user.usageCount,
        usageLimit: user.usageLimit,
        maxAgents: user.maxAgents,
        logRetentionDays: user.logRetentionDays,
        createdAt: user.createdAt,
      }
    });
  } catch (error) {
    logger.error('Session exchange failed', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to exchange session' });
  }
});

/**
 * PATCH /auth/onboarding
 * Updates user's onboarding status
 */
router.patch('/onboarding', async (req: Request, res: Response) => {
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

    const userId = getUserIdFromPayload(decoded);
    const { completed, step, data } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token payload'
      });
    }

    const updates: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (typeof completed === 'boolean') {
      updates.hasCompletedOnboarding = completed;
    }

    if (step && typeof step === 'string') {
      const validSteps = ['welcome', 'profile_setup', 'preferences', 'complete', 'skipped'];
      if (!validSteps.includes(step)) {
        return res.status(400).json({
          error: 'Invalid step',
          message: `Step must be one of: ${validSteps.join(', ')}`
        });
      }
      updates.onboardingStep = step;
    }

    // Persist onboarding data (agent + budget) when completing
    if (data && typeof data === 'object' && completed) {
      if (data.agent?.name) {
        try {
          const agentId = crypto.randomUUID();
          await db.insert(agents).values({
            id: agentId,
            userId,
            name: data.agent.name,
            model: data.agent.model || 'gpt-4',
            config: { systemPrompt: '', maxRetries: 3, timeout: 60000, temperature: 0.7 },
          });
          logger.debug('Onboarding agent created', { userId, agentId, name: data.agent.name });
        } catch (agentError) {
          logger.warn('Failed to create onboarding agent', { error: (agentError as Error).message });
        }
      }

      if (data.budget?.limit && data.budget.limit > 0) {
        try {
          await db.insert(budgets).values({
            userId,
            name: 'Monthly Budget',
            limitAmount: String(data.budget.limit),
            period: data.budget.period || 'monthly',
            scope: 'global',
          });
          logger.debug('Onboarding budget created', { userId, limit: data.budget.limit });
        } catch (budgetError) {
          logger.warn('Failed to create onboarding budget', { error: (budgetError as Error).message });
        }
      }
    }

    const [updatedUser] = await db.update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        hasCompletedOnboarding: users.hasCompletedOnboarding,
        onboardingStep: users.onboardingStep,
      });

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.debug('Onboarding updated', { userId, completed: updatedUser.hasCompletedOnboarding, step: updatedUser.onboardingStep });

    res.json({
      success: true,
      hasCompletedOnboarding: updatedUser.hasCompletedOnboarding,
      onboardingStep: updatedUser.onboardingStep,
    });
  } catch (error) {
    logger.error('Failed to update onboarding', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to update onboarding' });
  }
});

export default router;
