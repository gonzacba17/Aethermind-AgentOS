import { v4 as uuid } from 'uuid';
import EventEmitter from 'eventemitter3';
import type {
  OrchestratorConfig,
  ExecutionResult,
  WorkflowDefinition,
  WorkflowStep,
  TraceNode,
  Trace,
  CostInfo,
  AgentEvent,
} from '../types/index.js';
import { OrchestratorConfigSchema } from '../types/index.js';
import { Agent } from '../agent/Agent.js';
import { AgentRuntime } from '../agent/AgentRuntime.js';
import { StructuredLogger } from '../logger/StructuredLogger.js';
import { TaskQueueService, TaskQueueItem as QueueItem, TaskQueueMetrics } from '../queue/TaskQueueService.js';

interface TaskQueueItem {
  id: string;
  agentId: string;
  input: unknown;
  priority: number;
  createdAt: Date;
  workflowId?: string;
  resolve: (result: ExecutionResult) => void;
  reject: (error: Error) => void;
}

// Map to track pending promises for tasks
interface PendingTask {
  resolve: (result: ExecutionResult) => void;
  reject: (error: Error) => void;
}

export class Orchestrator {
  private runtime: AgentRuntime;
  private config: OrchestratorConfig;
  private emitter: EventEmitter.EventEmitter;
  private logger: StructuredLogger;
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private taskQueueService: TaskQueueService;
  private pendingTasks: Map<string, PendingTask> = new Map();
  private traces: Map<string, Trace> = new Map();
  private costs: CostInfo[] = [];

  constructor(
    runtime: AgentRuntime,
    queueService: TaskQueueService,
    config: Partial<OrchestratorConfig> = {}
  ) {
    this.runtime = runtime;
    this.config = OrchestratorConfigSchema.parse(config);
    this.emitter = runtime.getEmitter();
    this.logger = new StructuredLogger({}, this.emitter);
    this.taskQueueService = queueService;
    this.setupEventListeners();
    this.setupQueueProcessing();
  }

  private setupEventListeners(): void {
    this.emitter.on('agent:completed', (event: AgentEvent) => {
      this.logger.debug('Agent completed', { event });
    });

    this.emitter.on('agent:failed', (event: AgentEvent) => {
      this.logger.warn('Agent failed', { event });
    });
  }

  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.name, workflow);
    this.logger.info(`Registered workflow: ${workflow.name}`);
  }

  getWorkflow(name: string): WorkflowDefinition | undefined {
    return this.workflows.get(name);
  }

  async executeTask(agentId: string, input: unknown, priority = 0): Promise<ExecutionResult> {
    return new Promise(async (resolve, reject) => {
      const taskId = uuid();
      const task: QueueItem = {
        id: taskId,
        agentId,
        input,
        priority,
        createdAt: new Date(),
      };

      // Store promise handlers
      this.pendingTasks.set(taskId, { resolve, reject });

      try {
        await this.taskQueueService.addTask(task);
        this.logger.debug(`Task queued: ${taskId}`, { agentId, priority });
      } catch (error) {
        this.pendingTasks.delete(taskId);
        reject(error);
      }
    });
  }

  private setupQueueProcessing(): void {
    this.taskQueueService.process(
      this.config.maxConcurrentAgents,
      async (task: QueueItem) => {
        await this.processTask(task);
      }
    );
  }

  private async processTask(task: QueueItem): Promise<void> {
    const pending = this.pendingTasks.get(task.id);
    
    try {
      this.logger.debug(`Processing task: ${task.id}`, { agentId: task.agentId });
      const result = await this.runtime.executeAgent(task.agentId, task.input);
      
      if (pending) {
        pending.resolve(result);
        this.pendingTasks.delete(task.id);
      }
    } catch (error) {
      this.logger.error(`Task failed: ${task.id}`, { error: (error as Error).message });
      
      if (pending) {
        pending.reject(error as Error);
        this.pendingTasks.delete(task.id);
      }
      
      throw error; // Re-throw for Bull's retry mechanism
    }
  }

  async executeWorkflow(
    workflowName: string,
    input: unknown
  ): Promise<{ executionId: string; results: Map<string, ExecutionResult> }> {
    const workflow = this.workflows.get(workflowName);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowName}`);
    }

    const executionId = uuid();
    const results = new Map<string, ExecutionResult>();
    const stepOutputs = new Map<string, unknown>();

    this.logger.info(`Starting workflow: ${workflowName}`, { executionId });
    this.emit('workflow:started', { executionId, workflowName, input });

    const rootTrace = this.createTraceNode(workflowName, 'workflow', input);

    try {
      let currentStepId: string | undefined = workflow.entryPoint;

      while (currentStepId) {
        const step = workflow.steps.find((s) => s.id === currentStepId);
        if (!step) {
          throw new Error(`Step not found: ${currentStepId}`);
        }

        if (step.condition && !this.evaluateCondition(step.condition, stepOutputs)) {
          this.logger.info(`Skipping step due to condition: ${step.id}`);
          currentStepId = this.getNextStep(step, stepOutputs);
          continue;
        }

        const agent = this.runtime.getAgentByName(step.agent);
        if (!agent) {
          throw new Error(`Agent not found for step: ${step.agent}`);
        }

        const stepInput = this.prepareStepInput(step, input, stepOutputs);
        const stepTrace = this.createTraceNode(step.id, 'agent', stepInput);
        rootTrace.children.push(stepTrace);

        this.logger.info(`Executing step: ${step.id}`, { agent: step.agent });

        const result = await this.runtime.executeAgent(agent.id, stepInput);
        results.set(step.id, result);
        stepOutputs.set(step.id, result.output);

        stepTrace.completedAt = new Date();
        stepTrace.duration = stepTrace.completedAt.getTime() - stepTrace.startedAt.getTime();
        stepTrace.output = result.output;

        this.emit('workflow:step:completed', {
          executionId,
          stepId: step.id,
          result,
        });

        if (result.status === 'failed' || result.status === 'timeout') {
          throw new Error(`Step failed: ${step.id}`);
        }

        currentStepId = this.getNextStep(step, stepOutputs);
      }

      rootTrace.completedAt = new Date();
      rootTrace.duration = rootTrace.completedAt.getTime() - rootTrace.startedAt.getTime();
      rootTrace.output = Object.fromEntries(stepOutputs);

      const trace: Trace = {
        id: uuid(),
        executionId,
        rootNode: rootTrace,
        createdAt: new Date(),
      };
      this.traces.set(executionId, trace);

      this.logger.info(`Workflow completed: ${workflowName}`, { executionId });
      this.emit('workflow:completed', { executionId, workflowName, results: Object.fromEntries(results) });

      return { executionId, results };
    } catch (error) {
      rootTrace.completedAt = new Date();
      rootTrace.error = (error as Error).message;

      this.logger.error(`Workflow failed: ${workflowName}`, { executionId, error: (error as Error).message });
      this.emit('workflow:failed', { executionId, workflowName, error: (error as Error).message });

      throw error;
    }
  }

  private createTraceNode(
    name: string,
    type: TraceNode['type'],
    input: unknown
  ): TraceNode {
    return {
      id: uuid(),
      name,
      type,
      startedAt: new Date(),
      input,
      children: [],
    };
  }

  private evaluateCondition(condition: string, outputs: Map<string, unknown>): boolean {
    const parts = condition.split('.');
    if (parts.length !== 2) return true;

    const [stepId, property] = parts;
    const output = outputs.get(stepId!) as Record<string, unknown> | undefined;
    if (!output) return false;

    if (property === 'success') {
      return output !== null && output !== undefined;
    }

    return Boolean(output[property!]);
  }

  private getNextStep(step: WorkflowStep, outputs: Map<string, unknown>): string | undefined {
    if (!step.next) return undefined;

    if (Array.isArray(step.next)) {
      return step.next[0];
    }

    return step.next;
  }

  private prepareStepInput(
    step: WorkflowStep,
    initialInput: unknown,
    stepOutputs: Map<string, unknown>
  ): unknown {
    return {
      initial: initialInput,
      previousSteps: Object.fromEntries(stepOutputs),
    };
  }

  async executeParallel(
    tasks: Array<{ agentId: string; input: unknown }>
  ): Promise<ExecutionResult[]> {
    const promises = tasks.map((task) =>
      this.runtime.executeAgent(task.agentId, task.input)
    );
    return Promise.all(promises);
  }

  getTrace(executionId: string): Trace | undefined {
    return this.traces.get(executionId);
  }

  getAllTraces(): Trace[] {
    return Array.from(this.traces.values());
  }

  trackCost(costInfo: CostInfo): void {
    this.costs.push(costInfo);
    this.emit('cost:tracked', costInfo);
  }

  getCosts(): CostInfo[] {
    return [...this.costs];
  }

  getCostsByExecution(executionId: string): CostInfo[] {
    return this.costs.filter((c) => c.executionId === executionId);
  }

  getTotalCost(): number {
    return this.costs.reduce((sum, c) => sum + c.cost, 0);
  }

  private emit(type: string, data: unknown): void {
    const event: AgentEvent = {
      type: type as AgentEvent['type'],
      timestamp: new Date(),
      data,
    };
    this.emitter.emit(type, event);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getRuntime(): AgentRuntime {
    return this.runtime;
  }

  getConfig(): OrchestratorConfig {
    return { ...this.config };
  }

  async getQueueLength(): Promise<number> {
    const metrics = await this.taskQueueService.getMetrics();
    return metrics.waiting + metrics.active;
  }

  async getQueueMetrics(): Promise<TaskQueueMetrics> {
    return await this.taskQueueService.getMetrics();
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down orchestrator...');
    await this.taskQueueService.close();
    this.pendingTasks.clear();
  }
}

export function createOrchestrator(
  runtime: AgentRuntime,
  queueService: TaskQueueService,
  config?: Partial<OrchestratorConfig>
): Orchestrator {
  return new Orchestrator(runtime, queueService, config);
}
