import { Response, NextFunction } from 'express';
import { AuthRequest } from './jwt-auth.js';
import { prisma } from '../lib/prisma';

const PLAN_LIMITS = {
  free: 100,
  starter: 10000,
  pro: 100000,
  enterprise: -1,
};

export async function usageLimiter(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { usageCount: true, usageLimit: true, plan: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.plan !== 'enterprise' && user.usageCount >= user.usageLimit) {
      res.status(429).json({
        error: 'Usage limit exceeded',
        message: `You have reached your ${user.plan} plan limit of ${user.usageLimit} executions/month. Upgrade your plan to continue.`,
        current: user.usageCount,
        limit: user.usageLimit,
        plan: user.plan,
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Usage limiter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function incrementUsage(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { usageCount: { increment: 1 } },
  });
}

export async function resetUsageForUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { usageCount: 0 },
  });
}

export async function updatePlan(
  userId: string,
  plan: keyof typeof PLAN_LIMITS
): Promise<void> {
  const limit = PLAN_LIMITS[plan];
  await prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      usageLimit: limit === -1 ? 999999999 : limit,
    },
  });
}
