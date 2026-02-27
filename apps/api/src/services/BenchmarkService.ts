import { db } from '../db/index.js';
import { telemetryEvents, clients, platformBenchmarks } from '../db/schema.js';
import { eq, and, gte, sql, desc } from 'drizzle-orm';

// ============================================
// Types
// ============================================

export interface BenchmarkData {
  avgCostPerRequest: number;
  p50CostPerRequest: number;
  p90CostPerRequest: number;
  avgCacheHitRate: number;
  avgCompressionRatio: number;
  sampleSize: number;
}

export interface ClientMetrics {
  costPerRequest: number;
  cacheHitRate: number;
  compressionRatio: number;
  totalRequests: number;
}

export interface BenchmarkComparison {
  client: ClientMetrics;
  benchmark: BenchmarkData | null;
  reason?: string;
  insights: string[];
}

// ============================================
// Constants
// ============================================

const MIN_SAMPLE_SIZE = 5;
const MIN_REQUESTS_PER_CLIENT = 100;

// ============================================
// Platform Benchmark Calculation
// ============================================

/**
 * Calculate anonymous aggregate benchmarks from all qualifying clients.
 * Returns null if fewer than MIN_SAMPLE_SIZE clients qualify (privacy).
 */
export async function calculatePlatformBenchmarks(): Promise<BenchmarkData | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Get per-client metrics for clients with > MIN_REQUESTS_PER_CLIENT requests
  const clientStats = await db
    .select({
      organizationId: telemetryEvents.organizationId,
      totalRequests: sql<number>`count(*)::int`,
      avgCostPerRequest: sql<string>`avg(${telemetryEvents.cost}::numeric)`,
      cacheHitRate: sql<string>`avg(case when ${telemetryEvents.cacheHit} = true then 1.0 else 0.0 end)`,
      compressionRatio: sql<string>`avg(case when ${telemetryEvents.compressionApplied} = true and ${telemetryEvents.originalTokens} > 0 then 1.0 - (${telemetryEvents.compressedTokens}::numeric / ${telemetryEvents.originalTokens}::numeric) else 0.0 end)`,
    })
    .from(telemetryEvents)
    .where(gte(telemetryEvents.timestamp, thirtyDaysAgo))
    .groupBy(telemetryEvents.organizationId)
    .having(sql`count(*) > ${MIN_REQUESTS_PER_CLIENT}`);

  if (clientStats.length < MIN_SAMPLE_SIZE) {
    return null;
  }

  // Calculate aggregate metrics
  const costs = clientStats.map((c) => parseFloat(c.avgCostPerRequest ?? '0')).sort((a, b) => a - b);
  const cacheHitRates = clientStats.map((c) => parseFloat(c.cacheHitRate ?? '0'));
  const compressionRatios = clientStats.map((c) => parseFloat(c.compressionRatio ?? '0'));

  const avgCostPerRequest = costs.reduce((a, b) => a + b, 0) / costs.length;
  const p50CostPerRequest = percentile(costs, 50);
  const p90CostPerRequest = percentile(costs, 90);
  const avgCacheHitRate = cacheHitRates.reduce((a, b) => a + b, 0) / cacheHitRates.length;
  const avgCompressionRatio = compressionRatios.reduce((a, b) => a + b, 0) / compressionRatios.length;

  return {
    avgCostPerRequest: round6(avgCostPerRequest),
    p50CostPerRequest: round6(p50CostPerRequest),
    p90CostPerRequest: round6(p90CostPerRequest),
    avgCacheHitRate: round4(avgCacheHitRate),
    avgCompressionRatio: round4(avgCompressionRatio),
    sampleSize: clientStats.length,
  };
}

/**
 * Store a benchmark snapshot in the database.
 */
export async function storeBenchmark(data: BenchmarkData): Promise<void> {
  await db.insert(platformBenchmarks).values({
    calculatedAt: new Date(),
    avgCostPerRequest: String(data.avgCostPerRequest),
    p50CostPerRequest: String(data.p50CostPerRequest),
    p90CostPerRequest: String(data.p90CostPerRequest),
    avgCacheHitRate: String(data.avgCacheHitRate),
    avgCompressionRatio: String(data.avgCompressionRatio),
    sampleSize: data.sampleSize,
  });
}

/**
 * Get the most recent benchmark from the database.
 */
export async function getLatestBenchmark(): Promise<BenchmarkData | null> {
  const rows = await db
    .select()
    .from(platformBenchmarks)
    .orderBy(desc(platformBenchmarks.calculatedAt))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    avgCostPerRequest: parseFloat(row.avgCostPerRequest),
    p50CostPerRequest: parseFloat(row.p50CostPerRequest),
    p90CostPerRequest: parseFloat(row.p90CostPerRequest),
    avgCacheHitRate: parseFloat(row.avgCacheHitRate),
    avgCompressionRatio: parseFloat(row.avgCompressionRatio),
    sampleSize: row.sampleSize,
  };
}

// ============================================
// Client Comparison
// ============================================

/**
 * Get a client's metrics for comparison against benchmarks.
 */
export async function getClientMetrics(clientId: string): Promise<ClientMetrics | null> {
  const orgId = await getOrganizationId(clientId);
  if (!orgId) return null;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await db
    .select({
      totalRequests: sql<number>`count(*)::int`,
      avgCost: sql<string>`avg(${telemetryEvents.cost}::numeric)`,
      cacheHitRate: sql<string>`avg(case when ${telemetryEvents.cacheHit} = true then 1.0 else 0.0 end)`,
      compressionRatio: sql<string>`avg(case when ${telemetryEvents.compressionApplied} = true and ${telemetryEvents.originalTokens} > 0 then 1.0 - (${telemetryEvents.compressedTokens}::numeric / ${telemetryEvents.originalTokens}::numeric) else 0.0 end)`,
    })
    .from(telemetryEvents)
    .where(
      and(
        eq(telemetryEvents.organizationId, orgId),
        gte(telemetryEvents.timestamp, thirtyDaysAgo),
      ),
    );

  const row = result[0];
  if (!row || Number(row.totalRequests) === 0) return null;

  return {
    costPerRequest: parseFloat(row.avgCost ?? '0'),
    cacheHitRate: parseFloat(row.cacheHitRate ?? '0'),
    compressionRatio: parseFloat(row.compressionRatio ?? '0'),
    totalRequests: Number(row.totalRequests),
  };
}

/**
 * Compare a client's metrics against platform benchmarks.
 * Returns insights generated programmatically (no LLM).
 */
export async function compareToBenchmark(clientId: string): Promise<BenchmarkComparison> {
  const [clientMetrics, benchmark] = await Promise.all([
    getClientMetrics(clientId),
    getLatestBenchmark(),
  ]);

  if (!clientMetrics) {
    return {
      client: { costPerRequest: 0, cacheHitRate: 0, compressionRatio: 0, totalRequests: 0 },
      benchmark: null,
      reason: 'no_client_data',
      insights: [],
    };
  }

  if (!benchmark || benchmark.sampleSize < MIN_SAMPLE_SIZE) {
    return {
      client: clientMetrics,
      benchmark: null,
      reason: 'insufficient_data',
      insights: [],
    };
  }

  const insights = generateInsights(clientMetrics, benchmark);

  return {
    client: {
      costPerRequest: round6(clientMetrics.costPerRequest),
      cacheHitRate: round4(clientMetrics.cacheHitRate),
      compressionRatio: round4(clientMetrics.compressionRatio),
      totalRequests: clientMetrics.totalRequests,
    },
    benchmark,
    insights,
  };
}

/**
 * Generate text insights comparing client to benchmark.
 * Pure function — extracted for testability.
 */
export function generateInsights(client: ClientMetrics, benchmark: BenchmarkData): string[] {
  const insights: string[] = [];

  // Cost comparison
  if (benchmark.avgCostPerRequest > 0 && client.costPerRequest > 0) {
    const costRatio = client.costPerRequest / benchmark.avgCostPerRequest;
    if (costRatio > 2) {
      insights.push(
        `Tu costo por request es ${costRatio.toFixed(1)}x el promedio — activa model routing.`,
      );
    } else if (costRatio > 1.5) {
      insights.push(
        `Tu costo por request es ${costRatio.toFixed(1)}x el promedio — considera optimizar tus prompts o activar compresión.`,
      );
    } else if (costRatio < 0.5) {
      insights.push(
        `Tu costo por request es ${(costRatio * 100).toFixed(0)}% del promedio — excelente optimización.`,
      );
    }
  }

  // Cache comparison
  if (client.cacheHitRate < benchmark.avgCacheHitRate * 0.5 && benchmark.avgCacheHitRate > 0.05) {
    insights.push(
      `Tu cache hit rate (${(client.cacheHitRate * 100).toFixed(1)}%) está muy por debajo del promedio (${(benchmark.avgCacheHitRate * 100).toFixed(1)}%) — revisa tu configuración de caché.`,
    );
  } else if (client.cacheHitRate > benchmark.avgCacheHitRate * 1.5) {
    insights.push(
      `Tu cache hit rate (${(client.cacheHitRate * 100).toFixed(1)}%) supera el promedio (${(benchmark.avgCacheHitRate * 100).toFixed(1)}%).`,
    );
  }

  // Compression comparison
  if (client.compressionRatio < benchmark.avgCompressionRatio * 0.5 && benchmark.avgCompressionRatio > 0.05) {
    insights.push(
      `Tu ratio de compresión está por debajo del promedio — activa la compresión de prompts para ahorrar tokens.`,
    );
  }

  return insights;
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

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  const weight = index - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
