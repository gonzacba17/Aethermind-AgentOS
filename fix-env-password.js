// Fix POSTGRES_PASSWORD in .env file
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
let content = fs.readFileSync(envPath, 'utf8');

console.log('Before fix:');
const lines = content.split('\n');
const passwordLine = lines.find(l => l.trim().startsWith('POSTGRES_PASSWORD='));
if (passwordLine) {
  console.log(`  POSTGRES_PASSWORD line: "${passwordLine}"`);
  console.log(`  Length: ${passwordLine.length}`);
  console.log(`  Hex:`, Buffer.from(passwordLine).toString('hex'));
}

// Replace the line with the correct value
content = content.replace(/POSTGRES_PASSWORD=.*/g, 'POSTGRES_PASSWORD=testpass123');

fs.writeFileSync(envPath, content, 'utf8');

console.log('\nAfter fix:');
const newContent = fs.readFileSync(envPath, 'utf8');
const newLines = newContent.split('\n');
const newPasswordLine = newLines.find(l => l.trim().startsWith('POSTGRES_PASSWORD='));
if (newPasswordLine) {
  console.log(`  POSTGRES_PASSWORD line: "${newPasswordLine}"`);
  console.log(`  Length: ${newPasswordLine.length}`);
}

console.log('\n✅ Fixed POSTGRES_PASSWORD in .env');
