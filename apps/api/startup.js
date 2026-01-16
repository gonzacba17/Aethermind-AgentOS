/**
 * Railway Startup Script
 * Syncs Drizzle schema and starts the API server
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function main() {
  console.log('🔄 Syncing database schema with Drizzle...');
  
  try {
    // Run drizzle-kit push to sync schema
    const { stdout, stderr } = await execAsync('npx drizzle-kit push', {
      cwd: '/app/apps/api',
      env: process.env
    });
    
    if (stdout) console.log(stdout);
    if (stderr) console.warn(stderr);
    
    console.log('✅ Schema sync completed');
  } catch (error) {
    console.warn('⚠️  Schema sync failed:', error.message);
    console.warn('Continuing to start application...');
  }
  
  console.log('🚀 Starting application...');
  
  // Start the main application
  require('./dist/index.js');
}

main().catch(err => {
  console.error('❌ Startup failed:', err);
  process.exit(1);
});
