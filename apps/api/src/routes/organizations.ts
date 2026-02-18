import { Router, Request, Response } from 'express';
import { db } from '../db';
import { organizations, users, agents } from '../db/schema';
import { eq, count, and, isNull } from 'drizzle-orm';
import { jwtAuthMiddleware, AuthRequest } from '../middleware/jwt-auth.js';
import logger from '../utils/logger';

const router = Router();

router.use(jwtAuthMiddleware as any);

/**
 * GET /api/organizations/current
 * Returns the organization for the authenticated user.
 * Falls back to a user-level org view if user has no organizationId.
 *
 * CONTRACT: Never returns null. Always returns an object with:
 *   { id: string, name: string, plan: 'free'|'starter'|'pro'|'enterprise',
 *     membersCount: number, usageCount: number, usageLimit: number }
 * Billing components depend on this shape — do NOT return null or 404 for missing user.
 */
router.get('/current', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    if (!userId) {
      // Even on auth failure, return defaults so billing components don't crash
      return res.json({
        id: 'unknown',
        name: 'Guest',
        plan: 'free' as const,
        membersCount: 1,
        usageCount: 0,
        usageLimit: 100,
      });
    }

    // Get user with their organizationId
    const [user] = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      plan: users.plan,
      organizationId: users.organizationId,
      usageCount: users.usageCount,
      usageLimit: users.usageLimit,
      maxAgents: users.maxAgents,
    }).from(users).where(eq(users.id, userId));

    if (!user) {
      // User not found — return defaults instead of 404
      // This prevents billing component crashes when user record is missing
      return res.json({
        id: userId,
        name: 'Unknown User',
        plan: 'free' as const,
        membersCount: 1,
        usageCount: 0,
        usageLimit: 100,
      });
    }

    // If user belongs to an organization, return it
    if (user.organizationId) {
      const [org] = await db.select().from(organizations)
        .where(and(eq(organizations.id, user.organizationId), isNull(organizations.deletedAt)));

      if (org) {
        // Count members in org
        const [memberResult] = await db.select({ count: count() })
          .from(users)
          .where(eq(users.organizationId, org.id));

        return res.json({
          id: org.id,
          name: org.name,
          plan: (org.plan?.toLowerCase() || 'free') as 'free' | 'starter' | 'pro' | 'enterprise',
          membersCount: memberResult?.count || 1,
          usageCount: user.usageCount,
          usageLimit: user.usageLimit,
        });
      }
    }

    // No organization — return user-level view
    res.json({
      id: userId,
      name: user.name || user.email?.split('@')[0] || 'My Workspace',
      plan: (user.plan || 'free') as 'free' | 'starter' | 'pro' | 'enterprise',
      membersCount: 1,
      usageCount: user.usageCount,
      usageLimit: user.usageLimit,
    });
  } catch (error) {
    logger.error('Failed to fetch organization', { error: (error as Error).message });
    // Even on error, return defaults — never null
    res.json({
      id: 'error',
      name: 'Error loading',
      plan: 'free' as const,
      membersCount: 1,
      usageCount: 0,
      usageLimit: 100,
    });
  }
});

export default router;
