/**
 * Budget Module - Intelligent Budget Guards
 *
 * This module provides comprehensive budget management with:
 * - Smart guards with multiple enforcement strategies
 * - Circuit breaker for runaway cost protection
 * - Scheduled limit adjustments
 * - Automatic actions in response to events
 */

// Budget Guard
export {
  BudgetGuard,
  budgetGuard,
  type GuardAction,
  type GuardDecision,
  type GuardContext,
  type GuardRule,
  type GuardCondition,
  type GuardRuleConfig,
  type BudgetGuardConfig,
} from './guard.js';

// Circuit Breaker
export {
  BudgetCircuitBreaker,
  budgetCircuitBreaker,
  type CircuitState,
  type TripReason,
  type CircuitStatus,
  type CircuitEvent,
  type CircuitBreakerConfig,
} from './circuit-breaker.js';

// Scheduler
export {
  BudgetScheduler,
  budgetScheduler,
  type ScheduleType,
  type ScheduleAction,
  type ScheduledTask,
  type ScheduleActionConfig,
  type TaskResult,
  type BudgetSchedulerConfig,
} from './scheduler.js';

// Actions Manager
export {
  BudgetActionsManager,
  budgetActionsManager,
  type ActionTrigger,
  type ActionType,
  type ActionRule,
  type ActionCondition,
  type ActionDefinition,
  type ActionConfig,
  type ActionResult,
  type ActionContext,
  type BudgetActionsConfig,
} from './actions.js';
