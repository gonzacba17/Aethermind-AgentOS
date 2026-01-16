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
    // Run drizzle-kit push to sync schema
    const { stdout, stderr } = await execAsync('npx drizzle-kit push --config=./drizzle.config.ts', {
      cwd: __dirname,
      env: process.env
    });
    
    if (stdout) {
      console.log('📋 Drizzle output:');
      console.log(stdout);
    }
    if (stderr) {
      console.warn('⚠️  Drizzle warnings:');
      console.warn(stderr);
    }
    
    console.log('✅ Schema sync completed successfully');
  } catch (error) {
    console.error('❌ Schema sync failed:', error.message);
    if (error.stdout) console.log('stdout:', error.stdout);
    if (error.stderr) console.error('stderr:', error.stderr);
    console.warn('⚠️  Continuing to start application...');
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
