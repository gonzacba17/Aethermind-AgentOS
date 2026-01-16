import { db } from '../db';
import { budgets } from '../db/schema';
import type { Budget } from '../db/schema';
import { eq, and, lt, sql } from 'drizzle-orm';

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
   * Increment the current spend for a budget
   */
  async incrementSpend(budgetId: string, amount: number): Promise<void> {
    // Drizzle doesn't have increment, so we need to fetch and update
    const [budget] = await db.select({ currentSpend: budgets.currentSpend })
      .from(budgets)
      .where(eq(budgets.id, budgetId))
      .limit(1);
    
    if (budget) {
      const newSpend = Number(budget.currentSpend) + amount;
      await db.update(budgets)
        .set({ currentSpend: newSpend.toString() })
        .where(eq(budgets.id, budgetId));
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
