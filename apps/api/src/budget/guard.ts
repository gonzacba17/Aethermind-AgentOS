/**
 * Intelligent Budget Guards
 *
 * Smart budget enforcement with multiple strategies:
 * - Hard limits (block requests)
 * - Soft limits (allow with warning)
 * - Gradual throttling
 * - Model downgrading
 */

import { z } from 'zod';
import { db, pool } from '../db/index.js';
import { budgets } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import logger from '../utils/logger.js';

/**
 * Guard action types
 */
export type GuardAction =
  | 'allow'
  | 'warn'
  | 'throttle'
  | 'downgrade_model'
  | 'block'
  | 'queue';

/**
 * Guard decision
 */
export interface GuardDecision {
  action: GuardAction;
  budgetId: string;
  budgetName: string;
  allowed: boolean;
  reason: string;
  utilization: number;
  remaining: number;
  suggestions?: string[];
  alternativeModel?: string;
  throttleDelay?: number;
  metadata?: Record<string, unknown>;
  bypassReason?: string;
  ruleId?: string;
}

/**
 * Request context for guard evaluation
 */
export interface GuardContext {
  userId: string;
  organizationId?: string;
  scope: 'user' | 'team' | 'agent' | 'workflow' | 'global';
  scopeId?: string;
  estimatedCost: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  bypassReason?: string;
}

/**
 * Guard rule
 */
export interface GuardRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  conditions: GuardCondition[];
  action: GuardAction;
  config: GuardRuleConfig;
}

/**
 * Guard condition
 */
export interface GuardCondition {
  field: 'utilization' | 'remaining' | 'cost' | 'model' | 'priority' | 'time';
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'in' | 'not_in';
  value: number | string | string[];
}

/**
 * Guard rule configuration
 */
export interface GuardRuleConfig {
  throttlePercent?: number;
  throttleDelayMs?: number;
  alternativeModels?: string[];
  warningMessage?: string;
  blockMessage?: string;
  notifyChannels?: string[];
  bypassForPriority?: ('high' | 'critical')[];
}

/**
 * Guard configuration
 */
export interface BudgetGuardConfig {
  enabled: boolean;
  defaultAction: GuardAction;

  // Utilization thresholds
  warnThreshold: number;      // Default: 0.8 (80%)
  throttleThreshold: number;  // Default: 0.9 (90%)
  blockThreshold: number;     // Default: 1.0 (100%)

  // Throttling configuration
  maxThrottleDelayMs: number;
  throttleIncrementMs: number;

  // Model downgrade configuration
  enableModelDowngrade: boolean;
  modelDowngradeMap: Record<string, string>;

  // Priority bypass
  allowPriorityBypass: boolean;
  bypassPriorities: ('high' | 'critical')[];

  // Caching
  decisionCacheTtlMs: number;
}

const DEFAULT_CONFIG: BudgetGuardConfig = {
  enabled: true,
  defaultAction: 'warn',
  warnThreshold: 0.8,
  throttleThreshold: 0.9,
  blockThreshold: 1.0,
  maxThrottleDelayMs: 5000,
  throttleIncrementMs: 500,
  enableModelDowngrade: true,
  modelDowngradeMap: {
    'gpt-4': 'gpt-3.5-turbo',
    'gpt-4-turbo': 'gpt-3.5-turbo',
    'gpt-4o': 'gpt-4o-mini',
    'claude-3-opus': 'claude-3-sonnet',
    'claude-opus': 'claude-sonnet',
    'claude-3.5-sonnet': 'claude-3-haiku',
  },
  allowPriorityBypass: true,
  bypassPriorities: ['critical'],
  decisionCacheTtlMs: 5000,
};

/**
 * Budget Guard Class
 */
export class BudgetGuard {
  private config: BudgetGuardConfig;
  private rules: Map<string, GuardRule[]> = new Map();
  private decisionCache: Map<string, { decision: GuardDecision; expiresAt: number }> = new Map();

  constructor(config: Partial<BudgetGuardConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Evaluate request against budget guards
   */
  async evaluate(context: GuardContext): Promise<GuardDecision> {
    if (!this.config.enabled) {
      return this.createDecision('allow', null, context, 'Guards disabled');
    }

    // Check cache
    const cacheKey = this.getCacheKey(context);
    const cached = this.decisionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.decision;
    }

    try {
      // Fetch applicable budget
      const budget = await this.fetchBudget(context);

      if (!budget) {
        return this.createDecision('allow', null, context, 'No budget configured');
      }

      const utilization = Number(budget.currentSpend) / Number(budget.limitAmount);
      const remaining = Number(budget.limitAmount) - Number(budget.currentSpend);
      const projectedUtilization = (Number(budget.currentSpend) + context.estimatedCost) / Number(budget.limitAmount);

      // Check priority bypass
      if (this.shouldBypass(context)) {
        const decision = this.createDecision(
          'allow',
          budget,
          context,
          `Priority bypass: ${context.priority}`,
          { utilization, remaining, bypassReason: context.bypassReason || context.priority }
        );
        this.cacheDecision(cacheKey, decision);
        return decision;
      }

      // Evaluate custom rules first
      const ruleDecision = await this.evaluateRules(context, budget, utilization, remaining);
      if (ruleDecision) {
        this.cacheDecision(cacheKey, ruleDecision);
        return ruleDecision;
      }

      // Apply default threshold logic
      const decision = this.evaluateThresholds(context, budget, utilization, remaining, projectedUtilization);
      this.cacheDecision(cacheKey, decision);
      return decision;

    } catch (error) {
      logger.error('Budget guard evaluation failed', {
        error: (error as Error).message,
        context,
      });
      // Fail open - allow request but log error
      return this.createDecision('allow', null, context, 'Evaluation error - allowing by default');
    }
  }

  /**
   * Evaluate threshold-based rules
   */
  private evaluateThresholds(
    context: GuardContext,
    budget: any,
    utilization: number,
    remaining: number,
    projectedUtilization: number
  ): GuardDecision {
    // Hard limit check
    if (budget.hardLimit && projectedUtilization > this.config.blockThreshold) {
      return this.createDecision(
        'block',
        budget,
        context,
        `Budget limit exceeded (${(utilization * 100).toFixed(1)}% used)`,
        {
          utilization,
          remaining,
          suggestions: this.generateSuggestions('block', context, budget),
        }
      );
    }

    // Throttle threshold
    if (utilization >= this.config.throttleThreshold) {
      const throttleDelay = this.calculateThrottleDelay(utilization);

      // Check if model downgrade is possible
      if (this.config.enableModelDowngrade) {
        const alternativeModel = this.config.modelDowngradeMap[context.model];
        if (alternativeModel) {
          return this.createDecision(
            'downgrade_model',
            budget,
            context,
            `High utilization (${(utilization * 100).toFixed(1)}%) - suggesting cheaper model`,
            {
              utilization,
              remaining,
              alternativeModel,
              suggestions: [`Switch to ${alternativeModel} to reduce costs`],
            }
          );
        }
      }

      return this.createDecision(
        'throttle',
        budget,
        context,
        `High utilization (${(utilization * 100).toFixed(1)}%) - request throttled`,
        {
          utilization,
          remaining,
          throttleDelay,
          suggestions: this.generateSuggestions('throttle', context, budget),
        }
      );
    }

    // Warning threshold
    if (utilization >= this.config.warnThreshold) {
      return this.createDecision(
        'warn',
        budget,
        context,
        `Budget at ${(utilization * 100).toFixed(1)}% - approaching limit`,
        {
          utilization,
          remaining,
          suggestions: this.generateSuggestions('warn', context, budget),
        }
      );
    }

    // Allow
    return this.createDecision(
      'allow',
      budget,
      context,
      'Within budget limits',
      { utilization, remaining }
    );
  }

  /**
   * Evaluate custom rules
   */
  private async evaluateRules(
    context: GuardContext,
    budget: any,
    utilization: number,
    remaining: number
  ): Promise<GuardDecision | null> {
    const rules = this.rules.get(context.userId) || [];

    // Sort by priority
    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (!rule.enabled) continue;

      const matches = this.evaluateConditions(rule.conditions, {
        utilization,
        remaining,
        cost: context.estimatedCost,
        model: context.model,
        priority: context.priority || 'normal',
        time: new Date().getHours(),
      });

      if (matches) {
        return this.createDecision(
          rule.action,
          budget,
          context,
          `Rule "${rule.name}" triggered`,
          {
            utilization,
            remaining,
            ruleId: rule.id,
            ...this.getRuleActionConfig(rule),
          }
        );
      }
    }

    return null;
  }

  /**
   * Evaluate rule conditions
   */
  private evaluateConditions(
    conditions: GuardCondition[],
    values: Record<string, number | string>
  ): boolean {
    return conditions.every(condition => {
      const value = values[condition.field];

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
          return (condition.value as string[]).includes(value as string);
        case 'not_in':
          return !(condition.value as string[]).includes(value as string);
        default:
          return false;
      }
    });
  }

  /**
   * Fetch applicable budget
   */
  private async fetchBudget(context: GuardContext): Promise<any | null> {
    try {
      const conditions = [
        eq(budgets.userId, context.userId),
        eq(budgets.scope, context.scope),
        eq(budgets.status, 'active'),
      ];

      if (context.scopeId) {
        conditions.push(eq(budgets.scopeId, context.scopeId));
      }

      const [budget] = await db.select()
        .from(budgets)
        .where(and(...conditions))
        .orderBy(sql`${budgets.createdAt} DESC`)
        .limit(1);

      return budget || null;
    } catch (error) {
      logger.error('Failed to fetch budget', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Create guard decision
   */
  private createDecision(
    action: GuardAction,
    budget: any | null,
    context: GuardContext,
    reason: string,
    extras?: Partial<GuardDecision>
  ): GuardDecision {
    return {
      action,
      budgetId: budget?.id || '',
      budgetName: budget?.name || 'N/A',
      allowed: action === 'allow' || action === 'warn',
      reason,
      utilization: extras?.utilization || 0,
      remaining: extras?.remaining || 0,
      suggestions: extras?.suggestions,
      alternativeModel: extras?.alternativeModel,
      throttleDelay: extras?.throttleDelay,
      metadata: extras?.metadata || extras,
    };
  }

  /**
   * Generate suggestions based on action
   */
  private generateSuggestions(
    action: GuardAction,
    context: GuardContext,
    budget: any
  ): string[] {
    const suggestions: string[] = [];

    switch (action) {
      case 'block':
        suggestions.push('Wait for budget reset or increase budget limit');
        if (this.config.modelDowngradeMap[context.model]) {
          suggestions.push(`Consider using ${this.config.modelDowngradeMap[context.model]} for lower costs`);
        }
        suggestions.push('Contact administrator to increase limits');
        break;

      case 'throttle':
        suggestions.push('Reduce request frequency to stay within budget');
        suggestions.push('Consider batching requests');
        break;

      case 'warn':
        suggestions.push('Monitor spending closely');
        suggestions.push('Consider setting up budget alerts');
        if (budget.period === 'daily') {
          suggestions.push('Budget resets tomorrow');
        }
        break;
    }

    return suggestions;
  }

  /**
   * Calculate throttle delay based on utilization
   */
  private calculateThrottleDelay(utilization: number): number {
    // Linear increase from threshold to 100%
    const excessUtilization = utilization - this.config.throttleThreshold;
    const range = this.config.blockThreshold - this.config.throttleThreshold;
    const ratio = Math.min(1, excessUtilization / range);

    return Math.min(
      this.config.maxThrottleDelayMs,
      ratio * this.config.maxThrottleDelayMs
    );
  }

  /**
   * Check if request should bypass guards
   */
  private shouldBypass(context: GuardContext): boolean {
    if (!this.config.allowPriorityBypass) return false;

    const priority = context.priority || 'normal';
    return this.config.bypassPriorities.includes(priority as any);
  }

  /**
   * Get action config from rule
   */
  private getRuleActionConfig(rule: GuardRule): Partial<GuardDecision> {
    const config: Partial<GuardDecision> = {};

    if (rule.config.throttleDelayMs) {
      config.throttleDelay = rule.config.throttleDelayMs;
    }

    if (rule.config.alternativeModels?.length) {
      config.alternativeModel = rule.config.alternativeModels[0];
    }

    if (rule.config.warningMessage) {
      config.suggestions = [rule.config.warningMessage];
    }

    return config;
  }

  /**
   * Get cache key for context
   */
  private getCacheKey(context: GuardContext): string {
    return `${context.userId}:${context.scope}:${context.scopeId || 'default'}`;
  }

  /**
   * Cache decision
   */
  private cacheDecision(key: string, decision: GuardDecision): void {
    this.decisionCache.set(key, {
      decision,
      expiresAt: Date.now() + this.config.decisionCacheTtlMs,
    });
  }

  /**
   * Add custom guard rule
   */
  addRule(userId: string, rule: GuardRule): void {
    const userRules = this.rules.get(userId) || [];
    userRules.push(rule);
    this.rules.set(userId, userRules);
  }

  /**
   * Remove guard rule
   */
  removeRule(userId: string, ruleId: string): boolean {
    const userRules = this.rules.get(userId) || [];
    const index = userRules.findIndex(r => r.id === ruleId);
    if (index >= 0) {
      userRules.splice(index, 1);
      this.rules.set(userId, userRules);
      return true;
    }
    return false;
  }

  /**
   * Get rules for user
   */
  getRules(userId: string): GuardRule[] {
    return this.rules.get(userId) || [];
  }

  /**
   * Clear decision cache
   */
  clearCache(): void {
    this.decisionCache.clear();
  }

  /**
   * Get configuration
   */
  getConfig(): BudgetGuardConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<BudgetGuardConfig>): void {
    this.config = { ...this.config, ...updates };
    this.clearCache();
  }
}

// Export singleton instance
export const budgetGuard = new BudgetGuard();
