/**
 * Budget Circuit Breaker
 *
 * Implements the circuit breaker pattern for budget enforcement.
 * Automatically trips when budget anomalies are detected, preventing
 * runaway costs and allowing graceful recovery.
 */

import { z } from 'zod';
import { db, pool } from '../db/index.js';
import { budgets } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import logger from '../utils/logger.js';

/**
 * Circuit breaker states
 */
export type CircuitState = 'closed' | 'open' | 'half_open';

/**
 * Trip reason
 */
export type TripReason =
  | 'budget_exceeded'
  | 'cost_spike'
  | 'error_rate'
  | 'anomaly_detected'
  | 'manual'
  | 'scheduled';

/**
 * Circuit breaker status
 */
export interface CircuitStatus {
  state: CircuitState;
  budgetId: string;
  budgetName: string;
  tripReason?: TripReason;
  trippedAt?: Date;
  lastAttemptAt?: Date;
  failureCount: number;
  successCount: number;
  halfOpenSuccessCount: number;
  nextRetryAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Circuit breaker event
 */
export interface CircuitEvent {
  id: string;
  circuitId: string;
  event: 'trip' | 'reset' | 'half_open' | 'success' | 'failure';
  previousState: CircuitState;
  newState: CircuitState;
  reason: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  // Failure thresholds
  failureThreshold: number;           // Number of failures before tripping
  failureWindowMs: number;            // Time window for counting failures

  // Recovery configuration
  recoveryTimeoutMs: number;          // Time to wait before trying half-open
  halfOpenSuccessThreshold: number;   // Successes needed to close circuit
  halfOpenMaxAttempts: number;        // Max attempts in half-open state

  // Cost-based triggers
  costSpikeMultiplier: number;        // Trip if cost exceeds N times average
  costSpikeWindowMs: number;          // Window for cost spike detection

  // Rate-based triggers
  maxRequestsPerMinute: number;       // Trip if exceeded
  errorRateThreshold: number;         // Error rate (0-1) that triggers trip

  // Notification
  notifyOnTrip: boolean;
  notifyOnReset: boolean;

  // Auto-reset
  enableAutoReset: boolean;
  autoResetTimeoutMs: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  failureWindowMs: 60000, // 1 minute
  recoveryTimeoutMs: 300000, // 5 minutes
  halfOpenSuccessThreshold: 3,
  halfOpenMaxAttempts: 5,
  costSpikeMultiplier: 5,
  costSpikeWindowMs: 300000, // 5 minutes
  maxRequestsPerMinute: 1000,
  errorRateThreshold: 0.5,
  notifyOnTrip: true,
  notifyOnReset: true,
  enableAutoReset: true,
  autoResetTimeoutMs: 3600000, // 1 hour
};

/**
 * Circuit state data
 */
interface CircuitData {
  state: CircuitState;
  tripReason?: TripReason;
  trippedAt?: Date;
  lastAttemptAt?: Date;
  failureCount: number;
  successCount: number;
  halfOpenSuccessCount: number;
  halfOpenAttempts: number;
  failures: { timestamp: Date; reason: string }[];
  recentCosts: { timestamp: Date; cost: number }[];
  requestsInLastMinute: number;
  lastRequestTime?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Budget Circuit Breaker Class
 */
export class BudgetCircuitBreaker {
  private config: CircuitBreakerConfig;
  private circuits: Map<string, CircuitData> = new Map();
  private eventListeners: Array<(event: CircuitEvent) => void> = [];
  private eventCounter = 0;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request is allowed through circuit
   */
  async canProceed(budgetId: string, budgetName: string = 'Unknown'): Promise<boolean> {
    const circuit = this.getOrCreateCircuit(budgetId);
    const now = new Date();

    switch (circuit.state) {
      case 'closed':
        return true;

      case 'open':
        // Check if it's time to try half-open
        if (circuit.trippedAt) {
          const timeSinceTrip = now.getTime() - circuit.trippedAt.getTime();
          if (timeSinceTrip >= this.config.recoveryTimeoutMs) {
            this.transitionToHalfOpen(budgetId, budgetName);
            return true;
          }
        }
        return false;

      case 'half_open':
        // Allow limited requests
        if (circuit.halfOpenAttempts < this.config.halfOpenMaxAttempts) {
          circuit.halfOpenAttempts++;
          circuit.lastAttemptAt = now;
          return true;
        }
        return false;
    }
  }

  /**
   * Record successful request
   */
  recordSuccess(budgetId: string, budgetName: string = 'Unknown', cost: number = 0): void {
    const circuit = this.getOrCreateCircuit(budgetId);
    const now = new Date();

    circuit.successCount++;
    circuit.lastAttemptAt = now;

    // Record cost for spike detection
    circuit.recentCosts.push({ timestamp: now, cost });
    this.pruneRecentCosts(circuit);

    // Update request counter
    circuit.requestsInLastMinute++;
    circuit.lastRequestTime = now;

    if (circuit.state === 'half_open') {
      circuit.halfOpenSuccessCount++;

      // Check if we should close the circuit
      if (circuit.halfOpenSuccessCount >= this.config.halfOpenSuccessThreshold) {
        this.close(budgetId, budgetName, 'Recovery threshold met');
      }
    }
  }

  /**
   * Record failed request
   */
  recordFailure(budgetId: string, budgetName: string = 'Unknown', reason: string = 'Unknown'): void {
    const circuit = this.getOrCreateCircuit(budgetId);
    const now = new Date();

    circuit.failureCount++;
    circuit.lastAttemptAt = now;
    circuit.failures.push({ timestamp: now, reason });

    // Prune old failures
    this.pruneFailures(circuit);

    // Check if we should trip
    const recentFailures = circuit.failures.filter(
      f => now.getTime() - f.timestamp.getTime() < this.config.failureWindowMs
    );

    if (circuit.state === 'closed' && recentFailures.length >= this.config.failureThreshold) {
      this.trip(budgetId, budgetName, 'error_rate', `${recentFailures.length} failures in ${this.config.failureWindowMs / 1000}s`);
    } else if (circuit.state === 'half_open') {
      // Any failure in half-open reopens the circuit
      this.trip(budgetId, budgetName, 'error_rate', 'Failure during half-open state');
    }
  }

  /**
   * Record cost for spike detection
   */
  recordCost(budgetId: string, budgetName: string, cost: number): void {
    const circuit = this.getOrCreateCircuit(budgetId);
    const now = new Date();

    circuit.recentCosts.push({ timestamp: now, cost });
    this.pruneRecentCosts(circuit);

    // Check for cost spike
    if (this.detectCostSpike(circuit, cost)) {
      this.trip(budgetId, budgetName, 'cost_spike', `Cost ${cost} exceeds ${this.config.costSpikeMultiplier}x average`);
    }
  }

  /**
   * Manually trip the circuit
   */
  trip(
    budgetId: string,
    budgetName: string,
    reason: TripReason,
    details: string = ''
  ): void {
    const circuit = this.getOrCreateCircuit(budgetId);
    const previousState = circuit.state;
    const now = new Date();

    if (circuit.state === 'open') return; // Already open

    circuit.state = 'open';
    circuit.tripReason = reason;
    circuit.trippedAt = now;
    circuit.halfOpenSuccessCount = 0;
    circuit.halfOpenAttempts = 0;

    this.emitEvent({
      circuitId: budgetId,
      event: 'trip',
      previousState,
      newState: 'open',
      reason: `${reason}: ${details}`,
      metadata: { budgetName },
    });

    logger.warn('Circuit breaker tripped', {
      budgetId,
      budgetName,
      reason,
      details,
    });
  }

  /**
   * Reset circuit to closed state
   */
  close(budgetId: string, budgetName: string = 'Unknown', reason: string = 'Manual reset'): void {
    const circuit = this.getOrCreateCircuit(budgetId);
    const previousState = circuit.state;

    circuit.state = 'closed';
    circuit.tripReason = undefined;
    circuit.trippedAt = undefined;
    circuit.failureCount = 0;
    circuit.halfOpenSuccessCount = 0;
    circuit.halfOpenAttempts = 0;
    circuit.failures = [];

    this.emitEvent({
      circuitId: budgetId,
      event: 'reset',
      previousState,
      newState: 'closed',
      reason,
      metadata: { budgetName },
    });

    logger.info('Circuit breaker reset', { budgetId, budgetName, reason });
  }

  /**
   * Transition to half-open state
   */
  private transitionToHalfOpen(budgetId: string, budgetName: string): void {
    const circuit = this.getOrCreateCircuit(budgetId);
    const previousState = circuit.state;

    circuit.state = 'half_open';
    circuit.halfOpenSuccessCount = 0;
    circuit.halfOpenAttempts = 0;

    this.emitEvent({
      circuitId: budgetId,
      event: 'half_open',
      previousState,
      newState: 'half_open',
      reason: 'Recovery timeout elapsed',
      metadata: { budgetName },
    });

    logger.info('Circuit breaker half-open', { budgetId, budgetName });
  }

  /**
   * Get circuit status
   */
  getStatus(budgetId: string, budgetName: string = 'Unknown'): CircuitStatus {
    const circuit = this.getOrCreateCircuit(budgetId);
    const now = new Date();

    let nextRetryAt: Date | undefined;
    if (circuit.state === 'open' && circuit.trippedAt) {
      nextRetryAt = new Date(circuit.trippedAt.getTime() + this.config.recoveryTimeoutMs);
    }

    return {
      state: circuit.state,
      budgetId,
      budgetName,
      tripReason: circuit.tripReason,
      trippedAt: circuit.trippedAt,
      lastAttemptAt: circuit.lastAttemptAt,
      failureCount: circuit.failureCount,
      successCount: circuit.successCount,
      halfOpenSuccessCount: circuit.halfOpenSuccessCount,
      nextRetryAt,
      metadata: circuit.metadata,
    };
  }

  /**
   * Get all circuit statuses
   */
  getAllStatuses(): CircuitStatus[] {
    const statuses: CircuitStatus[] = [];
    for (const [budgetId, circuit] of this.circuits) {
      statuses.push(this.getStatus(budgetId));
    }
    return statuses;
  }

  /**
   * Get or create circuit data
   */
  private getOrCreateCircuit(budgetId: string): CircuitData {
    let circuit = this.circuits.get(budgetId);
    if (!circuit) {
      circuit = {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        halfOpenSuccessCount: 0,
        halfOpenAttempts: 0,
        failures: [],
        recentCosts: [],
        requestsInLastMinute: 0,
      };
      this.circuits.set(budgetId, circuit);
    }
    return circuit;
  }

  /**
   * Detect cost spike
   */
  private detectCostSpike(circuit: CircuitData, cost: number): boolean {
    if (circuit.recentCosts.length < 5) return false;

    const average = circuit.recentCosts.reduce((sum, c) => sum + c.cost, 0) / circuit.recentCosts.length;
    return cost > average * this.config.costSpikeMultiplier;
  }

  /**
   * Prune old failures
   */
  private pruneFailures(circuit: CircuitData): void {
    const now = Date.now();
    circuit.failures = circuit.failures.filter(
      f => now - f.timestamp.getTime() < this.config.failureWindowMs * 2
    );
  }

  /**
   * Prune old costs
   */
  private pruneRecentCosts(circuit: CircuitData): void {
    const now = Date.now();
    circuit.recentCosts = circuit.recentCosts.filter(
      c => now - c.timestamp.getTime() < this.config.costSpikeWindowMs
    );
  }

  /**
   * Periodic cleanup
   */
  private cleanup(): void {
    const now = Date.now();

    for (const [budgetId, circuit] of this.circuits) {
      // Prune old data
      this.pruneFailures(circuit);
      this.pruneRecentCosts(circuit);

      // Reset request counter
      if (circuit.lastRequestTime &&
          now - circuit.lastRequestTime.getTime() > 60000) {
        circuit.requestsInLastMinute = 0;
      }

      // Auto-reset if enabled
      if (this.config.enableAutoReset &&
          circuit.state === 'open' &&
          circuit.trippedAt &&
          now - circuit.trippedAt.getTime() > this.config.autoResetTimeoutMs) {
        this.close(budgetId, 'Unknown', 'Auto-reset timeout');
      }
    }
  }

  /**
   * Emit circuit event
   */
  private emitEvent(event: Omit<CircuitEvent, 'id' | 'timestamp'>): void {
    const fullEvent: CircuitEvent = {
      id: `ce-${++this.eventCounter}-${Date.now()}`,
      timestamp: new Date(),
      ...event,
    };

    for (const listener of this.eventListeners) {
      try {
        listener(fullEvent);
      } catch (error) {
        logger.error('Circuit event listener error', { error: (error as Error).message });
      }
    }
  }

  /**
   * Add event listener
   */
  onEvent(listener: (event: CircuitEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index >= 0) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get configuration
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.eventListeners = [];
  }
}

// Export singleton instance
export const budgetCircuitBreaker = new BudgetCircuitBreaker();
