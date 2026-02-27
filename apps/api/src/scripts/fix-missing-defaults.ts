/**
 * Fix missing DEFAULT values on NOT NULL columns in production.
 *
 * drizzle-kit push does not always sync column defaults. These three tables
 * have updated_at as NOT NULL but no DEFAULT in PostgreSQL, causing INSERT
 * failures when Drizzle sends "default" for the column value.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx apps/api/src/scripts/fix-missing-defaults.ts
 *
 * Idempotent: safe to run multiple times.
 */
import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const fixes = [
  { table: 'organizations', column: 'updated_at', defaultExpr: 'now()' },
  { table: 'users',         column: 'updated_at', defaultExpr: 'now()' },
  { table: 'budgets',       column: 'updated_at', defaultExpr: 'now()' },
];

async function main() {
  console.log('[fix-missing-defaults] Starting...\n');

  for (const fix of fixes) {
    // Check current state
    const check = await pool.query(
      `SELECT column_default FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [fix.table, fix.column]
    );

    const current = check.rows[0]?.column_default;
    if (current) {
      console.log(`  [SKIP] ${fix.table}.${fix.column} already has DEFAULT: ${current}`);
      continue;
    }

    // Apply the fix
    const sql = `ALTER TABLE "${fix.table}" ALTER COLUMN "${fix.column}" SET DEFAULT ${fix.defaultExpr}`;
    console.log(`  [FIX]  ${sql}`);
    await pool.query(sql);

    // Also backfill any existing NULL values
    const backfill = `UPDATE "${fix.table}" SET "${fix.column}" = now() WHERE "${fix.column}" IS NULL`;
    const result = await pool.query(backfill);
    if (result.rowCount && result.rowCount > 0) {
      console.log(`         Backfilled ${result.rowCount} NULL rows`);
    }

    console.log(`         Done.`);
  }

  // Verify
  console.log('\n[fix-missing-defaults] Verification:\n');
  for (const fix of fixes) {
    const res = await pool.query(
      `SELECT column_default, is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [fix.table, fix.column]
    );
    const row = res.rows[0];
    console.log(`  ${fix.table}.${fix.column}: default=${row?.column_default || 'NONE'}  nullable=${row?.is_nullable}`);
  }

  await pool.end();
  console.log('\n[fix-missing-defaults] Complete.');
}

main().catch(e => { console.error(e); process.exit(1); });
