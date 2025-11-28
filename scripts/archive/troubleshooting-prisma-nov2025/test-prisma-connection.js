#!/usr/bin/env node
/**
 * Prisma PostgreSQL Connection Test
 * Tests the database connection and displays diagnostic information
 */

// Load environment variables from .env file FIRST
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

// Create Prisma client
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testConnection() {
  console.log('='.repeat(80));
  console.log('PRISMA PostgreSQL CONNECTION TEST');
  console.log('='.repeat(80));
  console.log('');

  // Display DATABASE_URL (with password masked)
  const databaseUrl = process.env.DATABASE_URL || 'NOT SET';
  const maskedUrl = databaseUrl.replace(/:([^@]+)@/, ':****@');
  console.log('📋 Configuration:');
  console.log(`   DATABASE_URL: ${maskedUrl}`);
  console.log('');

  // Parse and display connection details
  try {
    const url = new URL(databaseUrl);
    console.log('🔍 Parsed Connection Details:');
    console.log(`   Protocol: ${url.protocol}`);
    console.log(`   Username: ${url.username}`);
    console.log(`   Password: ${'*'.repeat(url.password.length)} (${url.password.length} chars)`);
    console.log(`   Host: ${url.hostname}`);
    console.log(`   Port: ${url.port}`);
    console.log(`   Database: ${url.pathname.substring(1)}`);
    console.log('');
  } catch (error) {
    console.error('❌ Error parsing DATABASE_URL:', error.message);
    console.log('');
  }

  // Test connection
  console.log('🔌 Testing database connection...');
  console.log('');

  try {
    // Try to connect and run a simple query
    await prisma.$connect();
    console.log('✅ Successfully connected to PostgreSQL!');
    console.log('');

    // Test a simple query
    console.log('📊 Running test query...');
    const result = await prisma.$queryRaw`SELECT version() as version, current_database() as database, current_user as user`;
    console.log('✅ Query executed successfully!');
    console.log('');
    console.log('Database Info:');
    console.log(`   PostgreSQL Version: ${result[0].version}`);
    console.log(`   Current Database: ${result[0].database}`);
    console.log(`   Current User: ${result[0].user}`);
    console.log('');

    // Check if tables exist
    console.log('📋 Checking for tables...');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    if (tables.length > 0) {
      console.log(`✅ Found ${tables.length} table(s):`);
      tables.forEach(t => console.log(`   - ${t.table_name}`));
    } else {
      console.log('⚠️  No tables found in the database');
      console.log('   Run: npx prisma db push');
    }
    console.log('');

    console.log('='.repeat(80));
    console.log('✅ ALL TESTS PASSED - Prisma can connect to PostgreSQL!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ CONNECTION FAILED!');
    console.error('');
    console.error('Error Details:');
    console.error(`   Code: ${error.code}`);
    console.error(`   Message: ${error.message}`);
    console.error('');
    
    if (error.code === 'P1000') {
      console.error('🔍 Authentication Error (P1000) - Possible causes:');
      console.error('   1. Wrong password in DATABASE_URL');
      console.error('   2. User does not exist');
      console.error('   3. User does not have permission to access the database');
      console.error('');
      console.error('💡 Troubleshooting steps:');
      console.error('   1. Verify PostgreSQL is running: docker ps');
      console.error('   2. Check password in .env matches docker-compose.yml');
      console.error('   3. Test direct connection: psql -h localhost -U aethermind -d aethermind');
      console.error('   4. Reset password if needed (see reset-postgres-password.ps1)');
    }
    
    console.error('');
    console.error('='.repeat(80));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testConnection()
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
