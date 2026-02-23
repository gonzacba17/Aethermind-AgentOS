/**
 * Create the clients table on the remote database.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/create-clients-table.ts
 */

import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' },
  connectionTimeoutMillis: 15000,
});

async function main() {
  console.log('Connecting to database...');

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
  console.log('✅ clients table created (or already exists)');

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_clients_access_token ON clients(access_token);
  `);
  console.log('✅ idx_clients_access_token index created (or already exists)');

  // Quick verification
  const res = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'clients'
    ORDER BY ordinal_position
  `);
  console.log('\nTable columns:');
  for (const row of res.rows) {
    console.log(`  ${row.column_name} (${row.data_type})`);
  }

  await pool.end();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
