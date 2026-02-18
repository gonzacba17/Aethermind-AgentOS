/**
 * Retry Failed Telemetry Events
 * 
 * Reads failed events from the dead-letter queue (./failed-events/)
 * and retries inserting them into the database.
 * 
 * Usage: npx tsx scripts/retry-failed-events.ts
 */

import path from 'path';
import fs from 'fs';
import { db } from '../src/db/index.js';
import { telemetryEvents } from '../src/db/schema.js';

const DLQ_DIR = path.resolve(process.cwd(), 'failed-events');
const PROCESSED_DIR = path.join(DLQ_DIR, 'processed');
const MAX_RETRIES = 3;

interface DLQPayload {
  organizationId: string;
  events: Array<{
    timestamp: string;
    provider: string;
    model: string;
    tokens: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    cost: number;
    latency: number;
    status: string;
    error?: string;
  }>;
  error: string;
  failedAt: string;
  retryCount: number;
}

async function main() {
  console.log('🔄 Retry Failed Events — Dead Letter Queue Processor');
  console.log('====================================================');

  if (!fs.existsSync(DLQ_DIR)) {
    console.log('ℹ️  No failed-events directory found. Nothing to retry.');
    return;
  }

  // Ensure processed directory exists
  if (!fs.existsSync(PROCESSED_DIR)) {
    fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  }

  const files = fs.readdirSync(DLQ_DIR).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('✅ No failed events to process.');
    return;
  }

  console.log(`📄 Found ${files.length} failed event files\n`);

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    const filepath = path.join(DLQ_DIR, file);
    console.log(`Processing: ${file}`);

    try {
      const raw = fs.readFileSync(filepath, 'utf-8');
      const payload: DLQPayload = JSON.parse(raw);

      // Check retry count
      if (payload.retryCount >= MAX_RETRIES) {
        console.log(`  ⏭  Skipped — max retries (${MAX_RETRIES}) exceeded`);
        skippedCount++;
        continue;
      }

      // Map events to database format
      const data = payload.events.map(event => ({
        organizationId: payload.organizationId,
        timestamp: new Date(event.timestamp),
        provider: event.provider,
        model: event.model,
        promptTokens: event.tokens.promptTokens,
        completionTokens: event.tokens.completionTokens,
        totalTokens: event.tokens.totalTokens,
        cost: event.cost.toString(),
        latency: event.latency,
        status: event.status,
        error: event.error || null,
      }));

      // Retry insert
      await db.insert(telemetryEvents).values(data).onConflictDoNothing();

      console.log(`  ✅ Inserted ${data.length} events for org ${payload.organizationId}`);

      // Move to processed
      fs.renameSync(filepath, path.join(PROCESSED_DIR, file));
      successCount++;
    } catch (error) {
      console.error(`  ❌ Failed to retry: ${(error as Error).message}`);

      // Increment retry count
      try {
        const raw = fs.readFileSync(filepath, 'utf-8');
        const payload: DLQPayload = JSON.parse(raw);
        payload.retryCount++;
        fs.writeFileSync(filepath, JSON.stringify(payload, null, 2), 'utf-8');
      } catch {
        // If we can't even update the retry count, leave the file as-is
      }

      failCount++;
    }
  }

  console.log('\n====================================================');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed:  ${failCount}`);
  console.log(`⏭  Skipped: ${skippedCount}`);
  console.log('====================================================');

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
