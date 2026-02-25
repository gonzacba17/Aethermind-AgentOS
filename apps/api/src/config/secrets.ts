import { z } from 'zod';
import logger from '../utils/logger';

/**
 * Secrets validation schema using Zod
 * Enforces security requirements for all sensitive environment variables
 */
const secretsSchema = z.object({
  // JWT secret for signing tokens
  JWT_SECRET: z.string()
    .min(32, 'JWT_SECRET must be at least 32 characters long')
    .describe('Secret key for signing JWT tokens'),

  // Session secret (must differ from JWT_SECRET)
  SESSION_SECRET: z.string()
    .min(32, 'SESSION_SECRET must be at least 32 characters long')
    .optional()
    .describe('Secret key for session cookies'),

  // API key hash for admin authentication
  API_KEY_HASH: z.string()
    .optional()
    .describe('Bcrypt hash of admin API key'),

  // Encryption key for sensitive data (user API keys)
  // NOTE: Reads API_KEY_ENCRYPTION_KEY (used by user-api-keys.ts) with ENCRYPTION_KEY as fallback
  ENCRYPTION_KEY: z.string()
    .min(32, 'ENCRYPTION_KEY must be at least 32 characters')
    .optional()
    .describe('AES-256 encryption key for user API keys (env: API_KEY_ENCRYPTION_KEY or ENCRYPTION_KEY)'),

  // Database URL
  DATABASE_URL: z.string()
    .url()
    .optional()
    .describe('PostgreSQL connection string'),

  // Redis URL
  REDIS_URL: z.string()
    .optional()
    .describe('Redis connection string'),

  // Stripe secret key
  STRIPE_SECRET_KEY: z.string()
    .startsWith('sk_', 'STRIPE_SECRET_KEY must start with sk_')
    .optional()
    .describe('Stripe API secret key'),

  // SendGrid API key
  SENDGRID_API_KEY: z.string()
    .startsWith('SG.', 'SENDGRID_API_KEY must start with SG.')
    .optional()
    .describe('SendGrid API key for email'),

});

export type SecretsConfig = z.infer<typeof secretsSchema>;

/**
 * Validates that JWT_SECRET and SESSION_SECRET are different
 * This prevents session hijacking via JWT exposure
 */
function validateSecretsSeparation(secrets: SecretsConfig): void {
  if (secrets.SESSION_SECRET && secrets.JWT_SECRET === secrets.SESSION_SECRET) {
    throw new Error(
      'SECURITY: JWT_SECRET and SESSION_SECRET must be different. ' +
      'Using the same secret for both increases risk if one is compromised. ' +
      'Generate a new secret: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
}

/**
 * Validates all secrets on application startup
 * Throws if any critical security requirements are not met
 */
export function validateSecrets(): SecretsConfig {
  const isProduction = process.env.NODE_ENV === 'production';

  try {
    // Parse environment variables
    const secrets = secretsSchema.parse({
      JWT_SECRET: process.env.JWT_SECRET,
      SESSION_SECRET: process.env.SESSION_SECRET,
      API_KEY_HASH: process.env.API_KEY_HASH,
      ENCRYPTION_KEY: process.env.API_KEY_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY,
      DATABASE_URL: process.env.DATABASE_URL,
      REDIS_URL: process.env.REDIS_URL,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    });

    // Additional security validations
    validateSecretsSeparation(secrets);

    // Production-specific requirements
    if (isProduction) {
      if (!secrets.DATABASE_URL) {
        throw new Error('DATABASE_URL is required in production');
      }
      if (!secrets.API_KEY_HASH) {
        throw new Error('API_KEY_HASH is required in production');
      }
      if (!secrets.ENCRYPTION_KEY) {
        throw new Error(
          'FATAL: API_KEY_ENCRYPTION_KEY is required in production for encrypting user API keys. ' +
          'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        );
      }
    }

    logger.info('Secrets validation passed', {
      hasJwtSecret: !!secrets.JWT_SECRET,
      hasSessionSecret: !!secrets.SESSION_SECRET,
      hasApiKeyHash: !!secrets.API_KEY_HASH,
      hasEncryptionKey: !!secrets.ENCRYPTION_KEY,
      hasDatabaseUrl: !!secrets.DATABASE_URL,
      hasRedisUrl: !!secrets.REDIS_URL,
      hasStripeKey: !!secrets.STRIPE_SECRET_KEY,
      hasSendgridKey: !!secrets.SENDGRID_API_KEY,
    });

    return secrets;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
      logger.error(`Secrets validation failed:\n${issues}`);

      if (isProduction) {
        throw new Error(`FATAL: Secrets validation failed in production:\n${issues}`);
      }
    }
    throw error;
  }
}

/**
 * Get the validated secrets (call after validateSecrets)
 */
let cachedSecrets: SecretsConfig | null = null;

export function getSecrets(): SecretsConfig {
  if (!cachedSecrets) {
    cachedSecrets = validateSecrets();
  }
  return cachedSecrets;
}

/**
 * Check if a specific secret is configured
 */
export function hasSecret(key: keyof SecretsConfig): boolean {
  const secrets = getSecrets();
  return !!secrets[key];
}
