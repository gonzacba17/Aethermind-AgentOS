import { Router, Request, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import rateLimit from 'express-rate-limit';
import { db } from '../db';
import { users, subscriptionLogs } from '../db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { emailService } from '../services/EmailService';
import { StripeService } from '../services/StripeService';

const stripeService = new StripeService();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

const router: ExpressRouter = Router();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production' || process.env.JWT_SECRET.length < 32) {
  throw new Error('SECURITY: JWT_SECRET must be set and be at least 32 characters in production');
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production-min-32-chars';
const JWT_EXPIRES_IN = '7d';


interface SignupBody {
  email: string;
  password: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface ResetRequestBody {
  email: string;
}

interface ResetPasswordBody {
  token: string;
  password: string;
}

router.post('/signup', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as SignupBody;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const apiKey = `aethermind_${randomBytes(32).toString('hex')}`;
    const verificationToken = randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const userId = `user_${randomBytes(16).toString('hex')}`;
    
    const [user] = await db.insert(users).values({
      id: userId,
      email,
      passwordHash,
      apiKey,
      verificationToken,
      verificationExpiry,
      plan: 'free',
      usageLimit: 100,
      usageCount: 0,
      // Onboarding defaults
      hasCompletedOnboarding: false,
      onboardingStep: 'welcome',
      // Subscription status
      subscriptionStatus: 'free',
      // Free tier limits
      maxAgents: 3,
      logRetentionDays: 30,
      // Login tracking
      lastLoginAt: new Date(),
    }).returning();

    // Send verification email (non-blocking)
    emailService.sendVerificationEmail(email, verificationToken).catch((error) => {
      console.error('Failed to send verification email:', error);
    });

    if (!user) {
      return res.status(500).json({ error: 'Failed to create user' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        plan: user.plan,
        apiKey: user.apiKey,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        plan: user.plan,
        apiKey: user.apiKey,
        emailVerified: user.emailVerified,
        usageCount: user.usageCount,
        usageLimit: user.usageLimit,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/verify-email', async (req: Request, res: Response) => {
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
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot password endpoint (frontend compatibility)
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
      console.error('Failed to send password reset email:', error);
    });

    res.json({ success: true, message: 'If that email exists, a reset link was sent' });
  } catch (error) {
    console.error('Reset request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Legacy endpoint for backward compatibility
router.post('/reset-request', authLimiter, async (req: Request, res: Response) => {
  // Redirect to new endpoint
  return router.stack.find(layer => layer.route?.path === '/forgot-password')?.handle(req, res, () => {});
});

router.post('/reset-password', authLimiter, async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body as ResetPasswordBody;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
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
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/update-plan
 * Update user's subscription plan
 * CRITICAL ENDPOINT - Required by frontend
 */
router.post('/update-plan', async (req: Request, res: Response) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing authentication token'
      });
    }

    // Verify JWT token
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }

    const userId = decoded.userId || decoded.id;
    const { plan } = req.body;

    // Validate plan
    const validPlans = ['free', 'pro', 'enterprise'];
    if (!plan || !validPlans.includes(plan)) {
      return res.status(400).json({
        error: 'Invalid plan',
        message: 'Plan must be one of: free, pro, enterprise'
      });
    }

    // Get current user
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
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
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        plan: users.plan,
        apiKey: users.apiKey,
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
      userId,
      event: 'plan_updated',
      metadata: {
        oldPlan: user.plan,
        newPlan: plan,
        timestamp: new Date().toISOString(),
      },
    }).catch((error) => {
      console.error('Failed to log plan change:', error);
    });

    console.log(`✅ Plan updated for user ${user.email}: ${user.plan} → ${plan}`);

    // Safety check (should never happen with .returning())
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
    console.error('Update plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /auth/me
 * Returns current authenticated user information
 * Requires: Authorization: Bearer <JWT_TOKEN>
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    // Debug logging
    console.log('[/auth/me] Request received');
    console.log('[/auth/me] Headers:', JSON.stringify(req.headers, null, 2));
    console.log('[/auth/me] Authorization header:', req.headers.authorization);
    
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    console.log('[/auth/me] Extracted token:', token ? `${token.substring(0, 20)}...` : 'NONE');

    if (!token) {
      console.log('[/auth/me] REJECTED: No token found');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing authentication token'
      });
    }

    // Verify JWT token
    let decoded: any;
    try {
      console.log('[/auth/me] Verifying token with JWT_SECRET');
      decoded = jwt.verify(token, JWT_SECRET);
      console.log('[/auth/me] Token verified successfully. User ID:', decoded.userId || decoded.id);
    } catch (error) {
      console.log('[/auth/me] REJECTED: JWT verification failed');
      console.log('[/auth/me] Error:', (error as Error).message);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }

    // Get user from database using userId from token
    const userId = decoded.userId || decoded.id;
    
    const [user] = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      plan: users.plan,
      apiKey: users.apiKey,
      emailVerified: users.emailVerified,
      usageCount: users.usageCount,
      usageLimit: users.usageLimit,
      stripeCustomerId: users.stripeCustomerId,
      stripeSubscriptionId: users.stripeSubscriptionId,
      createdAt: users.createdAt,
      // Onboarding fields
      hasCompletedOnboarding: users.hasCompletedOnboarding,
      onboardingStep: users.onboardingStep,
      // Trial fields
      trialStartedAt: users.trialStartedAt,
      trialEndsAt: users.trialEndsAt,
      subscriptionStatus: users.subscriptionStatus,
      // Login tracking
      firstLoginAt: users.firstLoginAt,
      lastLoginAt: users.lastLoginAt,
      // Free tier limits
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
          // Update if status differs
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
        console.error('Failed to sync with Stripe:', error);
      }
    }

    // Calculate trial status
    const now = new Date();
    const isTrialActive = user.trialStartedAt && user.trialEndsAt && now < user.trialEndsAt;
    const daysLeftInTrial = isTrialActive && user.trialEndsAt 
      ? Math.ceil((user.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Check if first-time user
    const isFirstTimeUser = user.createdAt ? 
      (now.getTime() - new Date(user.createdAt).getTime() < 24 * 60 * 60 * 1000) : false;

    // Update lastLoginAt asynchronously (non-blocking)
    db.update(users)
      .set({ lastLoginAt: now })
      .where(eq(users.id, userId))
      .catch((error) => {
        console.error('Failed to update lastLoginAt:', error);
      });

    // Return user info with enhanced subscription status
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      apiKey: user.apiKey,
      emailVerified: user.emailVerified,
      usageCount: user.usageCount,
      usageLimit: user.usageLimit,
      // Onboarding status
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      onboardingStep: user.onboardingStep,
      isFirstTimeUser,
      // Subscription info  
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
      // Login tracking
      firstLoginAt: user.firstLoginAt,
      lastLoginAt: user.lastLoginAt,
      // Free tier limits
      maxAgents: user.maxAgents,
      logRetentionDays: user.logRetentionDays,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch user'
    });
  }
});

export default router;

