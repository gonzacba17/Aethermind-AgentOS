/**
 * Budget Management Routes
 *
 * REST API endpoints for budget CRUD operations and
 * integration with intelligent budget guards, circuit breakers,
 * schedulers, and automatic actions.
 */

import { Router } from 'express';
import type { Router as ExpressRouter, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery } from '../middleware/validator.js';
import { db } from '../db/index.js';
import { budgets } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import {
  budgetGuard,
  budgetCircuitBreaker,
  budgetScheduler,
  budgetActionsManager,
  type GuardContext,
  type GuardRule,
  type ScheduledTask,
  type ActionRule,
} from '../budget/index.js';
import logger from '../utils/logger.js';

const router: ExpressRouter = Router();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const CreateBudgetSchema = z.object({
  name: z.string().min(1).max(255),
  limitAmount: z.number().positive(),
  period: z.enum(['daily', 'weekly', 'monthly']),
  scope: z.enum(['user', 'team', 'agent', 'workflow', 'global']),
  scopeId: z.string().optional(),
  hardLimit: z.boolean().default(true),
  alertAt: z.number().min(1).max(100).default(80),
});

const UpdateBudgetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  limitAmount: z.number().positive().optional(),
  period: z.enum(['daily', 'weekly', 'monthly']).optional(),
  hardLimit: z.boolean().optional(),
  alertAt: z.number().min(1).max(100).optional(),
  status: z.enum(['active', 'paused', 'exceeded']).optional(),
});

const ListBudgetsSchema = z.object({
  status: z.enum(['active', 'paused', 'exceeded']).optional(),
  scope: z.enum(['user', 'team', 'agent', 'workflow', 'global']).optional(),
});

const GuardEvaluateSchema = z.object({
  scope: z.enum(['user', 'team', 'agent', 'workflow', 'global']),
  scopeId: z.string().optional(),
  estimatedCost: z.number().nonnegative(),
  model: z.string(),
  inputTokens: z.number().nonnegative(),
  outputTokens: z.number().nonnegative(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
});

const GuardRuleSchema = z.object({
  name: z.string().min(1).max(255),
  enabled: z.boolean().default(true),
  priority: z.number().default(0),
  conditions: z.array(z.object({
    field: z.enum(['utilization', 'remaining', 'cost', 'model', 'priority', 'time']),
    operator: z.enum(['gt', 'lt', 'eq', 'gte', 'lte', 'in', 'not_in']),
    value: z.union([z.number(), z.string(), z.array(z.string())]),
  })),
  action: z.enum(['allow', 'warn', 'throttle', 'downgrade_model', 'block', 'queue']),
  config: z.object({
    throttlePercent: z.number().optional(),
    throttleDelayMs: z.number().optional(),
    alternativeModels: z.array(z.string()).optional(),
    warningMessage: z.string().optional(),
    blockMessage: z.string().optional(),
    notifyChannels: z.array(z.string()).optional(),
    bypassForPriority: z.array(z.enum(['high', 'critical'])).optional(),
  }).optional(),
});

const ScheduleTaskSchema = z.object({
  budgetId: z.string().uuid(),
  name: z.string().min(1).max(255),
  scheduleType: z.enum(['once', 'daily', 'weekly', 'monthly', 'cron']),
  action: z.enum([
    'increase_limit', 'decrease_limit', 'set_limit',
    'reset_spend', 'pause_budget', 'resume_budget',
    'change_period', 'send_report'
  ]),
  actionConfig: z.object({
    amount: z.number().optional(),
    percentage: z.number().optional(),
    newPeriod: z.enum(['daily', 'weekly', 'monthly']).optional(),
    reportRecipients: z.array(z.string()).optional(),
    reportFormat: z.enum(['email', 'slack', 'webhook']).optional(),
    notifyOnComplete: z.boolean().optional(),
    rollbackOnError: z.boolean().optional(),
  }).optional(),
  timing: z.object({
    hour: z.number().min(0).max(23).optional(),
    minute: z.number().min(0).max(59).optional(),
    dayOfWeek: z.number().min(0).max(6).optional(),
    dayOfMonth: z.number().min(1).max(31).optional(),
    cronExpression: z.string().optional(),
    timezone: z.string().optional(),
  }).optional(),
});

const ActionRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  priority: z.number().default(0),
  budgetId: z.string().uuid().optional(),
  trigger: z.enum([
    'threshold_reached', 'threshold_exceeded', 'anomaly_detected',
    'circuit_tripped', 'forecast_warning', 'manual', 'scheduled'
  ]),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['gt', 'lt', 'eq', 'gte', 'lte', 'in', 'between']),
    value: z.union([z.number(), z.string(), z.array(z.number())]),
  })),
  actions: z.array(z.object({
    type: z.enum([
      'notify_email', 'notify_slack', 'notify_webhook',
      'pause_budget', 'reduce_limit', 'increase_limit',
      'downgrade_models', 'throttle_requests', 'block_requests',
      'reset_spend', 'escalate', 'custom'
    ]),
    config: z.record(z.unknown()),
    delayMs: z.number().optional(),
    retryOnFailure: z.boolean().optional(),
  })),
  cooldownMinutes: z.number().min(1).default(60),
  maxExecutionsPerDay: z.number().min(1).default(10),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function getUserId(req: Request): string {
  return (req.user as any)?.id || '';
}

// ============================================
// BUDGET CRUD ROUTES
// ============================================

/**
 * POST /api/budgets
 * Create a new budget
 */
router.post('/', validateBody(CreateBudgetSchema), async (req: Request, res: Response) => {
  try {
    const budget = await req.budgetService.createBudget({
      userId: getUserId(req),
      ...req.body,
    });

    res.status(201).json(budget);
  } catch (error) {
    logger.error('Failed to create budget', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/budgets
 * List all budgets for the user
 */
router.get('/', validateQuery(ListBudgetsSchema), async (req: Request, res: Response) => {
  try {
    const { status, scope } = req.query as any;
    const userId = getUserId(req);

    const conditions = [eq(budgets.userId, userId)];
    if (status) conditions.push(eq(budgets.status, status));
    if (scope) conditions.push(eq(budgets.scope, scope));

    const results = await db.select()
      .from(budgets)
      .where(and(...conditions))
      .orderBy(budgets.createdAt);

    res.json(results);
  } catch (error) {
    logger.error('Failed to list budgets', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/budgets/:id
 * Get a specific budget
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const budgetId = req.params.id!;
    const [budget] = await db.select()
      .from(budgets)
      .where(and(
        eq(budgets.id, budgetId),
        eq(budgets.userId, getUserId(req))
      ))
      .limit(1);

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    res.json(budget);
  } catch (error) {
    logger.error('Failed to get budget', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PATCH /api/budgets/:id
 * Update a budget
 */
router.patch('/:id', validateBody(UpdateBudgetSchema), async (req: Request, res: Response) => {
  try {
    const budgetId = req.params.id;
    if (!budgetId) {
      return res.status(400).json({ error: 'Budget ID is required' });
    }

    await req.budgetService.updateBudget(
      budgetId,
      getUserId(req),
      req.body
    );

    const [updated] = await db.select()
      .from(budgets)
      .where(and(
        eq(budgets.id, budgetId),
        eq(budgets.userId, getUserId(req))
      ))
      .limit(1);

    if (!updated) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Clear guard cache when budget is updated
    budgetGuard.clearCache();

    res.json(updated);
  } catch (error) {
    logger.error('Failed to update budget', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/budgets/:id
 * Delete a budget
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await req.budgetService.deleteBudget(req.params.id!, getUserId(req));
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete budget', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/budgets/:id/usage
 * Get budget usage summary
 */
router.get('/:id/usage', async (req: Request, res: Response) => {
  try {
    const budgetId = req.params.id!;
    const [budget] = await db.select()
      .from(budgets)
      .where(and(
        eq(budgets.id, budgetId),
        eq(budgets.userId, getUserId(req))
      ))
      .limit(1);

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    const percentUsed = (Number(budget.currentSpend) / Number(budget.limitAmount)) * 100;
    const remaining = Number(budget.limitAmount) - Number(budget.currentSpend);

    // Get circuit breaker status
    const circuitStatus = budgetCircuitBreaker.getStatus(budget.id, budget.name);

    res.json({
      budgetId: budget.id,
      name: budget.name,
      limitAmount: Number(budget.limitAmount),
      currentSpend: Number(budget.currentSpend),
      remaining: Math.max(0, remaining),
      percentUsed: Math.min(100, percentUsed),
      status: budget.status,
      period: budget.period,
      hardLimit: budget.hardLimit,
      alertAt: budget.alertAt,
      circuitBreaker: circuitStatus,
    });
  } catch (error) {
    logger.error('Failed to get budget usage', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// BUDGET GUARD ROUTES
// ============================================

/**
 * POST /api/budgets/guard/evaluate
 * Evaluate a request against budget guards
 */
router.post('/guard/evaluate', validateBody(GuardEvaluateSchema), async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const context: GuardContext = {
      userId,
      ...req.body,
    };

    const decision = await budgetGuard.evaluate(context);
    res.json(decision);
  } catch (error) {
    logger.error('Guard evaluation failed', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/budgets/guard/rules
 * Get guard rules for user
 */
router.get('/guard/rules', (_req: Request, res: Response) => {
  try {
    const userId = getUserId(_req);
    const rules = budgetGuard.getRules(userId);
    res.json({ rules });
  } catch (error) {
    logger.error('Failed to get guard rules', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/budgets/guard/rules
 * Add a guard rule
 */
router.post('/guard/rules', validateBody(GuardRuleSchema), (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const rule: GuardRule = {
      id: `rule-${Date.now()}`,
      ...req.body,
      config: req.body.config || {},
    };

    budgetGuard.addRule(userId, rule);
    res.status(201).json(rule);
  } catch (error) {
    logger.error('Failed to add guard rule', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/budgets/guard/rules/:ruleId
 * Remove a guard rule
 */
router.delete('/guard/rules/:ruleId', (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const removed = budgetGuard.removeRule(userId, req.params.ruleId!);

    if (!removed) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to remove guard rule', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/budgets/guard/config
 * Get guard configuration
 */
router.get('/guard/config', (_req: Request, res: Response) => {
  res.json(budgetGuard.getConfig());
});

/**
 * PATCH /api/budgets/guard/config
 * Update guard configuration
 */
router.patch('/guard/config', (req: Request, res: Response) => {
  try {
    budgetGuard.updateConfig(req.body);
    res.json(budgetGuard.getConfig());
  } catch (error) {
    logger.error('Failed to update guard config', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// CIRCUIT BREAKER ROUTES
// ============================================

/**
 * GET /api/budgets/circuit-breaker/status/:budgetId
 * Get circuit breaker status for a budget
 */
router.get('/circuit-breaker/status/:budgetId', async (req: Request, res: Response) => {
  try {
    const budgetId = req.params.budgetId!;
    const [budget] = await db.select()
      .from(budgets)
      .where(eq(budgets.id, budgetId))
      .limit(1);

    const status = budgetCircuitBreaker.getStatus(
      budgetId,
      budget?.name || 'Unknown'
    );

    res.json(status);
  } catch (error) {
    logger.error('Failed to get circuit status', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/budgets/circuit-breaker/all
 * Get all circuit breaker statuses
 */
router.get('/circuit-breaker/all', (_req: Request, res: Response) => {
  const statuses = budgetCircuitBreaker.getAllStatuses();
  res.json({ circuits: statuses });
});

/**
 * POST /api/budgets/circuit-breaker/trip/:budgetId
 * Manually trip a circuit breaker
 */
router.post('/circuit-breaker/trip/:budgetId', async (req: Request, res: Response) => {
  try {
    const budgetId = req.params.budgetId!;
    const [budget] = await db.select()
      .from(budgets)
      .where(eq(budgets.id, budgetId))
      .limit(1);

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    budgetCircuitBreaker.trip(
      budgetId,
      budget.name,
      'manual',
      req.body.reason || 'Manual trip'
    );

    const status = budgetCircuitBreaker.getStatus(budgetId, budget.name);
    res.json(status);
  } catch (error) {
    logger.error('Failed to trip circuit', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/budgets/circuit-breaker/reset/:budgetId
 * Reset a circuit breaker
 */
router.post('/circuit-breaker/reset/:budgetId', async (req: Request, res: Response) => {
  try {
    const budgetId = req.params.budgetId!;
    const [budget] = await db.select()
      .from(budgets)
      .where(eq(budgets.id, budgetId))
      .limit(1);

    budgetCircuitBreaker.close(
      budgetId,
      budget?.name || 'Unknown',
      req.body.reason || 'Manual reset'
    );

    const status = budgetCircuitBreaker.getStatus(budgetId, budget?.name || 'Unknown');
    res.json(status);
  } catch (error) {
    logger.error('Failed to reset circuit', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/budgets/circuit-breaker/config
 * Get circuit breaker configuration
 */
router.get('/circuit-breaker/config', (_req: Request, res: Response) => {
  res.json(budgetCircuitBreaker.getConfig());
});

/**
 * PATCH /api/budgets/circuit-breaker/config
 * Update circuit breaker configuration
 */
router.patch('/circuit-breaker/config', (req: Request, res: Response) => {
  try {
    budgetCircuitBreaker.updateConfig(req.body);
    res.json(budgetCircuitBreaker.getConfig());
  } catch (error) {
    logger.error('Failed to update circuit config', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// SCHEDULER ROUTES
// ============================================

/**
 * GET /api/budgets/scheduler/status
 * Get scheduler status
 */
router.get('/scheduler/status', (_req: Request, res: Response) => {
  res.json(budgetScheduler.getStatus());
});

/**
 * POST /api/budgets/scheduler/start
 * Start the scheduler
 */
router.post('/scheduler/start', (_req: Request, res: Response) => {
  budgetScheduler.start();
  res.json({ success: true, status: budgetScheduler.getStatus() });
});

/**
 * POST /api/budgets/scheduler/stop
 * Stop the scheduler
 */
router.post('/scheduler/stop', (_req: Request, res: Response) => {
  budgetScheduler.stop();
  res.json({ success: true, status: budgetScheduler.getStatus() });
});

/**
 * GET /api/budgets/scheduler/tasks
 * List all scheduled tasks
 */
router.get('/scheduler/tasks', (_req: Request, res: Response) => {
  const tasks = budgetScheduler.getAllTasks();
  res.json({ tasks });
});

/**
 * GET /api/budgets/scheduler/tasks/:budgetId
 * Get scheduled tasks for a budget
 */
router.get('/scheduler/tasks/:budgetId', (req: Request, res: Response) => {
  const tasks = budgetScheduler.getBudgetTasks(req.params.budgetId!);
  res.json({ tasks });
});

/**
 * POST /api/budgets/scheduler/tasks
 * Create a scheduled task
 */
router.post('/scheduler/tasks', validateBody(ScheduleTaskSchema), (req: Request, res: Response) => {
  try {
    const { budgetId, name, scheduleType, action, actionConfig, timing } = req.body;

    const task = budgetScheduler.scheduleTask(
      budgetId,
      name,
      scheduleType,
      action,
      actionConfig || {},
      timing || {}
    );

    res.status(201).json(task);
  } catch (error) {
    logger.error('Failed to schedule task', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PATCH /api/budgets/scheduler/tasks/:taskId
 * Update a scheduled task
 */
router.patch('/scheduler/tasks/:taskId', (req: Request, res: Response) => {
  try {
    const task = budgetScheduler.updateTask(req.params.taskId!, req.body);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    logger.error('Failed to update task', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/budgets/scheduler/tasks/:taskId
 * Delete a scheduled task
 */
router.delete('/scheduler/tasks/:taskId', (req: Request, res: Response) => {
  try {
    const deleted = budgetScheduler.deleteTask(req.params.taskId!);

    if (!deleted) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete task', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/budgets/scheduler/tasks/:taskId/run
 * Run a task immediately
 */
router.post('/scheduler/tasks/:taskId/run', async (req: Request, res: Response) => {
  try {
    const result = await budgetScheduler.runTaskNow(req.params.taskId!);
    res.json(result);
  } catch (error) {
    logger.error('Failed to run task', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/budgets/scheduler/results
 * Get recent task results
 */
router.get('/scheduler/results', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const results = budgetScheduler.getRecentResults(limit);
  res.json({ results });
});

// ============================================
// ACTION RULES ROUTES
// ============================================

/**
 * GET /api/budgets/actions/rules
 * List all action rules
 */
router.get('/actions/rules', (_req: Request, res: Response) => {
  const rules = budgetActionsManager.getAllRules();
  res.json({ rules });
});

/**
 * GET /api/budgets/actions/rules/:budgetId
 * Get action rules for a budget
 */
router.get('/actions/rules/:budgetId', (req: Request, res: Response) => {
  const rules = budgetActionsManager.getBudgetRules(req.params.budgetId!);
  res.json({ rules });
});

/**
 * POST /api/budgets/actions/rules
 * Create an action rule
 */
router.post('/actions/rules', validateBody(ActionRuleSchema), (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const rule = budgetActionsManager.registerRule({
      ...req.body,
      userId,
    });

    res.status(201).json(rule);
  } catch (error) {
    logger.error('Failed to create action rule', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PATCH /api/budgets/actions/rules/:ruleId
 * Update an action rule
 */
router.patch('/actions/rules/:ruleId', (req: Request, res: Response) => {
  try {
    const rule = budgetActionsManager.updateRule(req.params.ruleId!, req.body);

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json(rule);
  } catch (error) {
    logger.error('Failed to update action rule', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/budgets/actions/rules/:ruleId
 * Delete an action rule
 */
router.delete('/actions/rules/:ruleId', (req: Request, res: Response) => {
  try {
    const deleted = budgetActionsManager.deleteRule(req.params.ruleId!);

    if (!deleted) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete action rule', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/budgets/actions/evaluate
 * Evaluate and execute actions for a context
 */
router.post('/actions/evaluate', async (req: Request, res: Response) => {
  try {
    const { budgetId, trigger } = req.body;

    // Fetch budget
    const [budget] = await db.select()
      .from(budgets)
      .where(eq(budgets.id, budgetId))
      .limit(1);

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    const results = await budgetActionsManager.evaluateAndExecute({
      budgetId: budget.id,
      budgetName: budget.name,
      userId: getUserId(req),
      trigger: trigger || 'manual',
      currentSpend: Number(budget.currentSpend),
      limitAmount: Number(budget.limitAmount),
      utilization: Number(budget.currentSpend) / Number(budget.limitAmount),
    });

    res.json({ results });
  } catch (error) {
    logger.error('Action evaluation failed', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/budgets/actions/config
 * Get action manager configuration
 */
router.get('/actions/config', (_req: Request, res: Response) => {
  res.json(budgetActionsManager.getConfig());
});

/**
 * PATCH /api/budgets/actions/config
 * Update action manager configuration
 */
router.patch('/actions/config', (req: Request, res: Response) => {
  try {
    budgetActionsManager.updateConfig(req.body);
    res.json(budgetActionsManager.getConfig());
  } catch (error) {
    logger.error('Failed to update actions config', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// QUICK SETUP ROUTES
// ============================================

/**
 * POST /api/budgets/:id/setup/alerts
 * Quick setup for budget alerts
 */
router.post('/:id/setup/alerts', async (req: Request, res: Response) => {
  try {
    const { thresholds, actions } = req.body;
    const budgetId = req.params.id!;
    const userId = getUserId(req);

    // Verify budget exists
    const [budget] = await db.select()
      .from(budgets)
      .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId)))
      .limit(1);

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    const createdRules: ActionRule[] = [];

    // Create rules for each threshold
    for (const threshold of thresholds || [0.8, 0.9, 1.0]) {
      const rule = budgetActionsManager.createThresholdRule(
        budgetId,
        threshold,
        actions || [
          {
            type: 'notify_email',
            config: {
              messageTemplate: `Budget {budgetName} is at {utilization}% utilization`,
            },
          },
        ]
      );
      createdRules.push(rule);
    }

    res.json({ rules: createdRules });
  } catch (error) {
    logger.error('Failed to setup alerts', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/budgets/:id/setup/schedule
 * Quick setup for budget schedule (daily/weekly/monthly reset)
 */
router.post('/:id/setup/schedule', async (req: Request, res: Response) => {
  try {
    const { period, hour } = req.body;
    const budgetId = req.params.id!;
    const userId = getUserId(req);

    // Verify budget exists
    const [budget] = await db.select()
      .from(budgets)
      .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId)))
      .limit(1);

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    let task: ScheduledTask;
    const resetHour = hour ?? 0;

    switch (period || budget.period) {
      case 'daily':
        task = budgetScheduler.scheduleDailyReset(budgetId, resetHour);
        break;
      case 'weekly':
        task = budgetScheduler.scheduleWeeklyReset(budgetId, 1, resetHour); // Monday
        break;
      case 'monthly':
        task = budgetScheduler.scheduleMonthlyReset(budgetId, 1, resetHour); // 1st of month
        break;
      default:
        return res.status(400).json({ error: 'Invalid period' });
    }

    res.json({ task });
  } catch (error) {
    logger.error('Failed to setup schedule', { error: (error as Error).message });
    res.status(500).json({ error: (error as Error).message });
  }
});

export { router as budgetRoutes };
