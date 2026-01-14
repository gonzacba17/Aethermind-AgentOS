import crypto from 'crypto';
import bcrypt from 'bcryptjs';

async function generateApiKey(): Promise<void> {
  const apiKey = `ak_${crypto.randomBytes(32).toString('hex')}`;

  const saltRounds = 10;
  const hash = await bcrypt.hash(apiKey, saltRounds);

  console.log('\n========================================');
  console.log('  Aethermind API Key Generator');
  console.log('========================================\n');
  console.log('API Key (save this securely - it cannot be recovered):');
  console.log(`  ${apiKey}\n`);
  console.log('API Key Hash (add this to your .env file):');
  console.log(`  API_KEY_HASH=${hash}\n`);
  console.log('----------------------------------------');
  console.log('Usage in API requests:');
  console.log(`  curl -H "X-API-Key: ${apiKey}" http://localhost:3001/api/agents\n`);
  console.log('========================================\n');
}

generateApiKey().catch(console.error);
