// Simple connection test using child_process to call psql
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read DATABASE_URL from .env
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');
let databaseUrl = null;

for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('DATABASE_URL=')) {
    databaseUrl = trimmed.substring('DATABASE_URL='.length);
    break;
  }
}

console.log('Testing connection with DATABASE_URL from .env...');
console.log('URL:', databaseUrl.replace(/:([^@]+)@/, ':****@'));
console.log('');

// Parse URL
const url = new URL(databaseUrl);
const password = url.password;

console.log(`Password length: ${password.length}`);
console.log(`Password (for verification): "${password}"`);
console.log('');

// Try to connect using docker exec psql
try {
  const result = execSync(
    `docker exec -e PGPASSWORD=${password} aethermindagentos-postgres-1 psql -h localhost -U ${url.username} -d ${url.pathname.substring(1)} -c "SELECT version();"`,
    { encoding: 'utf8' }
  );
  
  console.log('✅ SUCCESS! Connection works from host machine via Docker!');
  console.log('');
  console.log('Result:');
  console.log(result);
} catch (error) {
  console.error('❌ FAILED! Connection does not work.');
  console.error('');
  console.error('Error:', error.message);
  console.error('');
  console.error('This means the password in DATABASE_URL does not match PostgreSQL.');
}
