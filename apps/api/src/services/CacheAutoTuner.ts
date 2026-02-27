import { db } from '../db/index.js';
import { telemetryEvents, clients, clientInsights, cacheSettings } from '../db/schema.js';
import { eq, and, gte, sql } from 'drizzle-orm';

// ============================================
// Types
// ============================================

export interface CacheTuningResult {
  type: 'cache_suggestion';
  suggestion: 'lower_threshold' | 'raise_threshold' | 'no_change';
  currentThreshold: number;
  suggestedThreshold?: number;
  hitRate: number;
  estimatedSavingsUsd?: number;
  reason: string;
}

// ============================================
// Constants
// ============================================

const MIN_REQUESTS_FOR_ANALYSIS = 50;
const MIN_RATED_RATIO = 0.1; // Need at least 10% of responses rated to make quality-based suggestions

// ============================================
// Core Analysis
// ============================================

/**
 * Analyze cache performance for a client and generate tuning suggestions.
 * NEVER applies changes directly — only stores suggestions in client_insights.
 */
export async function analyzeCachePerformance(clientId: string): Promise<CacheTuningResult> {
  const orgId = await getOrganizationId(clientId);
  if (!orgId) {
    return { type: 'cache_suggestion', suggestion: 'no_change', hitRate: 0, currentThreshold: 0.9, reason: 'No organization found' };
  }

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Get cache stats from telemetry
  const statsResult = await db
    .select({
      totalRequests: sql<number>`count(*)::int`,
      cacheHits: sql<number>`count(*) filter (where ${telemetryEvents.cacheHit} = true)::int`,
      totalSavedUsd: sql<string>`coalesce(sum(${telemetryEvents.cacheSavedUsd}::numeric) filter (where ${telemetryEvents.cacheHit} = true), 0)`,
      badCacheRatings: sql<number>`count(*) filter (where ${telemetryEvents.cacheHit} = true and ${telemetryEvents.qualityRating} = 'bad')::int`,
      ratedCacheResponses: sql<number>`count(*) filter (where ${telemetryEvents.cacheHit} = true and ${telemetryEvents.qualityRating} is not null)::int`,
      totalRated: sql<number>`count(*) filter (where ${telemetryEvents.qualityRating} is not null)::int`,
    })
    .from(telemetryEvents)
    .where(
      and(
        eq(telemetryEvents.organizationId, orgId),
        gte(telemetryEvents.timestamp, fourteenDaysAgo),
      ),
    );

  const stats = statsResult[0];
  const totalRequests = Number(stats?.totalRequests ?? 0);
  const cacheHits = Number(stats?.cacheHits ?? 0);
  const badCacheRatings = Number(stats?.badCacheRatings ?? 0);
  const ratedCacheResponses = Number(stats?.ratedCacheResponses ?? 0);
  const totalRated = Number(stats?.totalRated ?? 0);

  // Get current cache settings
  const settingsRows = await db
    .select()
    .from(cacheSettings)
    .where(eq(cacheSettings.clientId, clientId))
    .limit(1);

  const currentThreshold = parseFloat(settingsRows[0]?.similarityThreshold ?? '0.90');

  if (totalRequests < MIN_REQUESTS_FOR_ANALYSIS) {
    return { type: 'cache_suggestion', suggestion: 'no_change', hitRate: 0, currentThreshold, reason: 'Insufficient data' };
  }

  const hitRate = cacheHits / totalRequests;
  const ratedRatio = totalRequests > 0 ? totalRated / totalRequests : 0;

  // Guard: if majority of qualityRating is null, don't make quality-based suggestions
  const hasEnoughRatings = ratedRatio >= MIN_RATED_RATIO;

  return evaluateCacheTuning({
    hitRate,
    badCacheRatings,
    ratedCacheResponses,
    currentThreshold,
    hasEnoughRatings,
    avgCostPerRequest: totalRequests > 0
      ? parseFloat(stats?.totalSavedUsd ?? '0') / Math.max(cacheHits, 1)
      : 0,
    totalRequests,
    cacheHits,
  });
}

/**
 * Pure evaluation logic — extracted for testability.
 */
export function evaluateCacheTuning(input: {
  hitRate: number;
  badCacheRatings: number;
  ratedCacheResponses: number;
  currentThreshold: number;
  hasEnoughRatings: boolean;
  avgCostPerRequest: number;
  totalRequests: number;
  cacheHits: number;
}): CacheTuningResult {
  const {
    hitRate,
    badCacheRatings,
    ratedCacheResponses,
    currentThreshold,
    hasEnoughRatings,
    avgCostPerRequest,
    totalRequests,
  } = input;

  // Case 1: Low hit rate (<10%) — suggest lowering threshold
  if (hitRate < 0.10) {
    const estimatedAdditionalHits = Math.round(totalRequests * 0.05); // conservative 5% more hits
    const estimatedSavingsUsd = estimatedAdditionalHits * avgCostPerRequest;

    return {
      type: 'cache_suggestion',
      suggestion: 'lower_threshold',
      currentThreshold,
      suggestedThreshold: 0.85,
      hitRate,
      estimatedSavingsUsd: Math.round(estimatedSavingsUsd * 100) / 100,
      reason: `Cache hit rate is ${(hitRate * 100).toFixed(1)}% — lowering similarity threshold from ${currentThreshold} to 0.85 could capture more near-duplicate prompts.`,
    };
  }

  // Case 2: High hit rate (>40%) with bad quality — suggest raising threshold
  if (hitRate > 0.40 && hasEnoughRatings && ratedCacheResponses > 0) {
    const badRatio = badCacheRatings / ratedCacheResponses;
    if (badRatio > 0.05) {
      return {
        type: 'cache_suggestion',
        suggestion: 'raise_threshold',
        currentThreshold,
        suggestedThreshold: 0.95,
        hitRate,
        reason: `Cache hit rate is ${(hitRate * 100).toFixed(1)}% but ${(badRatio * 100).toFixed(1)}% of rated cached responses are 'bad' — raising threshold to 0.95 will improve quality.`,
      };
    }
  }

  // Case 3: Stable — no change needed
  return {
    type: 'cache_suggestion',
    suggestion: 'no_change',
    hitRate,
    currentThreshold,
    reason: `Cache performance is within acceptable range (hit rate: ${(hitRate * 100).toFixed(1)}%).`,
  };
}

/**
 * Run cache auto-tuning for a client and store suggestion if applicable.
 */
export async function runCacheAutoTuner(clientId: string): Promise<void> {
  try {
    const result = await analyzeCachePerformance(clientId);

    if (result.suggestion !== 'no_change') {
      await db.insert(clientInsights).values({
        clientId,
        type: 'cache_suggestion',
        data: result,
        estimatedSavingsUsd: result.estimatedSavingsUsd != null ? String(result.estimatedSavingsUsd) : null,
      });
      console.log(`[CacheAutoTuner] Generated suggestion for client ${clientId}: ${result.suggestion}`);
    }
  } catch (error) {
    console.error(`[CacheAutoTuner] Error for client ${clientId}:`, error);
  }
}

// ============================================
// Helpers
// ============================================

async function getOrganizationId(clientId: string): Promise<string | null> {
  const rows = await db
    .select({ organizationId: clients.organizationId })
    .from(clients)
    .where(eq(clients.id, clientId));

  return rows[0]?.organizationId ?? null;
}
