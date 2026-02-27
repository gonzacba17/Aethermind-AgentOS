/**
 * Auth routes — login + logout
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import rateLimit from 'express-rate-limit';
import { db } from '../../db';
import { users, organizations, clients } from '../../db/schema';
import { eq } from 'drizzle-orm';
import logger from '../../utils/logger';
import {
  AUTH_RATE_LIMIT_WINDOW_MS,
  AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  JWT_EXPIRES_IN,
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

interface LoginBody {
  email: string;
  password: string;
}

router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginBody;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Look up existing client via organizationId, or auto-provision one
    let clientAccessToken: string | null = null;

    if (user.organizationId) {
      // User already has an org — find their client
      const [existingClient] = await db.select({
          accessToken: clients.accessToken,
          organizationId: clients.organizationId,
        })
        .from(clients)
        .where(eq(clients.organizationId, user.organizationId))
        .limit(1);
      if (existingClient) {
        clientAccessToken = existingClient.accessToken;
      }
    }

    // Also check for orphan clients belonging to this user's email with null org
    if (!clientAccessToken) {
      const [orphanClient] = await db.select({
          id: clients.id,
          accessToken: clients.accessToken,
          organizationId: clients.organizationId,
        })
        .from(clients)
        .where(eq(clients.companyName, user.email))
        .limit(1);

      if (orphanClient && !orphanClient.organizationId) {
        // Repair: create org and link both client + user in a transaction
        const orgSlug = `org_${randomBytes(8).toString('hex')}`;
        const orgApiKeyPlaintext = `aether_org_${randomBytes(32).toString('hex')}`;
        const orgApiKeyHash = await bcrypt.hash(orgApiKeyPlaintext, 10);
        const orgApiKeyPrefix = orgApiKeyPlaintext.slice(0, 16);

        await db.transaction(async (tx) => {
          const [org] = await tx.insert(organizations).values({
            name: user.email,
            slug: orgSlug,
            apiKeyHash: orgApiKeyHash,
            apiKeyPrefix: orgApiKeyPrefix,
          }).returning();

          if (!org) throw new Error('Failed to create organization for orphan client');

          await tx.update(clients).set({ organizationId: org.id }).where(eq(clients.id, orphanClient.id));
          await tx.update(users).set({ organizationId: org.id }).where(eq(users.id, user.id));
        });

        clientAccessToken = orphanClient.accessToken;
      } else if (orphanClient && orphanClient.organizationId) {
        // Client exists with an org but user wasn't linked — link user now
        await db.update(users).set({ organizationId: orphanClient.organizationId }).where(eq(users.id, user.id));
        clientAccessToken = orphanClient.accessToken;
      }
    }

    // Still no client — full auto-provision in a transaction
    if (!clientAccessToken) {
      const orgSlug = `org_${randomBytes(8).toString('hex')}`;
      const orgApiKeyPlaintext = `aether_org_${randomBytes(32).toString('hex')}`;
      const orgApiKeyHash = await bcrypt.hash(orgApiKeyPlaintext, 10);
      const orgApiKeyPrefix = orgApiKeyPlaintext.slice(0, 16);
      const newClientToken = `ct_${randomBytes(32).toString('hex')}`;
      const sdkApiKey = `aether_sdk_${randomBytes(24).toString('hex')}`;

      await db.transaction(async (tx) => {
        const [org] = await tx.insert(organizations).values({
          name: user.email,
          slug: orgSlug,
          apiKeyHash: orgApiKeyHash,
          apiKeyPrefix: orgApiKeyPrefix,
        }).returning();

        if (!org) throw new Error('Failed to create organization');

        await tx.insert(clients).values({
          companyName: user.email,
          accessToken: newClientToken,
          sdkApiKey,
          organizationId: org.id,
          isActive: true,
        });

        await tx.update(users).set({ organizationId: org.id }).where(eq(users.id, user.id));
      });

      clientAccessToken = newClientToken;
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    res.json({
      token,
      clientAccessToken,
      user: {
        id: user.id,
        email: user.email,
        plan: user.plan,
        emailVerified: user.emailVerified,
        usageCount: user.usageCount,
        usageLimit: user.usageLimit,
      },
    });
  } catch (error) {
    logger.error('Login error', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (_req: Request, res: Response) => {
  // JWT is stateless — client discards token.
  // If cookie-based auth is used, clear the cookie here.
  res.clearCookie('auth_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;
