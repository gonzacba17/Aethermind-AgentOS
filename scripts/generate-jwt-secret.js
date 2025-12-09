#!/usr/bin/env node

/**
 * Generate JWT Secret for Production
 * 
 * This script generates a cryptographically secure random string
 * for use as JWT_SECRET in Railway environment variables.
 * 
 * Usage:
 *   node scripts/generate-jwt-secret.js
 *   node scripts/generate-jwt-secret.js 64  (custom length)
 */

const crypto = require('crypto');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

console.log(`${colors.blue}${colors.bright}🔑 JWT Secret Generator for Aethermind AgentOS${colors.reset}\n`);

// Get desired length from argument (default: 64 bytes = 128 hex chars)
const byteLength = parseInt(process.argv[2]) || 64;

if (byteLength < 32) {
  console.log(`${colors.red}⚠️  Warning: JWT secret should be at least 32 bytes for security${colors.reset}`);
  console.log(`${colors.yellow}Using minimum recommended length: 32 bytes${colors.reset}\n`);
}

const actualLength = Math.max(byteLength, 32);

// Generate cryptographically secure random bytes
const jwtSecret = crypto.randomBytes(actualLength).toString('hex');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`${colors.green}✅ JWT Secret Generated Successfully!${colors.reset}\n`);

console.log(`${colors.bright}Length:${colors.reset} ${jwtSecret.length} characters (${actualLength} bytes)\n`);

console.log(`${colors.bright}JWT Secret (Set this in Railway as JWT_SECRET):${colors.reset}`);
console.log(`${colors.green}${jwtSecret}${colors.reset}\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log(`${colors.bright}📝 Next Steps:${colors.reset}`);
console.log('1. Copy the JWT Secret above');
console.log('2. Set it in Railway environment variables');
console.log('3. Keep this secret secure - never commit to git\n');

console.log(`${colors.bright}🔧 Railway Setup:${colors.reset}`);
console.log('1. Go to https://railway.app/dashboard');
console.log('2. Select your API service');
console.log('3. Click "Variables"');
console.log(`4. Add: ${colors.green}JWT_SECRET=${jwtSecret}${colors.reset}`);
console.log('5. Redeploy the service\n');

console.log(`${colors.bright}⚡ Quick Setup (Copy-Paste):${colors.reset}`);
console.log(`${colors.yellow}export JWT_SECRET="${jwtSecret}"${colors.reset}\n`);

console.log(`${colors.bright}🔐 Security Notes:${colors.reset}`);
console.log('• This secret is used to sign and verify JWT tokens');
console.log('• Never share or commit this to version control');
console.log('• Store securely in your password manager');
console.log('• Rotate periodically (every 90 days recommended)\n');
