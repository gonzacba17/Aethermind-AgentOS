#!/usr/bin/env tsx
/**
 * Secret Generation Script
 * Generates secure random secrets for Aethermind API
 *
 * Usage:
 *   npx tsx scripts/generate-secrets.ts
 *   pnpm generate-secrets
 *
 * Output: Environment variables ready to copy to .env or deployment config
 */

import crypto from 'crypto';

interface SecretConfig {
  name: string;
  description: string;
  length: number;
  format: 'hex' | 'base64' | 'alphanumeric';
}

const secrets: SecretConfig[] = [
  {
    name: 'JWT_SECRET',
    description: 'Secret for signing JWT tokens (min 32 chars)',
    length: 32,
    format: 'base64',
  },
  {
    name: 'SESSION_SECRET',
    description: 'Secret for session cookies (must differ from JWT_SECRET)',
    length: 32,
    format: 'base64',
  },
  {
    name: 'ENCRYPTION_KEY',
    description: 'AES-256 key for encrypting user data (64 hex chars)',
    length: 32, // 32 bytes = 64 hex chars
    format: 'hex',
  },
];

function generateSecret(config: SecretConfig): string {
  const bytes = crypto.randomBytes(config.length);

  switch (config.format) {
    case 'hex':
      return bytes.toString('hex');
    case 'base64':
      return bytes.toString('base64');
    case 'alphanumeric':
      return bytes.toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, config.length * 2);
    default:
      return bytes.toString('hex');
  }
}

function generateApiKeyHash(): { plainKey: string; hash: string } {
  // Generate a plain API key
  const plainKey = `am_${crypto.randomBytes(24).toString('base64url')}`;

  // Note: In production, use bcrypt to hash this
  // This is just for display purposes
  return {
    plainKey,
    hash: '(run: npx bcrypt-cli hash "' + plainKey + '" to generate bcrypt hash)',
  };
}

console.log('\n='.repeat(60));
console.log(' Aethermind API - Secret Generator');
console.log('='.repeat(60));
console.log('\nGenerated secrets (copy to .env or deployment config):\n');

console.log('# Authentication Secrets');
console.log('# IMPORTANT: Each secret must be unique!');
console.log('#'.repeat(50));

for (const config of secrets) {
  const value = generateSecret(config);
  console.log(`\n# ${config.description}`);
  console.log(`${config.name}=${value}`);
}

const apiKey = generateApiKeyHash();
console.log('\n# Admin API Key');
console.log('# Store the plain key securely, use the hash in API_KEY_HASH');
console.log('#'.repeat(50));
console.log(`\n# Plain API Key (keep secret!): ${apiKey.plainKey}`);
console.log(`# API_KEY_HASH=${apiKey.hash}`);

console.log('\n# Cookie Domain (optional, for cross-subdomain auth)');
console.log('# COOKIE_DOMAIN=.yourdomain.com');

console.log('\n' + '='.repeat(60));
console.log(' Security Notes:');
console.log('='.repeat(60));
console.log(`
1. NEVER commit these secrets to git
2. Use different secrets for dev/staging/production
3. JWT_SECRET and SESSION_SECRET MUST be different
4. Rotate secrets periodically (quarterly recommended)
5. Store production secrets in a vault (Railway, AWS Secrets Manager, etc.)
`);

console.log('To generate API_KEY_HASH with bcrypt:');
console.log('  npm install -g bcrypt-cli');
console.log('  bcrypt-cli hash "your-api-key"');
console.log('');
