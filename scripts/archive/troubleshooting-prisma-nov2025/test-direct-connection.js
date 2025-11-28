// Direct PostgreSQL connection test using pg library
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Read .env file manually
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

console.log('='.repeat(80));
console.log('DIRECT PostgreSQL CONNECTION TEST');
console.log('='.repeat(80));
console.log('');

console.log('DATABASE_URL:', databaseUrl.replace(/:([^@]+)@/, ':****@'));
console.log('');

// Parse the URL
const url = new URL(databaseUrl);

const client = new Client({
  host: url.hostname,
  port: parseInt(url.port),
  database: url.pathname.substring(1),
  user: url.username,
  password: url.password,
});

console.log('Connection details:');
console.log(`  Host: ${url.hostname}`);
console.log(`  Port: ${url.port}`);
console.log(`  Database: ${url.pathname.substring(1)}`);
console.log(`  User: ${url.username}`);
console.log(`  Password: ${'*'.repeat(url.password.length)} (${url.password.length} chars)`);
console.log('');

console.log('Attempting to connect...');

client.connect()
  .then(() => {
    console.log('✅ Successfully connected to PostgreSQL!');
    console.log('');
    
    return client.query('SELECT version(), current_database(), current_user');
  })
  .then((result) => {
    console.log('✅ Query executed successfully!');
    console.log('');
    console.log('Database Info:');
    console.log(`  PostgreSQL Version: ${result.rows[0].version}`);
    console.log(`  Current Database: ${result.rows[0].current_database}`);
    console.log(`  Current User: ${result.rows[0].current_user}`);
    console.log('');
    console.log('='.repeat(80));
    console.log('✅ CONNECTION SUCCESSFUL!');
    console.log('='.repeat(80));
    
    return client.end();
  })
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ CONNECTION FAILED!');
    console.error('');
    console.error('Error Details:');
    console.error(`  Code: ${error.code}`);
    console.error(`  Message: ${error.message}`);
    console.error('');
    console.error('Full error:', error);
    console.error('');
    console.error('='.repeat(80));
    
    client.end().finally(() => {
      process.exit(1);
    });
  });
