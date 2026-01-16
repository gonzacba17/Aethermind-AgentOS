import { Response, NextFunction } from 'express';
import { AuthRequest } from './jwt-auth.js';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

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

    const [user] = await db.select({
      usageCount: users.usageCount,
      usageLimit: users.usageLimit,
      plan: users.plan,
    })
    .from(users)
    .where(eq(users.id, req.userId))
    .limit(1);

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
  const [user] = await db.select({ usageCount: users.usageCount })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (user) {
    await db.update(users)
      .set({ usageCount: user.usageCount + 1 })
      .where(eq(users.id, userId));
  }
}

export async function resetUsageForUser(userId: string): Promise<void> {
  await db.update(users)
    .set({ usageCount: 0 })
    .where(eq(users.id, userId));
}

export async function updatePlan(
  userId: string,
  plan: keyof typeof PLAN_LIMITS
): Promise<void> {
  const limit = PLAN_LIMITS[plan];
  await db.update(users)
    .set({
      plan,
      usageLimit: limit === -1 ? 999999999 : limit,
    })
    .where(eq(users.id, userId));
}
