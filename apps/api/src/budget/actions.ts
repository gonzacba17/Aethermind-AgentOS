/**
 * Budget Automatic Actions
 *
 * Defines and executes automatic actions in response to
 * budget events, thresholds, and conditions.
 */

import { z } from 'zod';
import { db, pool } from '../db/index.js';
import { budgets, users, alertLogs } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { BudgetGuard, GuardDecision, budgetGuard } from './guard.js';
import { BudgetCircuitBreaker, budgetCircuitBreaker } from './circuit-breaker.js';
import { BudgetScheduler, budgetScheduler } from './scheduler.js';
import logger from '../utils/logger.js';

/**
 * Action trigger types
 */
export type ActionTrigger =
  | 'threshold_reached'
  | 'threshold_exceeded'
  | 'anomaly_detected'
  | 'circuit_tripped'
  | 'forecast_warning'
  | 'manual'
  | 'scheduled';

/**
 * Action types
 */
export type ActionType =
  | 'notify_email'
  | 'notify_slack'
  | 'notify_webhook'
  | 'pause_budget'
  | 'reduce_limit'
  | 'increase_limit'
  | 'downgrade_models'
  | 'throttle_requests'
  | 'block_requests'
  | 'reset_spend'
  | 'escalate'
  | 'custom';

/**
 * Action rule definition
 */
export interface ActionRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  budgetId?: string; // Optional - if not set, applies globally
  userId?: string;

  // Trigger configuration
  trigger: ActionTrigger;
  conditions: ActionCondition[];

  // Action configuration
  actions: ActionDefinition[];

  // Execution settings
  cooldownMinutes: number;
  maxExecutionsPerDay: number;
  lastExecutedAt?: Date;
  executionCount: number;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Action condition
 */
export interface ActionCondition {
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'in' | 'between';
  value: number | string | number[];
}

/**
 * Action definition
 */
export interface ActionDefinition {
  type: ActionType;
  config: ActionConfig;
  delayMs?: number;
  retryOnFailure?: boolean;
}

/**
 * Action configuration
 */
export interface ActionConfig {
  // Notification config
  recipients?: string[];
  webhookUrl?: string;
  messageTemplate?: string;

  // Budget modification config
  amount?: number;
  percentage?: number;

  // Model config
  targetModels?: string[];
  alternativeModels?: string[];

  // Throttle config
  throttlePercent?: number;
  throttleDurationMs?: number;

  // Escalation config
  escalateTo?: string[];
  escalationMessage?: string;

  // Custom config
  customHandler?: string;
  customParams?: Record<string, unknown>;
}

/**
 * Action execution result
 */
export interface ActionResult {
  ruleId: string;
  actionType: ActionType;
  success: boolean;
  message: string;
  executedAt: Date;
  duration: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Action context
 */
export interface ActionContext {
  budgetId: string;
  budgetName: string;
  userId: string;
  trigger: ActionTrigger;
  currentSpend: number;
  limitAmount: number;
  utilization: number;
  metadata?: Record<string, unknown>;
}

/**
 * Budget Actions Configuration
 */
export interface BudgetActionsConfig {
  enabled: boolean;
  maxConcurrentActions: number;
  defaultCooldownMinutes: number;
  maxActionsPerDay: number;
  enableEmailNotifications: boolean;
  enableSlackNotifications: boolean;
  enableWebhooks: boolean;
  emailFromAddress: string;
  slackWebhookUrl?: string;
}

const DEFAULT_CONFIG: BudgetActionsConfig = {
  enabled: true,
  maxConcurrentActions: 5,
  defaultCooldownMinutes: 30,
  maxActionsPerDay: 100,
  enableEmailNotifications: true,
  enableSlackNotifications: false,
  enableWebhooks: true,
  emailFromAddress: 'alerts@aethermind.ai',
};

/**
 * Budget Actions Manager Class
 */
export class BudgetActionsManager {
  private config: BudgetActionsConfig;
  private rules: Map<string, ActionRule> = new Map();
  private runningActions: Set<string> = new Set();
  private ruleCounter = 0;
  private dailyExecutionCounts: Map<string, number> = new Map();
  private lastDailyReset: Date = new Date();

  constructor(
    config: Partial<BudgetActionsConfig> = {},
    private guard: BudgetGuard = budgetGuard,
    private circuitBreaker: BudgetCircuitBreaker = budgetCircuitBreaker,
    private scheduler: BudgetScheduler = budgetScheduler
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register an action rule
   */
  registerRule(rule: Omit<ActionRule, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>): ActionRule {
    const fullRule: ActionRule = {
      ...rule,
      id: `rule-${++this.ruleCounter}-${Date.now()}`,
      executionCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.rules.set(fullRule.id, fullRule);
    logger.info('Action rule registered', { ruleId: fullRule.id, name: fullRule.name });

    return fullRule;
  }

  /**
   * Update an action rule
   */
  updateRule(ruleId: string, updates: Partial<ActionRule>): ActionRule | null {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;

    const updatedRule = { ...rule, ...updates, updatedAt: new Date() };
    this.rules.set(ruleId, updatedRule);

    return updatedRule;
  }

  /**
   * Delete an action rule
   */
  deleteRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId: string): ActionRule | null {
    return this.rules.get(ruleId) || null;
  }

  /**
   * Get all rules
   */
  getAllRules(): ActionRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rules for a budget
   */
  getBudgetRules(budgetId: string): ActionRule[] {
    return Array.from(this.rules.values())
      .filter(r => !r.budgetId || r.budgetId === budgetId);
  }

  /**
   * Evaluate and execute actions for a context
   */
  async evaluateAndExecute(context: ActionContext): Promise<ActionResult[]> {
    if (!this.config.enabled) {
      return [];
    }

    this.checkDailyReset();

    const results: ActionResult[] = [];
    const applicableRules = this.getApplicableRules(context);

    // Sort by priority (higher first)
    applicableRules.sort((a, b) => b.priority - a.priority);

    for (const rule of applicableRules) {
      if (!this.canExecute(rule)) {
        continue;
      }

      const conditionsMet = this.evaluateConditions(rule.conditions, context);
      if (!conditionsMet) {
        continue;
      }

      const ruleResults = await this.executeRule(rule, context);
      results.push(...ruleResults);
    }

    return results;
  }

  /**
   * Get applicable rules for context
   */
  private getApplicableRules(context: ActionContext): ActionRule[] {
    return Array.from(this.rules.values())
      .filter(rule => {
        if (!rule.enabled) return false;
        if (rule.budgetId && rule.budgetId !== context.budgetId) return false;
        if (rule.userId && rule.userId !== context.userId) return false;
        if (rule.trigger !== context.trigger) return false;
        return true;
      });
  }

  /**
   * Check if rule can be executed
   */
  private canExecute(rule: ActionRule): boolean {
    // Check cooldown
    if (rule.lastExecutedAt) {
      const cooldownMs = (rule.cooldownMinutes || this.config.defaultCooldownMinutes) * 60 * 1000;
      if (Date.now() - rule.lastExecutedAt.getTime() < cooldownMs) {
        return false;
      }
    }

    // Check daily limit
    const dailyCount = this.dailyExecutionCounts.get(rule.id) || 0;
    if (dailyCount >= rule.maxExecutionsPerDay) {
      return false;
    }

    return true;
  }

  /**
   * Evaluate conditions
   */
  private evaluateConditions(conditions: ActionCondition[], context: ActionContext): boolean {
    const values: Record<string, number | string> = {
      currentSpend: context.currentSpend,
      limitAmount: context.limitAmount,
      utilization: context.utilization,
      budgetId: context.budgetId,
      userId: context.userId,
    };

    return conditions.every(condition => {
      const value = values[condition.field];
      if (value === undefined) return true;

      switch (condition.operator) {
        case 'gt':
          return (value as number) > (condition.value as number);
        case 'lt':
          return (value as number) < (condition.value as number);
        case 'gte':
          return (value as number) >= (condition.value as number);
        case 'lte':
          return (value as number) <= (condition.value as number);
        case 'eq':
          return value === condition.value;
        case 'in':
          return (condition.value as number[]).includes(value as number);
        case 'between':
          const range = condition.value as number[];
          const min = range[0] ?? 0;
          const max = range[1] ?? Infinity;
          return (value as number) >= min && (value as number) <= max;
        default:
          return false;
      }
    });
  }

  /**
   * Execute a rule's actions
   */
  private async executeRule(rule: ActionRule, context: ActionContext): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    for (const action of rule.actions) {
      // Apply delay if specified
      if (action.delayMs) {
        await new Promise(resolve => setTimeout(resolve, action.delayMs));
      }

      const result = await this.executeAction(rule.id, action, context);
      results.push(result);

      // Stop if action failed and retry is not enabled
      if (!result.success && !action.retryOnFailure) {
        break;
      }
    }

    // Update rule execution stats
    rule.lastExecutedAt = new Date();
    rule.executionCount++;
    rule.updatedAt = new Date();
    this.rules.set(rule.id, rule);

    // Update daily count
    const currentCount = this.dailyExecutionCounts.get(rule.id) || 0;
    this.dailyExecutionCounts.set(rule.id, currentCount + 1);

    return results;
  }

  /**
   * Execute a single action
   */
  private async executeAction(
    ruleId: string,
    action: ActionDefinition,
    context: ActionContext
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      switch (action.type) {
        case 'notify_email':
          await this.sendEmailNotification(action.config, context);
          break;

        case 'notify_slack':
          await this.sendSlackNotification(action.config, context);
          break;

        case 'notify_webhook':
          await this.sendWebhookNotification(action.config, context);
          break;

        case 'pause_budget':
          await this.pauseBudget(context.budgetId);
          break;

        case 'reduce_limit':
          await this.modifyLimit(context.budgetId, action.config, 'reduce');
          break;

        case 'increase_limit':
          await this.modifyLimit(context.budgetId, action.config, 'increase');
          break;

        case 'downgrade_models':
          // This would integrate with the optimization engine
          logger.info('Model downgrade action triggered', {
            budgetId: context.budgetId,
            models: action.config.targetModels,
          });
          break;

        case 'throttle_requests':
          // Update guard configuration
          this.guard.updateConfig({
            throttleThreshold: Math.max(0, 1 - (action.config.throttlePercent || 50) / 100),
          });
          break;

        case 'block_requests':
          this.circuitBreaker.trip(context.budgetId, context.budgetName, 'manual', 'Automatic action');
          break;

        case 'reset_spend':
          await this.resetBudgetSpend(context.budgetId);
          break;

        case 'escalate':
          await this.escalate(action.config, context);
          break;

        case 'custom':
          logger.info('Custom action triggered', {
            handler: action.config.customHandler,
            params: action.config.customParams,
          });
          break;

        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      return {
        ruleId,
        actionType: action.type,
        success: true,
        message: `Action ${action.type} executed successfully`,
        executedAt: new Date(),
        duration: Date.now() - startTime,
      };

    } catch (error) {
      return {
        ruleId,
        actionType: action.type,
        success: false,
        message: `Action ${action.type} failed`,
        executedAt: new Date(),
        duration: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(config: ActionConfig, context: ActionContext): Promise<void> {
    if (!this.config.enableEmailNotifications) {
      logger.info('Email notifications disabled');
      return;
    }

    const message = this.formatMessage(config.messageTemplate || this.getDefaultTemplate('email'), context);

    // Log the notification (actual sending would integrate with EmailService)
    logger.info('Email notification', {
      recipients: config.recipients,
      subject: `Budget Alert: ${context.budgetName}`,
      message,
    });

    // Store in alert logs
    await db.insert(alertLogs).values({
      budgetId: context.budgetId,
      alertType: 'action',
      channel: 'email',
      recipient: (config.recipients || []).join(','),
      message,
      success: true,
    });
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(config: ActionConfig, context: ActionContext): Promise<void> {
    if (!this.config.enableSlackNotifications) {
      logger.info('Slack notifications disabled');
      return;
    }

    const webhookUrl = config.webhookUrl || this.config.slackWebhookUrl;
    if (!webhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }

    const message = this.formatMessage(config.messageTemplate || this.getDefaultTemplate('slack'), context);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message,
        attachments: [{
          color: context.utilization > 0.9 ? 'danger' : 'warning',
          fields: [
            { title: 'Budget', value: context.budgetName, short: true },
            { title: 'Utilization', value: `${(context.utilization * 100).toFixed(1)}%`, short: true },
            { title: 'Current Spend', value: `$${context.currentSpend.toFixed(2)}`, short: true },
            { title: 'Limit', value: `$${context.limitAmount.toFixed(2)}`, short: true },
          ],
        }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.statusText}`);
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(config: ActionConfig, context: ActionContext): Promise<void> {
    if (!this.config.enableWebhooks || !config.webhookUrl) {
      return;
    }

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'budget_action',
        trigger: context.trigger,
        budget: {
          id: context.budgetId,
          name: context.budgetName,
          currentSpend: context.currentSpend,
          limitAmount: context.limitAmount,
          utilization: context.utilization,
        },
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.statusText}`);
    }
  }

  /**
   * Pause budget
   */
  private async pauseBudget(budgetId: string): Promise<void> {
    await db.update(budgets)
      .set({ status: 'paused', updatedAt: new Date() })
      .where(eq(budgets.id, budgetId));

    logger.info('Budget paused by automatic action', { budgetId });
  }

  /**
   * Modify budget limit
   */
  private async modifyLimit(
    budgetId: string,
    config: ActionConfig,
    direction: 'increase' | 'reduce'
  ): Promise<void> {
    const [budget] = await db.select()
      .from(budgets)
      .where(eq(budgets.id, budgetId))
      .limit(1);

    if (!budget) {
      throw new Error(`Budget ${budgetId} not found`);
    }

    const currentLimit = Number(budget.limitAmount);
    let newLimit: number;

    if (config.percentage) {
      const change = currentLimit * (config.percentage / 100);
      newLimit = direction === 'increase' ? currentLimit + change : currentLimit - change;
    } else {
      const change = config.amount || 0;
      newLimit = direction === 'increase' ? currentLimit + change : currentLimit - change;
    }

    newLimit = Math.max(0, newLimit);

    await db.update(budgets)
      .set({ limitAmount: newLimit.toString(), updatedAt: new Date() })
      .where(eq(budgets.id, budgetId));

    logger.info('Budget limit modified by automatic action', {
      budgetId,
      previousLimit: currentLimit,
      newLimit,
      direction,
    });
  }

  /**
   * Reset budget spend
   */
  private async resetBudgetSpend(budgetId: string): Promise<void> {
    await db.update(budgets)
      .set({
        currentSpend: '0',
        alert80Sent: false,
        alert100Sent: false,
        updatedAt: new Date(),
      })
      .where(eq(budgets.id, budgetId));

    logger.info('Budget spend reset by automatic action', { budgetId });
  }

  /**
   * Escalate alert
   */
  private async escalate(config: ActionConfig, context: ActionContext): Promise<void> {
    const message = config.escalationMessage ||
      `ESCALATION: Budget "${context.budgetName}" requires attention. Utilization: ${(context.utilization * 100).toFixed(1)}%`;

    // Send to escalation contacts
    for (const contact of config.escalateTo || []) {
      logger.info('Escalation sent', { contact, message });
    }
  }

  /**
   * Format message with context variables
   */
  private formatMessage(template: string, context: ActionContext): string {
    return template
      .replace(/\{budgetName\}/g, context.budgetName)
      .replace(/\{budgetId\}/g, context.budgetId)
      .replace(/\{currentSpend\}/g, context.currentSpend.toFixed(2))
      .replace(/\{limitAmount\}/g, context.limitAmount.toFixed(2))
      .replace(/\{utilization\}/g, (context.utilization * 100).toFixed(1))
      .replace(/\{trigger\}/g, context.trigger);
  }

  /**
   * Get default message template
   */
  private getDefaultTemplate(channel: 'email' | 'slack'): string {
    const templates = {
      email: `Budget Alert: {budgetName}\n\nYour budget "{budgetName}" is at {utilization}% utilization.\nCurrent spend: ${'{currentSpend}'}\nLimit: ${'{limitAmount}'}\n\nThis alert was triggered by: {trigger}`,
      slack: `*Budget Alert*: {budgetName} is at {utilization}% utilization`,
    };
    return templates[channel];
  }

  /**
   * Check and reset daily counts
   */
  private checkDailyReset(): void {
    const now = new Date();
    if (now.getDate() !== this.lastDailyReset.getDate()) {
      this.dailyExecutionCounts.clear();
      this.lastDailyReset = now;
    }
  }

  /**
   * Create common action rules
   */
  createThresholdRule(
    budgetId: string,
    threshold: number,
    actions: ActionDefinition[]
  ): ActionRule {
    return this.registerRule({
      name: `Threshold ${threshold * 100}% rule`,
      description: `Triggered when utilization reaches ${threshold * 100}%`,
      enabled: true,
      priority: Math.round(threshold * 10),
      budgetId,
      trigger: 'threshold_reached',
      conditions: [
        { field: 'utilization', operator: 'gte', value: threshold },
      ],
      actions,
      cooldownMinutes: 60,
      maxExecutionsPerDay: 3,
    });
  }

  /**
   * Get configuration
   */
  getConfig(): BudgetActionsConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<BudgetActionsConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// Export singleton instance
export const budgetActionsManager = new BudgetActionsManager();
