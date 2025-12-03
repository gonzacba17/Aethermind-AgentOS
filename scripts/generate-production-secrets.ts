import crypto from 'crypto';
import bcrypt from 'bcryptjs';

async function generateCompleteSecrets() {
  // Generate JWT Secret (64 bytes = 128 hex chars)
  const jwtSecret = crypto.randomBytes(64).toString('hex');
  
  // Generate API Key
  const apiKey = `ak_${crypto.randomBytes(32).toString('hex')}`;
  
  // Hash the API Key with bcrypt
  const saltRounds = 10;
  const apiKeyHash = await bcrypt.hash(apiKey, saltRounds);
  
  console.log('\n========================================');
  console.log('  🔐 Aethermind Production Secrets');
  console.log('========================================\n');
  
  console.log('📝 JWT_SECRET:');
  console.log(`${jwtSecret}\n`);
  
  console.log('🔑 API_KEY (¡GUÁRDALO! No se puede recuperar):');
  console.log(`${apiKey}\n`);
  
  console.log('🔒 API_KEY_HASH:');
  console.log(`${apiKeyHash}\n`);
  
  console.log('========================================');
  console.log('📋 COPIA ESTO A RAILWAY:');
  console.log('========================================\n');
  console.log(`JWT_SECRET=${jwtSecret}`);
  console.log(`API_KEY_HASH=${apiKeyHash}\n`);
  
  console.log('========================================');
  console.log('💾 GUARDA ESTO EN TU PASSWORD MANAGER:');
  console.log('========================================\n');
  console.log(`API_KEY=${apiKey}\n`);
  
  console.log('========================================');
  console.log('💡 Uso en requests a tu API:');
  console.log('========================================\n');
  console.log(`curl -H "X-API-Key: ${apiKey}" https://tu-api.railway.app/api/health\n`);
  console.log('========================================\n');
}

generateCompleteSecrets().catch(console.error);
