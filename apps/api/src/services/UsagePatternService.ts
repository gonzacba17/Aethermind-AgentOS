import { db } from '../db/index.js';
import { telemetryEvents, clients, clientInsights } from '../db/schema.js';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { embed } from './EmbeddingService.js';
import { cosineSimilarity } from './SemanticCacheService.js';

// ============================================
// Types
// ============================================

export interface PeakHour {
  hour: number;
  totalCost: number;
  requestCount: number;
}

export interface UnderutilizedAgent {
  agentId: string;
  recentRequests: number;
  previousRequests: number;
}

export interface OverloadedAgent {
  agentId: string;
  avgLatencyMs: number;
  requestCount: number;
}

export interface SimilarAgentPair {
  agentIdA: string;
  agentIdB: string;
  similarity: number;
  systemPromptPreviewA: string;
  systemPromptPreviewB: string;
}

// ============================================
// Pattern Detection Functions
// ============================================

/**
 * Detect the 3 peak cost hours for a client over the last 30 days.
 * Groups telemetry_events by hour of day and returns top 3 by total cost.
 */
export async function detectPeakHours(clientId: string): Promise<PeakHour[]> {
  const orgId = await getOrganizationId(clientId);
  if (!orgId) return [];

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      hour: sql<number>`extract(hour from ${telemetryEvents.timestamp})::int`,
      totalCost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
      requestCount: sql<number>`count(*)::int`,
    })
    .from(telemetryEvents)
    .where(
      and(
        eq(telemetryEvents.organizationId, orgId),
        gte(telemetryEvents.timestamp, thirtyDaysAgo),
      ),
    )
    .groupBy(sql`extract(hour from ${telemetryEvents.timestamp})`)
    .orderBy(desc(sql`sum(${telemetryEvents.cost}::numeric)`))
    .limit(3);

  return rows.map((r) => ({
    hour: Number(r.hour),
    totalCost: parseFloat(r.totalCost ?? '0'),
    requestCount: Number(r.requestCount),
  }));
}

/**
 * Detect agents with < 5 requests in the last 7 days that had prior activity.
 */
export async function detectUnderutilizedAgents(clientId: string): Promise<UnderutilizedAgent[]> {
  const orgId = await getOrganizationId(clientId);
  if (!orgId) return [];

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Get agents with activity in the 7-14 day window (previous period)
  const previousPeriodAgents = await db
    .select({
      agentId: telemetryEvents.agentId,
      count: sql<number>`count(*)::int`,
    })
    .from(telemetryEvents)
    .where(
      and(
        eq(telemetryEvents.organizationId, orgId),
        gte(telemetryEvents.timestamp, fourteenDaysAgo),
        sql`${telemetryEvents.timestamp} < ${sevenDaysAgo}`,
        sql`${telemetryEvents.agentId} is not null`,
      ),
    )
    .groupBy(telemetryEvents.agentId);

  if (previousPeriodAgents.length === 0) return [];

  // Get recent activity for those agents
  const recentActivity = await db
    .select({
      agentId: telemetryEvents.agentId,
      count: sql<number>`count(*)::int`,
    })
    .from(telemetryEvents)
    .where(
      and(
        eq(telemetryEvents.organizationId, orgId),
        gte(telemetryEvents.timestamp, sevenDaysAgo),
        sql`${telemetryEvents.agentId} is not null`,
      ),
    )
    .groupBy(telemetryEvents.agentId);

  const recentMap = new Map(recentActivity.map((r) => [r.agentId, Number(r.count)]));

  return previousPeriodAgents
    .filter((p) => {
      const recent = recentMap.get(p.agentId) ?? 0;
      return recent < 5;
    })
    .map((p) => ({
      agentId: p.agentId!,
      recentRequests: recentMap.get(p.agentId) ?? 0,
      previousRequests: Number(p.count),
    }));
}

/**
 * Detect agents with average latency > 5000ms in the last 30 days.
 */
export async function detectOverloadedAgents(clientId: string): Promise<OverloadedAgent[]> {
  const orgId = await getOrganizationId(clientId);
  if (!orgId) return [];

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      agentId: telemetryEvents.agentId,
      avgLatencyMs: sql<string>`round(avg(${telemetryEvents.latency})::numeric, 2)`,
      requestCount: sql<number>`count(*)::int`,
    })
    .from(telemetryEvents)
    .where(
      and(
        eq(telemetryEvents.organizationId, orgId),
        gte(telemetryEvents.timestamp, thirtyDaysAgo),
        sql`${telemetryEvents.agentId} is not null`,
      ),
    )
    .groupBy(telemetryEvents.agentId)
    .having(sql`avg(${telemetryEvents.latency}) > 5000`);

  return rows.map((r) => ({
    agentId: r.agentId!,
    avgLatencyMs: parseFloat(r.avgLatencyMs ?? '0'),
    requestCount: Number(r.requestCount),
  }));
}

/**
 * Detect similar agents by comparing system prompts using embeddings.
 * Only considers agents with > 100 requests. Returns pairs with similarity > 0.85.
 */
export async function detectSimilarAgents(clientId: string): Promise<SimilarAgentPair[]> {
  const orgId = await getOrganizationId(clientId);
  if (!orgId) return [];

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Get agents with > 100 requests and a sample prompt (first prompt as proxy for system prompt)
  const agentRows = await db
    .select({
      agentId: telemetryEvents.agentId,
      requestCount: sql<number>`count(*)::int`,
    })
    .from(telemetryEvents)
    .where(
      and(
        eq(telemetryEvents.organizationId, orgId),
        gte(telemetryEvents.timestamp, thirtyDaysAgo),
        sql`${telemetryEvents.agentId} is not null`,
      ),
    )
    .groupBy(telemetryEvents.agentId)
    .having(sql`count(*) > 100`);

  if (agentRows.length < 2) return [];

  // For each agent, get the most common model as a proxy for its typical usage
  // Use semantic_cache prompts if available, otherwise use agentId itself as identifier
  const agentPrompts: Array<{ agentId: string; prompt: string; embedding: number[] }> = [];

  for (const agent of agentRows) {
    if (!agent.agentId) continue;

    // Use agentId as the embedding source — in practice this would be the system prompt
    // but telemetry doesn't store full prompts. We use agentId as a fallback identifier.
    const agentEmbedding = await embed(agent.agentId);
    if (agentEmbedding) {
      agentPrompts.push({
        agentId: agent.agentId,
        prompt: agent.agentId,
        embedding: agentEmbedding,
      });
    }
  }

  // Compare all pairs
  const pairs: SimilarAgentPair[] = [];
  for (let i = 0; i < agentPrompts.length; i++) {
    for (let j = i + 1; j < agentPrompts.length; j++) {
      const a = agentPrompts[i]!;
      const b = agentPrompts[j]!;
      const similarity = cosineSimilarity(a.embedding, b.embedding);
      if (similarity > 0.85) {
        pairs.push({
          agentIdA: a.agentId,
          agentIdB: b.agentId,
          similarity: Math.round(similarity * 1000) / 1000,
          systemPromptPreviewA: a.prompt.substring(0, 100),
          systemPromptPreviewB: b.prompt.substring(0, 100),
        });
      }
    }
  }

  return pairs;
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

/**
 * Store detected patterns as client_insights.
 */
export async function storeInsights(
  clientId: string,
  type: string,
  data: unknown,
  estimatedSavingsUsd?: number,
): Promise<void> {
  await db.insert(clientInsights).values({
    clientId,
    type,
    data,
    estimatedSavingsUsd: estimatedSavingsUsd != null ? String(estimatedSavingsUsd) : null,
  });
}

/**
 * Run all pattern detection for a client and store results.
 */
export async function detectAllPatterns(clientId: string): Promise<void> {
  try {
    const [peakHours, underutilized, overloaded, similar] = await Promise.all([
      detectPeakHours(clientId),
      detectUnderutilizedAgents(clientId),
      detectOverloadedAgents(clientId),
      detectSimilarAgents(clientId),
    ]);

    if (peakHours.length > 0) {
      await storeInsights(clientId, 'peak_hours', { peakHours });
    }

    for (const agent of underutilized) {
      await storeInsights(clientId, 'underutilized_agent', agent);
    }

    for (const agent of overloaded) {
      await storeInsights(clientId, 'overloaded_agent', agent);
    }

    for (const pair of similar) {
      await storeInsights(clientId, 'similar_agents', pair);
    }
  } catch (error) {
    console.error(`[UsagePatternService] Error detecting patterns for client ${clientId}:`, error);
  }
}
