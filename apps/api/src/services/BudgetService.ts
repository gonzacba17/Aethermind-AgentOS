import { PrismaClient } from '@prisma/client';
import type { Budget } from '@prisma/client';

export class BudgetService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get the active budget for a given scope
   */
  async getActiveBudget(
    userId: string,
    scope: string,
    scopeId?: string
  ): Promise<Budget | null> {
    return this.prisma.budget.findFirst({
      where: {
        userId,
        scope,
        scopeId: scopeId || null,
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
    });
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
    await this.prisma.budget.update({
      where: { id: budgetId },
      data: {
        currentSpend: {
          increment: amount,
        },
      },
    });
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
    
    await this.prisma.budget.updateMany({
      where: {
        period: 'daily',
        updatedAt: {
          lt: startOfDay,
        },
      },
      data: {
        currentSpend: 0,
        alert80Sent: false,
        alert100Sent: false,
      },
    });

    // Reset weekly budgets (every Monday)
    if (now.getDay() === 1) {
      await this.prisma.budget.updateMany({
        where: { period: 'weekly' },
        data: {
          currentSpend: 0,
          alert80Sent: false,
          alert100Sent: false,
        },
      });
    }

    // Reset monthly budgets (1st of month)
    if (now.getDate() === 1) {
      await this.prisma.budget.updateMany({
        where: { period: 'monthly' },
        data: {
          currentSpend: 0,
          alert80Sent: false,
          alert100Sent: false,
        },
      });
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
    return this.prisma.budget.create({
      data: {
        userId: data.userId,
        name: data.name,
        limitAmount: data.limitAmount,
        period: data.period,
        scope: data.scope,
        scopeId: data.scopeId || null,
        hardLimit: data.hardLimit ?? true,
        alertAt: data.alertAt ?? 80,
        status: 'active',
      },
    });
  }

  /**
   * Get all budgets for a user
   */
  async getUserBudgets(userId: string): Promise<Budget[]> {
    return this.prisma.budget.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update a budget
   */
  async updateBudget(
    budgetId: string,
    userId: string,
    data: Partial<Budget>
  ): Promise<void> {
    await this.prisma.budget.updateMany({
      where: {
        id: budgetId,
        userId,
      },
      data,
    });
  }

  /**
   * Delete a budget
   */
  async deleteBudget(budgetId: string, userId: string): Promise<void> {
    await this.prisma.budget.deleteMany({
      where: {
        id: budgetId,
        userId,
      },
    });
  }
}

export function createBudgetService(prisma: PrismaClient): BudgetService {
  return new BudgetService(prisma);
}
