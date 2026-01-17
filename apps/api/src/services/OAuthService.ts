import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { retryDatabaseOperation, checkDatabaseConnection } from '../middleware/database';

interface OAuthUserData {
  provider: 'google' | 'github';
  providerId: string;
  email: string;
  name: string;
}

/**
 * In-memory store for temporary users
 * Used to track users created when DB was unavailable
 * Allows conversion to permanent users when DB becomes available
 */
export const temporaryUsersStore = new Map<string, {
  tempId: string;
  provider: 'google' | 'github';
  providerId: string;
  email: string;
  name: string;
  createdAt: Date;
  plan: string;
  usageCount: number;
  usageLimit: number;
}>();

/**
 * Get count of temporary users in memory
 */
export function getTemporaryUsersCount(): number {
  return temporaryUsersStore.size;
}

/**
 * Get temporary user by ID
 */
export function getTemporaryUser(tempId: string) {
  return temporaryUsersStore.get(tempId) || null;
}

/**
 * Attempt to convert a temporary user to a permanent database user
 * @param tempId - The temporary user ID (starts with "temp-")
 * @returns The permanent user if conversion succeeded, null otherwise
 */
export async function convertTemporaryUser(tempId: string): Promise<any | null> {
  const tempUser = temporaryUsersStore.get(tempId);
  
  if (!tempUser) {
    logger.warn('🔍 Temporary user not found for conversion', { tempId });
    return null;
  }

  logger.info('🔄 Attempting to convert temporary user to permanent', {
    tempId,
    email: tempUser.email,
    provider: tempUser.provider,
  });

  // First check if DB is available
  const dbAvailable = await checkDatabaseConnection();
  if (!dbAvailable) {
    logger.error('❌ Cannot convert temporary user - database still unavailable');
    return null;
  }

  try {
    // Check if user already exists with this email (maybe created separately)
    const [existingUser] = await db.select()
      .from(users)
      .where(eq(users.email, tempUser.email))
      .limit(1);

    if (existingUser) {
      // User exists - update with OAuth provider ID and remove from temp store
      logger.info('👤 Found existing user with same email, linking OAuth', {
        existingUserId: existingUser.id,
        email: tempUser.email,
      });

      const updateData = tempUser.provider === 'google'
        ? { googleId: tempUser.providerId, lastLoginAt: new Date() }
        : { githubId: tempUser.providerId, lastLoginAt: new Date() };

      const [updatedUser] = await db.update(users)
        .set(updateData)
        .where(eq(users.id, existingUser.id))
        .returning();

      // Remove from temporary store
      temporaryUsersStore.delete(tempId);
      
      logger.info('✅ Temporary user merged with existing account', {
        permanentId: updatedUser!.id,
        email: updatedUser!.email,
      });

      return updatedUser;
    }

    // Create new permanent user
    const newUserData = {
      id: `user_${randomBytes(16).toString('hex')}`,
      email: tempUser.email,
      name: tempUser.name,
      plan: tempUser.plan as 'free' | 'pro' | 'enterprise',
      usageLimit: tempUser.usageLimit,
      usageCount: tempUser.usageCount,
      apiKey: `aethermind_${uuidv4()}`,
      emailVerified: true,
      hasCompletedOnboarding: false,
      onboardingStep: 'welcome',
      subscriptionStatus: 'free' as const,
      maxAgents: 3,
      logRetentionDays: 30,
      firstLoginAt: tempUser.createdAt,
      lastLoginAt: new Date(),
      ...(tempUser.provider === 'google' 
        ? { googleId: tempUser.providerId } 
        : { githubId: tempUser.providerId }),
    };

    const [newUser] = await db.insert(users)
      .values(newUserData)
      .returning();

    // Remove from temporary store
    temporaryUsersStore.delete(tempId);

    logger.info('✅ Temporary user converted to permanent successfully', {
      oldTempId: tempId,
      newPermanentId: newUser!.id,
      email: newUser!.email,
    });

    return newUser;
  } catch (error) {
    logger.error('❌ Failed to convert temporary user', {
      tempId,
      error: (error as Error).message,
    });
    return null;
  }
}

/**
 * Find or create user from OAuth login
 * Handles three scenarios:
 * 1. User exists with this OAuth ID -> return user
 * 2. User exists with this email -> link OAuth ID to account
 * 3. New user -> create with OAuth ID
 * 
 * FALLBACK: If database is unavailable after retries, creates temporary in-memory user
 */
export async function findOrCreateOAuthUser(
  data: OAuthUserData
) {
  const { provider, providerId, email, name } = data;
  
  logger.info('🔐 OAuth user lookup started', { 
    provider, 
    email, 
    providerId: providerId.substring(0, 10) + '...' 
  });
  
  try {
    // Use retry logic for database operations
    const user = await retryDatabaseOperation(async () => {
      // 1. Check if user exists with this OAuth provider ID
      let foundUser = null;
      
      if (provider === 'google') {
        const [result] = await db.select()
          .from(users)
          .where(eq(users.googleId, providerId))
          .limit(1);
        foundUser = result || null;
      } else { // github
        const [result] = await db.select()
          .from(users)
          .where(eq(users.githubId, providerId))
          .limit(1);
        foundUser = result || null;
      }
      
      if (foundUser) {
        logger.info('✅ Existing OAuth user found in database', {
          userId: foundUser.id,
          provider,
          email: foundUser.email,
        });
        
        // Update last login
        await db.update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, foundUser.id));
        
        return foundUser;
      }
      
      // 2. Check if user exists with this email (possibly registered with password)
      const [existingUser] = await db.select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      
      if (existingUser) {
        // Link OAuth account to existing user
        logger.info('🔗 Linking OAuth provider to existing user', {
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
      logger.info('👤 Creating new OAuth user in database', { provider, email, name });
      
      const newUserData = {
        id: `user_${randomBytes(16).toString('hex')}`,
        email,
        name,
        plan: 'free' as const,
        usageLimit: 100,
        usageCount: 0,
        apiKey: `aethermind_${uuidv4()}`,
        emailVerified: true, // OAuth emails are pre-verified
        hasCompletedOnboarding: false,
        onboardingStep: 'welcome',
        subscriptionStatus: 'free' as const,
        maxAgents: 3,
        logRetentionDays: 30,
        firstLoginAt: new Date(),
        lastLoginAt: new Date(),
        ...(provider === 'google' ? { googleId: providerId } : { githubId: providerId }),
      };
      
      const [newUser] = await db.insert(users)
        .values(newUserData)
        .returning();
      
      logger.info('✅ New OAuth user created in database', {
        userId: newUser!.id,
        provider,
        email: newUser!.email,
      });
      
      return newUser!;
    }, {
      maxRetries: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 2,
    });

    return user;
    
  } catch (error) {
    // FALLBACK: Database unavailable after all retries - create temporary in-memory user
    logger.error('❌ Database unavailable for OAuth after 3 retries - creating temporary user', {
      provider,
      email,
      error: (error as Error).message,
    });
    
    // Create a temporary user object that works with JWT
    const tempId = `temp-${providerId}`;
    const tempUser = {
      id: tempId,
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
    
    // Store in memory for potential conversion later
    temporaryUsersStore.set(tempId, {
      tempId,
      provider,
      providerId,
      email,
      name,
      createdAt: new Date(),
      plan: 'free',
      usageCount: 0,
      usageLimit: 100,
    });
    
    logger.warn('⚠️ Temporary OAuth user created (in-memory)', {
      userId: tempUser.id,
      provider,
      email: tempUser.email,
      temporaryUsersCount: temporaryUsersStore.size,
      note: 'This user will NOT persist. Configure PostgreSQL for persistence.',
    });
    
    return tempUser as any;
  }
}
