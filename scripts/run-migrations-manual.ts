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

async function run() {
  console.log('Connecting to database...');
  console.log('  URL prefix:', DATABASE_URL!.substring(0, 30) + '...');
  console.log('  SSL rejectUnauthorized:', sslConfig.rejectUnauthorized);

  const client = await pool.connect();
  try {
    // Quick sanity check
    await client.query('SELECT 1');
    console.log('✅ Connected successfully\n');

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
  } finally {
    client.release();
    await pool.end();
    console.log('Connection closed.');
  }
}

run().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
