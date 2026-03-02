import { Router } from 'express';
import { db } from '../db/index.js';
import { telemetryEvents, clientBudgets, clients, routingRules, providerHealth, cacheSettings, semanticCache, promptCompressionLog, optimizationSettings, clientInsights, agents, logs, users, traces, executions, costs } from '../db/schema.js';
import { eq, and, gte, lte, sql, isNotNull, isNull, desc } from 'drizzle-orm';
import { ClientAuthenticatedRequest } from '../middleware/clientAuth.js';
import { evaluateBudget } from '../services/ClientBudgetService.js';
import { classifyPrompt } from '../services/PromptClassifier.js';
import * as SemanticCacheService from '../services/SemanticCacheService.js';
import { analyze as analyzePrompt } from '../services/PromptAnalyzer.js';
import * as SystemPromptAnalyzer from '../services/SystemPromptAnalyzer.js';
import { compareToBenchmark } from '../services/BenchmarkService.js';

const router = Router();

/**
 * Resolve period string to a Date threshold
 */
function periodToDate(period: string): Date {
  const now = new Date();
  switch (period) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

/**
 * GET /api/client/me
 * Returns the authenticated client's info.
 */
router.get('/me', (req, res) => {
  const clientReq = req as ClientAuthenticatedRequest;
  const client = clientReq.client;

  if (!client) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  res.json({
    companyName: client.companyName,
    sdkApiKey: client.sdkApiKey,
    id: client.id,
  });
});

/**
 * GET /api/client/metrics?period=30d
 *
 * Totals: cost, tokens, events, avg latency, error count, success rate
 */
router.get('/metrics', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const period = (req.query.period as string) || '30d';
    const since = periodToDate(period);

    const result = await db
      .select({
        totalCost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
        totalTokens: sql<number>`coalesce(sum(${telemetryEvents.totalTokens}), 0)`,
        totalEvents: sql<number>`count(*)::int`,
        avgLatency: sql<number>`coalesce(avg(${telemetryEvents.latency}), 0)::int`,
        errorCount: sql<number>`count(*) filter (where ${telemetryEvents.status} = 'error')::int`,
        successCount: sql<number>`count(*) filter (where ${telemetryEvents.status} = 'success')::int`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, since),
        ),
      );

    const row = result[0];
    const total = (row?.totalEvents ?? 0) as number;
    const successRate = total > 0
      ? ((row?.successCount ?? 0) as number / total * 100).toFixed(1)
      : '100.0';

    res.json({
      totalCost: parseFloat(row?.totalCost ?? '0'),
      totalTokens: Number(row?.totalTokens ?? 0),
      totalEvents: Number(row?.totalEvents ?? 0),
      avgLatency: Number(row?.avgLatency ?? 0),
      errorCount: Number(row?.errorCount ?? 0),
      successRate: parseFloat(successRate),
      period,
    });
  } catch (error) {
    console.error('[Client Metrics] Error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

/**
 * GET /api/client/metrics/by-model?period=30d
 *
 * Breakdown by model: cost, tokens, count, avg latency
 */
router.get('/metrics/by-model', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const period = (req.query.period as string) || '30d';
    const since = periodToDate(period);

    const rows = await db
      .select({
        model: telemetryEvents.model,
        cost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
        tokens: sql<number>`coalesce(sum(${telemetryEvents.totalTokens}), 0)`,
        count: sql<number>`count(*)::int`,
        avgLatency: sql<number>`coalesce(avg(${telemetryEvents.latency}), 0)::int`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, since),
        ),
      )
      .groupBy(telemetryEvents.model)
      .orderBy(sql`sum(${telemetryEvents.cost}::numeric) desc`);

    const data = rows.map((r) => ({
      model: r.model,
      cost: parseFloat(r.cost ?? '0'),
      tokens: Number(r.tokens ?? 0),
      count: Number(r.count ?? 0),
      avgLatency: Number(r.avgLatency ?? 0),
    }));

    res.json({ data, period });
  } catch (error) {
    console.error('[Client Metrics By Model] Error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics by model' });
  }
});

/**
 * GET /api/client/metrics/timeseries?period=30d
 *
 * Daily aggregates for charts: date, cost, tokens, events
 */
router.get('/metrics/timeseries', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const period = (req.query.period as string) || '30d';
    const since = periodToDate(period);

    const rows = await db
      .select({
        date: sql<string>`date_trunc('day', ${telemetryEvents.timestamp})::date::text`,
        cost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
        tokens: sql<number>`coalesce(sum(${telemetryEvents.totalTokens}), 0)`,
        events: sql<number>`count(*)::int`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, since),
        ),
      )
      .groupBy(sql`date_trunc('day', ${telemetryEvents.timestamp})::date`)
      .orderBy(sql`date_trunc('day', ${telemetryEvents.timestamp})::date asc`);

    const data = rows.map((r) => ({
      date: r.date,
      cost: parseFloat(r.cost ?? '0'),
      tokens: Number(r.tokens ?? 0),
      events: Number(r.events ?? 0),
    }));

    res.json({ data, period });
  } catch (error) {
    console.error('[Client Metrics Timeseries] Error:', error);
    res.status(500).json({ error: 'Failed to fetch timeseries' });
  }
});

// ============================================
// BUDGET ENDPOINTS (Phase 1.1)
// ============================================

/**
 * POST /api/client/budgets
 * Create or update a budget for the authenticated client.
 */
router.post('/budgets', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { type, limitUsd, alertThresholds } = req.body;

    if (!type || !['monthly', 'daily'].includes(type)) {
      res.status(400).json({ error: 'type must be "monthly" or "daily"' });
      return;
    }
    if (!limitUsd || isNaN(parseFloat(limitUsd)) || parseFloat(limitUsd) <= 0) {
      res.status(400).json({ error: 'limitUsd must be a positive number' });
      return;
    }

    const thresholds = alertThresholds || [80, 90, 100];
    if (!Array.isArray(thresholds) || thresholds.some((t: any) => typeof t !== 'number' || t < 1 || t > 100)) {
      res.status(400).json({ error: 'alertThresholds must be an array of numbers between 1 and 100' });
      return;
    }

    // Check if budget of this type already exists — update it
    const existing = await db
      .select()
      .from(clientBudgets)
      .where(and(eq(clientBudgets.clientId, client.id), eq(clientBudgets.type, type)));

    const existingBudget = existing[0];
    if (existingBudget) {
      const updated = await db
        .update(clientBudgets)
        .set({
          limitUsd: parseFloat(limitUsd).toFixed(2),
          alertThresholds: thresholds,
          updatedAt: new Date(),
        })
        .where(eq(clientBudgets.id, existingBudget.id))
        .returning();

      res.json({ budget: updated[0], updated: true });
      return;
    }

    // Create new budget
    const created = await db
      .insert(clientBudgets)
      .values({
        clientId: client.id,
        type,
        limitUsd: parseFloat(limitUsd).toFixed(2),
        alertThresholds: thresholds,
      })
      .returning();

    res.status(201).json({ budget: created[0], updated: false });
  } catch (error) {
    console.error('[Client Budgets] Create error:', error);
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

/**
 * GET /api/client/budgets
 * Get all active budgets for the authenticated client, with current spend info.
 */
router.get('/budgets', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const budgetRows = await db
      .select()
      .from(clientBudgets)
      .where(eq(clientBudgets.clientId, client.id));

    // Enrich each budget with current evaluation
    const enriched = await Promise.all(
      budgetRows.map(async (budget) => {
        const evaluation = await evaluateBudget(client.id);
        return {
          ...budget,
          limitUsd: parseFloat(budget.limitUsd),
          evaluation: evaluation && evaluation.budgetId === budget.id ? {
            status: evaluation.status,
            percentUsed: evaluation.percentUsed,
            remaining: evaluation.remaining,
            spentUsd: evaluation.spentUsd,
          } : null,
        };
      }),
    );

    res.json({ budgets: enriched });
  } catch (error) {
    console.error('[Client Budgets] List error:', error);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

/**
 * DELETE /api/client/budgets/:id
 * Delete a budget.
 */
router.delete('/budgets/:id', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    const deleted = await db
      .delete(clientBudgets)
      .where(and(eq(clientBudgets.id, id), eq(clientBudgets.clientId, client.id)))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ error: 'Budget not found' });
      return;
    }

    res.json({ deleted: true, id });
  } catch (error) {
    console.error('[Client Budgets] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

/**
 * GET /api/client/budget-status
 * Returns budget evaluation for the authenticated client.
 * Used by SDK for enforcement checks.
 */
router.get('/budget-status', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const evaluation = await evaluateBudget(client.id);

    if (!evaluation) {
      // No budget defined — always allow
      res.json({ status: 'ok', percentUsed: 0, remaining: null, noBudget: true });
      return;
    }

    res.json(evaluation);
  } catch (error) {
    console.error('[Client Budget Status] Error:', error);
    res.status(500).json({ error: 'Failed to evaluate budget' });
  }
});

// ============================================
// ANALYTICS ENDPOINTS (Phase 1.2)
// ============================================

/**
 * GET /api/client/analytics/agents?period=30d
 * Cost breakdown by agentId.
 */
router.get('/analytics/agents', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const period = (req.query.period as string) || '30d';
    const since = periodToDate(period);

    const rows = await db
      .select({
        agentId: telemetryEvents.agentId,
        cost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
        tokens: sql<number>`coalesce(sum(${telemetryEvents.totalTokens}), 0)`,
        requests: sql<number>`count(*)::int`,
        avgLatency: sql<number>`coalesce(avg(${telemetryEvents.latency}), 0)::int`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, since),
        ),
      )
      .groupBy(telemetryEvents.agentId)
      .orderBy(sql`sum(${telemetryEvents.cost}::numeric) desc`)
      .limit(10);

    const data = rows.map((r) => ({
      agentId: r.agentId || 'unknown',
      cost: parseFloat(r.cost ?? '0'),
      tokens: Number(r.tokens ?? 0),
      requests: Number(r.requests ?? 0),
      avgLatency: Number(r.avgLatency ?? 0),
    }));

    res.json({ data, period });
  } catch (error) {
    console.error('[Client Analytics Agents] Error:', error);
    res.status(500).json({ error: 'Failed to fetch agent analytics' });
  }
});

/**
 * GET /api/client/analytics/workflows?period=30d
 * Cost breakdown by sessionId (workflow/pipeline).
 */
router.get('/analytics/workflows', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const period = (req.query.period as string) || '30d';
    const since = periodToDate(period);

    const rows = await db
      .select({
        sessionId: telemetryEvents.sessionId,
        cost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
        tokens: sql<number>`coalesce(sum(${telemetryEvents.totalTokens}), 0)`,
        requests: sql<number>`count(*)::int`,
        avgLatency: sql<number>`coalesce(avg(${telemetryEvents.latency}), 0)::int`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, since),
        ),
      )
      .groupBy(telemetryEvents.sessionId)
      .orderBy(sql`sum(${telemetryEvents.cost}::numeric) desc`)
      .limit(10);

    const data = rows.map((r) => ({
      sessionId: r.sessionId || 'unknown',
      cost: parseFloat(r.cost ?? '0'),
      tokens: Number(r.tokens ?? 0),
      requests: Number(r.requests ?? 0),
      avgLatency: Number(r.avgLatency ?? 0),
    }));

    res.json({ data, period });
  } catch (error) {
    console.error('[Client Analytics Workflows] Error:', error);
    res.status(500).json({ error: 'Failed to fetch workflow analytics' });
  }
});

/**
 * GET /api/client/analytics/comparison?period=week|month
 * Compare current period vs previous period.
 */
router.get('/analytics/comparison', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const period = (req.query.period as string) || 'month';
    const now = new Date();
    let currentStart: Date;
    let previousStart: Date;
    let previousEnd: Date;

    if (period === 'week') {
      const dayOfWeek = now.getDay();
      currentStart = new Date(now);
      currentStart.setDate(now.getDate() - dayOfWeek);
      currentStart.setHours(0, 0, 0, 0);

      previousEnd = new Date(currentStart);
      previousStart = new Date(currentStart);
      previousStart.setDate(previousStart.getDate() - 7);
    } else {
      // month
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      previousEnd = new Date(currentStart);
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    }

    // Current period spend
    const currentResult = await db
      .select({
        cost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
        tokens: sql<number>`coalesce(sum(${telemetryEvents.totalTokens}), 0)`,
        requests: sql<number>`count(*)::int`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, currentStart),
        ),
      );

    // Previous period spend
    const previousResult = await db
      .select({
        cost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
        tokens: sql<number>`coalesce(sum(${telemetryEvents.totalTokens}), 0)`,
        requests: sql<number>`count(*)::int`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, previousStart),
          lte(telemetryEvents.timestamp, previousEnd),
        ),
      );

    const current = {
      cost: parseFloat(currentResult[0]?.cost ?? '0'),
      tokens: Number(currentResult[0]?.tokens ?? 0),
      requests: Number(currentResult[0]?.requests ?? 0),
    };

    const previous = {
      cost: parseFloat(previousResult[0]?.cost ?? '0'),
      tokens: Number(previousResult[0]?.tokens ?? 0),
      requests: Number(previousResult[0]?.requests ?? 0),
    };

    const deltaCost = current.cost - previous.cost;
    const deltaPercent = previous.cost > 0
      ? ((deltaCost / previous.cost) * 100)
      : (current.cost > 0 ? 100 : 0);

    res.json({
      period,
      current,
      previous,
      delta: {
        cost: Math.round(deltaCost * 100) / 100,
        costPercent: Math.round(deltaPercent * 10) / 10,
        tokens: current.tokens - previous.tokens,
        requests: current.requests - previous.requests,
      },
    });
  } catch (error) {
    console.error('[Client Analytics Comparison] Error:', error);
    res.status(500).json({ error: 'Failed to fetch comparison analytics' });
  }
});

/**
 * GET /api/client/analytics/export?period=30d
 * Export telemetry events as CSV.
 */
router.get('/analytics/export', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const period = (req.query.period as string) || '30d';
    const since = periodToDate(period);

    const rows = await db
      .select({
        timestamp: telemetryEvents.timestamp,
        model: telemetryEvents.model,
        promptTokens: telemetryEvents.promptTokens,
        completionTokens: telemetryEvents.completionTokens,
        totalTokens: telemetryEvents.totalTokens,
        cost: telemetryEvents.cost,
        agentId: telemetryEvents.agentId,
        latency: telemetryEvents.latency,
        status: telemetryEvents.status,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, since),
        ),
      )
      .orderBy(telemetryEvents.timestamp);

    // Build CSV
    const header = 'timestamp,model,prompt_tokens,completion_tokens,total_tokens,cost_usd,agent_id,latency_ms,status';
    const csvRows = rows.map((r) =>
      `${r.timestamp.toISOString()},${r.model},${r.promptTokens},${r.completionTokens},${r.totalTokens},${r.cost},${r.agentId || ''},${r.latency},${r.status}`
    );
    const csv = [header, ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="aethermind-usage-${period}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('[Client Analytics Export] Error:', error);
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

// ============================================
// FORECAST ENDPOINTS (Phase 1.3)
// ============================================

/**
 * GET /api/client/forecast
 * Project monthly spend based on last 7 days average.
 */
router.get('/forecast', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const daysRemaining = lastDayOfMonth - currentDay;

    // Get daily costs for last 7 days
    const dailyRows = await db
      .select({
        date: sql<string>`date_trunc('day', ${telemetryEvents.timestamp})::date::text`,
        cost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, sevenDaysAgo),
        ),
      )
      .groupBy(sql`date_trunc('day', ${telemetryEvents.timestamp})::date`)
      .orderBy(sql`date_trunc('day', ${telemetryEvents.timestamp})::date asc`);

    const daysWithData = dailyRows.length;
    const totalCostLast7d = dailyRows.reduce((sum, r) => sum + parseFloat(r.cost ?? '0'), 0);
    const avgDailyUsd = daysWithData > 0 ? totalCostLast7d / daysWithData : 0;

    // Current month spend so far
    const monthResult = await db
      .select({
        cost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, monthStart),
        ),
      );
    const spentSoFar = parseFloat(monthResult[0]?.cost ?? '0');

    const projectedMonthlyUsd = spentSoFar + (avgDailyUsd * daysRemaining);

    let confidence: 'low' | 'medium' | 'high' = 'low';
    if (daysWithData >= 7) confidence = 'high';
    else if (daysWithData >= 3) confidence = 'medium';

    // Check budget for visual indicator
    const evaluation = await evaluateBudget(client.id);

    res.json({
      projectedMonthlyUsd: Math.round(projectedMonthlyUsd * 100) / 100,
      avgDailyUsd: Math.round(avgDailyUsd * 100) / 100,
      spentSoFar: Math.round(spentSoFar * 100) / 100,
      daysRemaining,
      daysWithData,
      confidence,
      budget: evaluation ? {
        limitUsd: evaluation.limitUsd,
        percentProjected: evaluation.limitUsd > 0
          ? Math.round((projectedMonthlyUsd / evaluation.limitUsd) * 10000) / 100
          : null,
      } : null,
    });
  } catch (error) {
    console.error('[Client Forecast] Error:', error);
    res.status(500).json({ error: 'Failed to generate forecast' });
  }
});

/**
 * GET /api/client/forecast/by-model
 * Forecast broken down by model.
 */
router.get('/forecast/by-model', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const daysRemaining = lastDayOfMonth - currentDay;

    // Daily cost per model for last 7 days
    const rows = await db
      .select({
        model: telemetryEvents.model,
        dayCount: sql<number>`count(distinct date_trunc('day', ${telemetryEvents.timestamp})::date)::int`,
        totalCost7d: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, sevenDaysAgo),
        ),
      )
      .groupBy(telemetryEvents.model)
      .orderBy(sql`sum(${telemetryEvents.cost}::numeric) desc`);

    // Current month spend by model
    const monthRows = await db
      .select({
        model: telemetryEvents.model,
        cost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, monthStart),
        ),
      )
      .groupBy(telemetryEvents.model);

    const monthCostMap = new Map(monthRows.map((r) => [r.model, parseFloat(r.cost ?? '0')]));

    const data = rows.map((r) => {
      const totalCost7d = parseFloat(r.totalCost7d ?? '0');
      const dayCount = Number(r.dayCount ?? 1);
      const avgDaily = dayCount > 0 ? totalCost7d / dayCount : 0;
      const spentSoFar = monthCostMap.get(r.model) || 0;
      const projected = spentSoFar + (avgDaily * daysRemaining);

      let confidence: 'low' | 'medium' | 'high' = 'low';
      if (dayCount >= 7) confidence = 'high';
      else if (dayCount >= 3) confidence = 'medium';

      return {
        model: r.model,
        projectedMonthlyUsd: Math.round(projected * 100) / 100,
        avgDailyUsd: Math.round(avgDaily * 100) / 100,
        spentSoFar: Math.round(spentSoFar * 100) / 100,
        confidence,
      };
    });

    res.json({ data, daysRemaining });
  } catch (error) {
    console.error('[Client Forecast By Model] Error:', error);
    res.status(500).json({ error: 'Failed to generate forecast by model' });
  }
});

// ============================================
// ROUTING ENDPOINTS (Phase 2)
// ============================================

/**
 * GET /api/client/routing/rules
 * Returns routing rules for the authenticated client.
 */
router.get('/routing/rules', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const rules = await db
      .select()
      .from(routingRules)
      .where(eq(routingRules.clientId, client.id));

    const rule = rules[0];
    if (!rule) {
      res.json({
        enabled: false,
        simpleModel: 'gpt-4o-mini',
        mediumModel: 'gpt-4o-mini',
        complexModel: 'gpt-4o',
      });
      return;
    }

    res.json({
      id: rule.id,
      enabled: rule.enabled,
      simpleModel: rule.simpleModel,
      mediumModel: rule.mediumModel,
      complexModel: rule.complexModel,
      updatedAt: rule.updatedAt,
    });
  } catch (error) {
    console.error('[Client Routing Rules] Error:', error);
    res.status(500).json({ error: 'Failed to fetch routing rules' });
  }
});

/**
 * PUT /api/client/routing/rules
 * Update routing configuration for the authenticated client.
 */
router.put('/routing/rules', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { enabled, simpleModel, mediumModel, complexModel } = req.body;

    // Validate
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: '"enabled" must be a boolean' });
      return;
    }

    const existingRules = await db
      .select()
      .from(routingRules)
      .where(eq(routingRules.clientId, client.id));

    const existing = existingRules[0];
    if (existing) {
      // Update
      const updated = await db
        .update(routingRules)
        .set({
          enabled,
          simpleModel: simpleModel || existing.simpleModel,
          mediumModel: mediumModel || existing.mediumModel,
          complexModel: complexModel || existing.complexModel,
          updatedAt: new Date(),
        })
        .where(eq(routingRules.id, existing.id))
        .returning();

      res.json({ rule: updated[0], created: false });
    } else {
      // Create
      const created = await db
        .insert(routingRules)
        .values({
          clientId: client.id,
          enabled,
          simpleModel: simpleModel || 'gpt-4o-mini',
          mediumModel: mediumModel || 'gpt-4o-mini',
          complexModel: complexModel || 'gpt-4o',
        })
        .returning();

      res.status(201).json({ rule: created[0], created: true });
    }
  } catch (error) {
    console.error('[Client Routing Rules] Update error:', error);
    res.status(500).json({ error: 'Failed to update routing rules' });
  }
});

/**
 * GET /api/client/routing/provider-health
 * Returns current health status of all providers.
 */
router.get('/routing/provider-health', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const healthRows = await db
      .select({
        provider: providerHealth.provider,
        status: providerHealth.status,
        latencyMs: providerHealth.latencyMs,
        lastCheckedAt: providerHealth.lastCheckedAt,
        errorMessage: providerHealth.errorMessage,
      })
      .from(providerHealth);

    // Also get average latency per provider from last 24h telemetry
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const latencyRows = await db
      .select({
        provider: telemetryEvents.provider,
        avgLatency: sql<number>`coalesce(avg(${telemetryEvents.latency}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(telemetryEvents)
      .where(
        and(
          client.organizationId ? eq(telemetryEvents.organizationId, client.organizationId) : sql`1=1`,
          gte(telemetryEvents.timestamp, since24h),
        ),
      )
      .groupBy(telemetryEvents.provider);

    const latencyMap = new Map(latencyRows.map(r => [r.provider, { avgLatency: r.avgLatency, count: r.count }]));

    const providers = healthRows.map(h => ({
      provider: h.provider,
      status: h.status,
      latencyMs: h.latencyMs,
      lastCheckedAt: h.lastCheckedAt,
      errorMessage: h.errorMessage,
      avg24hLatency: latencyMap.get(h.provider)?.avgLatency ?? null,
      requests24h: latencyMap.get(h.provider)?.count ?? 0,
    }));

    res.json({ providers });
  } catch (error) {
    console.error('[Client Provider Health] Error:', error);
    res.status(500).json({ error: 'Failed to fetch provider health' });
  }
});

/**
 * GET /api/client/routing/optimization
 * Returns optimization opportunities based on telemetry data.
 */
router.get('/routing/optimization', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const period = (req.query.period as string) || '30d';
    const since = periodToDate(period);

    // Expensive models (could be routed to cheaper ones)
    const EXPENSIVE_MODELS = [
      'gpt-4', 'gpt-4-turbo', 'gpt-4o',
      'claude-3-opus-20240229', 'claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20240620',
      'o1-preview', 'o1-mini',
    ];
    const CHEAP_MODELS = [
      'gpt-4o-mini', 'gpt-3.5-turbo', 'claude-3-haiku-20240307',
    ];

    // Total cost and count
    const totalResult = await db
      .select({
        totalCost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
        totalRequests: sql<number>`count(*)::int`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, since),
        ),
      );

    // Cost from expensive models
    const expensiveResult = await db
      .select({
        cost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, since),
          sql`${telemetryEvents.model} = ANY(${EXPENSIVE_MODELS})`,
        ),
      );

    const totalCost = parseFloat(totalResult[0]?.totalCost ?? '0');
    const totalRequests = Number(totalResult[0]?.totalRequests ?? 0);
    const expensiveCost = parseFloat(expensiveResult[0]?.cost ?? '0');
    const expensiveCount = Number(expensiveResult[0]?.count ?? 0);

    // Estimate: assume 60% of expensive-model requests could use cheaper models
    const redirectablePercent = totalRequests > 0 ? (expensiveCount / totalRequests) * 100 : 0;
    const savingsFactor = 0.85; // ~85% savings when moving from gpt-4o to gpt-4o-mini
    const estimatedMonthlySavings = (expensiveCost * 0.6 * savingsFactor);

    // Already routed savings (from telemetry where routedModel != null)
    const routedResult = await db
      .select({
        routedCount: sql<number>`count(*)::int`,
        routedSavings: sql<string>`coalesce(sum(
          CASE WHEN ${telemetryEvents.routedModel} IS NOT NULL AND ${telemetryEvents.originalModel} IS NOT NULL
          THEN 0 ELSE 0 END
        ), 0)`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, since),
          isNotNull(telemetryEvents.routedModel),
        ),
      );

    res.json({
      totalCost: Math.round(totalCost * 100) / 100,
      totalRequests,
      expensiveModelCost: Math.round(expensiveCost * 100) / 100,
      expensiveModelCount: expensiveCount,
      redirectablePercent: Math.round(redirectablePercent * 10) / 10,
      estimatedMonthlySavings: Math.round(estimatedMonthlySavings * 100) / 100,
      routedRequests: Number(routedResult[0]?.routedCount ?? 0),
      period,
    });
  } catch (error) {
    console.error('[Client Optimization] Error:', error);
    res.status(500).json({ error: 'Failed to fetch optimization data' });
  }
});

/**
 * GET /api/client/routing/ab-insights
 * Returns A/B testing insights comparing original vs routed models.
 */
router.get('/routing/ab-insights', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const period = (req.query.period as string) || '30d';
    const since = periodToDate(period);

    // Get events where routing was used
    const rows = await db
      .select({
        originalModel: telemetryEvents.originalModel,
        routedModel: telemetryEvents.routedModel,
        avgCost: sql<string>`coalesce(avg(${telemetryEvents.cost}::numeric), 0)`,
        count: sql<number>`count(*)::int`,
        avgLatency: sql<number>`coalesce(avg(${telemetryEvents.latency}), 0)::int`,
        fallbackCount: sql<number>`count(*) filter (where ${telemetryEvents.fallbackUsed} = true)::int`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, since),
          isNotNull(telemetryEvents.routedModel),
        ),
      )
      .groupBy(telemetryEvents.originalModel, telemetryEvents.routedModel)
      .orderBy(sql`count(*) desc`)
      .limit(20);

    const data = rows.map(r => ({
      originalModel: r.originalModel || 'unknown',
      routedModel: r.routedModel || 'unknown',
      avgCost: parseFloat(r.avgCost ?? '0'),
      count: Number(r.count ?? 0),
      avgLatency: Number(r.avgLatency ?? 0),
      fallbackCount: Number(r.fallbackCount ?? 0),
      qualityRating: '-', // Pending Phase 5
    }));

    res.json({ data, period });
  } catch (error) {
    console.error('[Client A/B Insights] Error:', error);
    res.status(500).json({ error: 'Failed to fetch A/B insights' });
  }
});

/**
 * POST /api/client/telemetry/:eventId/rating
 * Rate a telemetry event's quality (infrastructure for Phase 5).
 */
router.post('/telemetry/:eventId/rating', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { eventId } = req.params;
    const { rating } = req.body;

    if (!rating || !['good', 'bad'].includes(rating)) {
      res.status(400).json({ error: 'rating must be "good" or "bad"' });
      return;
    }

    const updated = await db
      .update(telemetryEvents)
      .set({ qualityRating: rating })
      .where(
        and(
          eq(telemetryEvents.id, eventId),
          client.organizationId ? eq(telemetryEvents.organizationId, client.organizationId) : sql`1=1`,
        ),
      )
      .returning({ id: telemetryEvents.id });

    if (updated.length === 0) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.json({ success: true, eventId, rating });
  } catch (error) {
    console.error('[Client Telemetry Rating] Error:', error);
    res.status(500).json({ error: 'Failed to save rating' });
  }
});

// ============================================
// CACHE ENDPOINTS (Phase 3)
// ============================================

/**
 * GET /api/client/cache/settings
 * Returns cache settings for the authenticated client (or defaults).
 */
router.get('/cache/settings', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const rows = await db
      .select()
      .from(cacheSettings)
      .where(eq(cacheSettings.clientId, client.id))
      .limit(1);

    const settings = rows[0];
    if (!settings) {
      // Return defaults
      res.json({
        enabled: false,
        similarityThreshold: 0.90,
        ttlSeconds: 86400,
        deterministicTtlSeconds: null,
      });
      return;
    }

    res.json({
      enabled: settings.enabled,
      similarityThreshold: parseFloat(settings.similarityThreshold),
      ttlSeconds: settings.ttlSeconds,
      deterministicTtlSeconds: settings.deterministicTtlSeconds,
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    console.error('[Client Cache Settings] Error:', error);
    res.status(500).json({ error: 'Failed to fetch cache settings' });
  }
});

/**
 * PUT /api/client/cache/settings
 * Update cache settings for the authenticated client.
 */
router.put('/cache/settings', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { enabled, similarityThreshold, ttlSeconds, deterministicTtlSeconds } = req.body;

    const existingRows = await db
      .select()
      .from(cacheSettings)
      .where(eq(cacheSettings.clientId, client.id))
      .limit(1);

    const existing = existingRows[0];
    if (existing) {
      const updated = await db
        .update(cacheSettings)
        .set({
          enabled: enabled ?? existing.enabled,
          similarityThreshold: similarityThreshold != null
            ? similarityThreshold.toFixed(2)
            : existing.similarityThreshold,
          ttlSeconds: ttlSeconds ?? existing.ttlSeconds,
          deterministicTtlSeconds: deterministicTtlSeconds !== undefined
            ? deterministicTtlSeconds
            : existing.deterministicTtlSeconds,
          updatedAt: new Date(),
        })
        .where(eq(cacheSettings.id, existing.id))
        .returning();

      const row = updated[0];
      if (!row) {
        res.status(500).json({ error: 'Failed to update cache settings' });
        return;
      }
      res.json({
        enabled: row.enabled,
        similarityThreshold: parseFloat(row.similarityThreshold),
        ttlSeconds: row.ttlSeconds,
        deterministicTtlSeconds: row.deterministicTtlSeconds,
        updatedAt: row.updatedAt,
      });
    } else {
      const created = await db
        .insert(cacheSettings)
        .values({
          clientId: client.id,
          enabled: enabled ?? false,
          similarityThreshold: similarityThreshold != null ? similarityThreshold.toFixed(2) : '0.90',
          ttlSeconds: ttlSeconds ?? 86400,
          deterministicTtlSeconds: deterministicTtlSeconds ?? null,
        })
        .returning();

      const row = created[0];
      if (!row) {
        res.status(500).json({ error: 'Failed to create cache settings' });
        return;
      }
      res.status(201).json({
        enabled: row.enabled,
        similarityThreshold: parseFloat(row.similarityThreshold),
        ttlSeconds: row.ttlSeconds,
        deterministicTtlSeconds: row.deterministicTtlSeconds,
        updatedAt: row.updatedAt,
      });
    }
  } catch (error) {
    console.error('[Client Cache Settings] Update error:', error);
    res.status(500).json({ error: 'Failed to update cache settings' });
  }
});

/**
 * DELETE /api/client/cache/entries
 * Purge all cache entries for the authenticated client.
 */
router.delete('/cache/entries', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const count = await SemanticCacheService.purgeAll(client.id);
    res.json({ purged: count });
  } catch (error) {
    console.error('[Client Cache Purge] Error:', error);
    res.status(500).json({ error: 'Failed to purge cache' });
  }
});

/**
 * GET /api/client/cache/stats?period=30d
 * Returns cache analytics for the authenticated client.
 */
router.get('/cache/stats', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const period = (req.query.period as string) || '30d';
    const since = periodToDate(period);

    // Total requests and cache hits from telemetry
    const telemetryResult = await db
      .select({
        totalRequests: sql<number>`count(*)::int`,
        cacheHits: sql<number>`count(*) filter (where ${telemetryEvents.cacheHit} = true)::int`,
        totalSavedUsd: sql<string>`coalesce(sum(${telemetryEvents.cacheSavedUsd}::numeric) filter (where ${telemetryEvents.cacheHit} = true), 0)`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, since),
        ),
      );

    const totalRequests = Number(telemetryResult[0]?.totalRequests ?? 0);
    const cacheHits = Number(telemetryResult[0]?.cacheHits ?? 0);
    const totalSavedUsd = parseFloat(telemetryResult[0]?.totalSavedUsd ?? '0');
    const hitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;

    // Cache size and deterministic count
    const cacheResult = await db
      .select({
        cacheSize: sql<number>`count(*)::int`,
        deterministicCount: sql<number>`count(*) filter (where ${semanticCache.isDeterministic} = true)::int`,
      })
      .from(semanticCache)
      .where(eq(semanticCache.clientId, client.id));

    const cacheSize = Number(cacheResult[0]?.cacheSize ?? 0);
    const deterministicCount = Number(cacheResult[0]?.deterministicCount ?? 0);

    // Top cached prompts
    const topPrompts = await db
      .select({
        promptPreview: sql<string>`left(${semanticCache.prompt}, 50)`,
        hitCount: semanticCache.hitCount,
        savedUsd: sql<string>`(${semanticCache.costUsd}::numeric * ${semanticCache.hitCount})`,
      })
      .from(semanticCache)
      .where(eq(semanticCache.clientId, client.id))
      .orderBy(desc(semanticCache.hitCount))
      .limit(5);

    res.json({
      hitRate: Math.round(hitRate * 1000) / 1000,
      totalRequests,
      cacheHits,
      totalSavedUsd: Math.round(totalSavedUsd * 100) / 100,
      cacheSize,
      deterministicCount,
      topCachedPrompts: topPrompts.map(p => ({
        promptPreview: p.promptPreview,
        hitCount: p.hitCount,
        savedUsd: Math.round(parseFloat(p.savedUsd ?? '0') * 100) / 100,
      })),
      period,
    });
  } catch (error) {
    console.error('[Client Cache Stats] Error:', error);
    res.status(500).json({ error: 'Failed to fetch cache stats' });
  }
});

// ============================================
// OPTIMIZATION ENDPOINTS (Phase 4)
// ============================================

/**
 * POST /api/client/optimization/analyze
 * Analyze a prompt and return compression suggestions without applying.
 */
router.post('/optimization/analyze', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { prompt, model } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'prompt is required and must be a string' });
      return;
    }

    const analysis = analyzePrompt(prompt);

    res.json({
      originalTokens: analysis.originalTokens,
      estimatedCompressedTokens: analysis.estimatedCompressedTokens,
      compressionRatio: Math.round(analysis.compressionRatio * 1000) / 1000,
      issues: analysis.issues,
      compressedPrompt: analysis.compressedPrompt,
      model: model || null,
    });
  } catch (error) {
    console.error('[Client Optimization Analyze] Error:', error);
    res.status(500).json({ error: 'Failed to analyze prompt' });
  }
});

/**
 * GET /api/client/optimization/stats
 * Returns compression statistics: tokens saved, USD saved, % compression, etc.
 */
router.get('/optimization/stats', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const period = (req.query.period as string) || '30d';
    const since = periodToDate(period);

    // Get compression stats from prompt_compression_log
    const statsResult = await db
      .select({
        totalRequests: sql<number>`count(*)::int`,
        compressedRequests: sql<number>`count(*) filter (where ${promptCompressionLog.compressionApplied} = true)::int`,
        totalOriginalTokens: sql<number>`coalesce(sum(${promptCompressionLog.originalTokens}), 0)::int`,
        totalCompressedTokens: sql<number>`coalesce(sum(${promptCompressionLog.compressedTokens}), 0)::int`,
        totalSavedTokens: sql<number>`coalesce(sum(${promptCompressionLog.savedTokens}), 0)::int`,
        totalSavedUsd: sql<string>`coalesce(sum(${promptCompressionLog.savedUsd}::numeric), 0)`,
      })
      .from(promptCompressionLog)
      .where(
        and(
          eq(promptCompressionLog.clientId, client.id),
          gte(promptCompressionLog.createdAt, since),
        ),
      );

    const stats = statsResult[0];
    const totalRequests = Number(stats?.totalRequests ?? 0);
    const compressedRequests = Number(stats?.compressedRequests ?? 0);
    const totalOriginalTokens = Number(stats?.totalOriginalTokens ?? 0);
    const totalCompressedTokens = Number(stats?.totalCompressedTokens ?? 0);
    const totalSavedTokens = Number(stats?.totalSavedTokens ?? 0);
    const totalSavedUsd = parseFloat(stats?.totalSavedUsd ?? '0');

    const avgCompressionPercent =
      totalOriginalTokens > 0
        ? Math.round(((totalOriginalTokens - totalCompressedTokens) / totalOriginalTokens) * 1000) / 10
        : 0;

    const compressionRate =
      totalRequests > 0
        ? Math.round((compressedRequests / totalRequests) * 1000) / 10
        : 0;

    res.json({
      totalRequests,
      compressedRequests,
      compressionRate,
      totalSavedTokens,
      totalSavedUsd: Math.round(totalSavedUsd * 100) / 100,
      avgCompressionPercent,
      period,
    });
  } catch (error) {
    console.error('[Client Optimization Stats] Error:', error);
    res.status(500).json({ error: 'Failed to fetch optimization stats' });
  }
});

/**
 * GET /api/client/optimization/settings
 * Returns optimization settings for the authenticated client.
 */
router.get('/optimization/settings', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const rows = await db
      .select()
      .from(optimizationSettings)
      .where(eq(optimizationSettings.clientId, client.id))
      .limit(1);

    const settings = rows[0];
    if (!settings) {
      // Return defaults
      res.json({
        compressionEnabled: false,
        minCompressionRatio: 0.15,
      });
      return;
    }

    res.json({
      compressionEnabled: settings.compressionEnabled,
      minCompressionRatio: parseFloat(settings.minCompressionRatio),
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    console.error('[Client Optimization Settings] Error:', error);
    res.status(500).json({ error: 'Failed to fetch optimization settings' });
  }
});

/**
 * PUT /api/client/optimization/settings
 * Enable/disable automatic compression, set minimum threshold.
 */
router.put('/optimization/settings', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { compressionEnabled, minCompressionRatio } = req.body;

    // Validate
    if (compressionEnabled !== undefined && typeof compressionEnabled !== 'boolean') {
      res.status(400).json({ error: 'compressionEnabled must be a boolean' });
      return;
    }
    if (minCompressionRatio !== undefined) {
      if (typeof minCompressionRatio !== 'number' || minCompressionRatio < 0 || minCompressionRatio > 1) {
        res.status(400).json({ error: 'minCompressionRatio must be between 0 and 1' });
        return;
      }
    }

    const existingRows = await db
      .select()
      .from(optimizationSettings)
      .where(eq(optimizationSettings.clientId, client.id))
      .limit(1);

    const existing = existingRows[0];
    if (existing) {
      const updated = await db
        .update(optimizationSettings)
        .set({
          compressionEnabled: compressionEnabled ?? existing.compressionEnabled,
          minCompressionRatio: minCompressionRatio != null
            ? minCompressionRatio.toFixed(2)
            : existing.minCompressionRatio,
          updatedAt: new Date(),
        })
        .where(eq(optimizationSettings.clientId, client.id))
        .returning();

      const row = updated[0];
      if (!row) {
        res.status(500).json({ error: 'Failed to update optimization settings' });
        return;
      }
      res.json({
        compressionEnabled: row.compressionEnabled,
        minCompressionRatio: parseFloat(row.minCompressionRatio),
        updatedAt: row.updatedAt,
      });
    } else {
      const created = await db
        .insert(optimizationSettings)
        .values({
          clientId: client.id,
          compressionEnabled: compressionEnabled ?? false,
          minCompressionRatio: minCompressionRatio != null ? minCompressionRatio.toFixed(2) : '0.15',
        })
        .returning();

      const row = created[0];
      if (!row) {
        res.status(500).json({ error: 'Failed to create optimization settings' });
        return;
      }
      res.status(201).json({
        compressionEnabled: row.compressionEnabled,
        minCompressionRatio: parseFloat(row.minCompressionRatio),
        updatedAt: row.updatedAt,
      });
    }
  } catch (error) {
    console.error('[Client Optimization Settings] Update error:', error);
    res.status(500).json({ error: 'Failed to update optimization settings' });
  }
});

/**
 * GET /api/client/optimization/system-prompts
 * Returns system prompt analysis (duplicate detection).
 */
router.get('/optimization/system-prompts', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const analysis = await SystemPromptAnalyzer.analyzeSystemPrompts(client.id);
    res.json(analysis);
  } catch (error) {
    console.error('[Client System Prompts] Error:', error);
    res.status(500).json({ error: 'Failed to analyze system prompts' });
  }
});

/**
 * GET /api/client/optimization/system-prompts/templates
 * Returns available optimized system prompt templates by use case.
 */
router.get('/optimization/system-prompts/templates', async (_req, res) => {
  try {
    const templates = SystemPromptAnalyzer.getAllTemplates();
    res.json({ templates });
  } catch (error) {
    console.error('[Client System Prompt Templates] Error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// ============================================
// PHASE 5 — Learning Engine: Insights & Benchmarks
// ============================================

/**
 * GET /api/client/insights/patterns
 * Returns all pending (not applied, not dismissed) insights for the client.
 */
router.get('/insights/patterns', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const rows = await db
      .select()
      .from(clientInsights)
      .where(
        and(
          eq(clientInsights.clientId, client.id),
          isNull(clientInsights.appliedAt),
          isNull(clientInsights.dismissedAt),
        ),
      )
      .orderBy(desc(clientInsights.createdAt));

    res.json({
      insights: rows.map((r) => ({
        id: r.id,
        type: r.type,
        data: r.data,
        estimatedSavingsUsd: r.estimatedSavingsUsd ? parseFloat(r.estimatedSavingsUsd) : null,
        acknowledged: r.acknowledged,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[Client Insights] Error:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

/**
 * GET /api/client/insights/history
 * Returns all insights (including applied/dismissed) for the client.
 */
router.get('/insights/history', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const rows = await db
      .select()
      .from(clientInsights)
      .where(eq(clientInsights.clientId, client.id))
      .orderBy(desc(clientInsights.createdAt))
      .limit(100);

    res.json({
      insights: rows.map((r) => ({
        id: r.id,
        type: r.type,
        data: r.data,
        estimatedSavingsUsd: r.estimatedSavingsUsd ? parseFloat(r.estimatedSavingsUsd) : null,
        acknowledged: r.acknowledged,
        appliedAt: r.appliedAt?.toISOString() ?? null,
        dismissedAt: r.dismissedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[Client Insights History] Error:', error);
    res.status(500).json({ error: 'Failed to fetch insights history' });
  }
});

/**
 * POST /api/client/insights/:id/apply
 * Apply a suggestion — uses existing services to make the actual change.
 */
router.post('/insights/:id/apply', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const insightId = req.params.id;

    // Verify the insight belongs to this client and hasn't been applied/dismissed
    const rows = await db
      .select()
      .from(clientInsights)
      .where(
        and(
          eq(clientInsights.id, insightId),
          eq(clientInsights.clientId, client.id),
          isNull(clientInsights.appliedAt),
          isNull(clientInsights.dismissedAt),
        ),
      );

    const insight = rows[0];
    if (!insight) {
      res.status(404).json({ error: 'Insight not found or already processed' });
      return;
    }

    const data = insight.data as Record<string, unknown>;

    // Apply the suggestion using existing services
    if (insight.type === 'cache_suggestion') {
      const suggestedThreshold = data.suggestedThreshold as number;
      if (suggestedThreshold) {
        // Upsert cache settings using existing table
        const existing = await db
          .select()
          .from(cacheSettings)
          .where(eq(cacheSettings.clientId, client.id))
          .limit(1);

        if (existing[0]) {
          await db
            .update(cacheSettings)
            .set({
              similarityThreshold: String(suggestedThreshold),
              updatedAt: new Date(),
            })
            .where(eq(cacheSettings.clientId, client.id));
        } else {
          await db.insert(cacheSettings).values({
            clientId: client.id,
            enabled: true,
            similarityThreshold: String(suggestedThreshold),
          });
        }
      }
    } else if (insight.type === 'routing_suggestion') {
      const suggestion = data.suggestion as string;
      if (suggestion === 'revert_routing') {
        // Disable routing for the client
        await db
          .update(routingRules)
          .set({
            enabled: false,
            updatedAt: new Date(),
          })
          .where(eq(routingRules.clientId, client.id));
      }
      // 'extend_routing' would need more context about which complexity level — handled by frontend
    }

    // Mark as applied
    await db
      .update(clientInsights)
      .set({ appliedAt: new Date() })
      .where(eq(clientInsights.id, insightId));

    res.json({ success: true, appliedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[Client Insights Apply] Error:', error);
    res.status(500).json({ error: 'Failed to apply insight' });
  }
});

/**
 * POST /api/client/insights/:id/dismiss
 * Dismiss a suggestion.
 */
router.post('/insights/:id/dismiss', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const insightId = req.params.id;

    // Verify the insight belongs to this client and hasn't been processed
    const rows = await db
      .select()
      .from(clientInsights)
      .where(
        and(
          eq(clientInsights.id, insightId),
          eq(clientInsights.clientId, client.id),
          isNull(clientInsights.appliedAt),
          isNull(clientInsights.dismissedAt),
        ),
      );

    if (!rows[0]) {
      res.status(404).json({ error: 'Insight not found or already processed' });
      return;
    }

    await db
      .update(clientInsights)
      .set({ dismissedAt: new Date() })
      .where(eq(clientInsights.id, insightId));

    res.json({ success: true, dismissedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[Client Insights Dismiss] Error:', error);
    res.status(500).json({ error: 'Failed to dismiss insight' });
  }
});

/**
 * GET /api/client/benchmarks
 * Returns client metrics vs platform benchmarks with textual insights.
 */
router.get('/benchmarks', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const comparison = await compareToBenchmark(client.id);
    res.json(comparison);
  } catch (error) {
    console.error('[Client Benchmarks] Error:', error);
    res.status(500).json({ error: 'Failed to fetch benchmarks' });
  }
});

// ============================================
// AGENTS & LOGS (B2B client-token accessible)
// ============================================

/**
 * GET /api/client/agents
 * List agents belonging to any user in the client's organization.
 */
router.get('/agents', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const rows = await db
      .select({
        id: agents.id,
        name: agents.name,
        model: agents.model,
        config: agents.config,
        createdAt: agents.createdAt,
      })
      .from(agents)
      .innerJoin(users, eq(agents.userId, users.id))
      .where(
        and(
          eq(users.organizationId, client.organizationId),
          isNull(agents.deletedAt),
        ),
      )
      .orderBy(desc(agents.createdAt));

    const data = rows.map((r) => ({
      id: r.id,
      name: r.name,
      model: r.model,
      status: 'idle' as const,
      config: r.config,
    }));

    res.json({
      data,
      total: data.length,
      offset: 0,
      limit: data.length,
      hasMore: false,
    });
  } catch (error) {
    console.error('[Client Agents] Error:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

/**
 * GET /api/client/logs?level=error&limit=100&offset=0
 * List logs for agents belonging to the client's organization.
 */
router.get('/logs', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const level = req.query.level as string | undefined;

    const conditions = [
      eq(users.organizationId, client.organizationId),
    ];

    if (level) {
      conditions.push(eq(logs.level, level));
    }

    const rows = await db
      .select({
        id: logs.id,
        level: logs.level,
        message: logs.message,
        metadata: logs.metadata,
        timestamp: logs.timestamp,
        agentId: logs.agentId,
        executionId: logs.executionId,
      })
      .from(logs)
      .innerJoin(agents, eq(logs.agentId, agents.id))
      .innerJoin(users, eq(agents.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(logs.timestamp))
      .limit(limit)
      .offset(offset);

    const data = rows.map((r) => ({
      id: r.id,
      level: r.level,
      message: r.message,
      metadata: r.metadata,
      timestamp: r.timestamp?.toISOString() ?? new Date().toISOString(),
      agentId: r.agentId,
      executionId: r.executionId,
    }));

    res.json({ logs: data, total: data.length });
  } catch (error) {
    console.error('[Client Logs] Error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// ============================================
// TRACES (B2B client-token accessible)
// ============================================

/**
 * GET /api/client/traces?limit=50&offset=0
 * List traces for executions belonging to the client's organization.
 */
router.get('/traces', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const rows = await db
      .select({
        id: traces.id,
        executionId: traces.executionId,
        treeData: traces.treeData,
        metadata: traces.metadata,
        createdAt: traces.createdAt,
      })
      .from(traces)
      .innerJoin(executions, eq(traces.executionId, executions.id))
      .innerJoin(users, eq(executions.userId, users.id))
      .where(eq(users.organizationId, client.organizationId))
      .orderBy(desc(traces.createdAt))
      .limit(limit)
      .offset(offset);

    const data = rows.map((r) => ({
      id: r.id,
      executionId: r.executionId,
      rootNode: r.treeData,
      metadata: r.metadata,
      createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
    }));

    res.json(data);
  } catch (error) {
    console.error('[Client Traces] Error:', error);
    res.status(500).json({ error: 'Failed to fetch traces' });
  }
});

/**
 * GET /api/client/traces/:id
 * Get a single trace by ID (org-scoped).
 */
router.get('/traces/:id', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const rows = await db
      .select({
        id: traces.id,
        executionId: traces.executionId,
        treeData: traces.treeData,
        metadata: traces.metadata,
        createdAt: traces.createdAt,
      })
      .from(traces)
      .innerJoin(executions, eq(traces.executionId, executions.id))
      .innerJoin(users, eq(executions.userId, users.id))
      .where(
        and(
          eq(traces.id, req.params.id),
          eq(users.organizationId, client.organizationId),
        ),
      )
      .limit(1);

    const r = rows[0];
    if (!r) {
      res.status(404).json({ error: 'Trace not found' });
      return;
    }

    res.json({
      id: r.id,
      executionId: r.executionId,
      rootNode: r.treeData,
      metadata: r.metadata,
      createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Client Traces] Error:', error);
    res.status(500).json({ error: 'Failed to fetch trace' });
  }
});

/**
 * GET /api/client/costs/summary
 * Aggregated cost summary for the client's organization.
 */
router.get('/costs/summary', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const rows = await db
      .select({
        model: costs.model,
        totalCost: sql<number>`COALESCE(SUM(${costs.cost}::numeric), 0)`,
        totalTokens: sql<number>`COALESCE(SUM(${costs.totalTokens}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(costs)
      .innerJoin(executions, eq(costs.executionId, executions.id))
      .innerJoin(users, eq(executions.userId, users.id))
      .where(eq(users.organizationId, client.organizationId))
      .groupBy(costs.model);

    let total = 0;
    let totalTokens = 0;
    let executionCount = 0;
    const byModel: Record<string, { count: number; tokens: number; cost: number }> = {};

    for (const row of rows) {
      const cost = Number(row.totalCost);
      const tokens = Number(row.totalTokens);
      const count = Number(row.count);
      total += cost;
      totalTokens += tokens;
      executionCount += count;
      byModel[row.model] = { count, tokens, cost };
    }

    res.json({ total, totalTokens, executionCount, byModel });
  } catch (error) {
    console.error('[Client Costs Summary] Error:', error);
    res.status(500).json({ error: 'Failed to fetch cost summary' });
  }
});

/**
 * GET /api/client/costs?startDate=...&endDate=...&agentId=...
 * Cost history for the client's organization.
 */
router.get('/costs', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const conditions = [eq(users.organizationId, client.organizationId)];

    if (req.query.startDate) {
      conditions.push(gte(costs.createdAt, new Date(req.query.startDate as string)));
    }
    if (req.query.endDate) {
      conditions.push(lte(costs.createdAt, new Date(req.query.endDate as string)));
    }

    const rows = await db
      .select({
        id: costs.id,
        executionId: costs.executionId,
        model: costs.model,
        promptTokens: costs.promptTokens,
        completionTokens: costs.completionTokens,
        totalTokens: costs.totalTokens,
        cost: costs.cost,
        createdAt: costs.createdAt,
      })
      .from(costs)
      .innerJoin(executions, eq(costs.executionId, executions.id))
      .innerJoin(users, eq(executions.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(costs.createdAt))
      .limit(500);

    const data = rows.map((r) => ({
      id: r.id,
      executionId: r.executionId,
      model: r.model,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      totalTokens: r.totalTokens,
      cost: Number(r.cost),
      timestamp: r.createdAt?.toISOString() ?? new Date().toISOString(),
    }));

    res.json(data);
  } catch (error) {
    console.error('[Client Costs] Error:', error);
    res.status(500).json({ error: 'Failed to fetch costs' });
  }
});

export default router;
