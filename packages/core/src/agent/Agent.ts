import { v4 as uuid } from 'uuid';
import EventEmitter from 'eventemitter3';
import type {
  AgentConfig,
  AgentContext,
  AgentLogic,
  AgentStatus,
  ExecutionResult,
  AgentEvent,
} from '../types/index.js';
import { AgentConfigSchema } from '../types/index.js';
import { StructuredLogger } from '../logger/StructuredLogger.js';
import { StateManager } from '../state/StateManager.js';

export class Agent {
  readonly id: string;
  readonly config: AgentConfig;
  private logic: AgentLogic;
  private emitter: EventEmitter.EventEmitter;
  private logger: StructuredLogger;
  private status: AgentStatus = 'idle';
  private stateManager: StateManager;
  private currentExecutionId?: string;

  constructor(config: AgentConfig, logic: AgentLogic, emitter?: EventEmitter.EventEmitter) {
    this.id = uuid();
    this.config = AgentConfigSchema.parse(config);
    this.logic = logic;
    this.emitter = emitter || new EventEmitter.EventEmitter();
    this.logger = new StructuredLogger({ agentId: this.id }, this.emitter);
    this.stateManager = new StateManager();
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  getName(): string {
    return this.config.name;
  }

  getModel(): string {
    return this.config.model;
  }

  private setStatus(status: AgentStatus): void {
    this.status = status;
    this.emit('agent:status', { agentId: this.id, status });
  }

  private emit(type: string, data: unknown): void {
    const event: AgentEvent = {
      type: type as AgentEvent['type'],
      timestamp: new Date(),
      agentId: this.id,
      executionId: this.currentExecutionId,
      data,
    };
    this.emitter.emit(type, event);
    this.emitter.emit('agent:event', event);
  }

  async execute(input: unknown): Promise<ExecutionResult> {
    const executionId = uuid();
    this.currentExecutionId = executionId;
    const startedAt = new Date();

    this.setStatus('running');
    this.logger.info(`Starting execution`, { executionId, input });
    this.emit('agent:started', { executionId, input });

    const context: AgentContext = {
      agentId: this.id,
      executionId,
      input,
      state: this.stateManager.getSnapshot(),
      logger: this.logger.child({ executionId }),
      emit: (event, data) => this.emit(event, data),
    };

    try {
      const output = await this.executeWithTimeout(context);
      const completedAt = new Date();

      this.setStatus('completed');
      this.logger.info(`Execution completed`, { executionId, duration: completedAt.getTime() - startedAt.getTime() });
      this.emit('agent:completed', { executionId, output });

      return {
        executionId,
        agentId: this.id,
        status: 'completed',
        output,
        startedAt,
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
      };
    } catch (error) {
      const completedAt = new Date();
      const isTimeout = error instanceof TimeoutError;
      const status: AgentStatus = isTimeout ? 'timeout' : 'failed';

      this.setStatus(status);
      this.logger.error(`Execution ${status}`, { executionId, error: (error as Error).message });
      this.emit('agent:failed', { executionId, error: (error as Error).message });

      return {
        executionId,
        agentId: this.id,
        status,
        output: null,
        error: error as Error,
        startedAt,
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
      };
    } finally {
      this.currentExecutionId = undefined;
    }
  }

  private async executeWithTimeout(context: AgentContext): Promise<unknown> {
    const timeout = this.config.timeout;

    return Promise.race([
      this.executeWithRetry(context),
      new Promise((_, reject) =>
        setTimeout(() => reject(new TimeoutError(`Execution timed out after ${timeout}ms`)), timeout)
      ),
    ]);
  }

  private async executeWithRetry(context: AgentContext): Promise<unknown> {
    const maxRetries = this.config.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.calculateBackoff(attempt);
          this.logger.info(`Retry attempt ${attempt}/${maxRetries}, waiting ${delay}ms`);
          await this.sleep(delay);
        }
        return await this.logic(context);
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Attempt ${attempt + 1} failed: ${lastError.message}`);

        if (attempt === maxRetries) {
          throw lastError;
        }
      }
    }

    throw lastError;
  }

  private calculateBackoff(attempt: number): number {
    const baseDelay = 1000;
    const maxDelay = 30000;
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    const jitter = Math.random() * 0.3 * delay;
    return Math.floor(delay + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  on(event: string, handler: (data: AgentEvent) => void): () => void {
    this.emitter.on(event, handler);
    return () => this.emitter.off(event, handler);
  }

  getLogger(): StructuredLogger {
    return this.logger;
  }

  getState(): StateManager {
    return this.stateManager;
  }

  getEmitter(): EventEmitter.EventEmitter {
    return this.emitter;
  }
}

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function createAgent(
  config: AgentConfig,
  logic: AgentLogic,
  emitter?: EventEmitter.EventEmitter
): Agent {
  return new Agent(config, logic, emitter);
}
