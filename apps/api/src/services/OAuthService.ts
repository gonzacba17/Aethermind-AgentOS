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
 */
export async function findOrCreateOAuthUser(
  prisma: PrismaClient,
  data: OAuthUserData
) {
  const { provider, providerId, email, name } = data;
  
  // Determine which field to check based on provider
  const providerField = provider === 'google' ? 'googleId' : 'githubId';
  
  logger.debug('OAuth user lookup', { provider, email, providerId });
  
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
    logger.info('Linking OAuth to existing email account', {
      userId: user.id,
      provider,
      email,
    });
    
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        [providerField]: providerId,
        name: (user as any).name || name, // Keep existing name if present
      } as any,
    });
    
    return user;
  }
  
  // 3. Create new user with OAuth
  logger.info('Creating new OAuth user', {
    email,
    provider,
    name,
  });
  
  // Generate a unique API key for the new user
  const apiKey = `aether_${uuidv4()}`;
  
  user = await prisma.user.create({
    data: {
      email,
      name,
      [providerField]: providerId,
      plan: 'free',
      usageLimit: 1000,
      usageCount: 0,
      apiKey,
      emailVerified: true, // OAuth emails are pre-verified
    } as any,
  });
  
  logger.info('New OAuth user created', {
    userId: user.id,
    email,
    provider,
    plan: user.plan,
  });
  
  return user;
}
