import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';

interface OAuthUserData {
  provider: 'google' | 'github';
  providerId: string;
  email: string;
  name: string;
}

/**
 * Find or create user from OAuth login
 * Handles three scenarios:
 * 1. User exists with this OAuth ID -> return user
 * 2. User exists with this email -> link OAuth ID to account
 * 3. New user -> create with OAuth ID
 * 
 * FALLBACK: If database is unavailable, creates temporary in-memory user
 */
export async function findOrCreateOAuthUser(
  data: OAuthUserData
) {
  const { provider, providerId, email, name } = data;
  
  logger.debug('OAuth user lookup', { provider, email, providerId });
  
  try {
    // 1. Check if user exists with this OAuth provider ID
    let user = null;
    
    if (provider === 'google') {
      const [foundUser] = await db.select()
        .from(users)
        .where(eq(users.googleId, providerId))
        .limit(1);
      user = foundUser || null;
    } else { // github
      const [foundUser] = await db.select()
        .from(users)
        .where(eq(users.githubId, providerId))
        .limit(1);
      user = foundUser || null;
    }
    
    if (user) {
      logger.info('Existing OAuth user found', {
        userId: user.id,
        provider,
        email: user.email,
      });
      return user;
    }
    
    // 2. Check if user exists with this email (possibly registered with password)
    const [existingUser] = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    if (existingUser) {
      // Link OAuth account to existing user
      logger.info('Linking OAuth provider to existing user', {
        userId: existingUser.id,
        provider,
        email,
      });
      
      const updateData = provider === 'google' 
        ? { googleId: providerId, lastLoginAt: new Date() }
        : { githubId: providerId, lastLoginAt: new Date() };
      
      const [updatedUser] = await db.update(users)
        .set(updateData)
        .where(eq(users.id, existingUser.id))
        .returning();
      
      return updatedUser!;
    }
    
    // 3. Create new user with OAuth data
    logger.info('Creating new OAuth user', { provider, email, name });
    
    const newUserData = {
      id: `user_${randomBytes(16).toString('hex')}`, // Generate unique ID
      email,
      name,
      plan: 'free' as const,
      usageLimit: 100,
      usageCount: 0,
      apiKey: `aethermind_${uuidv4()}`,
      emailVerified: true, // OAuth emails are pre-verified
      // Onboarding defaults
      hasCompletedOnboarding: false,
      onboardingStep: 'welcome',
      // Subscription status
      subscriptionStatus: 'free' as const,
      // Free tier limits
      maxAgents: 3,
      logRetentionDays: 30,
      // Login tracking
      firstLoginAt: new Date(),
      lastLoginAt: new Date(),
      // Provider-specific field
      ...(provider === 'google' ? { googleId: providerId } : { githubId: providerId }),
    };
    
    const [newUser] = await db.insert(users)
      .values(newUserData)
      .returning();
    
    logger.info('New OAuth user created', {
      userId: newUser!.id,
      provider,
      email: newUser!.email,
    });
    
    return newUser!;
    
  } catch (error) {
    // FALLBACK: Database unavailable - create temporary in-memory user
    logger.warn('Database unavailable for OAuth - creating temporary user', {
      provider,
      email,
      error: (error as Error).message,
    });
    
    // Create a temporary user object that works with JWT
    const tempUser = {
      id: `temp-${providerId}`,
      email,
      name,
      plan: 'free',
      usageCount: 0,
      usageLimit: 100,
      apiKey: `temp-${uuidv4()}`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    logger.info('Temporary OAuth user created (in-memory)', {
      userId: tempUser.id,
      provider,
      email: tempUser.email,
      note: 'This user will NOT persist. Configure PostgreSQL for persistence.',
    });
    
    return tempUser as any;
  }
}
