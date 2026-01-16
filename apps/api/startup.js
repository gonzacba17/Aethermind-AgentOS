/**
 * Railway Startup Script
 * Syncs Drizzle schema and starts the API server
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const execAsync = promisify(exec);

async function main() {
  console.log('==========================================');
  console.log('🚀 Aethermind API - Startup');
  console.log('==========================================');
  
  // Detect working directory
  const cwd = process.cwd();
  console.log('📁 Current directory:', cwd);
  console.log('📁 __dirname:', __dirname);
  
  // Check if migrations exist
  const migrationsPath = path.join(__dirname, 'src', 'db', 'migrations');
  console.log('🔍 Checking migrations at:', migrationsPath);
  
  if (fs.existsSync(migrationsPath)) {
    console.log('✅ Migrations folder found');
    const files = fs.readdirSync(migrationsPath);
    console.log('📄 Migration files:', files.filter(f => f.endsWith('.sql')));
  } else {
    console.warn('⚠️  Migrations folder not found!');
  }
  
  console.log('');
  console.log('🔄 Syncing database schema with Drizzle...');
  
  try {
    // Use drizzle-kit push instead of migrate (more resilient for Railway)
    // Push directly syncs the schema without requiring migrations table
    console.log('📋 Pushing schema to database...');
    const { stdout, stderr } = await execAsync('npx drizzle-kit push --config=./drizzle.config.ts --yes', {
      cwd: __dirname,
      env: process.env,
      timeout: 45000, // 45 second timeout
    });
    
    if (stdout) {
      console.log('📋 Drizzle output:');
      console.log(stdout);
    }
    if (stderr && !stderr.includes('No schema changes')) {
      console.warn('⚠️  Drizzle warnings:');
      console.warn(stderr);
    }
    
    console.log('✅ Database schema sync completed');
  } catch (error) {
    console.error('❌ Database schema sync failed:', error.message);
    
    // Log diagnostics
    console.error('');
    console.error('📊 Database Diagnostics:');
    console.error(`   DATABASE_URL configured: ${!!process.env.DATABASE_URL}`);
    console.error(`   Migrations path: ${migrationsPath}`);
    console.error(`   Migrations exist: ${fs.existsSync(migrationsPath)}`);
    
    console.warn('⚠️  Continuing to start application...');
    console.warn('   The database schema may need manual verification.');
  }
  
  console.log('');
  console.log('🚀 Starting application server...');
  
  // Start the main application
  require('./dist/index.js');
}

main().catch(err => {
  console.error('❌ Startup failed:', err);
  console.error(err.stack);
  process.exit(1);
});
