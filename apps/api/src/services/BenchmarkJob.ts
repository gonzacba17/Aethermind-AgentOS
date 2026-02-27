import { calculatePlatformBenchmarks, storeBenchmark } from './BenchmarkService.js';

/**
 * BenchmarkJob — runs every Monday at 02:00 UTC.
 *
 * Calculates anonymous aggregate benchmarks from all qualifying clients
 * and stores a snapshot in platform_benchmarks.
 */

let cronInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Main job execution.
 */
async function runBenchmarkCalculation(): Promise<void> {
  if (isRunning) {
    console.warn('[BenchmarkJob] Previous cycle still running, skipping');
    return;
  }

  isRunning = true;
  const start = Date.now();

  try {
    const benchmarkData = await calculatePlatformBenchmarks();

    if (!benchmarkData) {
      console.log('[BenchmarkJob] Insufficient data (< 5 qualifying clients) — skipping');
      return;
    }

    await storeBenchmark(benchmarkData);

    const duration = Date.now() - start;
    console.log(`[BenchmarkJob] Completed in ${duration}ms — sampleSize: ${benchmarkData.sampleSize}, avgCost: $${benchmarkData.avgCostPerRequest}`);
  } catch (error) {
    console.error('[BenchmarkJob] Fatal error:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Calculate milliseconds until next Monday 02:00 UTC.
 */
function msUntilNextMonday0200(): number {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sunday, 1=Monday, ...
  const daysUntilMonday = (8 - dayOfWeek) % 7 || 7; // days until next Monday
  const nextMonday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysUntilMonday,
    2, 0, 0, 0,
  ));
  return nextMonday.getTime() - now.getTime();
}

/**
 * Start the benchmark cron job.
 * Runs every Monday at 02:00 UTC.
 */
export function startBenchmarkCron(): void {
  if (cronInterval) {
    console.warn('[BenchmarkJob] Cron already running');
    return;
  }

  const initialDelay = msUntilNextMonday0200();
  console.log(`[BenchmarkJob] Cron scheduled — next run in ${Math.round(initialDelay / 3600000)}h (Monday 02:00 UTC)`);

  // Schedule first run at next Monday 02:00 UTC
  setTimeout(() => {
    runBenchmarkCalculation().catch((err) =>
      console.error('[BenchmarkJob] Scheduled run failed:', err),
    );

    // Then repeat weekly
    cronInterval = setInterval(() => {
      runBenchmarkCalculation().catch((err) =>
        console.error('[BenchmarkJob] Weekly run failed:', err),
      );
    }, ONE_WEEK_MS);
  }, initialDelay);
}

/**
 * Stop the benchmark cron job.
 */
export function stopBenchmarkCron(): void {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log('[BenchmarkJob] Cron stopped');
  }
}
