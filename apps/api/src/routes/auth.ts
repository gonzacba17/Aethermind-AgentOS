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
import { convertTemporaryUser, getTemporaryUser, removeTemporaryUser } from '../services/OAuthService';
import redisService from '../services/RedisService';
import logger from '../utils/logger';
import {
  AUTH_RATE_LIMIT_WINDOW_MS,
  AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
  PASSWORD_RESET_RATE_LIMIT_MAX_ATTEMPTS,
  EMAIL_VERIFY_RATE_LIMIT_WINDOW_MS,
  EMAIL_VERIFY_RATE_LIMIT_MAX_ATTEMPTS,
  JWT_EXPIRES_IN,
  PASSWORD_MIN_LENGTH,
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
} from '../config/constants';
import {
  getJWTSecret,
  generateUserToken,
  formatAuthResponse,
  extractTokenFromRequest,
  verifyJWT,
  JWTPayload,
  getUserIdFromPayload,
} from '../utils/auth-helpers';

const stripeService = new StripeService();

// Rate limiter for login/signup attempts
const authLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// SECURITY: Rate limiter for email verification to prevent brute force
const emailVerifyLimiter = rateLimit({
  windowMs: EMAIL_VERIFY_RATE_LIMIT_WINDOW_MS,
  max: EMAIL_VERIFY_RATE_LIMIT_MAX_ATTEMPTS,
  message: 'Too many verification attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// SECURITY: Strict rate limiter for password reset to prevent abuse
const passwordResetLimiter = rateLimit({
  windowMs: PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
  max: PASSWORD_RESET_RATE_LIMIT_MAX_ATTEMPTS,
  message: 'Too many password reset attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const router: ExpressRouter = Router();

// Validate JWT secret at startup
const JWT_SECRET = getJWTSecret();


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

    if (password.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` });
    }

    const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const apiKey = `aethermind_${randomBytes(32).toString('hex')}`;
    const verificationToken = randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

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
      logger.error('Failed to send verification email', { error: (error as Error).message });
    });

    if (!user) {
      return res.status(500).json({ error: 'Failed to create user' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    } as jwt.SignOptions);

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
    logger.error('Signup error', { error: (error as Error).message });
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
    } as jwt.SignOptions);

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
    logger.error('Login error', { error: (error as Error).message });
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
      logger.error('Failed to send password reset email', { error: (error as Error).message });
    });

    res.json({ success: true, message: 'If that email exists, a reset link was sent' });
  } catch (error) {
    logger.error('Password reset request error', { error: (error as Error).message });
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

    if (password.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` });
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
    logger.error('Password reset error', { error: (error as Error).message });
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
    const token = extractTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing authentication token'
      });
    }

    // Verify JWT token
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
    const { plan } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token payload'
      });
    }

    // Handle temporary users: attempt to convert to permanent before rejecting
    if (userId.startsWith('temp-')) {
      logger.info('Temporary user attempting plan update', { userId });
      
      // Check if we have this user in memory
      const tempUserData = getTemporaryUser(userId);
      if (!tempUserData) {
        logger.error('Temporary user not found in memory', { userId });
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'Session expired. Please log out and sign in again.',
          code: 'TEMPORARY_USER_NOT_FOUND'
        });
      }

      // Attempt to convert temporary user to permanent
      logger.info('Attempting to convert temporary user to permanent', { userId });
      const convertedUser = await convertTemporaryUser(userId);

      if (convertedUser) {
        logger.info('Successfully converted temporary user to permanent', { userId, newId: convertedUser.id });
        userId = convertedUser.id; // Use the new permanent ID
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

    // Validate plan
    const validPlans = ['free', 'pro', 'enterprise'];
    if (!plan || !validPlans.includes(plan)) {
      return res.status(400).json({
        error: 'Invalid plan',
        message: 'Plan must be one of: free, pro, enterprise'
      });
    }

    // Get current user (userId is guaranteed non-null at this point)
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

      // For pro/enterprise, user must have active Stripe subscription or be in trial
      if (!isTrialActive && !hasActiveSubscription) {
        // Verify with Stripe if they claim to have a subscription
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
            // Allow the update if Stripe is unavailable but user has subscription ID
            if (!user.stripeSubscriptionId) {
              return res.status(403).json({
                error: 'Subscription required',
                message: 'Unable to verify subscription. Please try again.',
                code: 'SUBSCRIPTION_VERIFICATION_FAILED'
              });
            }
          }
        } else {
          // No Stripe customer ID and no trial - cannot upgrade
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
    logger.error('Update plan error', { error: (error as Error).message });
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
    // Extract token from Authorization header
    const token = extractTokenFromRequest(req);

    if (!token) {
      logger.debug('/auth/me rejected: no token found');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing authentication token'
      });
    }

    // Verify JWT token
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

    // Get user from database using userId from token
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
        try {
          const [existingUser] = await db.select()
            .from(users)
            .where(eq(users.email, emailFromToken))
            .limit(1);
          
          if (existingUser) {
            logger.info('User already exists in DB with this email', { userId: existingUser.id });
            
            // Generate new JWT token with permanent user ID
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
            
            // Remove from temporary store if exists
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
          }
        } catch (dbError) {
          logger.error('DB lookup failed', { error: (dbError as Error).message });
        }
      }
      
      // Try to convert using the temporary store data
      const convertedUser = await convertTemporaryUser(userId);
      
      if (convertedUser) {
        logger.info('Temporary user auto-converted during /auth/me', { userId: convertedUser.id });
        
        // Generate new JWT token with permanent user ID
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
        
        // Remove from temporary store
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
          
          const [newUser] = await db.insert(users)
            .values({
              id: newUserId,
              email: emailFromToken,
              name: decoded.name || nameFromEmail,
              plan: 'free',
              usageLimit: 100,
              usageCount: 0,
              apiKey: `aethermind_${randomBytes(16).toString('hex')}`,
              emailVerified: true,
              hasCompletedOnboarding: false,
              onboardingStep: 'welcome',
              subscriptionStatus: 'free',
              maxAgents: 3,
              logRetentionDays: 30,
              firstLoginAt: new Date(),
              lastLoginAt: new Date(),
            })
            .returning();
          
          if (!newUser) {
            throw new Error('Failed to create user in database');
          }
          
          logger.info('Created new permanent user from JWT', { userId: newUser.id });
          
          // Generate new token
          const newToken = jwt.sign(
            {
              userId: newUser.id,
              id: newUser.id,
              email: newUser.email,
              plan: newUser.plan,
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
          );
          
          // Remove from temporary store if exists
          removeTemporaryUser(userId);
          
          return res.json({
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            plan: newUser.plan,
            usageCount: newUser.usageCount,
            usageLimit: newUser.usageLimit,
            emailVerified: true,
            hasCompletedOnboarding: false,
            isTemporaryUser: false,
            wasConverted: true,
            newToken,
            subscription: {
              status: 'free',
              plan: 'free',
              isTrialActive: false,
              daysLeftInTrial: 0,
            },
            createdAt: newUser.createdAt,
          });
        } catch (createError) {
          logger.error('Failed to create permanent user from JWT', { error: (createError as Error).message });
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
        logger.error('Failed to sync with Stripe', { error: (error as Error).message });
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
        logger.error('Failed to update lastLoginAt', { error: (error as Error).message });
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
    logger.error('Error fetching user', { error: (error as Error).message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch user'
    });
  }
});

// ============================================
// SESSION EXCHANGE ENDPOINTS
// For secure cross-domain authentication
// ============================================

/**
 * POST /auth/create-temp-session
 * Creates a temporary session ID for secure cross-domain redirect
 * Requires: Authorization: Bearer <JWT_TOKEN>
 * Returns: { sessionId: string }
 */
router.post('/create-temp-session', async (req: Request, res: Response) => {
  try {
    // Extract and verify JWT token
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

    // Generate unique session ID
    const sessionId = randomBytes(32).toString('hex');

    // Store session in Redis (or memory fallback) with 60-second TTL
    await redisService.setex(
      `temp_session:${sessionId}`,
      60, // 60 seconds TTL
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
 * This is a public endpoint (no auth required)
 * Body: { sessionId: string }
 * Returns: { token: string, user: {...} }
 */
router.post('/session', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // Retrieve session from Redis/memory
    const sessionData = await redisService.get(`temp_session:${sessionId}`);

    if (!sessionData) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Delete session immediately (one-time use)
    await redisService.del(`temp_session:${sessionId}`);

    const { token, userId } = JSON.parse(sessionData);

    // Get user data from database
    const [user] = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      plan: users.plan,
      apiKey: users.apiKey,
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
        apiKey: user.apiKey,
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
 * Requires: Authorization: Bearer <JWT_TOKEN>
 * Body: { completed?: boolean, step?: string }
 */
router.patch('/onboarding', async (req: Request, res: Response) => {
  try {
    // Extract and verify JWT token
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
    const { completed, step } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token payload'
      });
    }

    // Build update object
    const updates: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (typeof completed === 'boolean') {
      updates.hasCompletedOnboarding = completed;
    }

    if (step && typeof step === 'string') {
      // Validate step value
      const validSteps = ['welcome', 'profile_setup', 'preferences', 'complete', 'skipped'];
      if (!validSteps.includes(step)) {
        return res.status(400).json({
          error: 'Invalid step',
          message: `Step must be one of: ${validSteps.join(', ')}`
        });
      }
      updates.onboardingStep = step;
    }

    // Update user
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

