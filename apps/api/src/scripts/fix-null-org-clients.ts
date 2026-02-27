/**
 * Repair script: fix clients with organization_id = NULL
 *
 * For each client row where organization_id IS NULL:
 *   1. Creates a new organization (name = client.companyName)
 *   2. Links the client to the new organization
 *   3. Links any user whose email matches client.companyName to the org
 *
 * Idempotent: re-running skips clients that already have an organization_id.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/fix-null-org-clients.ts
 *
 * Requires DATABASE_URL in env (or .env file loaded via dotenv).
 */

import 'dotenv/config';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { clients, organizations, users } from '../db/schema';
import { eq, isNull } from 'drizzle-orm';

async function main() {
  console.log('[fix-null-org-clients] Starting...');

  // Find all clients with null organization_id
  const orphanClients = await db.select({
    id: clients.id,
    companyName: clients.companyName,
    accessToken: clients.accessToken,
    organizationId: clients.organizationId,
  })
    .from(clients)
    .where(isNull(clients.organizationId));

  if (orphanClients.length === 0) {
    console.log('[fix-null-org-clients] No orphan clients found. Nothing to do.');
    process.exit(0);
  }

  console.log(`[fix-null-org-clients] Found ${orphanClients.length} client(s) with NULL organization_id`);

  let fixed = 0;
  let errors = 0;

  for (const client of orphanClients) {
    try {
      console.log(`  Processing client "${client.companyName}" (${client.id})...`);

      const orgSlug = `org_${randomBytes(8).toString('hex')}`;
      const orgApiKeyPlaintext = `aether_org_${randomBytes(32).toString('hex')}`;
      const orgApiKeyHash = await bcrypt.hash(orgApiKeyPlaintext, 10);
      const orgApiKeyPrefix = orgApiKeyPlaintext.slice(0, 16);

      await db.transaction(async (tx) => {
        // Create organization
        const [org] = await tx.insert(organizations).values({
          name: client.companyName,
          slug: orgSlug,
          apiKeyHash: orgApiKeyHash,
          apiKeyPrefix: orgApiKeyPrefix,
        }).returning();

        if (!org) throw new Error('Insert returned no org');

        // Link client to organization
        await tx.update(clients)
          .set({ organizationId: org.id })
          .where(eq(clients.id, client.id));

        // Link matching user (by email = companyName) to the same org
        const [matchingUser] = await tx.select({ id: users.id, organizationId: users.organizationId })
          .from(users)
          .where(eq(users.email, client.companyName))
          .limit(1);

        if (matchingUser && !matchingUser.organizationId) {
          await tx.update(users)
            .set({ organizationId: org.id })
            .where(eq(users.id, matchingUser.id));
          console.log(`    Linked user ${matchingUser.id} to org ${org.id}`);
        }

        console.log(`    Created org ${org.id} (slug: ${orgSlug}), linked to client ${client.id}`);
      });

      fixed++;
    } catch (err) {
      console.error(`  ERROR fixing client ${client.id}:`, (err as Error).message);
      errors++;
    }
  }

  console.log(`\n[fix-null-org-clients] Done. Fixed: ${fixed}, Errors: ${errors}`);
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[fix-null-org-clients] Fatal error:', err);
  process.exit(1);
});
