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
  console.log('🔄 Running database migrations with Drizzle...');
  
  try {
    // Check if migrations exist first
    const migrationsExist = fs.existsSync(migrationsPath) && 
                           fs.readdirSync(migrationsPath).some(f => f.endsWith('.sql'));
    
    if (!migrationsExist) {
      console.warn('⚠️  No migrations found - database may not be initialized');
      console.warn('   Run: npx drizzle-kit generate to create migrations');
    } else {
      // Run drizzle-kit migrate to apply migrations from the migrations folder
      console.log('📋 Applying SQL migrations...');
      const { stdout, stderr } = await execAsync('npx drizzle-kit migrate --config=./drizzle.config.ts', {
        cwd: __dirname,
        env: process.env,
        timeout: 30000, // 30 second timeout for migrations
      });
      
      if (stdout) {
        console.log('📋 Drizzle migration output:');
        console.log(stdout);
      }
      if (stderr) {
        console.warn('⚠️  Drizzle migration warnings:');
        console.warn(stderr);
      }
      
      console.log('✅ Database migrations completed successfully');
    }
  } catch (error) {
    console.error('❌ Database migration failed:', error.message);
    if (error.stdout) console.log('stdout:', error.stdout);
    if (error.stderr) console.error('stderr:', error.stderr);
    
    // Log helpful diagnostics
    console.error('');
    console.error('📊 Migration Diagnostics:');
    console.error(`   DATABASE_URL configured: ${!!process.env.DATABASE_URL}`);
    console.error(`   Migrations path: ${migrationsPath}`);
    console.error(`   Migrations exist: ${fs.existsSync(migrationsPath)}`);
    
    console.warn('⚠️  Continuing to start application despite migration failure...');
    console.warn('   The database may be in an inconsistent state.');
    console.warn('   Verify migrations manually if needed.');
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
