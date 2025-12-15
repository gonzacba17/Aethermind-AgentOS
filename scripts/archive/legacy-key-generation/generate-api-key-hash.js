#!/usr/bin/env node

/**
 * Generate API Key Hash for Production
 * 
 * This script generates a secure API key and its bcrypt hash
 * for use in Railway environment variables.
 * 
 * Usage:
 *   node scripts/generate-api-key-hash.js
 *   node scripts/generate-api-key-hash.js "my-custom-key"
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

console.log(`${colors.blue}${colors.bright}🔐 API Key Generator for Aethermind AgentOS${colors.reset}\n`);

// Get API key from argument or generate a secure random one
const apiKey = process.argv[2] || `aethermind_${crypto.randomBytes(32).toString('hex')}`;

// Generate bcrypt hash (10 rounds)
const hash = bcrypt.hashSync(apiKey, 10);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`${colors.green}✅ API Key Generated Successfully!${colors.reset}\n`);

console.log(`${colors.bright}API Key (Store securely - you won't see this again):${colors.reset}`);
console.log(`${colors.yellow}${apiKey}${colors.reset}\n`);

console.log(`${colors.bright}API Key Hash (Set this in Railway as API_KEY_HASH):${colors.reset}`);
console.log(`${colors.green}${hash}${colors.reset}\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log(`${colors.bright}📝 Next Steps:${colors.reset}`);
console.log('1. Copy the API Key and store it in a password manager');
console.log('2. Set API_KEY_HASH in Railway environment variables');
console.log('3. Use the API Key in X-API-Key header for API requests\n');

console.log(`${colors.bright}🔧 Railway Setup:${colors.reset}`);
console.log('1. Go to https://railway.app/dashboard');
console.log('2. Select your API service');
console.log('3. Click "Variables"');
console.log(`4. Add: ${colors.green}API_KEY_HASH=${hash}${colors.reset}`);
console.log('5. Redeploy the service\n');

console.log(`${colors.bright}🧪 Test API Request:${colors.reset}`);
console.log(`${colors.blue}curl -H "X-API-Key: ${apiKey}" https://your-api.railway.app/api/health${colors.reset}\n`);
