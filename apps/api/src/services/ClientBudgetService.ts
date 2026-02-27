import { db } from '../db/index.js';
import { clientBudgets, telemetryEvents, clients } from '../db/schema.js';
import { eq, and, gte, sql } from 'drizzle-orm';

export interface BudgetEvaluation {
  status: 'ok' | 'warning' | 'exceeded';
  percentUsed: number;
  remaining: number;
  spentUsd: number;
  limitUsd: number;
  budgetId: string;
  budgetType: string;
}

/**
 * Get the start of the current budget period
 */
function getPeriodStart(type: string): Date {
  const now = new Date();
  if (type === 'daily') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  // monthly
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Calculate current spend for an organization in a given period
 */
async function calculateSpend(organizationId: string, since: Date): Promise<number> {
  const result = await db
    .select({
      totalCost: sql<string>`coalesce(sum(${telemetryEvents.cost}::numeric), 0)`,
    })
    .from(telemetryEvents)
    .where(
      and(
        eq(telemetryEvents.organizationId, organizationId),
        gte(telemetryEvents.timestamp, since),
      ),
    );

  return parseFloat(result[0]?.totalCost ?? '0');
}

/**
 * Evaluate budget status for a client.
 * Compares current telemetry spend against defined budget limits.
 */
export async function evaluateBudget(clientId: string): Promise<BudgetEvaluation | null> {
  // Get the client to find organizationId
  const clientRows = await db
    .select({ organizationId: clients.organizationId })
    .from(clients)
    .where(eq(clients.id, clientId));

  const client = clientRows[0];
  if (!client?.organizationId) return null;

  // Get active budgets for this client (monthly takes priority, then daily)
  const budgetRows = await db
    .select()
    .from(clientBudgets)
    .where(eq(clientBudgets.clientId, clientId))
    .orderBy(sql`case when ${clientBudgets.type} = 'monthly' then 0 else 1 end`);

  const budget = budgetRows[0];
  if (!budget) return null;

  const periodStart = getPeriodStart(budget.type);
  const spentUsd = await calculateSpend(client.organizationId, periodStart);
  const limitUsd = parseFloat(budget.limitUsd);
  const percentUsed = limitUsd > 0 ? (spentUsd / limitUsd) * 100 : 0;
  const remaining = Math.max(0, limitUsd - spentUsd);

  // Determine status based on alert thresholds
  const thresholds = (budget.alertThresholds as number[]) || [80, 90, 100];

  let status: 'ok' | 'warning' | 'exceeded' = 'ok';
  if (percentUsed >= 100) {
    status = 'exceeded';
  } else if (percentUsed >= Math.min(...thresholds)) {
    status = 'warning';
  }

  return {
    status,
    percentUsed: Math.round(percentUsed * 100) / 100,
    remaining: Math.round(remaining * 100) / 100,
    spentUsd: Math.round(spentUsd * 100) / 100,
    limitUsd,
    budgetId: budget.id,
    budgetType: budget.type,
  };
}

/**
 * Evaluate budget by organizationId (used by SDK endpoint).
 * Finds the client by organizationId and evaluates their budget.
 */
export async function evaluateBudgetByOrg(organizationId: string): Promise<BudgetEvaluation | null> {
  // Find the client for this organization
  const clientRows = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.organizationId, organizationId), eq(clients.isActive, true)));

  const client = clientRows[0];
  if (!client) return null;

  return evaluateBudget(client.id);
}

/**
 * Evaluate ALL budgets for a given client (used by alert cron).
 * Returns evaluations for each budget.
 */
export async function evaluateAllBudgets(clientId: string): Promise<BudgetEvaluation[]> {
  const clientRows = await db
    .select({ organizationId: clients.organizationId })
    .from(clients)
    .where(eq(clients.id, clientId));

  const client = clientRows[0];
  if (!client?.organizationId) return [];

  const budgetRows = await db
    .select()
    .from(clientBudgets)
    .where(eq(clientBudgets.clientId, clientId));

  const results: BudgetEvaluation[] = [];

  for (const budget of budgetRows) {
    const periodStart = getPeriodStart(budget.type);
    const spentUsd = await calculateSpend(client.organizationId, periodStart);
    const limitUsd = parseFloat(budget.limitUsd);
    const percentUsed = limitUsd > 0 ? (spentUsd / limitUsd) * 100 : 0;
    const remaining = Math.max(0, limitUsd - spentUsd);

    let status: 'ok' | 'warning' | 'exceeded' = 'ok';
    if (percentUsed >= 100) {
      status = 'exceeded';
    } else if (percentUsed >= Math.min(...((budget.alertThresholds as number[]) || [80]))) {
      status = 'warning';
    }

    results.push({
      status,
      percentUsed: Math.round(percentUsed * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      spentUsd: Math.round(spentUsd * 100) / 100,
      limitUsd,
      budgetId: budget.id,
      budgetType: budget.type,
    });
  }

  return results;
}
