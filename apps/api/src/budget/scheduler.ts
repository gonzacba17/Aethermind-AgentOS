/**
 * Budget Limit Scheduler
 *
 * Manages time-based budget adjustments, scheduled limit changes,
 * and periodic budget operations.
 */

import { z } from 'zod';
import { db, pool } from '../db/index.js';
import { budgets } from '../db/schema.js';
import { eq, and, sql, lte } from 'drizzle-orm';
import logger from '../utils/logger.js';

/**
 * Schedule types
 */
export type ScheduleType = 'once' | 'daily' | 'weekly' | 'monthly' | 'cron';

/**
 * Schedule action types
 */
export type ScheduleAction =
  | 'increase_limit'
  | 'decrease_limit'
  | 'set_limit'
  | 'reset_spend'
  | 'pause_budget'
  | 'resume_budget'
  | 'change_period'
  | 'send_report';

/**
 * Scheduled task
 */
export interface ScheduledTask {
  id: string;
  budgetId: string;
  name: string;
  enabled: boolean;
  scheduleType: ScheduleType;
  cronExpression?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour: number;
  minute: number;
  timezone: string;
  action: ScheduleAction;
  actionConfig: ScheduleActionConfig;
  lastRunAt?: Date;
  nextRunAt: Date;
  runCount: number;
  maxRuns?: number;
  failedRuns: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Action configuration
 */
export interface ScheduleActionConfig {
  // For limit changes
  amount?: number;
  percentage?: number;

  // For period changes
  newPeriod?: 'daily' | 'weekly' | 'monthly';

  // For reports
  reportRecipients?: string[];
  reportFormat?: 'email' | 'slack' | 'webhook';

  // General
  notifyOnComplete?: boolean;
  rollbackOnError?: boolean;
}

/**
 * Task execution result
 */
export interface TaskResult {
  taskId: string;
  success: boolean;
  action: ScheduleAction;
  message: string;
  previousValue?: any;
  newValue?: any;
  executedAt: Date;
  duration: number;
  error?: string;
}

/**
 * Scheduler configuration
 */
export interface BudgetSchedulerConfig {
  enabled: boolean;
  checkIntervalMs: number;
  maxConcurrentTasks: number;
  retryFailedTasks: boolean;
  maxRetries: number;
  retryDelayMs: number;
  defaultTimezone: string;
}

const DEFAULT_CONFIG: BudgetSchedulerConfig = {
  enabled: true,
  checkIntervalMs: 60000, // 1 minute
  maxConcurrentTasks: 5,
  retryFailedTasks: true,
  maxRetries: 3,
  retryDelayMs: 300000, // 5 minutes
  defaultTimezone: 'UTC',
};

/**
 * Budget Limit Scheduler Class
 */
export class BudgetScheduler {
  private config: BudgetSchedulerConfig;
  private tasks: Map<string, ScheduledTask> = new Map();
  private runningTasks: Set<string> = new Set();
  private checkInterval?: NodeJS.Timeout;
  private taskCounter = 0;
  private results: TaskResult[] = [];

  constructor(config: Partial<BudgetSchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (!this.config.enabled) {
      logger.info('Budget scheduler is disabled');
      return;
    }

    if (this.checkInterval) {
      logger.warn('Scheduler already running');
      return;
    }

    this.checkInterval = setInterval(() => this.processTasks(), this.config.checkIntervalMs);
    logger.info('Budget scheduler started', { checkIntervalMs: this.config.checkIntervalMs });

    // Run initial check
    this.processTasks();
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    logger.info('Budget scheduler stopped');
  }

  /**
   * Schedule a new task
   */
  scheduleTask(
    budgetId: string,
    name: string,
    scheduleType: ScheduleType,
    action: ScheduleAction,
    actionConfig: ScheduleActionConfig,
    timing: {
      hour?: number;
      minute?: number;
      dayOfWeek?: number;
      dayOfMonth?: number;
      cronExpression?: string;
      timezone?: string;
    } = {}
  ): ScheduledTask {
    const task: ScheduledTask = {
      id: `task-${++this.taskCounter}-${Date.now()}`,
      budgetId,
      name,
      enabled: true,
      scheduleType,
      cronExpression: timing.cronExpression,
      dayOfWeek: timing.dayOfWeek,
      dayOfMonth: timing.dayOfMonth,
      hour: timing.hour ?? 0,
      minute: timing.minute ?? 0,
      timezone: timing.timezone || this.config.defaultTimezone,
      action,
      actionConfig,
      nextRunAt: this.calculateNextRun({
        scheduleType,
        ...timing,
        timezone: timing.timezone || this.config.defaultTimezone,
      }),
      runCount: 0,
      failedRuns: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.tasks.set(task.id, task);
    logger.info('Task scheduled', { taskId: task.id, action, scheduleType });

    return task;
  }

  /**
   * Update task schedule
   */
  updateTask(taskId: string, updates: Partial<ScheduledTask>): ScheduledTask | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const updatedTask = { ...task, ...updates, updatedAt: new Date() };

    // Recalculate next run if schedule changed
    if (updates.scheduleType || updates.hour !== undefined || updates.minute !== undefined) {
      updatedTask.nextRunAt = this.calculateNextRun(updatedTask);
    }

    this.tasks.set(taskId, updatedTask);
    return updatedTask;
  }

  /**
   * Delete task
   */
  deleteTask(taskId: string): boolean {
    return this.tasks.delete(taskId);
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): ScheduledTask | null {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Get all tasks for a budget
   */
  getBudgetTasks(budgetId: string): ScheduledTask[] {
    return Array.from(this.tasks.values()).filter(t => t.budgetId === budgetId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get pending tasks
   */
  getPendingTasks(): ScheduledTask[] {
    const now = new Date();
    return Array.from(this.tasks.values())
      .filter(t => t.enabled && t.nextRunAt <= now && !this.runningTasks.has(t.id))
      .sort((a, b) => a.nextRunAt.getTime() - b.nextRunAt.getTime());
  }

  /**
   * Process due tasks
   */
  private async processTasks(): Promise<void> {
    if (!this.config.enabled) return;

    const pendingTasks = this.getPendingTasks();
    const tasksToRun = pendingTasks.slice(0, this.config.maxConcurrentTasks - this.runningTasks.size);

    for (const task of tasksToRun) {
      // Don't await - run concurrently
      this.executeTask(task).catch(error => {
        logger.error('Task execution error', { taskId: task.id, error: (error as Error).message });
      });
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: ScheduledTask): Promise<TaskResult> {
    const startTime = Date.now();
    this.runningTasks.add(task.id);

    try {
      logger.info('Executing scheduled task', { taskId: task.id, action: task.action });

      const result = await this.performAction(task);

      // Update task state
      task.lastRunAt = new Date();
      task.runCount++;
      task.nextRunAt = this.calculateNextRun(task);
      task.updatedAt = new Date();

      // Check max runs
      if (task.maxRuns && task.runCount >= task.maxRuns) {
        task.enabled = false;
        logger.info('Task disabled - max runs reached', { taskId: task.id });
      }

      this.tasks.set(task.id, task);
      this.results.push(result);

      return result;

    } catch (error) {
      const errorMessage = (error as Error).message;

      task.failedRuns++;
      task.updatedAt = new Date();

      // Handle retry
      if (this.config.retryFailedTasks && task.failedRuns < this.config.maxRetries) {
        task.nextRunAt = new Date(Date.now() + this.config.retryDelayMs);
      } else if (task.failedRuns >= this.config.maxRetries) {
        task.enabled = false;
        logger.warn('Task disabled - max retries exceeded', { taskId: task.id });
      } else {
        task.nextRunAt = this.calculateNextRun(task);
      }

      this.tasks.set(task.id, task);

      const result: TaskResult = {
        taskId: task.id,
        success: false,
        action: task.action,
        message: `Task failed: ${errorMessage}`,
        executedAt: new Date(),
        duration: Date.now() - startTime,
        error: errorMessage,
      };

      this.results.push(result);
      return result;

    } finally {
      this.runningTasks.delete(task.id);
    }
  }

  /**
   * Perform the scheduled action
   */
  private async performAction(task: ScheduledTask): Promise<TaskResult> {
    const startTime = Date.now();
    let previousValue: any;
    let newValue: any;

    // Fetch current budget state
    const [budget] = await db.select()
      .from(budgets)
      .where(eq(budgets.id, task.budgetId))
      .limit(1);

    if (!budget) {
      throw new Error(`Budget ${task.budgetId} not found`);
    }

    switch (task.action) {
      case 'increase_limit':
        previousValue = Number(budget.limitAmount);
        newValue = task.actionConfig.percentage
          ? previousValue * (1 + task.actionConfig.percentage / 100)
          : previousValue + (task.actionConfig.amount || 0);

        await db.update(budgets)
          .set({ limitAmount: newValue.toString(), updatedAt: new Date() })
          .where(eq(budgets.id, task.budgetId));
        break;

      case 'decrease_limit':
        previousValue = Number(budget.limitAmount);
        newValue = task.actionConfig.percentage
          ? previousValue * (1 - task.actionConfig.percentage / 100)
          : previousValue - (task.actionConfig.amount || 0);
        newValue = Math.max(0, newValue);

        await db.update(budgets)
          .set({ limitAmount: newValue.toString(), updatedAt: new Date() })
          .where(eq(budgets.id, task.budgetId));
        break;

      case 'set_limit':
        previousValue = Number(budget.limitAmount);
        newValue = task.actionConfig.amount || previousValue;

        await db.update(budgets)
          .set({ limitAmount: newValue.toString(), updatedAt: new Date() })
          .where(eq(budgets.id, task.budgetId));
        break;

      case 'reset_spend':
        previousValue = Number(budget.currentSpend);
        newValue = 0;

        await db.update(budgets)
          .set({
            currentSpend: '0',
            alert80Sent: false,
            alert100Sent: false,
            updatedAt: new Date(),
          })
          .where(eq(budgets.id, task.budgetId));
        break;

      case 'pause_budget':
        previousValue = budget.status;
        newValue = 'paused';

        await db.update(budgets)
          .set({ status: 'paused', updatedAt: new Date() })
          .where(eq(budgets.id, task.budgetId));
        break;

      case 'resume_budget':
        previousValue = budget.status;
        newValue = 'active';

        await db.update(budgets)
          .set({ status: 'active', updatedAt: new Date() })
          .where(eq(budgets.id, task.budgetId));
        break;

      case 'change_period':
        previousValue = budget.period;
        newValue = task.actionConfig.newPeriod || budget.period;

        await db.update(budgets)
          .set({
            period: newValue,
            currentSpend: '0', // Reset spend when changing period
            updatedAt: new Date(),
          })
          .where(eq(budgets.id, task.budgetId));
        break;

      case 'send_report':
        // This would integrate with AlertService
        previousValue = null;
        newValue = {
          sent: true,
          recipients: task.actionConfig.reportRecipients,
        };
        logger.info('Budget report would be sent', {
          budgetId: task.budgetId,
          recipients: task.actionConfig.reportRecipients,
        });
        break;

      default:
        throw new Error(`Unknown action: ${task.action}`);
    }

    return {
      taskId: task.id,
      success: true,
      action: task.action,
      message: `Successfully executed ${task.action}`,
      previousValue,
      newValue,
      executedAt: new Date(),
      duration: Date.now() - startTime,
    };
  }

  /**
   * Calculate next run time
   */
  private calculateNextRun(timing: {
    scheduleType: ScheduleType;
    hour?: number;
    minute?: number;
    dayOfWeek?: number;
    dayOfMonth?: number;
    cronExpression?: string;
    timezone?: string;
  }): Date {
    const now = new Date();
    const result = new Date(now);

    // Set time
    result.setHours(timing.hour || 0, timing.minute || 0, 0, 0);

    // If already past today's time, start from tomorrow
    if (result <= now) {
      result.setDate(result.getDate() + 1);
    }

    switch (timing.scheduleType) {
      case 'once':
        // Already set
        break;

      case 'daily':
        // Already set - runs daily at specified time
        break;

      case 'weekly':
        const targetDay = timing.dayOfWeek ?? 1; // Default Monday
        while (result.getDay() !== targetDay) {
          result.setDate(result.getDate() + 1);
        }
        break;

      case 'monthly':
        const targetDayOfMonth = timing.dayOfMonth ?? 1;
        result.setDate(targetDayOfMonth);
        if (result <= now) {
          result.setMonth(result.getMonth() + 1);
        }
        break;

      case 'cron':
        // Simplified cron parsing - just use hourly for now
        // A full cron parser would be more complex
        result.setMinutes(timing.minute || 0);
        if (result <= now) {
          result.setHours(result.getHours() + 1);
        }
        break;
    }

    return result;
  }

  /**
   * Run task immediately
   */
  async runTaskNow(taskId: string): Promise<TaskResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (this.runningTasks.has(taskId)) {
      throw new Error(`Task ${taskId} is already running`);
    }

    return this.executeTask(task);
  }

  /**
   * Get recent results
   */
  getRecentResults(limit: number = 100): TaskResult[] {
    return this.results.slice(-limit);
  }

  /**
   * Get results for a task
   */
  getTaskResults(taskId: string): TaskResult[] {
    return this.results.filter(r => r.taskId === taskId);
  }

  /**
   * Schedule common tasks
   */
  scheduleDailyReset(budgetId: string, hour: number = 0): ScheduledTask {
    return this.scheduleTask(
      budgetId,
      'Daily budget reset',
      'daily',
      'reset_spend',
      {},
      { hour, minute: 0 }
    );
  }

  scheduleWeeklyReset(budgetId: string, dayOfWeek: number = 1, hour: number = 0): ScheduledTask {
    return this.scheduleTask(
      budgetId,
      'Weekly budget reset',
      'weekly',
      'reset_spend',
      {},
      { dayOfWeek, hour, minute: 0 }
    );
  }

  scheduleMonthlyReset(budgetId: string, dayOfMonth: number = 1, hour: number = 0): ScheduledTask {
    return this.scheduleTask(
      budgetId,
      'Monthly budget reset',
      'monthly',
      'reset_spend',
      {},
      { dayOfMonth, hour, minute: 0 }
    );
  }

  scheduleLimitIncrease(
    budgetId: string,
    scheduleType: ScheduleType,
    percentage: number,
    timing: { hour?: number; dayOfWeek?: number; dayOfMonth?: number } = {}
  ): ScheduledTask {
    return this.scheduleTask(
      budgetId,
      `Auto-increase limit by ${percentage}%`,
      scheduleType,
      'increase_limit',
      { percentage },
      timing
    );
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    enabled: boolean;
    running: boolean;
    taskCount: number;
    runningTaskCount: number;
    pendingTaskCount: number;
  } {
    return {
      enabled: this.config.enabled,
      running: !!this.checkInterval,
      taskCount: this.tasks.size,
      runningTaskCount: this.runningTasks.size,
      pendingTaskCount: this.getPendingTasks().length,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): BudgetSchedulerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<BudgetSchedulerConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...updates };

    // Handle enable/disable
    if (wasEnabled && !this.config.enabled) {
      this.stop();
    } else if (!wasEnabled && this.config.enabled) {
      this.start();
    }

    // Update check interval if changed
    if (this.checkInterval && updates.checkIntervalMs) {
      this.stop();
      this.start();
    }
  }
}

// Export singleton instance
export const budgetScheduler = new BudgetScheduler();
