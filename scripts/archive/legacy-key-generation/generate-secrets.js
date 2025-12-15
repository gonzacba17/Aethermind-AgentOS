const crypto = require('crypto');

function generateSecrets() {
  // Generate JWT Secret (64 bytes = 128 hex chars, muy seguro)
  const jwtSecret = crypto.randomBytes(64).toString('hex');
  
  // Generate API Key
  const apiKey = `ak_${crypto.randomBytes(32).toString('hex')}`;
  
  console.log('\n========================================');
  console.log('  🔐 Aethermind Security Secrets');
  console.log('========================================\n');
  
  console.log('📝 JWT_SECRET (para autenticación de tokens):');
  console.log(`   ${jwtSecret}\n`);
  
  console.log('🔑 API_KEY (guarda esto de forma segura - NO se puede recuperar):');
  console.log(`   ${apiKey}\n`);
  
  console.log('⚠️  IMPORTANTE: Necesitas hashear el API_KEY con bcrypt');
  console.log('   Ejecuta: pnpm run generate-api-key');
  console.log('   O usa el API_KEY arriba con el script existente\n');
  
  console.log('========================================');
  console.log('📋 Variables para tu .env / Railway:');
  console.log('========================================\n');
  console.log(`JWT_SECRET=${jwtSecret}`);
  console.log(`\n# Luego de hashear el API_KEY:`);
  console.log(`# API_KEY_HASH=<hash generado>\n`);
  
  console.log('========================================');
  console.log('💡 Uso del API Key en requests:');
  console.log('========================================\n');
  console.log(`curl -H "X-API-Key: ${apiKey}" https://tu-api.railway.app/api/agents\n`);
  console.log('========================================\n');
  
  console.log('🔄 Próximo paso:');
  console.log('   Copia el API_KEY de arriba y ejecuta:');
  console.log('   node -e "const bcrypt = require(\'bcryptjs\'); bcrypt.hash(\'TU_API_KEY\', 10).then(console.log)"\n');
}

generateSecrets();
