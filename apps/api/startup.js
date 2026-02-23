/**
 * Railway Startup Script
 * Ensures clients table exists, then starts the API server.
 *
 * Previous version ran drizzle-kit migrate here — kept commented out
 * so it can be restored if we return to migration-based deploys.
 */

const { Pool } = require('pg');
const path = require('path');

async function main() {
  console.log('==========================================');
  console.log('🚀 Aethermind API - Startup');
  console.log('==========================================');

  const cwd = process.cwd();
  console.log('📁 Current directory:', cwd);
  console.log('📁 __dirname:', __dirname);
  console.log('');

  // ── Ensure clients table exists ──────────────────────────
  if (process.env.SKIP_DB_MIGRATE !== 'true' && process.env.DATABASE_URL) {
    console.log('🔄 Ensuring clients table exists...');

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
      connectionTimeoutMillis: 10000,
    });

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS clients (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_name VARCHAR(255) NOT NULL,
          access_token VARCHAR(80) NOT NULL UNIQUE,
          sdk_api_key VARCHAR(255) NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          notes TEXT
        );
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_clients_access_token ON clients(access_token);
      `);
      console.log('✅ clients table ready');
    } catch (error) {
      console.error('❌ Failed to ensure clients table:', error.message);
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    } finally {
      await pool.end();
    }
  } else {
    console.log('ℹ️  Skipping DB setup (SKIP_DB_MIGRATE=true or no DATABASE_URL)');
  }

  // ── Old drizzle-kit migration logic (disabled for B2B beta) ──
  // if (process.env.SKIP_DB_MIGRATE !== 'true') {
  //   console.log('🔄 Running database migrations...');
  //   try {
  //     const { stdout, stderr } = await execAsync(
  //       'npx tsx ./node_modules/drizzle-kit/bin.cjs migrate --config=./drizzle.config.ts',
  //       {
  //         cwd: __dirname,
  //         env: { ...process.env, NODE_OPTIONS: '' },
  //         timeout: 30000,
  //       }
  //     );
  //     if (stderr) console.error('⚠️  Migration stderr:', stderr);
  //     if (stdout) console.log('📋 Migration output:', stdout);
  //     console.log('✅ Database migrations completed');
  //   } catch (error) {
  //     console.error('❌ Migration failed!', error.message);
  //     if (process.env.NODE_ENV === 'production') {
  //       process.exit(1);
  //     }
  //   }
  // }

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
