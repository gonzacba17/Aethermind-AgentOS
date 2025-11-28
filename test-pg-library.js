// Test using the exact same pg library that Prisma uses
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

console.log('='.repeat(80));
console.log('PG LIBRARY CONNECTION TEST (Same as Prisma uses)');
console.log('='.repeat(80));
console.log('');

console.log('DATABASE_URL:', databaseUrl.replace(/:([^@]+)@/, ':****@'));
console.log('');

// Try to require pg from Prisma's dependencies
let Client;
try {
  // Try to load pg from Prisma's node_modules
  const pgPath = path.join(__dirname, 'node_modules', '.pnpm', 'pg@8.16.3', 'node_modules', 'pg');
  Client = require(pgPath).Client;
  console.log('✅ Loaded pg library from:', pgPath);
} catch (error) {
  console.error('❌ Could not load pg library');
  console.error('Error:', error.message);
  process.exit(1);
}

console.log('');

// Parse URL
const url = new URL(databaseUrl);

const client = new Client({
  connectionString: databaseUrl,
});

console.log('Connection details:');
console.log(`  Host: ${url.hostname}`);
console.log(`  Port: ${url.port}`);
console.log(`  Database: ${url.pathname.substring(1)}`);
console.log(`  User: ${url.username}`);
console.log(`  Password: ${'*'.repeat(url.password.length)} (${url.password.length} chars)`);
console.log('');

console.log('Attempting to connect using pg library...');
console.log('');

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
    console.log('✅ CONNECTION SUCCESSFUL - Same library as Prisma!');
    console.log('='.repeat(80));
    console.log('');
    console.log('This means the DATABASE_URL is correct and should work with Prisma.');
    console.log('The issue might be with Prisma configuration or cache.');
    
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
    console.error('Full error:');
    console.error(error);
    console.error('');
    console.error('='.repeat(80));
    
    client.end().finally(() => {
      process.exit(1);
    });
  });
