// Simple test to check DATABASE_URL parsing
const fs = require('fs');
const path = require('path');

// Read .env file
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

// Parse DATABASE_URL
const lines = envContent.split('\n');
let databaseUrl = null;

for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('DATABASE_URL=')) {
    databaseUrl = trimmed.substring('DATABASE_URL='.length);
    break;
  }
}

console.log('Raw DATABASE_URL from .env file:');
console.log(JSON.stringify(databaseUrl));
console.log('');
console.log('Length:', databaseUrl?.length);
console.log('');

// Check for invisible characters
if (databaseUrl) {
  console.log('Character codes (showing only special/invisible):');
  let hasSpecialChars = false;
  for (let i = 0; i < databaseUrl.length; i++) {
    const char = databaseUrl[i];
    const code = databaseUrl.charCodeAt(i);
    if (code < 32 || code > 126) {
      console.log(`  Position ${i}: char='${char}' code=${code} (INVISIBLE/SPECIAL)`);
      hasSpecialChars = true;
    }
  }
  
  if (!hasSpecialChars) {
    console.log('  No special or invisible characters found!');
  }
  
  console.log('');
  console.log('Trimmed version:');
  console.log(JSON.stringify(databaseUrl.trim()));
  console.log('');
  console.log('Are they equal?', databaseUrl === databaseUrl.trim());
  console.log('');
  console.log('Expected:');
  console.log(JSON.stringify('postgresql://aethermind:testpass123@localhost:5432/aethermind'));
  console.log('');
  console.log('Match:', databaseUrl.trim() === 'postgresql://aethermind:testpass123@localhost:5432/aethermind');
}
