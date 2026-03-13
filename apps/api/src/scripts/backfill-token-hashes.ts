/**
 * Backfill script: hash existing plaintext access tokens and SDK API keys.
 *
 * For each client row where accessTokenHash IS NULL:
 *   1. Reads the plaintext accessToken
 *   2. Computes bcrypt hash + prefix
 *   3. Updates the row with hash + prefix
 *
 * Same for sdkApiKeyHash.
 *
 * Idempotent: re-running skips rows that already have hashes.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/backfill-token-hashes.ts
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { clients } from '../db/schema';
import { isNull } from 'drizzle-orm';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('[backfill-token-hashes] Starting...');

  // Find all clients missing hashes
  const rows = await db.select({
    id: clients.id,
    accessToken: clients.accessToken,
    sdkApiKey: clients.sdkApiKey,
    accessTokenHash: clients.accessTokenHash,
    sdkApiKeyHash: clients.sdkApiKeyHash,
  })
    .from(clients)
    .where(isNull(clients.accessTokenHash));

  if (rows.length === 0) {
    console.log('[backfill-token-hashes] All tokens already hashed. Nothing to do.');
    process.exit(0);
  }

  console.log(`[backfill-token-hashes] Found ${rows.length} client(s) to backfill`);

  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const accessTokenHash = await bcrypt.hash(row.accessToken, 10);
      const accessTokenPrefix = row.accessToken.slice(0, 16);
      const sdkApiKeyHash = row.sdkApiKeyHash || await bcrypt.hash(row.sdkApiKey, 10);
      const sdkApiKeyPrefix = row.sdkApiKey.slice(0, 20);

      await db.update(clients)
        .set({
          accessTokenHash,
          accessTokenPrefix,
          sdkApiKeyHash,
          sdkApiKeyPrefix,
        })
        .where(eq(clients.id, row.id));

      updated++;
      console.log(`  [${updated}/${rows.length}] Hashed tokens for client ${row.id}`);
    } catch (err) {
      console.error(`  ERROR hashing tokens for client ${row.id}:`, (err as Error).message);
      errors++;
    }
  }

  console.log(`\n[backfill-token-hashes] Done. Updated: ${updated}, Errors: ${errors}`);
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[backfill-token-hashes] Fatal error:', err);
  process.exit(1);
});
