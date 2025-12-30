import { Router, Request, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import logger from '../utils/logger';

const router: ExpressRouter = Router();

// JWT Secret validation
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('SECURITY: JWT_SECRET must be set and be at least 32 characters in production');
}

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware to authenticate JWT token
 * Extracts user from token and attaches to request
 */
async function authenticateToken(req: Request, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing authentication token'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Attach user info to request
    (req as any).userId = decoded.id || decoded.userId;
    
    next();
  } catch (error) {
    logger.error('Token authentication failed', { error: (error as Error).message });
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or expired token'
    });
  }
}

/**
 * GET /api/onboarding/status
 * Returns current onboarding status for authenticated user
 */
router.get('/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        hasCompletedOnboarding: true,
        onboardingStep: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is first-time (created within last 24 hours)
    const isFirstTimeUser = new Date().getTime() - new Date(user.createdAt).getTime() < 24 * 60 * 60 * 1000;

    res.json({
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      onboardingStep: user.onboardingStep,
      isFirstTimeUser,
    });
  } catch (error) {
    logger.error('Error fetching onboarding status', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/onboarding/step
 * Updates the current onboarding step
 * Body: { step: string }
 */
router.patch('/step', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { step } = req.body;

    if (!step || typeof step !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Step is required and must be a string'
      });
    }

    // Validate step value (optional - you can add more strict validation)
    const validSteps = ['welcome', 'profile_setup', 'preferences', 'complete', 'skipped'];
    if (!validSteps.includes(step)) {
      logger.warn('Invalid onboarding step provided', { step, userId });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        onboardingStep: step,
      },
      select: {
        id: true,
        hasCompletedOnboarding: true,
        onboardingStep: true,
      },
    });

    logger.info('Onboarding step updated', { userId, step });

    res.json({
      message: 'Onboarding step updated successfully',
      user: {
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        onboardingStep: user.onboardingStep,
      },
    });
  } catch (error) {
    logger.error('Error updating onboarding step', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/onboarding/complete
 * Marks onboarding as complete
 */
router.post('/complete', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        hasCompletedOnboarding: true,
        onboardingStep: 'complete',
      },
      select: {
        id: true,
        email: true,
        hasCompletedOnboarding: true,
        onboardingStep: true,
      },
    });

    logger.info('Onboarding completed', { userId, email: user.email });

    res.json({
      message: 'Onboarding completed successfully',
      user: {
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        onboardingStep: user.onboardingStep,
      },
    });
  } catch (error) {
    logger.error('Error completing onboarding', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/onboarding/skip
 * Allows user to skip onboarding
 */
router.post('/skip', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        hasCompletedOnboarding: true,
        onboardingStep: 'skipped',
      },
      select: {
        id: true,
        email: true,
        hasCompletedOnboarding: true,
        onboardingStep: true,
      },
    });

    logger.info('Onboarding skipped', { userId, email: user.email });

    res.json({
      message: 'Onboarding skipped successfully',
      user: {
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        onboardingStep: user.onboardingStep,
      },
    });
  } catch (error) {
    logger.error('Error skipping onboarding', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
