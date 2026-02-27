import { db } from '../db/index.js';
import { telemetryEvents, clients, clientInsights, routingRules } from '../db/schema.js';
import { eq, and, gte, sql } from 'drizzle-orm';

// ============================================
// Types
// ============================================

export interface RoutingTuningResult {
  type: 'routing_suggestion';
  suggestion: 'revert_routing' | 'extend_routing' | 'no_change';
  originalModel: string;
  routedModel: string;
  complexityLevel?: string;
  goodRatio?: number;
  badRatio?: number;
  monthlySavings?: number;
  estimatedSavingsUsd?: number;
  reason: string;
}

export interface RoutingPairStats {
  originalModel: string;
  routedModel: string;
  totalRated: number;
  goodCount: number;
  badCount: number;
  totalCount: number;
  totalCost: number;
  avgCostSaved: number;
}

// ============================================
// Constants
// ============================================

const MIN_RATED_FOR_SUGGESTION = 10;
const BAD_RATIO_THRESHOLD = 0.10; // > 10% bad → suggest revert
const GOOD_RATIO_THRESHOLD = 0.90; // > 90% good → suggest extend
const MIN_MONTHLY_SAVINGS_FOR_EXTEND = 10; // $10/month minimum savings to suggest extending
const MIN_RATED_RATIO = 0.1; // Need at least 10% rated to avoid spurious suggestions

// ============================================
// Core Analysis
// ============================================

/**
 * Analyze routing performance for a client and generate tuning suggestions.
 * NEVER applies changes directly — only stores suggestions in client_insights.
 */
export async function analyzeRoutingPerformance(clientId: string): Promise<RoutingTuningResult[]> {
  const orgId = await getOrganizationId(clientId);
  if (!orgId) return [];

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Get routing pairs with quality ratings
  const pairRows = await db
    .select({
      originalModel: telemetryEvents.originalModel,
      routedModel: telemetryEvents.routedModel,
      totalCount: sql<number>`count(*)::int`,
      totalRated: sql<number>`count(*) filter (where ${telemetryEvents.qualityRating} is not null)::int`,
      goodCount: sql<number>`count(*) filter (where ${telemetryEvents.qualityRating} = 'good')::int`,
      badCount: sql<number>`count(*) filter (where ${telemetryEvents.qualityRating} = 'bad')::int`,
      totalCost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
    })
    .from(telemetryEvents)
    .where(
      and(
        eq(telemetryEvents.organizationId, orgId),
        gte(telemetryEvents.timestamp, fourteenDaysAgo),
        sql`${telemetryEvents.originalModel} is not null`,
        sql`${telemetryEvents.routedModel} is not null`,
        sql`${telemetryEvents.originalModel} != ${telemetryEvents.routedModel}`,
      ),
    )
    .groupBy(telemetryEvents.originalModel, telemetryEvents.routedModel);

  const results: RoutingTuningResult[] = [];

  for (const row of pairRows) {
    const stats: RoutingPairStats = {
      originalModel: row.originalModel!,
      routedModel: row.routedModel!,
      totalRated: Number(row.totalRated),
      goodCount: Number(row.goodCount),
      badCount: Number(row.badCount),
      totalCount: Number(row.totalCount),
      totalCost: parseFloat(row.totalCost ?? '0'),
      avgCostSaved: 0, // Calculated from cost difference
    };

    const result = evaluateRoutingPair(stats);
    if (result.suggestion !== 'no_change') {
      results.push(result);
    }
  }

  return results;
}

/**
 * Pure evaluation logic for a routing pair — extracted for testability.
 */
export function evaluateRoutingPair(stats: RoutingPairStats): RoutingTuningResult {
  const { originalModel, routedModel, totalRated, goodCount, badCount, totalCount, totalCost } = stats;

  // Guard: need enough rated responses
  const ratedRatio = totalCount > 0 ? totalRated / totalCount : 0;
  if (totalRated < MIN_RATED_FOR_SUGGESTION || ratedRatio < MIN_RATED_RATIO) {
    return {
      type: 'routing_suggestion',
      suggestion: 'no_change',
      originalModel,
      routedModel,
      reason: 'Insufficient quality ratings to generate a suggestion.',
    };
  }

  const badRatio = totalRated > 0 ? badCount / totalRated : 0;
  const goodRatio = totalRated > 0 ? goodCount / totalRated : 0;

  // Case 1: High bad ratio → suggest reverting
  if (badRatio > BAD_RATIO_THRESHOLD) {
    return {
      type: 'routing_suggestion',
      suggestion: 'revert_routing',
      originalModel,
      routedModel,
      badRatio: Math.round(badRatio * 1000) / 1000,
      reason: `Routing ${originalModel} → ${routedModel} has ${(badRatio * 100).toFixed(1)}% bad ratings — consider reverting to the original model for this complexity level.`,
    };
  }

  // Case 2: High good ratio + sufficient savings → suggest extending
  if (goodRatio > GOOD_RATIO_THRESHOLD) {
    // Estimate monthly savings: (14-day cost savings) * (30/14) extrapolation
    const monthlySavings = (totalCost / 14) * 30;
    if (monthlySavings > MIN_MONTHLY_SAVINGS_FOR_EXTEND) {
      return {
        type: 'routing_suggestion',
        suggestion: 'extend_routing',
        originalModel,
        routedModel,
        goodRatio: Math.round(goodRatio * 1000) / 1000,
        monthlySavings: Math.round(monthlySavings * 100) / 100,
        estimatedSavingsUsd: Math.round(monthlySavings * 100) / 100,
        reason: `Routing ${originalModel} → ${routedModel} has ${(goodRatio * 100).toFixed(1)}% good ratings and saves ~$${monthlySavings.toFixed(2)}/month — consider extending this routing to the next complexity level.`,
      };
    }
  }

  // Case 3: No change needed
  return {
    type: 'routing_suggestion',
    suggestion: 'no_change',
    originalModel,
    routedModel,
    reason: 'Routing performance is within acceptable range.',
  };
}

/**
 * Run routing auto-tuning for a client and store suggestions if applicable.
 */
export async function runRoutingAutoTuner(clientId: string): Promise<void> {
  try {
    const results = await analyzeRoutingPerformance(clientId);

    for (const result of results) {
      await db.insert(clientInsights).values({
        clientId,
        type: 'routing_suggestion',
        data: result,
        estimatedSavingsUsd: result.estimatedSavingsUsd != null ? String(result.estimatedSavingsUsd) : null,
      });
      console.log(`[RoutingAutoTuner] Generated suggestion for client ${clientId}: ${result.suggestion} (${result.originalModel} → ${result.routedModel})`);
    }
  } catch (error) {
    console.error(`[RoutingAutoTuner] Error for client ${clientId}:`, error);
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
