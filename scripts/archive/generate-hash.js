const crypto = require('crypto');
const bcrypt = require('bcryptjs');

async function generateApiKey() {
  const apiKey = `ak_${crypto.randomBytes(32).toString('hex')}`;
  
  const saltRounds = 10;
  const hash = await bcrypt.hash(apiKey, saltRounds);

  console.log('\n========================================');
  console.log('  Aethermind API Key Generator');
  console.log('========================================\n');
  console.log('🔑 API Key (GUARDA ESTO - no se puede recuperar):');
  console.log(`\n  ${apiKey}\n`);
  console.log('📋 Hash para Railway (copia esto en API_KEY_HASH):');
  console.log(`\n  ${hash}\n`);
  console.log('----------------------------------------');
  console.log('💡 Uso en requests HTTP:');
  console.log(`  curl -H "X-API-Key: ${apiKey}" https://tu-api.railway.app/api/agents\n`);
  console.log('========================================\n');
}

generateApiKey().catch(console.error);
