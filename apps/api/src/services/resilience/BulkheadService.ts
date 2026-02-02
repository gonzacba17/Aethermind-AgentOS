/**
 * Bulkhead Pattern Implementation
 *
 * Isolates critical resources to prevent cascade failures:
 * - Semaphore-based concurrency limiting
 * - Separate pools for different operation types
 * - Queue management with timeout
 * - Metrics and monitoring
 */

import { EventEmitter } from 'events';

// ============================================
// TYPES
// ============================================

export interface BulkheadConfig {
  name: string;
  maxConcurrent: number;
  maxQueue: number;
  queueTimeoutMs: number;
  executionTimeoutMs?: number;
}

export interface BulkheadMetrics {
  name: string;
  activeCount: number;
  queueLength: number;
  maxConcurrent: number;
  maxQueue: number;
  totalExecuted: number;
  totalRejected: number;
  totalTimedOut: number;
  avgExecutionTimeMs: number;
}

interface QueuedItem<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  queuedAt: number;
  timeoutId?: NodeJS.Timeout;
}

// ============================================
// BULKHEAD IMPLEMENTATION
// ============================================

export class Bulkhead<T = unknown> extends EventEmitter {
  private config: BulkheadConfig;
  private activeCount = 0;
  private queue: QueuedItem<T>[] = [];

  // Metrics
  private totalExecuted = 0;
  private totalRejected = 0;
  private totalTimedOut = 0;
  private executionTimes: number[] = [];
  private readonly maxExecutionTimeSamples = 100;

  constructor(config: BulkheadConfig) {
    super();
    this.config = config;
  }

  /**
   * Execute a function with bulkhead protection
   */
  async execute(fn: () => Promise<T>): Promise<T> {
    // Check if we can execute immediately
    if (this.activeCount < this.config.maxConcurrent) {
      return this.runExecution(fn);
    }

    // Check if queue is full
    if (this.queue.length >= this.config.maxQueue) {
      this.totalRejected++;
      this.emit('rejected', { name: this.config.name, reason: 'queue_full' });
      throw new BulkheadRejectError(
        `Bulkhead '${this.config.name}' queue is full (${this.config.maxQueue})`
      );
    }

    // Add to queue
    return this.enqueue(fn);
  }

  /**
   * Try to execute without queueing
   */
  tryExecute(fn: () => Promise<T>): Promise<T> | null {
    if (this.activeCount < this.config.maxConcurrent) {
      return this.runExecution(fn);
    }
    return null;
  }

  /**
   * Get current metrics
   */
  getMetrics(): BulkheadMetrics {
    const avgExecutionTime =
      this.executionTimes.length > 0
        ? this.executionTimes.reduce((a, b) => a + b, 0) / this.executionTimes.length
        : 0;

    return {
      name: this.config.name,
      activeCount: this.activeCount,
      queueLength: this.queue.length,
      maxConcurrent: this.config.maxConcurrent,
      maxQueue: this.config.maxQueue,
      totalExecuted: this.totalExecuted,
      totalRejected: this.totalRejected,
      totalTimedOut: this.totalTimedOut,
      avgExecutionTimeMs: Math.round(avgExecutionTime),
    };
  }

  /**
   * Check if bulkhead has available capacity
   */
  isAvailable(): boolean {
    return this.activeCount < this.config.maxConcurrent;
  }

  /**
   * Check if queue has space
   */
  canQueue(): boolean {
    return this.queue.length < this.config.maxQueue;
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async runExecution(fn: () => Promise<T>): Promise<T> {
    this.activeCount++;
    this.emit('acquire', { name: this.config.name, activeCount: this.activeCount });

    const startTime = Date.now();

    try {
      let result: T;

      if (this.config.executionTimeoutMs) {
        result = await this.executeWithTimeout(fn, this.config.executionTimeoutMs);
      } else {
        result = await fn();
      }

      this.recordExecutionTime(Date.now() - startTime);
      this.totalExecuted++;

      return result;
    } finally {
      this.activeCount--;
      this.emit('release', { name: this.config.name, activeCount: this.activeCount });
      this.processQueue();
    }
  }

  private async executeWithTimeout(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          this.totalTimedOut++;
          reject(new BulkheadTimeoutError(
            `Bulkhead '${this.config.name}' execution timed out after ${timeoutMs}ms`
          ));
        }, timeoutMs);
      }),
    ]);
  }

  private enqueue(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const item: QueuedItem<T> = {
        fn,
        resolve,
        reject,
        queuedAt: Date.now(),
      };

      // Set queue timeout
      item.timeoutId = setTimeout(() => {
        const index = this.queue.indexOf(item);
        if (index !== -1) {
          this.queue.splice(index, 1);
          this.totalTimedOut++;
          this.emit('queueTimeout', { name: this.config.name });
          reject(new BulkheadTimeoutError(
            `Bulkhead '${this.config.name}' queue timeout after ${this.config.queueTimeoutMs}ms`
          ));
        }
      }, this.config.queueTimeoutMs);

      this.queue.push(item);
      this.emit('queued', { name: this.config.name, queueLength: this.queue.length });
    });
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.activeCount >= this.config.maxConcurrent) {
      return;
    }

    const item = this.queue.shift()!;

    // Clear timeout
    if (item.timeoutId) {
      clearTimeout(item.timeoutId);
    }

    // Execute
    this.runExecution(item.fn)
      .then(item.resolve)
      .catch(item.reject);
  }

  private recordExecutionTime(timeMs: number): void {
    this.executionTimes.push(timeMs);

    // Keep only recent samples
    if (this.executionTimes.length > this.maxExecutionTimeSamples) {
      this.executionTimes.shift();
    }
  }
}

// ============================================
// BULKHEAD MANAGER
// ============================================

export class BulkheadManager {
  private bulkheads: Map<string, Bulkhead<unknown>> = new Map();

  /**
   * Create or get a bulkhead
   */
  getBulkhead<T>(name: string, config?: Partial<BulkheadConfig>): Bulkhead<T> {
    let bulkhead = this.bulkheads.get(name);

    if (!bulkhead) {
      const defaultConfig: BulkheadConfig = {
        name,
        maxConcurrent: 10,
        maxQueue: 100,
        queueTimeoutMs: 30000,
        ...config,
      };

      bulkhead = new Bulkhead<unknown>(defaultConfig);
      this.bulkheads.set(name, bulkhead);
    }

    return bulkhead as Bulkhead<T>;
  }

  /**
   * Get metrics for all bulkheads
   */
  getAllMetrics(): BulkheadMetrics[] {
    return Array.from(this.bulkheads.values()).map((b) => b.getMetrics());
  }

  /**
   * Get a specific bulkhead's metrics
   */
  getMetrics(name: string): BulkheadMetrics | null {
    const bulkhead = this.bulkheads.get(name);
    return bulkhead ? bulkhead.getMetrics() : null;
  }
}

// ============================================
// ERROR CLASSES
// ============================================

export class BulkheadRejectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BulkheadRejectError';
  }
}

export class BulkheadTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BulkheadTimeoutError';
  }
}

// ============================================
// PREDEFINED BULKHEADS FOR AETHERMIND
// ============================================

export const bulkheadManager = new BulkheadManager();

// Critical operations - limited concurrency
export const criticalBulkhead = bulkheadManager.getBulkhead('critical', {
  maxConcurrent: 5,
  maxQueue: 20,
  queueTimeoutMs: 10000,
  executionTimeoutMs: 30000,
});

// LLM API calls - separate pool
export const llmBulkhead = bulkheadManager.getBulkhead('llm', {
  maxConcurrent: 20,
  maxQueue: 100,
  queueTimeoutMs: 60000,
  executionTimeoutMs: 120000,
});

// Database operations - high throughput
export const databaseBulkhead = bulkheadManager.getBulkhead('database', {
  maxConcurrent: 50,
  maxQueue: 200,
  queueTimeoutMs: 5000,
  executionTimeoutMs: 10000,
});

// External API calls
export const externalApiBulkhead = bulkheadManager.getBulkhead('external_api', {
  maxConcurrent: 15,
  maxQueue: 50,
  queueTimeoutMs: 30000,
  executionTimeoutMs: 60000,
});

// Background jobs
export const backgroundBulkhead = bulkheadManager.getBulkhead('background', {
  maxConcurrent: 10,
  maxQueue: 500,
  queueTimeoutMs: 300000, // 5 minutes
});

// ============================================
// DECORATOR FOR BULKHEAD PROTECTION
// ============================================

export function withBulkhead(bulkheadName: string, config?: Partial<BulkheadConfig>) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const bulkhead = bulkheadManager.getBulkhead(bulkheadName, config);
      return bulkhead.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

export default BulkheadManager;
