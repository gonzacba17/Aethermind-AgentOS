import { db, pool } from '../db';
import { budgets } from '../db/schema';
import type { Budget } from '../db/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import logger from '../utils/logger';

export class BudgetService {
  /**
   * Get the active budget for a given scope
   */
  async getActiveBudget(
    userId: string,
    scope: string,
    scopeId?: string
  ): Promise<Budget | null> {
    const [budget] = await db.select()
      .from(budgets)
      .where(and(
        eq(budgets.userId, userId),
        eq(budgets.scope, scope),
        scopeId ? eq(budgets.scopeId, scopeId) : sql`${budgets.scopeId} IS NULL`,
        eq(budgets.status, 'active')
      ))
      .orderBy(sql`${budgets.createdAt} DESC`)
      .limit(1);
    
    return budget || null;
  }

  /**
   * Validate if a budget allows the estimated cost
   */
  async validateBudget(
    userId: string,
    scope: string,
    scopeId: string | undefined,
    estimatedCost: number
  ): Promise<{ allowed: boolean; budget?: Budget }> {
    const budget = await this.getActiveBudget(userId, scope, scopeId);
    
    if (!budget) {
      // No budget configured, allow execution
      return { allowed: true };
    }

    const projectedSpend = Number(budget.currentSpend) + estimatedCost;
    const allowed = !budget.hardLimit || projectedSpend <= Number(budget.limitAmount);

    return { allowed, budget };
  }

  /**
   * Increment the current spend for a budget using atomic SQL increment
   * Uses a transaction with row lock to prevent race conditions
   */
  async incrementSpend(budgetId: string, amount: number): Promise<void> {
    // Use raw SQL with atomic increment to prevent race condition
    // This is the ONLY safe way to do concurrent updates
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Use SELECT FOR UPDATE to lock the row during the transaction
      const lockResult = await client.query(
        'SELECT id FROM budgets WHERE id = $1 FOR UPDATE',
        [budgetId]
      );

      if (lockResult.rows.length === 0) {
        await client.query('ROLLBACK');
        logger.warn('Budget not found for increment', { budgetId });
        return;
      }

      // Atomic increment using SQL - no JavaScript calculation
      await client.query(
        `UPDATE budgets
         SET current_spend = current_spend + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [amount.toString(), budgetId]
      );

      await client.query('COMMIT');
      logger.debug('Budget spend incremented', { budgetId, amount });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to increment budget spend', {
        budgetId,
        amount,
        error: (error as Error).message,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Increment spend and check if budget exceeded (atomic operation)
   * Returns the new spend amount and whether limit was exceeded
   */
  async incrementSpendAndCheck(
    budgetId: string,
    amount: number
  ): Promise<{ newSpend: number; exceeded: boolean; limitAmount: number }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock and update in one atomic operation
      const result = await client.query(
        `UPDATE budgets
         SET current_spend = current_spend + $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING current_spend, limit_amount, hard_limit`,
        [amount.toString(), budgetId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error(`Budget ${budgetId} not found`);
      }

      const row = result.rows[0];
      const newSpend = parseFloat(row.current_spend);
      const limitAmount = parseFloat(row.limit_amount);
      const exceeded = row.hard_limit && newSpend > limitAmount;

      await client.query('COMMIT');

      return { newSpend, exceeded, limitAmount };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reset periodic budgets (daily, weekly, monthly)
   * Should be called by a cron job
   */
  async resetPeriodic(): Promise<void> {
    const now = new Date();
    
    // Reset daily budgets (every day at midnight)
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    
    await db.update(budgets)
      .set({
        currentSpend: '0',
        alert80Sent: false,
        alert100Sent: false,
      })
      .where(and(
        eq(budgets.period, 'daily'),
        lt(budgets.updatedAt, startOfDay)
      ));

    // Reset weekly budgets (every Monday)
    if (now.getDay() === 1) {
      await db.update(budgets)
        .set({
          currentSpend: '0',
          alert80Sent: false,
          alert100Sent: false,
        })
        .where(eq(budgets.period, 'weekly'));
    }

    // Reset monthly budgets (1st of month)
    if (now.getDate() === 1) {
      await db.update(budgets)
        .set({
          currentSpend: '0',
          alert80Sent: false,
          alert100Sent: false,
        })
        .where(eq(budgets.period, 'monthly'));
    }
  }

  /**
   * Create a new budget
   */
  async createBudget(data: {
    userId: string;
    name: string;
    limitAmount: number;
    period: string;
    scope: string;
    scopeId?: string;
    hardLimit?: boolean;
    alertAt?: number;
  }): Promise<Budget> {
    const [budget] = await db.insert(budgets)
      .values({
        userId: data.userId,
        name: data.name,
        limitAmount: data.limitAmount.toString(),
        period: data.period,
        scope: data.scope,
        scopeId: data.scopeId || null,
        hardLimit: data.hardLimit ?? true,
        alertAt: data.alertAt ?? 80,
        status: 'active',
      })
      .returning();
    
    return budget!;
  }

  /**
   * Get all budgets for a user
   */
  async getUserBudgets(userId: string): Promise<Budget[]> {
    return db.select()
      .from(budgets)
      .where(eq(budgets.userId, userId))
      .orderBy(sql`${budgets.createdAt} DESC`);
  }

  /**
   * Update a budget
   */
  async updateBudget(
    budgetId: string,
    userId: string,
    data: Partial<Budget>
  ): Promise<void> {
    await db.update(budgets)
      .set(data)
      .where(and(
        eq(budgets.id, budgetId),
        eq(budgets.userId, userId)
      ));
  }

  /**
   * Delete a budget
   */
  async deleteBudget(budgetId: string, userId: string): Promise<void> {
    await db.delete(budgets)
      .where(and(
        eq(budgets.id, budgetId),
        eq(budgets.userId, userId)
      ));
  }
}

export function createBudgetService(): BudgetService {
  return new BudgetService();
}
