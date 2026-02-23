import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

// Same SSL config as apps/api/src/db/index.ts
const sslConfig = {
  rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
};

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: sslConfig,
  connectionTimeoutMillis: 10000,
});

const MIGRATIONS_DIR = path.resolve(__dirname, '../apps/api/src/db/migrations');

const migrations = [
  '0014_add_api_key_prefix.sql',
  '0015_rename_user_api_key_to_hash.sql',
];

async function showColumns(client: import('pg').PoolClient, table: string) {
  const res = await client.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  console.log(`  Columns in "${table}":`);
  for (const row of res.rows) {
    console.log(`    - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
  }
  console.log();
}

async function run() {
  console.log('Connecting to database...');
  console.log('  URL prefix:', DATABASE_URL!.substring(0, 30) + '...');
  console.log('  SSL rejectUnauthorized:', sslConfig.rejectUnauthorized);

  const client = await pool.connect();
  try {
    // Quick sanity check
    await client.query('SELECT 1');
    console.log('✅ Connected successfully\n');

    // ── BEFORE: show current state ──
    console.log('════════════════════════════════════════');
    console.log('  BEFORE MIGRATIONS — Current DB state');
    console.log('════════════════════════════════════════');
    await showColumns(client, 'users');
    await showColumns(client, 'organizations');

    // ── Run migrations ──
    for (const file of migrations) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      console.log(`── Running ${file} ──`);

      const sql = fs.readFileSync(filePath, 'utf-8');
      console.log(sql.trim());
      console.log();

      try {
        await client.query(sql);
        console.log(`✅ ${file} — OK\n`);
      } catch (err) {
        const e = err as Error & { code?: string; detail?: string };
        console.error(`❌ ${file} — FAILED`);
        console.error('   message:', e.message);
        console.error('   code:   ', e.code);
        if (e.detail) console.error('   detail: ', e.detail);
        console.error();
        // Don't run the next migration if this one failed
        process.exitCode = 1;
        break;
      }
    }

    // ── AFTER: confirm final state ──
    console.log('════════════════════════════════════════');
    console.log('  AFTER MIGRATIONS — Updated DB state');
    console.log('════════════════════════════════════════');
    await showColumns(client, 'users');
    await showColumns(client, 'organizations');

    console.log('Done. Verify that:');
    console.log('  ✓ users has "api_key_hash" (NOT "api_key")');
    console.log('  ✓ organizations has "api_key_prefix"');
  } finally {
    client.release();
    await pool.end();
    console.log('\nConnection closed.');
  }
}

run().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
