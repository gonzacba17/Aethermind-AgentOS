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
        'npx tsx ./node_modules/drizzle-kit/bin.cjs migrate --config=./drizzle.config.ts',
        {
          cwd: __dirname,
          env: { ...process.env, NODE_OPTIONS: '' },
          timeout: 30000,
        }
      );

      if (stderr) {
        console.error('⚠️  Migration stderr:', stderr);
      }
      if (stdout) {
        console.log('📋 Migration output:', stdout);
      }
      console.log('✅ Database migrations completed');
    } catch (error) {
      console.error('❌ Migration failed!');
      console.error('   Command:', error.cmd || 'unknown');
      console.error('   Exit code:', error.code);
      if (error.stdout) {
        console.error('   stdout:', error.stdout);
      }
      if (error.stderr) {
        console.error('   stderr:', error.stderr);
      }
      console.error('   Error message:', error.message);

      if (process.env.NODE_ENV === 'production') {
        console.error('   This is a blocking error. Fix migrations or set SKIP_DB_MIGRATE=true to bypass.');
        process.exit(1);
      } else {
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
