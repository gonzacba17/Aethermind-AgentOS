/**
 * Railway Startup Script
 * Runs Drizzle migrations and starts the API server
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
  
  // Run drizzle-kit migrate (NOT push — push is destructive)
  if (process.env.SKIP_DB_MIGRATE !== 'true') {
    console.log('🔄 Running database migrations...');
    
    try {
      const { stdout, stderr } = await execAsync(
        'npx tsx ./node_modules/drizzle-kit/bin.cjs migrate --config=./drizzle.config.ts 2>&1', 
        {
          cwd: __dirname,
          env: { ...process.env, NODE_OPTIONS: '' },
          timeout: 30000,
        }
      );
      
      if (stdout) {
        console.log('📋 Migration output:', stdout.slice(0, 500));
      }
      console.log('✅ Database migrations completed');
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        console.error('❌ FATAL: Database migration failed in production:', error.message);
        console.error('   This is a blocking error. Fix migrations before deploying.');
        process.exit(1);
      } else {
        console.warn('⚠️  Migration failed (non-production):', error.message);
        console.log('ℹ️  Run migrations manually: pnpm drizzle:push');
      }
    }
  } else {
    console.log('ℹ️  SKIP_DB_MIGRATE=true - skipping database migrations');
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
