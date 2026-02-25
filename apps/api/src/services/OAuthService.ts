import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { checkDatabaseConnection } from '../middleware/database';

/**
 * In-memory store for temporary users
 * Used to track users created when DB was unavailable
 * Allows conversion to permanent users when DB becomes available
 */
export const temporaryUsersStore = new Map<string, {
  tempId: string;
  provider: string;
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
 * Remove temporary user from memory after successful conversion
 * @param tempId - The temporary user ID to remove
 * @returns true if user existed and was removed, false otherwise
 */
export function removeTemporaryUser(tempId: string): boolean {
  const existed = temporaryUsersStore.has(tempId);
  temporaryUsersStore.delete(tempId);
  if (existed) {
    console.log('🗑️ Removed temporary user from memory:', tempId);
  }
  return existed;
}

/**
 * Attempt to convert a temporary user to a permanent database user
 * @param tempId - The temporary user ID (starts with "temp-")
 * @returns The permanent user if conversion succeeded, null otherwise
 */
export async function convertTemporaryUser(tempId: string): Promise<any | null> {
  const tempUser = temporaryUsersStore.get(tempId);

  if (!tempUser) {
    logger.warn('🔍 Temporary user not found in memory store for conversion', {
      tempId,
      storeSize: temporaryUsersStore.size,
      note: 'User may have been created before server restart. Will attempt direct DB creation.'
    });
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
      // User exists - link provider ID and remove from temp store
      logger.info('👤 Found existing user with same email, linking account', {
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
      apiKeyHash: await bcrypt.hash(`aethermind_${uuidv4()}`, 10),
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

    try {
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
    } catch (insertError: any) {
      // Handle unique constraint violation - user might have been created by concurrent request
      if (insertError.code === '23505' || insertError.message?.includes('unique') || insertError.message?.includes('duplicate')) {
        logger.info('Race condition: user created by concurrent request, fetching existing user', {
          email: tempUser.email
        });

        const [existingUser] = await db.select()
          .from(users)
          .where(eq(users.email, tempUser.email))
          .limit(1);

        if (existingUser) {
          temporaryUsersStore.delete(tempId);
          logger.info('✅ Found existing user after unique constraint error', { userId: existingUser.id });
          return existingUser;
        }
      }
      throw insertError; // Re-throw to be caught by outer catch
    }
  } catch (error: any) {
    logger.error('❌ Failed to convert temporary user', {
      tempId,
      error: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    });
    return null;
  }
}

