import { db } from '../db/index.js';
import { clientBudgets, alertEvents, clients, telemetryEvents } from '../db/schema.js';
import { eq, and, gte, sql } from 'drizzle-orm';

/**
 * Get the start of the current budget period.
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
 * Calculate current spend for an organization in a given period.
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
 * Send webhook notification to client.
 */
async function sendWebhook(
  webhookUrl: string,
  payload: {
    event: string;
    threshold: number;
    percentUsed: number;
    spentUsd: number;
    limitUsd: number;
    clientId: string;
  }
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[BudgetAlert] Webhook returned ${response.status} for ${webhookUrl}`);
      return false;
    }

    console.log(`[BudgetAlert] Webhook sent successfully to ${webhookUrl}`);
    return true;
  } catch (error) {
    console.error('[BudgetAlert] Webhook failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Evaluate all active budgets and trigger alerts.
 * Runs every 5 minutes via setInterval.
 *
 * - Checks each budget against its thresholds
 * - Creates alert_events for new threshold breaches
 * - Avoids duplicates: won't re-alert same threshold in same period
 * - Sends webhooks if client has a webhookUrl configured
 * - Logs email alerts (integration in future phase)
 */
export async function evaluateAndAlert(): Promise<void> {
  try {
    // Get all active budgets with client info
    const budgetRows = await db
      .select({
        budget: clientBudgets,
        clientId: clients.id,
        organizationId: clients.organizationId,
        webhookUrl: clients.webhookUrl,
        companyName: clients.companyName,
      })
      .from(clientBudgets)
      .innerJoin(clients, eq(clientBudgets.clientId, clients.id))
      .where(eq(clients.isActive, true));

    let alertsTriggered = 0;

    for (const row of budgetRows) {
      if (!row.organizationId) continue;

      const periodStart = getPeriodStart(row.budget.type);
      const spentUsd = await calculateSpend(row.organizationId, periodStart);
      const limitUsd = parseFloat(row.budget.limitUsd);
      if (limitUsd <= 0) continue;

      const percentUsed = (spentUsd / limitUsd) * 100;
      const thresholds = (row.budget.alertThresholds as number[]) || [80, 90, 100];

      for (const threshold of thresholds) {
        if (percentUsed < threshold) continue;

        // Check for existing alert for this threshold in this period
        const existingAlert = await db
          .select({ id: alertEvents.id })
          .from(alertEvents)
          .where(
            and(
              eq(alertEvents.budgetId, row.budget.id),
              eq(alertEvents.threshold, threshold),
              gte(alertEvents.triggeredAt, periodStart),
            ),
          )
          .limit(1);

        if (existingAlert.length > 0) {
          // Already alerted for this threshold in this period
          continue;
        }

        // Create alert event
        const insertedRows = await db
          .insert(alertEvents)
          .values({
            clientId: row.clientId,
            budgetId: row.budget.id,
            threshold,
          })
          .returning();

        const alertEvent = insertedRows[0];
        alertsTriggered++;

        // Send webhook if configured
        if (row.webhookUrl && alertEvent) {
          const success = await sendWebhook(row.webhookUrl, {
            event: 'budget.threshold_reached',
            threshold,
            percentUsed: Math.round(percentUsed * 100) / 100,
            spentUsd: Math.round(spentUsd * 100) / 100,
            limitUsd,
            clientId: row.clientId,
          });

          // Update notifiedAt if webhook succeeded
          if (success) {
            await db
              .update(alertEvents)
              .set({ notifiedAt: new Date() })
              .where(eq(alertEvents.id, alertEvent.id));
          }
        }

        // Email placeholder
        console.log(
          `[ALERT EMAIL] Client "${row.companyName}" (${row.clientId}): ` +
          `Budget ${row.budget.type} threshold ${threshold}% reached. ` +
          `Spent $${Math.round(spentUsd * 100) / 100} of $${limitUsd} (${Math.round(percentUsed * 10) / 10}%).`
        );
      }
    }

    if (alertsTriggered > 0) {
      console.log(`[BudgetAlert] Triggered ${alertsTriggered} new alert(s)`);
    }
  } catch (error) {
    console.error('[BudgetAlert] Cron evaluation failed:', error);
  }
}

let alertInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the budget alert cron job (every 5 minutes).
 */
export function startBudgetAlertCron(): void {
  if (alertInterval) {
    console.warn('[BudgetAlert] Cron already running');
    return;
  }

  const FIVE_MINUTES = 5 * 60 * 1000;
  alertInterval = setInterval(evaluateAndAlert, FIVE_MINUTES);

  // Run once immediately on startup
  evaluateAndAlert().catch((err) =>
    console.error('[BudgetAlert] Initial evaluation failed:', err)
  );

  console.log('[BudgetAlert] Cron started (every 5 minutes)');
}

/**
 * Stop the budget alert cron job.
 */
export function stopBudgetAlertCron(): void {
  if (alertInterval) {
    clearInterval(alertInterval);
    alertInterval = null;
    console.log('[BudgetAlert] Cron stopped');
  }
}
