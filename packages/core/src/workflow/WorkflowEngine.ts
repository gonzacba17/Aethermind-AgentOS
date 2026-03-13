import { v4 as uuid } from 'uuid';
import EventEmitter from 'eventemitter3';
import type {
  WorkflowDefinition,
  WorkflowStep,
  ExecutionResult,
  TraceNode,
} from '../types/index.js';
import { Orchestrator } from '../orchestrator/Orchestrator.js';
import { StructuredLogger } from '../logger/StructuredLogger.js';

export interface WorkflowContext {
  executionId: string;
  workflowName: string;
  input: unknown;
  stepOutputs: Map<string, unknown>;
  variables: Map<string, unknown>;
}

export interface WorkflowExecutionResult {
  executionId: string;
  workflowName: string;
  status: 'completed' | 'failed';
  stepResults: Map<string, ExecutionResult>;
  output: unknown;
  duration: number;
  trace: TraceNode;
}

export class WorkflowEngine {
  private orchestrator: Orchestrator;
  private emitter: EventEmitter.EventEmitter;
  private logger: StructuredLogger;
  private workflowDefinitions: Map<string, WorkflowDefinition> = new Map();

  constructor(orchestrator: Orchestrator) {
    this.orchestrator = orchestrator;
    this.emitter = orchestrator.getRuntime().getEmitter();
    this.logger = new StructuredLogger({}, this.emitter);
  }

  registerWorkflow(definition: WorkflowDefinition): void {
    this.validateWorkflow(definition);
    this.workflowDefinitions.set(definition.name, definition);
    this.orchestrator.registerWorkflow(definition);
    this.logger.info(`Workflow registered: ${definition.name}`);
  }

  updateWorkflow(name: string, definition: Partial<WorkflowDefinition>): void {
    const existing = this.workflowDefinitions.get(name);
    if (!existing) {
      throw new Error(`Workflow not found: ${name}`);
    }

    const updated = { ...existing, ...definition, name }; // Preserve name
    this.validateWorkflow(updated);
    this.workflowDefinitions.set(name, updated);
    this.orchestrator.registerWorkflow(updated); // Re-register with orchestrator
    this.logger.info(`Workflow updated: ${name}`);
  }

  deleteWorkflow(name: string): void {
    const existing = this.workflowDefinitions.get(name);
    if (!existing) {
      throw new Error(`Workflow not found: ${name}`);
    }

    this.workflowDefinitions.delete(name);
    this.logger.info(`Workflow deleted: ${name}`);
  }

  private validateWorkflow(definition: WorkflowDefinition): void {
    if (!definition.name) {
      throw new Error('Workflow must have a name');
    }
    if (!definition.steps || definition.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }
    if (!definition.entryPoint) {
      throw new Error('Workflow must have an entry point');
    }

    const stepIds = new Set(definition.steps.map((s) => s.id));
    if (!stepIds.has(definition.entryPoint)) {
      throw new Error(`Entry point "${definition.entryPoint}" not found in steps`);
    }

    for (const step of definition.steps) {
      if (step.next) {
        const nextSteps = Array.isArray(step.next) ? step.next : [step.next];
        for (const nextId of nextSteps) {
          if (!stepIds.has(nextId)) {
            throw new Error(`Step "${step.id}" references unknown next step "${nextId}"`);
          }
        }
      }
    }
  }

  async execute(workflowName: string, input: unknown): Promise<WorkflowExecutionResult> {
    const definition = this.workflowDefinitions.get(workflowName);
    if (!definition) {
      throw new Error(`Workflow not found: ${workflowName}`);
    }

    const executionId = uuid();
    const startTime = Date.now();
    const stepResults = new Map<string, ExecutionResult>();
    const stepOutputs = new Map<string, unknown>();

    const context: WorkflowContext = {
      executionId,
      workflowName,
      input,
      stepOutputs,
      variables: new Map(),
    };

    const rootTrace = this.createTraceNode(workflowName, 'workflow', input);

    this.logger.info(`Starting workflow execution: ${workflowName}`, { executionId });
    this.emitter.emit('workflow:started', { executionId, workflowName, input });

    try {
      await this.executeSteps(definition, context, stepResults, rootTrace);

      rootTrace.completedAt = new Date();
      rootTrace.duration = Date.now() - startTime;
      rootTrace.output = Object.fromEntries(stepOutputs);

      const result: WorkflowExecutionResult = {
        executionId,
        workflowName,
        status: 'completed',
        stepResults,
        output: this.getWorkflowOutput(definition, stepOutputs),
        duration: Date.now() - startTime,
        trace: rootTrace,
      };

      this.emitter.emit('workflow:completed', result);
      return result;
    } catch (error) {
      rootTrace.completedAt = new Date();
      rootTrace.duration = Date.now() - startTime;
      rootTrace.error = (error as Error).message;

      const result: WorkflowExecutionResult = {
        executionId,
        workflowName,
        status: 'failed',
        stepResults,
        output: null,
        duration: Date.now() - startTime,
        trace: rootTrace,
      };

      this.emitter.emit('workflow:failed', { ...result, error: (error as Error).message });
      throw error;
    }
  }

  private async executeSteps(
    definition: WorkflowDefinition,
    context: WorkflowContext,
    stepResults: Map<string, ExecutionResult>,
    rootTrace: TraceNode
  ): Promise<void> {
    const executed = new Set<string>();
    let currentStepIds = [definition.entryPoint];

    while (currentStepIds.length > 0) {
      const parallelSteps = currentStepIds.filter(
        (id) => !executed.has(id) && this.canExecute(id, definition, executed)
      );

      if (parallelSteps.length === 0) {
        break;
      }

      const stepPromises = parallelSteps.map(async (stepId) => {
        const step = definition.steps.find((s) => s.id === stepId);
        if (!step) return null;

        if (step.condition && !this.evaluateCondition(step.condition, context)) {
          this.logger.info(`Skipping step due to condition: ${stepId}`);
          return null;
        }

        return this.executeStep(step, context, rootTrace);
      });

      const results = await Promise.all(stepPromises);

      for (let i = 0; i < parallelSteps.length; i++) {
        const stepId = parallelSteps[i]!;
        const result = results[i];
        if (result) {
          stepResults.set(stepId, result);
          context.stepOutputs.set(stepId, result.output);
        }
        executed.add(stepId);
      }

      currentStepIds = this.getNextStepIds(parallelSteps, definition, context);
    }
  }

  private async executeStep(
    step: WorkflowStep,
    context: WorkflowContext,
    rootTrace: TraceNode
  ): Promise<ExecutionResult> {
    const agent = this.orchestrator.getRuntime().getAgentByName(step.agent);
    if (!agent) {
      throw new Error(`Agent not found: ${step.agent}`);
    }

    const stepTrace = this.createTraceNode(step.id, 'agent', context.input);
    rootTrace.children.push(stepTrace);

    this.logger.info(`Executing step: ${step.id}`, { agent: step.agent });

    const stepInput = {
      initial: context.input,
      previousSteps: Object.fromEntries(context.stepOutputs),
    };

    const result = await this.orchestrator.executeTask(agent.id, stepInput);

    stepTrace.completedAt = new Date();
    stepTrace.duration = stepTrace.completedAt.getTime() - stepTrace.startedAt.getTime();
    stepTrace.output = result.output;

    if (result.status === 'failed' || result.status === 'timeout') {
      stepTrace.error = result.error?.message;
      throw new Error(`Step failed: ${step.id} - ${result.error?.message}`);
    }

    this.emitter.emit('workflow:step:completed', {
      executionId: context.executionId,
      stepId: step.id,
      result,
    });

    return result;
  }

  private canExecute(
    stepId: string,
    definition: WorkflowDefinition,
    executed: Set<string>
  ): boolean {
    for (const step of definition.steps) {
      if (step.next) {
        const nextSteps = Array.isArray(step.next) ? step.next : [step.next];
        if (nextSteps.includes(stepId) && !executed.has(step.id)) {
          return false;
        }
      }
    }
    return true;
  }

  private getNextStepIds(
    currentStepIds: string[],
    definition: WorkflowDefinition,
    context: WorkflowContext
  ): string[] {
    const nextIds = new Set<string>();

    for (const currentId of currentStepIds) {
      const step = definition.steps.find((s) => s.id === currentId);
      if (step?.next) {
        const nextSteps = Array.isArray(step.next) ? step.next : [step.next];
        for (const nextId of nextSteps) {
          nextIds.add(nextId);
        }
      }
    }

    return Array.from(nextIds);
  }

  private evaluateCondition(condition: string, context: WorkflowContext): boolean {
    const parts = condition.split('.');
    if (parts.length !== 2) return true;

    const [stepId, property] = parts;
    const output = context.stepOutputs.get(stepId!) as Record<string, unknown> | undefined;

    if (!output) return false;

    if (property === 'success') {
      return output !== null && output !== undefined;
    }

    return Boolean(output[property!]);
  }

  private getWorkflowOutput(
    definition: WorkflowDefinition,
    stepOutputs: Map<string, unknown>
  ): unknown {
    const lastSteps = definition.steps.filter((s) => !s.next);
    if (lastSteps.length === 1) {
      return stepOutputs.get(lastSteps[0]!.id);
    }
    return Object.fromEntries(stepOutputs);
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

  getWorkflow(name: string): WorkflowDefinition | undefined {
    return this.workflowDefinitions.get(name);
  }

  listWorkflows(): string[] {
    return Array.from(this.workflowDefinitions.keys());
  }
}

export function createWorkflowEngine(orchestrator: Orchestrator): WorkflowEngine {
  return new WorkflowEngine(orchestrator);
}
