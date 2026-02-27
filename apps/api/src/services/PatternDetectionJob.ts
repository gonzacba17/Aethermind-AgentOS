import { db } from '../db/index.js';
import { telemetryEvents, clients } from '../db/schema.js';
import { eq, gte, sql } from 'drizzle-orm';
import { detectAllPatterns } from './UsagePatternService.js';
import { runCacheAutoTuner } from './CacheAutoTuner.js';
import { runRoutingAutoTuner } from './RoutingAutoTuner.js';

/**
 * PatternDetectionJob — runs every Sunday at 00:00 UTC.
 *
 * Processes all clients with telemetry activity in the last 7 days:
 * 1. Pattern detection (peak hours, underutilized/overloaded agents, similar agents)
 * 2. Cache auto-tuning (suggestions only)
 * 3. Routing auto-tuning (suggestions only)
 */

let cronInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Get all client IDs with telemetry activity in the last 7 days.
 */
async function getActiveClients(): Promise<string[]> {
  const sevenDaysAgo = new Date(Date.now() - ONE_WEEK_MS);

  const rows = await db
    .selectDistinct({
      clientId: clients.id,
    })
    .from(clients)
    .innerJoin(
      telemetryEvents,
      eq(clients.organizationId, telemetryEvents.organizationId),
    )
    .where(gte(telemetryEvents.timestamp, sevenDaysAgo));

  return rows.map((r) => r.clientId);
}

/**
 * Main job execution — processes all active clients.
 */
async function runPatternDetection(): Promise<void> {
  if (isRunning) {
    console.warn('[PatternDetectionJob] Previous cycle still running, skipping');
    return;
  }

  isRunning = true;
  const start = Date.now();

  try {
    const clientIds = await getActiveClients();
    console.log(`[PatternDetectionJob] Processing ${clientIds.length} active clients`);

    for (const clientId of clientIds) {
      try {
        // Run all analyses for this client
        await detectAllPatterns(clientId);
        await runCacheAutoTuner(clientId);
        await runRoutingAutoTuner(clientId);
      } catch (error) {
        console.error(`[PatternDetectionJob] Error processing client ${clientId}:`, error);
        // Continue with next client
      }
    }

    const duration = Date.now() - start;
    console.log(`[PatternDetectionJob] Completed in ${duration}ms (${clientIds.length} clients)`);
  } catch (error) {
    console.error('[PatternDetectionJob] Fatal error:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Calculate milliseconds until next Sunday 00:00 UTC.
 */
function msUntilNextSunday(): number {
  const now = new Date();
  const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
  const nextSunday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysUntilSunday,
    0, 0, 0, 0,
  ));
  return nextSunday.getTime() - now.getTime();
}

/**
 * Start the pattern detection cron job.
 * Runs every Sunday at 00:00 UTC.
 */
export function startPatternDetectionCron(): void {
  if (cronInterval) {
    console.warn('[PatternDetectionJob] Cron already running');
    return;
  }

  const initialDelay = msUntilNextSunday();
  console.log(`[PatternDetectionJob] Cron scheduled — next run in ${Math.round(initialDelay / 3600000)}h (Sunday 00:00 UTC)`);

  // Schedule first run at next Sunday 00:00 UTC
  setTimeout(() => {
    runPatternDetection().catch((err) =>
      console.error('[PatternDetectionJob] Scheduled run failed:', err),
    );

    // Then repeat weekly
    cronInterval = setInterval(() => {
      runPatternDetection().catch((err) =>
        console.error('[PatternDetectionJob] Weekly run failed:', err),
      );
    }, ONE_WEEK_MS);
  }, initialDelay);
}

/**
 * Stop the pattern detection cron job.
 */
export function stopPatternDetectionCron(): void {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log('[PatternDetectionJob] Cron stopped');
  }
}
