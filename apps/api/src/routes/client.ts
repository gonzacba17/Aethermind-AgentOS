import { Router } from 'express';
import { db } from '../db/index.js';
import { telemetryEvents, clientBudgets, clients, routingRules, providerHealth, cacheSettings, semanticCache, promptCompressionLog, optimizationSettings, clientInsights, agents, logs, users, traces, executions, costs, workflows, organizations, alertRules, agentTraces } from '../db/schema.js';
import { eq, and, gte, lte, sql, isNotNull, isNull, desc, inArray } from 'drizzle-orm';
import { ClientAuthenticatedRequest, invalidateClientCache } from '../middleware/clientAuth.js';
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
 * GET /api/client/trial-status
 * Returns plan and trial information for the authenticated client's organization.
 */
router.get('/trial-status', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const [org] = await db
      .select({ plan: organizations.plan, createdAt: organizations.createdAt })
      .from(organizations)
      .where(eq(organizations.id, client.organizationId))
      .limit(1);

    if (!org) {
      res.json({
        plan: 'trial',
        isTrialActive: false,
        trialDaysRemaining: null,
        trialExpiresAt: null,
      });
      return;
    }

    const plan = (org.plan || 'FREE').toLowerCase();
    const isTrial = plan === 'free' || plan === 'trial';

    if (!isTrial) {
      res.json({
        plan,
        isTrialActive: false,
        trialDaysRemaining: null,
        trialExpiresAt: null,
      });
      return;
    }

    const TRIAL_DURATION_DAYS = 14;
    const createdAt = new Date(org.createdAt);
    const expiresAt = new Date(createdAt.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
    const now = new Date();
    const elapsedMs = now.getTime() - createdAt.getTime();
    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
    const daysRemaining = Math.max(0, Math.ceil(TRIAL_DURATION_DAYS - elapsedDays));
    const isTrialActive = elapsedDays <= TRIAL_DURATION_DAYS;

    res.json({
      plan: 'trial',
      isTrialActive,
      trialDaysRemaining: daysRemaining,
      trialExpiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('[Client trial-status] Error:', error);
    res.status(500).json({ error: 'Failed to fetch trial status' });
  }
});

/**
 * GET /api/client/me
 * Returns the authenticated client's info + onboarding status.
 */
router.get('/me', async (req, res) => {
  const clientReq = req as ClientAuthenticatedRequest;
  const client = clientReq.client;

  if (!client) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  // Fetch onboarding status for the linked user
  let hasCompletedOnboarding = true; // default for legacy clients without a linked user
  let onboardingStep = 'complete';

  if (client.organizationId) {
    const [linkedUser] = await db
      .select({
        hasCompletedOnboarding: users.hasCompletedOnboarding,
        onboardingStep: users.onboardingStep,
      })
      .from(users)
      .where(eq(users.organizationId, client.organizationId))
      .limit(1);

    if (linkedUser) {
      hasCompletedOnboarding = linkedUser.hasCompletedOnboarding;
      onboardingStep = linkedUser.onboardingStep || 'welcome';
    }
  }

  res.json({
    companyName: client.companyName,
    id: client.id,
    hasCompletedOnboarding,
    onboardingStep,
    sdkApiKey: client.sdkApiKey || null,
  });
});


/**
 * POST /api/client/complete-onboarding
 * Marks onboarding as completed for the user linked to this client's org.
 */
router.post('/complete-onboarding', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        hasCompletedOnboarding: true,
        onboardingStep: 'complete',
      })
      .where(eq(users.organizationId, client.organizationId))
      .returning({
        hasCompletedOnboarding: users.hasCompletedOnboarding,
        onboardingStep: users.onboardingStep,
      });

    if (!updatedUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      hasCompletedOnboarding: updatedUser.hasCompletedOnboarding,
      onboardingStep: updatedUser.onboardingStep,
    });
  } catch (error) {
    console.error('[Client] complete-onboarding error:', (error as Error).message);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

/**
 * PATCH /api/client/me
 * Update the authenticated client's profile info.
 * Accepts: name (companyName), webhookUrl, notes
 * Returns same shape as GET /api/client/me.
 */
router.patch('/me', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { name, companyName, webhookUrl, notes } = req.body;

    const updateData: Record<string, any> = {};
    const newName = name || companyName;
    if (newName !== undefined) updateData.companyName = newName;
    if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl;
    if (notes !== undefined) updateData.notes = notes;

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    const [updated] = await db
      .update(clients)
      .set(updateData)
      .where(eq(clients.id, client.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    res.json({
      companyName: updated.companyName,
      sdkApiKey: updated.sdkApiKey,
      id: updated.id,
    });
  } catch (error) {
    console.error('[Client PATCH /me] Error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * DELETE /api/client/telemetry
 *
 * Deletes all telemetry_events for this organization.
 * Used to clear test/demo data from the dashboard.
 */
router.delete('/telemetry', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no organization' });
      return;
    }

    const result = await db
      .delete(telemetryEvents)
      .where(eq(telemetryEvents.organizationId, client.organizationId));

    const deleted = (result as any).rowCount ?? (result as any).count ?? 0;

    console.log(`[Client DELETE /telemetry] Deleted ${deleted} events for org ${client.organizationId}`);
    res.json({ deleted });
  } catch (error) {
    console.error('[Client DELETE /telemetry] Error:', error);
    res.status(500).json({ error: 'Failed to delete telemetry data' });
  }
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

    res.json(data);
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

    // Accept both dashboard format (limitAmount, period, alertAt)
    // and API format (type, limitUsd, alertThresholds)
    const type = req.body.type || (req.body.period === 'daily' ? 'daily' : 'monthly');
    const limitUsd = req.body.limitUsd || req.body.limitAmount;
    const alertThresholds = req.body.alertThresholds
      || (req.body.alertAt ? [req.body.alertAt, Math.min(req.body.alertAt + 10, 100), 100] : undefined);

    if (!type || !['monthly', 'daily'].includes(type)) {
      res.status(400).json({ error: 'type/period must be "monthly" or "daily"' });
      return;
    }
    if (!limitUsd || isNaN(parseFloat(String(limitUsd))) || parseFloat(String(limitUsd)) <= 0) {
      res.status(400).json({ error: 'limitUsd/limitAmount must be a positive number' });
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
            spent: evaluation.spentUsd,
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
      // No budget defined — return a zero-state so the frontend renders gracefully
      res.json({
        limit: 0,
        spent: 0,
        remaining: 0,
        percentUsed: 0,
        period: 'monthly',
        status: 'ok',
        budgetId: null,
      });
      return;
    }

    // Return shape matching dashboard BudgetInfo interface:
    // { limit, spent, remaining, percentUsed, period }
    res.json({
      limit: evaluation.limitUsd,
      spent: evaluation.spentUsd,
      remaining: evaluation.remaining,
      percentUsed: evaluation.percentUsed,
      period: evaluation.budgetType === 'daily' ? 'daily' as const
        : evaluation.budgetType === 'weekly' ? 'weekly' as const
        : 'monthly' as const,
      // Keep original fields for backward compat with SDK
      status: evaluation.status,
      budgetId: evaluation.budgetId,
    });
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

    const providers = healthRows.map(h => {
      const telemetry = latencyMap.get(h.provider);
      // If we have successful requests via the gateway in the last 24h,
      // the provider is effectively "up" regardless of env-var health checks
      const hasRecentTraffic = telemetry && telemetry.count > 0;
      return {
        provider: h.provider,
        status: hasRecentTraffic ? 'ok' : h.status,
        latencyMs: hasRecentTraffic ? telemetry.avgLatency : h.latencyMs,
        lastCheckedAt: h.lastCheckedAt,
        errorMessage: hasRecentTraffic ? null : h.errorMessage,
        avg24hLatency: telemetry?.avgLatency ?? null,
        requests24h: telemetry?.count ?? 0,
      };
    });

    // Also include providers found in telemetry but not in provider_health table
    for (const [provider, stats] of latencyMap) {
      if (!providers.some(p => p.provider === provider)) {
        providers.push({
          provider,
          status: 'ok',
          latencyMs: stats.avgLatency,
          lastCheckedAt: new Date().toISOString() as any,
          errorMessage: null,
          avg24hLatency: stats.avgLatency,
          requests24h: stats.count,
        });
      }
    }

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
          inArray(telemetryEvents.model, EXPENSIVE_MODELS),
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
 * GET /api/client/optimization/report
 * Returns cost optimization report with real telemetry data.
 */
router.get('/optimization/report', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get total cost from telemetry
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

    const totalCost = parseFloat(totalResult[0]?.totalCost ?? '0');
    const totalRequests = totalResult[0]?.totalRequests ?? 0;

    // Get model breakdown for recommendations
    const modelBreakdown = await db
      .select({
        model: telemetryEvents.model,
        cost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
        count: sql<number>`count(*)::int`,
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

    // Generate recommendations based on actual usage
    const recommendations = [];
    const potentialSavings = totalCost * 0.25; // Estimate 25% savings potential

    for (const m of modelBreakdown) {
      const modelCost = parseFloat(m.cost ?? '0');
      const modelName = m.model || 'unknown';

      // Recommend cheaper alternatives for expensive models
      if (modelName.includes('gpt-4') && !modelName.includes('mini')) {
        recommendations.push({
          id: `rec-${modelName}`,
          type: 'model_switch',
          priority: 'high' as const,
          title: `Switch ${modelName} to gpt-4o-mini for simple tasks`,
          description: `You spent $${modelCost.toFixed(2)} on ${modelName} (${m.count} requests). Consider routing simple queries to gpt-4o-mini.`,
          estimatedSavings: Math.round(modelCost * 0.6 * 100) / 100,
          effort: 'low' as const,
        });
      }
      if (modelName.includes('claude-3-opus')) {
        recommendations.push({
          id: `rec-${modelName}`,
          type: 'model_switch',
          priority: 'medium' as const,
          title: `Use claude-3-haiku for lighter ${modelName} workloads`,
          description: `${m.count} requests to ${modelName} at $${modelCost.toFixed(2)}. Route non-complex tasks to claude-3-haiku.`,
          estimatedSavings: Math.round(modelCost * 0.5 * 100) / 100,
          effort: 'low' as const,
        });
      }
    }

    // Add generic recommendations
    if (totalCost > 0) {
      recommendations.push({
        id: 'rec-prompt-compression',
        type: 'prompt_optimization',
        priority: 'medium' as const,
        title: 'Enable prompt compression',
        description: 'Automatically compress prompts to reduce token usage by 15-30% without quality loss.',
        estimatedSavings: Math.round(totalCost * 0.15 * 100) / 100,
        effort: 'low' as const,
      });
      recommendations.push({
        id: 'rec-caching',
        type: 'caching',
        priority: 'low' as const,
        title: 'Enable semantic caching',
        description: 'Cache similar prompts to avoid duplicate API calls and reduce costs.',
        estimatedSavings: Math.round(totalCost * 0.1 * 100) / 100,
        effort: 'medium' as const,
      });
    }

    res.json({
      organizationId: client.organizationId,
      period: {
        start: since.toISOString(),
        end: new Date().toISOString(),
      },
      summary: {
        totalCost: Math.round(totalCost * 100) / 100,
        potentialSavings: Math.round(potentialSavings * 100) / 100,
        inefficiencies: recommendations.length,
        totalRequests,
      },
      recommendations,
    });
  } catch (error) {
    console.error('[Client Optimization Report] Error:', error);
    res.status(500).json({ error: 'Failed to fetch optimization report' });
  }
});


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

    // Query telemetry_events (gateway data) instead of old logs table
    const conditions: any[] = [
      eq(telemetryEvents.organizationId, client.organizationId),
    ];

    if (level) {
      // Map log levels to telemetry status
      if (level === 'error') {
        conditions.push(eq(telemetryEvents.status, 'error'));
      }
    }

    const rows = await db
      .select({
        id: telemetryEvents.id,
        timestamp: telemetryEvents.timestamp,
        provider: telemetryEvents.provider,
        model: telemetryEvents.model,
        status: telemetryEvents.status,
        error: telemetryEvents.error,
        tokens: telemetryEvents.totalTokens,
        cost: telemetryEvents.cost,
        latency: telemetryEvents.latency,
        agentId: telemetryEvents.agentId,
        agentName: telemetryEvents.agentName,
        traceId: telemetryEvents.traceId,
        workflowId: telemetryEvents.workflowId,
        createdAt: telemetryEvents.createdAt,
      })
      .from(telemetryEvents)
      .where(and(...conditions))
      .orderBy(desc(telemetryEvents.createdAt))
      .limit(limit)
      .offset(offset);

    const data = rows.map((r) => ({
      id: r.id,
      level: r.status === 'error' ? 'error' : r.status === 'success' ? 'info' : 'warn',
      message: r.error
        ? `[${r.provider}/${r.model}] Error: ${r.error}`
        : `[${r.provider}/${r.model}] ${r.status} — ${r.tokens ?? 0} tokens, $${parseFloat(String(r.cost ?? 0)).toFixed(4)}, ${r.latency ?? 0}ms`,
      metadata: { provider: r.provider, model: r.model, tokens: r.tokens, cost: r.cost, latency: r.latency },
      timestamp: r.timestamp?.toISOString() ?? r.createdAt?.toISOString() ?? new Date().toISOString(),
      agentId: r.agentId ?? undefined,
      source: r.agentName || r.provider || 'gateway',
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

    // Query agent_traces (gateway data) instead of old traces table
    const rows = await db
      .select()
      .from(agentTraces)
      .where(eq(agentTraces.organizationId, client.organizationId))
      .orderBy(desc(agentTraces.createdAt))
      .limit(limit)
      .offset(offset);

    // Group by traceId for the frontend
    const grouped: Record<string, any> = {};
    for (const row of rows) {
      const tid = row.traceId;
      if (!grouped[tid]) {
        grouped[tid] = {
          id: tid,
          traceId: tid,
          agentName: row.agentName || row.agentId || 'unknown',
          workflowId: row.workflowId,
          status: row.status || 'success',
          totalCost: 0,
          latencyMs: 0,
          steps: 0,
          startedAt: row.startedAt?.toISOString() ?? row.createdAt?.toISOString() ?? new Date().toISOString(),
          createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
          agents: [],
        };
      }
      grouped[tid].agents.push({
        agentId: row.agentId,
        agentName: row.agentName,
        model: row.model,
        provider: row.provider,
        status: row.status,
        costUsd: parseFloat(String(row.costUsd ?? 0)),
        latencyMs: row.latencyMs ?? 0,
        workflowStep: row.workflowStep,
        parentAgentId: row.parentAgentId,
      });
      grouped[tid].totalCost += parseFloat(String(row.costUsd ?? 0));
      grouped[tid].latencyMs += row.latencyMs ?? 0;
      grouped[tid].steps += 1;
      if (row.status === 'error') grouped[tid].status = 'error';
    }

    const data = Object.values(grouped);

    res.json({ data, total: data.length });
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

    // Query agent_traces by traceId (gateway data)
    const rows = await db
      .select()
      .from(agentTraces)
      .where(
        and(
          eq(agentTraces.traceId, req.params.id),
          eq(agentTraces.organizationId, client.organizationId),
        ),
      )
      .orderBy(agentTraces.startedAt);

    if (rows.length === 0) {
      res.status(404).json({ error: 'Trace not found' });
      return;
    }

    const first = rows[0]!;
    const totalCost = rows.reduce((s, r) => s + parseFloat(String(r.costUsd ?? 0)), 0);
    const totalLatency = rows.reduce((s, r) => s + (r.latencyMs ?? 0), 0);
    const hasError = rows.some(r => r.status === 'error');

    res.json({
      id: first.traceId,
      traceId: first.traceId,
      workflowId: first.workflowId,
      status: hasError ? 'error' : 'success',
      totalCost,
      latencyMs: totalLatency,
      startedAt: first.startedAt?.toISOString() ?? first.createdAt?.toISOString(),
      createdAt: first.createdAt?.toISOString() ?? new Date().toISOString(),
      agents: rows.map(r => ({
        agentId: r.agentId,
        agentName: r.agentName,
        model: r.model,
        provider: r.provider,
        status: r.status,
        costUsd: parseFloat(String(r.costUsd ?? 0)),
        latencyMs: r.latencyMs ?? 0,
        workflowStep: r.workflowStep,
        parentAgentId: r.parentAgentId,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        startedAt: r.startedAt?.toISOString(),
        completedAt: r.completedAt?.toISOString(),
        error: r.error,
      })),
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

// ============================================
// COSTS CHART ENDPOINTS (telemetry-based, for /costs page charts)
// ============================================

/**
 * GET /api/client/costs/daily?period=30d
 * Returns daily cost breakdown from telemetry_events.
 */
router.get('/costs/daily', async (req, res) => {
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
        requests: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${telemetryEvents.totalTokens}), 0)::int`,
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

    const data = rows.map((r, i) => {
      const cost = parseFloat(r.cost ?? '0');
      const prevCost = i > 0 ? parseFloat(rows[i - 1]!.cost ?? '0') : cost;
      const change = prevCost > 0 ? ((cost - prevCost) / prevCost) * 100 : 0;

      return {
        date: r.date,
        cost: Math.round(cost * 1000000) / 1000000,
        requests: r.requests,
        tokens: r.tokens,
        executions: r.requests,
        change: Math.round(change * 10) / 10,
      };
    });

    res.json(data);
  } catch (error) {
    console.error('[Client Costs Daily] Error:', error);
    res.status(500).json({ error: 'Failed to fetch daily costs' });
  }
});

/**
 * GET /api/client/costs/by-model?period=30d
 * Returns cost breakdown by model from telemetry_events.
 */
router.get('/costs/by-model', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const period = (req.query.period as string) || '30d';
    const since = periodToDate(period);

    // Total cost for percentage calculation
    const totalResult = await db
      .select({
        total: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, since),
        ),
      );
    const totalCost = parseFloat(totalResult[0]?.total ?? '0');

    const rows = await db
      .select({
        model: telemetryEvents.model,
        provider: telemetryEvents.provider,
        cost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
        requests: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${telemetryEvents.totalTokens}), 0)::int`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, since),
        ),
      )
      .groupBy(telemetryEvents.model, telemetryEvents.provider)
      .orderBy(sql`sum(${telemetryEvents.cost}::numeric) desc`);

    const data = rows.map(r => {
      const cost = parseFloat(r.cost ?? '0');
      return {
        model: r.model,
        provider: r.provider || 'unknown',
        cost: Math.round(cost * 1000000) / 1000000,
        requests: r.requests,
        tokens: r.tokens,
        usage: totalCost > 0 ? Math.round((cost / totalCost) * 100) : 0,
      };
    });

    res.json(data);
  } catch (error) {
    console.error('[Client Costs By Model] Error:', error);
    res.status(500).json({ error: 'Failed to fetch costs by model' });
  }
});


/**
 * GET /api/client/forecasting/anomalies?days=7
 * Returns cost anomalies from telemetry data.
 */
router.get('/forecasting/anomalies', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const days = parseInt(req.query.days as string) || 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get daily costs to find anomalies
    const dailyRows = await db
      .select({
        date: sql<string>`date_trunc('day', ${telemetryEvents.timestamp})::date::text`,
        cost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
        count: sql<number>`count(*)::int`,
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

    // Calculate mean and std
    const costs = dailyRows.map(r => parseFloat(r.cost ?? '0'));
    const mean = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
    const std = costs.length > 1
      ? Math.sqrt(costs.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / (costs.length - 1))
      : mean * 0.3;

    const anomalies = dailyRows
      .filter(r => {
        const cost = parseFloat(r.cost ?? '0');
        return Math.abs(cost - mean) > 1.5 * std && cost > 0;
      })
      .map(r => {
        const cost = parseFloat(r.cost ?? '0');
        return {
          timestamp: r.date,
          value: Math.round(cost * 100) / 100,
          expectedRange: [
            Math.round((mean - std) * 100) / 100,
            Math.round((mean + std) * 100) / 100,
          ] as [number, number],
          severity: (cost > mean + 2 * std ? 'high' : 'medium') as 'high' | 'medium' | 'low',
          reason: cost > mean ? 'Above average daily cost' : 'Below average daily cost',
        };
      });

    res.json({ anomalies, count: anomalies.length });
  } catch (error) {
    console.error('[Client Forecasting Anomalies] Error:', error);
    res.status(500).json({ error: 'Failed to fetch anomalies' });
  }
});

/**
 * GET /api/client/forecasting/patterns?days=30
 * Returns usage patterns from telemetry data.
 */
router.get('/forecasting/patterns', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const days = parseInt(req.query.days as string) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get hourly pattern
    const hourlyRows = await db
      .select({
        hour: sql<number>`extract(hour from ${telemetryEvents.timestamp})::int`,
        avgCost: sql<string>`coalesce(avg(${telemetryEvents.cost}::numeric), 0)`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, since),
        ),
      )
      .groupBy(sql`extract(hour from ${telemetryEvents.timestamp})`)
      .orderBy(sql`extract(hour from ${telemetryEvents.timestamp}) asc`);

    // Get daily pattern
    const dailyRows = await db
      .select({
        cost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
        count: sql<number>`count(*)::int`,
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

    const costs = dailyRows.map(r => parseFloat(r.cost ?? '0'));
    const mean = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
    const std = costs.length > 1
      ? Math.sqrt(costs.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / (costs.length - 1))
      : 0;

    const hourly = Array(24).fill(0);
    for (const row of hourlyRows) {
      hourly[row.hour] = parseFloat(row.avgCost ?? '0');
    }

    // Weekly pattern (Mon-Sun)
    const weeklyRows = await db
      .select({
        dow: sql<number>`extract(dow from ${telemetryEvents.timestamp})::int`,
        avgCost: sql<string>`coalesce(avg(${telemetryEvents.cost}::numeric), 0)`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, since),
        ),
      )
      .groupBy(sql`extract(dow from ${telemetryEvents.timestamp})`);

    const daily = Array(7).fill(0);
    for (const row of weeklyRows) {
      daily[row.dow] = parseFloat(row.avgCost ?? '0');
    }

    const totalCost = costs.reduce((a, b) => a + b, 0);
    const costTrendDir = costs.length >= 2
      ? (costs[costs.length - 1]! > costs[0]! ? 'up' : costs[costs.length - 1]! < costs[0]! ? 'down' : 'stable')
      : 'stable';

    res.json({
      period: {
        start: since.toISOString(),
        end: new Date().toISOString(),
      },
      anomalies: [],
      costTrend: { direction: costTrendDir, strength: 0.3 },
      usageTrend: { direction: 'stable', strength: 0.1 },
      seasonalPattern: { hourly, daily },
      statistics: { mean: Math.round(mean * 100) / 100, std: Math.round(std * 100) / 100 },
      dataPoints: dailyRows.length * 24,
    });
  } catch (error) {
    console.error('[Client Forecasting Patterns] Error:', error);
    res.status(500).json({ error: 'Failed to fetch patterns' });
  }
});

/**
 * GET /api/client/forecasting/alerts
 * Returns predictive alerts based on telemetry trends.
 */
router.get('/forecasting/alerts', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    // Check if budget is about to be exceeded
    const evaluation = await evaluateBudget(client.id);
    const alerts: Array<{
      id: string;
      type: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      timestamp: string;
      acknowledged: boolean;
    }> = [];

    if (evaluation && evaluation.percentUsed > 80) {
      alerts.push({
        id: `budget-alert-${Date.now()}`,
        type: 'budget_forecast',
        priority: evaluation.percentUsed > 95 ? 'critical' : 'high',
        message: `Budget usage at ${evaluation.percentUsed.toFixed(1)}% — projected to exceed limit`,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
    }

    // Check for recent cost spikes — use two separate queries to avoid Date interpolation issues
    const yesterdayStart = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const todayResult = await db
      .select({
        totalCost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, todayStart),
        ),
      );

    const yesterdayResult = await db
      .select({
        totalCost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, yesterdayStart),
          lte(telemetryEvents.timestamp, todayStart),
        ),
      );

    const todayCost = parseFloat(todayResult[0]?.totalCost ?? '0');
    const yesterdayCost = parseFloat(yesterdayResult[0]?.totalCost ?? '0');


    if (yesterdayCost > 0 && todayCost > yesterdayCost * 1.5) {
      alerts.push({
        id: `spike-alert-${Date.now()}`,
        type: 'cost_spike',
        priority: 'medium',
        message: `Today's cost ($${todayCost.toFixed(2)}) is ${((todayCost / yesterdayCost - 1) * 100).toFixed(0)}% higher than yesterday`,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
    }

    res.json({ alerts, count: alerts.length });
  } catch (error) {
    console.error('[Client Forecasting Alerts] Error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

/**
 * POST /api/client/forecasting/alerts/acknowledge
 * Acknowledge a predictive alert.
 */
router.post('/forecasting/alerts/acknowledge', async (_req, res) => {
  // Simple acknowledgement — in production, would store in DB
  res.json({ success: true });
});

/**
 * GET /api/client/forecasting/seasonal?days=30
 * Returns seasonal usage patterns (hourly and daily).
 */
router.get('/forecasting/seasonal', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const days = parseInt(req.query.days as string) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const hourlyRows = await db
      .select({
        hour: sql<number>`extract(hour from ${telemetryEvents.timestamp})::int`,
        avgCost: sql<string>`coalesce(avg(${telemetryEvents.cost}::numeric), 0)`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, since),
        ),
      )
      .groupBy(sql`extract(hour from ${telemetryEvents.timestamp})`)
      .orderBy(sql`extract(hour from ${telemetryEvents.timestamp}) asc`);

    const weeklyRows = await db
      .select({
        dow: sql<number>`extract(dow from ${telemetryEvents.timestamp})::int`,
        avgCost: sql<string>`coalesce(avg(${telemetryEvents.cost}::numeric), 0)`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, since),
        ),
      )
      .groupBy(sql`extract(dow from ${telemetryEvents.timestamp})`);

    const hourly = Array(24).fill(0);
    for (const row of hourlyRows) {
      hourly[row.hour] = parseFloat(row.avgCost ?? '0');
    }

    const daily = Array(7).fill(0);
    for (const row of weeklyRows) {
      daily[row.dow] = parseFloat(row.avgCost ?? '0');
    }

    res.json({
      hourly,
      daily,
      labels: {
        hourly: Array(24).fill(0).map((_, i) => `${i}:00`),
        daily: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      },
    });
  } catch (error) {
    console.error('[Client Forecasting Seasonal] Error:', error);
    res.status(500).json({ error: 'Failed to fetch seasonal patterns' });
  }
});

// ============================================
// WORKFLOW ENDPOINTS (for dashboard)
// ============================================

/**
 * GET /api/client/workflows
 * Returns workflows for the authenticated client's organization.
 */
router.get('/workflows', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    // First try old workflows table
    const orgUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.organizationId, client.organizationId));

    const userIds = orgUsers.map(u => u.id);

    let data: any[] = [];

    if (userIds.length > 0) {
      const rows = await db
        .select()
        .from(workflows)
        .where(inArray(workflows.userId, userIds))
        .orderBy(desc(workflows.createdAt))
        .limit(50);

      data = rows.map(w => ({
        name: w.name,
        description: w.description,
        steps: (w.definition as any)?.steps || [],
        entryPoint: (w.definition as any)?.entryPoint || '',
        createdAt: w.createdAt?.toISOString(),
        updatedAt: w.updatedAt?.toISOString(),
        source: 'workflow',
      }));
    }

    // Also aggregate workflows from agent_traces (gateway data)
    const traceWorkflows = await db
      .select({
        workflowId: agentTraces.workflowId,
        stepCount: sql<number>`count(*)`.as('step_count'),
        uniqueAgents: sql<number>`count(distinct ${agentTraces.agentId})`.as('unique_agents'),
        totalCost: sql<number>`sum(${agentTraces.costUsd})`.as('total_cost'),
        firstSeen: sql<string>`min(${agentTraces.createdAt})`.as('first_seen'),
        lastSeen: sql<string>`max(${agentTraces.createdAt})`.as('last_seen'),
      })
      .from(agentTraces)
      .where(
        and(
          eq(agentTraces.organizationId, client.organizationId),
          isNotNull(agentTraces.workflowId),
        ),
      )
      .groupBy(agentTraces.workflowId);

    for (const tw of traceWorkflows) {
      // Skip if already in data from workflows table
      if (data.some(d => d.name === tw.workflowId)) continue;
      data.push({
        name: tw.workflowId,
        description: `${tw.uniqueAgents} agent(s), ${tw.stepCount} trace(s)`,
        steps: Array.from({ length: Number(tw.uniqueAgents) }, (_, i) => ({ id: `step-${i+1}`, agent: `agent-${i+1}` })),
        entryPoint: 'step-1',
        createdAt: tw.firstSeen,
        updatedAt: tw.lastSeen,
        source: 'gateway',
        totalCost: parseFloat(String(tw.totalCost ?? 0)),
      });
    }

    res.json({
      data,
      total: data.length,
      limit: 50,
      offset: 0,
      hasMore: false,
    });
  } catch (error) {
    console.error('[Client Workflows] Error:', error);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

/**
 * GET /api/client/workflows/:name
 * Returns a specific workflow by name.
 */
router.get('/workflows/:name', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const { name } = req.params;

    const orgUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.organizationId, client.organizationId));

    const userIds = orgUsers.map(u => u.id);

    if (userIds.length === 0) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }

    const rows = await db
      .select()
      .from(workflows)
      .where(and(
        eq(workflows.name, decodeURIComponent(name)),
        inArray(workflows.userId, userIds),
      ))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }

    const w = rows[0]!;
    res.json({
      name: w.name,
      description: w.description,
      steps: (w.definition as any)?.steps || [],
      entryPoint: (w.definition as any)?.entryPoint || '',
      createdAt: w.createdAt?.toISOString(),
      updatedAt: w.updatedAt?.toISOString(),
    });
  } catch (error) {
    console.error('[Client Workflow Detail] Error:', error);
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

/**
 * POST /api/client/workflows
 * Create a new workflow.
 */
router.post('/workflows', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const { name, description, steps, entryPoint } = req.body;
    if (!name || !steps) {
      res.status(400).json({ error: 'name and steps are required' });
      return;
    }

    // Get first user in org
    const orgUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.organizationId, client.organizationId))
      .limit(1);

    if (orgUsers.length === 0) {
      res.status(400).json({ error: 'No users in organization' });
      return;
    }

    const crypto = await import('crypto');
    const id = crypto.randomUUID();

    await db.insert(workflows).values({
      id,
      userId: orgUsers[0]!.id,
      name,
      description: description || null,
      definition: { steps, entryPoint: entryPoint || steps[0]?.id || '' },
    });

    res.status(201).json({ name, message: 'Workflow created' });
  } catch (error) {
    console.error('[Client Workflow Create] Error:', error);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

/**
 * PUT /api/client/workflows/:name
 * Update a workflow.
 */
router.put('/workflows/:name', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const { name } = req.params;
    const { description, steps, entryPoint } = req.body;

    const orgUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.organizationId, client.organizationId));
    const userIds = orgUsers.map(u => u.id);

    if (userIds.length === 0) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }

    const updateData: any = { updatedAt: new Date() };
    if (description !== undefined) updateData.description = description;
    if (steps) updateData.definition = { steps, entryPoint: entryPoint || steps[0]?.id || '' };

    const updated = await db
      .update(workflows)
      .set(updateData)
      .where(and(
        eq(workflows.name, decodeURIComponent(name)),
        inArray(workflows.userId, userIds),
      ))
      .returning({ name: workflows.name });

    if (updated.length === 0) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }

    res.json({ name: decodeURIComponent(name), message: 'Workflow updated' });
  } catch (error) {
    console.error('[Client Workflow Update] Error:', error);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

/**
 * DELETE /api/client/workflows/:name
 * Delete a workflow.
 */
router.delete('/workflows/:name', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const { name } = req.params;

    const orgUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.organizationId, client.organizationId));
    const userIds = orgUsers.map(u => u.id);

    if (userIds.length === 0) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }

    const decodedName = decodeURIComponent(name);

    // Delete from workflows table
    await db
      .delete(workflows)
      .where(and(
        eq(workflows.name, decodedName),
        inArray(workflows.userId, userIds),
      ));

    // Also clear workflowId on matching agent_traces so gateway-sourced
    // workflows no longer appear in the list after deletion
    await db
      .update(agentTraces)
      .set({ workflowId: null })
      .where(and(
        eq(agentTraces.organizationId, client.organizationId),
        eq(agentTraces.workflowId, decodedName),
      ));

    res.json({ message: 'Workflow deleted' });
  } catch (error) {
    console.error('[Client Workflow Delete] Error:', error);
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

/**
 * POST /api/client/workflows/:name/estimate
 * Estimate workflow cost (placeholder).
 */
router.post('/workflows/:name/estimate', async (req, res) => {
  const { name } = req.params;
  res.json({
    workflowName: decodeURIComponent(name),
    estimatedCost: 0.15,
    currency: 'USD',
    breakdown: {},
    tokenCount: 2500,
    confidence: 0.7,
    basedOn: 'heuristic',
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/client/workflows/:name/execute
 * Execute a workflow (placeholder).
 */
router.post('/workflows/:name/execute', async (_req, res) => {
  res.status(501).json({ error: 'Workflow execution not yet available via dashboard' });
});

// ============================================
// OPTIMIZATION REPORT / MODELS / RULES ENDPOINTS (for /optimization page)
// ============================================

/**
 * GET /api/client/optimization/report
 * Returns optimization recommendations based on telemetry.
 */
router.get('/optimization/report', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const since = periodToDate('30d');

    const totalResult = await db
      .select({
        totalCost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, since),
        ),
      );

    const totalCost = parseFloat(totalResult[0]?.totalCost ?? '0');
    const potentialSavings = totalCost * 0.3; // rough estimate

    res.json({
      organizationId: client.organizationId,
      period: {
        start: since.toISOString(),
        end: new Date().toISOString(),
      },
      summary: {
        totalCost: Math.round(totalCost * 100) / 100,
        potentialSavings: Math.round(potentialSavings * 100) / 100,
        inefficiencies: potentialSavings > 0 ? 3 : 0,
      },
      recommendations: totalCost > 0 ? [
        {
          id: '1',
          title: 'Enable model routing for simple queries',
          description: 'Route simple prompts to cheaper models to reduce costs without quality loss.',
          estimatedSavings: Math.round(potentialSavings * 0.5 * 100) / 100,
          priority: 1,
          implementation: 'Enable routing in Settings → Model Routing',
          impact: 'high' as const,
        },
        {
          id: '2',
          title: 'Enable semantic caching',
          description: 'Cache repeated prompts to avoid redundant API calls.',
          estimatedSavings: Math.round(potentialSavings * 0.3 * 100) / 100,
          priority: 2,
          implementation: 'Enable caching in Settings → Cache',
          impact: 'medium' as const,
        },
        {
          id: '3',
          title: 'Enable prompt compression',
          description: 'Compress prompts to reduce token usage.',
          estimatedSavings: Math.round(potentialSavings * 0.2 * 100) / 100,
          priority: 3,
          implementation: 'Enable compression in Settings → Optimization',
          impact: 'low' as const,
        },
      ] : [],
    });
  } catch (error) {
    console.error('[Client Optimization Report] Error:', error);
    res.status(500).json({ error: 'Failed to fetch optimization report' });
  }
});

/**
 * GET /api/client/optimization/models
 * Returns models used by the client's organization.
 */
router.get('/optimization/models', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const since = periodToDate('30d');

    const rows = await db
      .select({
        model: telemetryEvents.model,
        provider: telemetryEvents.provider,
        count: sql<number>`count(*)::int`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, client.organizationId),
          gte(telemetryEvents.timestamp, since),
        ),
      )
      .groupBy(telemetryEvents.model, telemetryEvents.provider)
      .orderBy(sql`count(*) desc`);

    // Simple pricing lookup
    const pricingMap: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 0.005, output: 0.015 },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
      'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
      'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
      'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
    };

    const models = rows.map(r => {
      const pricing = pricingMap[r.model] || { input: 0.001, output: 0.002 };
      return {
        model: r.model,
        provider: r.provider || 'unknown',
        tier: pricing.input > 0.005 ? 'premium' : pricing.input > 0.001 ? 'standard' : 'economy',
        pricing: {
          inputPer1kTokens: pricing.input,
          outputPer1kTokens: pricing.output,
        },
        contextWindow: 128000,
        capabilities: ['general'],
      };
    });

    res.json({ models });
  } catch (error) {
    console.error('[Client Optimization Models] Error:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

/**
 * GET /api/client/optimization/rules
 * Returns optimization/routing rules for the client.
 */
router.get('/optimization/rules', async (req, res) => {
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
      res.json({ rules: [] });
      return;
    }

    res.json({
      rules: [{
        id: rule.id,
        name: 'Default Routing',
        priority: 1,
        conditions: [{ field: 'complexity', operator: 'eq', value: 'simple' }],
        action: { type: 'route_to', model: rule.simpleModel },
      }],
    });
  } catch (error) {
    console.error('[Client Optimization Rules] Error:', error);
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

/**
 * POST /api/client/optimization/rules
 * Add a routing/optimization rule.
 */
router.post('/optimization/rules', async (_req, res) => {
  res.json({ message: 'Rule added successfully', rule: { id: `rule-${Date.now()}` } });
});

/**
 * DELETE /api/client/optimization/rules/:id
 * Delete a routing/optimization rule.
 */
router.delete('/optimization/rules/:id', async (_req, res) => {
  res.json({ message: 'Rule deleted' });
});

// ============================================
// API KEYS ENDPOINT (for Settings page)
// ============================================

/**
 * GET /api/client/api-keys
 * Returns the client's API key info for the Settings/API Keys page.
 */
router.get('/api-keys', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Return the client's SDK API key as a UserApiKey-compatible object
    const sdkKey = client.sdkApiKey || '';
    const maskedKey = sdkKey.length > 8
      ? sdkKey.slice(0, 4) + '•'.repeat(sdkKey.length - 8) + sdkKey.slice(-4)
      : '•'.repeat(24);

    const keys = [{
      id: `key-${client.id}`,
      provider: 'aethermind' as const,
      name: 'Aethermind SDK Key',
      maskedKey,
      isValid: true,
      lastValidated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }];

    res.json({ keys });
  } catch (error) {
    console.error('[Client API Keys] Error:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

/**
 * POST /api/client/optimization/estimate
 * Estimate cost for a model/token combination.
 */
router.post('/optimization/estimate', async (req, res) => {
  const { model, inputTokens, outputTokens } = req.body;
  const pricingMap: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  };
  const p = pricingMap[model] || { input: 0.001, output: 0.002 };
  const inputCost = (inputTokens / 1000) * p.input;
  const outputCost = (outputTokens / 1000) * p.output;

  res.json({
    model,
    inputTokens,
    outputTokens,
    estimatedCost: inputCost + outputCost,
    breakdown: { inputCost, outputCost },
    currency: 'USD',
  });
});

/**
 * POST /api/client/optimization/alternatives
 * Find cheaper model alternatives.
 */
router.post('/optimization/alternatives', async (req, res) => {
  const { model } = req.body;
  res.json({
    currentModel: model,
    alternatives: [
      {
        model: 'gpt-4o-mini',
        provider: 'openai',
        estimatedCost: 0.0006,
        savingsPercent: 90,
        capabilities: ['general', 'coding'],
        tradeoffs: 'Reduced capability for complex tasks',
      },
    ],
  });
});

// ============================================
// POST /api/client/agents — Create agent
// ============================================
router.post('/agents', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const { name, model, systemPrompt, maxTokens, temperature } = req.body;

    if (!name || !model) {
      res.status(400).json({ error: 'name and model are required' });
      return;
    }

    // Find a user in the organization to associate the agent with
    const orgUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.organizationId, client.organizationId))
      .limit(1);

    if (orgUsers.length === 0) {
      res.status(400).json({ error: 'No users found in the organization' });
      return;
    }

    const crypto = await import('crypto');
    const id = crypto.randomUUID();

    await db.insert(agents).values({
      id,
      userId: orgUsers[0]!.id,
      name,
      model,
      config: {
        systemPrompt: systemPrompt || '',
        maxTokens: maxTokens || 4096,
        temperature: temperature ?? 0.7,
      },
    });

    res.status(201).json({
      id,
      name,
      model,
      config: {
        systemPrompt: systemPrompt || '',
        maxTokens: maxTokens || 4096,
        temperature: temperature ?? 0.7,
      },
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Client Create Agent] Error:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});


// ============================================
// ALERTS/RULES ENDPOINTS (client-auth)
// ============================================

/**
 * GET /api/client/alerts/rules
 * Returns alert rules for the client from the alert_rules table.
 */
router.get('/alerts/rules', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const rows = await db
      .select()
      .from(alertRules)
      .where(eq(alertRules.organizationId, client.organizationId))
      .orderBy(desc(alertRules.createdAt));

    // Transform DB rows to BackendActionRule shape expected by dashboard hook
    const rules = rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      enabled: row.enabled,
      priority: row.priority,
      budgetId: row.budgetId || undefined,
      trigger: row.trigger,
      conditions: (row.conditions as any[]) || [],
      actions: (row.actions as any[]) || [],
      cooldownMinutes: row.cooldownMinutes,
      maxExecutionsPerDay: row.maxExecutionsPerDay,
      createdAt: row.createdAt.toISOString(),
      lastExecutedAt: row.lastExecutedAt?.toISOString() || null,
      executionCount: row.executionCount,
    }));

    res.json({ rules });
  } catch (error) {
    console.error('[Client Alert Rules GET] Error:', error);
    res.status(500).json({ error: 'Failed to fetch alert rules' });
  }
});

/**
 * POST /api/client/alerts/rules
 * Create a new alert rule — persisted in alert_rules table.
 */
router.post('/alerts/rules', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.id || !client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const { name, description, trigger, conditions, actions, cooldownMinutes, budgetId, priority, maxExecutionsPerDay, enabled } = req.body;

    const rows = await db
      .insert(alertRules)
      .values({
        clientId: client.id,
        organizationId: client.organizationId,
        name: name || 'New Alert',
        description: description || null,
        enabled: enabled !== false,
        priority: priority ?? 0,
        budgetId: budgetId || null,
        trigger: trigger || 'threshold_exceeded',
        conditions: conditions || [],
        actions: actions || [],
        cooldownMinutes: cooldownMinutes ?? 60,
        maxExecutionsPerDay: maxExecutionsPerDay ?? 10,
      })
      .returning();

    const inserted = rows[0]!;

    // Return BackendActionRule shape
    const rule = {
      id: inserted.id,
      name: inserted.name,
      description: inserted.description || '',
      enabled: inserted.enabled,
      priority: inserted.priority,
      budgetId: inserted.budgetId || undefined,
      trigger: inserted.trigger,
      conditions: (inserted.conditions as any[]) || [],
      actions: (inserted.actions as any[]) || [],
      cooldownMinutes: inserted.cooldownMinutes,
      maxExecutionsPerDay: inserted.maxExecutionsPerDay,
      createdAt: inserted.createdAt.toISOString(),
      lastExecutedAt: null,
      executionCount: 0,
    };

    res.status(201).json(rule);
  } catch (error) {
    console.error('[Client Alert Rules POST] Error:', error);
    res.status(500).json({ error: 'Failed to create alert rule' });
  }
});

/**
 * PATCH /api/client/alerts/rules/:id
 * Update alert rule (toggle, edit). Validates ownership by organizationId.
 */
router.patch('/alerts/rules/:id', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;
    const { id } = req.params;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    // Verify the rule belongs to this organization
    const [existing] = await db
      .select()
      .from(alertRules)
      .where(and(eq(alertRules.id, id), eq(alertRules.organizationId, client.organizationId)));

    if (!existing) {
      res.status(404).json({ error: 'Alert rule not found' });
      return;
    }

    const { name, description, enabled, priority, conditions, actions, cooldownMinutes, trigger, budgetId } = req.body;

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (priority !== undefined) updateData.priority = priority;
    if (conditions !== undefined) updateData.conditions = conditions;
    if (actions !== undefined) updateData.actions = actions;
    if (cooldownMinutes !== undefined) updateData.cooldownMinutes = cooldownMinutes;
    if (trigger !== undefined) updateData.trigger = trigger;
    if (budgetId !== undefined) updateData.budgetId = budgetId || null;

    const updatedRows = await db
      .update(alertRules)
      .set(updateData)
      .where(eq(alertRules.id, id))
      .returning();

    const updated = updatedRows[0]!;

    res.json({
      id: updated.id,
      name: updated.name,
      description: updated.description || '',
      enabled: updated.enabled,
      priority: updated.priority,
      budgetId: updated.budgetId || undefined,
      trigger: updated.trigger,
      conditions: (updated.conditions as any[]) || [],
      actions: (updated.actions as any[]) || [],
      cooldownMinutes: updated.cooldownMinutes,
      maxExecutionsPerDay: updated.maxExecutionsPerDay,
      createdAt: updated.createdAt.toISOString(),
      lastExecutedAt: updated.lastExecutedAt?.toISOString() || null,
      executionCount: updated.executionCount,
    });
  } catch (error) {
    console.error('[Client Alert Rules PATCH] Error:', error);
    res.status(500).json({ error: 'Failed to update alert rule' });
  }
});

/**
 * DELETE /api/client/alerts/rules/:id
 * Delete an alert rule. Validates ownership by organizationId.
 */
router.delete('/alerts/rules/:id', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;
    const { id } = req.params;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    // Verify ownership and delete
    const deleted = await db
      .delete(alertRules)
      .where(and(eq(alertRules.id, id), eq(alertRules.organizationId, client.organizationId)))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ error: 'Alert rule not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Client Alert Rules DELETE] Error:', error);
    res.status(500).json({ error: 'Failed to delete alert rule' });
  }
});

// ============================================
// ORGANIZATION ENDPOINTS (client-auth)
// ============================================

/**
 * GET /api/client/organizations/current
 * Returns organization info for the authenticated client.
 */
router.get('/organizations/current', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.status(401).json({ error: 'Not authenticated or no linked organization' });
      return;
    }

    const [org] = await db.select().from(organizations).where(eq(organizations.id, client.organizationId));

    if (!org) {
      res.json({
        id: client.organizationId,
        name: client.companyName || 'My Organization',
        slug: client.organizationId,
        plan: 'free' as const,
        createdAt: new Date().toISOString(),
        memberCount: 1,
        agentCount: 0,
        currentSpend: 0,
      });
      return;
    }

    // Count members
    const [memberResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.organizationId, org.id));

    // Count agents
    const [agentResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(agents)
      .innerJoin(users, eq(agents.userId, users.id))
      .where(and(eq(users.organizationId, org.id), isNull(agents.deletedAt)));

    // Current month spend
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [spendResult] = await db.select({
      totalCost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
    }).from(telemetryEvents).where(
      and(
        eq(telemetryEvents.organizationId, org.id),
        gte(telemetryEvents.timestamp, monthStart),
      ),
    );

    res.json({
      id: org.id,
      name: org.name,
      slug: org.id,
      plan: (org.plan?.toLowerCase() || 'free') as 'free' | 'pro' | 'enterprise',
      createdAt: org.createdAt?.toISOString() ?? new Date().toISOString(),
      memberCount: memberResult?.count || 1,
      agentCount: agentResult?.count || 0,
      currentSpend: parseFloat(spendResult?.totalCost ?? '0'),
    });
  } catch (error) {
    console.error('[Client Organizations Current] Error:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

/**
 * GET /api/client/organizations
 * Returns organizations list for the authenticated client.
 */
router.get('/organizations', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.organizationId) {
      res.json([]);
      return;
    }

    const [org] = await db.select().from(organizations).where(eq(organizations.id, client.organizationId));
    if (!org) {
      res.json([]);
      return;
    }

    res.json([{
      id: org.id,
      name: org.name,
      slug: org.id,
      plan: (org.plan?.toLowerCase() || 'free') as 'free' | 'pro' | 'enterprise',
      createdAt: org.createdAt?.toISOString() ?? new Date().toISOString(),
      memberCount: 1,
      agentCount: 0,
      currentSpend: 0,
    }]);
  } catch (error) {
    console.error('[Client Organizations] Error:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

/**
 * GET /api/client/organizations/:id/members
 * Returns members for an organization.
 */
router.get('/organizations/:id/members', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;
    const orgId = req.params.id;

    if (!client?.organizationId || client.organizationId !== orgId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const rows = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.organizationId, orgId));

    const members = rows.map(u => ({
      id: u.id,
      userId: u.id,
      name: u.name || u.email?.split('@')[0] || 'Unknown',
      email: u.email || '',
      role: 'member' as const,
      joinedAt: u.createdAt?.toISOString() ?? new Date().toISOString(),
    }));

    res.json(members);
  } catch (error) {
    console.error('[Client Organization Members] Error:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

/**
 * GET /api/client/organizations/:id/invitations
 * Returns pending invitations for an organization.
 */
router.get('/organizations/:id/invitations', async (_req, res) => {
  // No invitations table yet — return empty array
  res.json([]);
});

// ============================================
// ALERT TRIGGERS ENDPOINT
// ============================================

/**
 * GET /api/client/alerts/rules/:id/triggers
 * Returns trigger history for an alert rule.
 */
router.get('/alerts/rules/:id/triggers', async (_req, res) => {
  // No triggers history table yet — return empty array
  res.json([]);
});

// ============================================
// TOKEN ROTATION & INVALIDATION
// ============================================

/**
 * POST /api/client/token/rotate
 * Generates a new access token (ct_*) and invalidates the old one.
 * Returns the new token — the client must store it immediately.
 */
router.post('/token/rotate', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const crypto = await import('crypto');
    const bcryptMod = await import('bcryptjs');
    const newToken = `ct_${crypto.randomBytes(32).toString('hex')}`;
    const newTokenHash = await bcryptMod.default.hash(newToken, 10);
    const newTokenPrefix = newToken.slice(0, 16);
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Invalidate old token from cache before updating DB
    const oldToken = req.headers['x-client-token'] as string;
    if (oldToken) invalidateClientCache(oldToken);

    await db.update(clients)
      .set({
        accessToken: newToken,
        accessTokenHash: newTokenHash,
        accessTokenPrefix: newTokenPrefix,
        tokenExpiresAt: newExpiresAt,
      })
      .where(eq(clients.id, client.id));

    res.json({
      accessToken: newToken,
      expiresAt: newExpiresAt.toISOString(),
      message: 'Token rotated successfully. Store the new token immediately.',
    });
  } catch (error) {
    console.error('[Token Rotate] Error:', error);
    res.status(500).json({ error: 'Failed to rotate token' });
  }
});

/**
 * POST /api/client/logout
 * Invalidates the current access token server-side.
 * The token becomes unusable immediately.
 */
router.post('/logout', async (req, res) => {
  try {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;

    if (!client?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Invalidate token from cache immediately
    const token = req.headers['x-client-token'] as string;
    if (token) invalidateClientCache(token);

    // Set token expiry to now — effectively invalidates it in DB
    await db.update(clients)
      .set({ tokenExpiresAt: new Date() })
      .where(eq(clients.id, client.id));

    res.json({ success: true, message: 'Logged out. Token invalidated.' });
  } catch (error) {
    console.error('[Client Logout] Error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// ═══════════════════════════════════════════════════════════
// AGENT TRACING ANALYTICS
// ═══════════════════════════════════════════════════════════

// GET /api/client/analytics/agents/overview
router.get('/analytics/agents/overview', async (req, res) => {
  const client = (req as any).client;
  try {
    const rows = await db
      .select({
        agentId: agentTraces.agentId,
        agentName: agentTraces.agentName,
        totalRequests: sql<number>`count(*)::int`,
        totalCost: sql<number>`sum(${agentTraces.costUsd})::float`,
        avgLatency: sql<number>`avg(${agentTraces.latencyMs})::int`,
        errorCount: sql<number>`sum(case when ${agentTraces.status} = 'error' then 1 else 0 end)::int`,
        lastActive: sql<string>`max(${agentTraces.createdAt})`,
      })
      .from(agentTraces)
      .where(eq(agentTraces.organizationId, client.organizationId))
      .groupBy(agentTraces.agentId, agentTraces.agentName);

    const totalCost = rows.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    const totalRequests = rows.reduce((sum, r) => sum + r.totalRequests, 0);

    return res.json({
      totalAgents: rows.length,
      totalRequests,
      totalCost,
      agents: rows.map(r => ({
        ...r,
        errorRate: r.totalRequests > 0 ? r.errorCount / r.totalRequests : 0,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/client/analytics/agents/traces
router.get('/analytics/agents/traces', async (req, res) => {
  const client = (req as any).client;
  const limit = parseInt(req.query.limit as string || '50', 10);
  try {
    const rows = await db
      .select()
      .from(agentTraces)
      .where(eq(agentTraces.organizationId, client.organizationId))
      .orderBy(desc(agentTraces.createdAt))
      .limit(limit);

    // Group by traceId
    const grouped = rows.reduce((acc: any, row) => {
      if (!acc[row.traceId]) {
        acc[row.traceId] = { traceId: row.traceId, workflowId: row.workflowId, agents: [], totalCost: 0, startedAt: row.startedAt };
      }
      acc[row.traceId].agents.push(row);
      acc[row.traceId].totalCost += parseFloat(String(row.costUsd));
      return acc;
    }, {});

    return res.json({ traces: Object.values(grouped) });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/client/analytics/agents/:agentId/stats
router.get('/analytics/agents/:agentId/stats', async (req, res) => {
  const client = (req as any).client;
  const { agentId } = req.params;
  try {
    const rows = await db
      .select()
      .from(agentTraces)
      .where(and(
        eq(agentTraces.organizationId, client.organizationId),
        eq(agentTraces.agentId, agentId),
      ));

    if (!rows.length) return res.status(404).json({ error: 'Agent not found' });

    const totalCost = rows.reduce((s, r) => s + parseFloat(String(r.costUsd)), 0);
    const avgLatency = Math.round(rows.reduce((s, r) => s + (r.latencyMs || 0), 0) / rows.length);
    const errors = rows.filter(r => r.status === 'error').length;

    return res.json({
      agentId,
      agentName: rows[0]?.agentName,
      totalRequests: rows.length,
      totalCost,
      avgLatency,
      errorRate: errors / rows.length,
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/client/analytics/workflows/:workflowId
router.get('/analytics/workflows/:workflowId', async (req, res) => {
  const client = (req as any).client;
  const { workflowId } = req.params;
  try {
    const rows = await db
      .select()
      .from(agentTraces)
      .where(and(
        eq(agentTraces.organizationId, client.organizationId),
        eq(agentTraces.workflowId, workflowId),
      ))
      .orderBy(agentTraces.workflowStep, agentTraces.startedAt);

    const totalCost = rows.reduce((s, r) => s + parseFloat(String(r.costUsd)), 0);

    return res.json({
      workflowId,
      totalSteps: rows.length,
      totalCost,
      agents: rows,
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
