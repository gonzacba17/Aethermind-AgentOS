import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

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
  prisma: PrismaClient,
  data: OAuthUserData
) {
  const { provider, providerId, email, name } = data;
  
  // Determine which field to check based on provider
  const providerField = provider === 'google' ? 'googleId' : 'githubId';
  
  logger.debug('OAuth user lookup', { provider, email, providerId });
  
  try {
    // 1. Check if user exists with this OAuth provider ID
    let user = await prisma.user.findUnique({
      where: { [providerField]: providerId } as any,
    });
    
    if (user) {
      logger.info('Existing OAuth user found', {
        userId: user.id,
        provider,
        email: user.email,
      });
      return user;
    }
    
    // 2. Check if user exists with this email (possibly registered with password)
    user = await prisma.user.findUnique({
      where: { email },
    });
    
    if (user) {
      // Link OAuth account to existing user
      logger.info('Linking OAuth provider to existing user', {
        userId: user.id,
        provider,
        email,
      });
      
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          [providerField]: providerId,
        } as any,
      });
      
      return user;
    }
    
    // 3. Create new user with OAuth data
    logger.info('Creating new OAuth user', { provider, email, name });
    
    user = await prisma.user.create({
      data: {
        email,
        name,
        [providerField]: providerId,
        plan: 'free',
        usageLimit: 100,
        usageCount: 0,
        apiKey: `aethermind_${uuidv4()}`,
        emailVerified: true, // OAuth emails are pre-verified
      } as any,
    });
    
    logger.info('New OAuth user created', {
      userId: user.id,
      provider,
      email: user.email,
    });
    
    return user;
    
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
    
    return tempUser;
  }
}
