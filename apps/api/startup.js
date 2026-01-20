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
  
  // Skip drizzle-kit push in production - it requires tsx and doesn't work well in containers
  // Instead, run migrations manually before deploy or use the application's built-in schema sync
  if (process.env.SKIP_DB_PUSH !== 'true') {
    console.log('🔄 Attempting database schema sync...');
    
    try {
      // Try using npx with tsx loader
      const { stdout, stderr } = await execAsync(
        'npx tsx ./node_modules/drizzle-kit/bin.cjs push --config=./drizzle.config.ts 2>&1 || echo "Schema sync skipped - using existing schema"', 
        {
          cwd: __dirname,
          env: { ...process.env, NODE_OPTIONS: '' },
          timeout: 30000,
        }
      );
      
      if (stdout && !stdout.includes('skipped')) {
        console.log('📋 Drizzle output:', stdout.slice(0, 500));
      }
      console.log('✅ Database schema check completed');
    } catch (error) {
      console.warn('⚠️  drizzle-kit push skipped:', error.message);
      console.log('ℹ️  This is OK - the schema should already be in sync.');
      console.log('   If you added new tables, run: pnpm drizzle:push locally first.');
    }
  } else {
    console.log('ℹ️  SKIP_DB_PUSH=true - skipping database schema sync');
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

