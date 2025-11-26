import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { AgentRuntime } from '../../packages/core/src/agent/AgentRuntime.js';
import { Orchestrator } from '../../packages/core/src/orchestrator/Orchestrator.js';
import { TaskQueueService } from '../../packages/core/src/queue/TaskQueueService.js';
import type { AgentConfig, AgentLogic, WorkflowDefinition } from '../../packages/core/src/types/index.js';

describe('Orchestrator Integration Tests', () => {
  let runtime: AgentRuntime;
  let orchestrator: Orchestrator;
  let queueService: TaskQueueService;

  beforeAll(() => {
    // Create TaskQueueService with in-memory Redis (or mock)
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    queueService = new TaskQueueService({ redisUrl, concurrency: 3 });

    runtime = new AgentRuntime({
      maxConcurrentExecutions: 3
    });

    orchestrator = new Orchestrator(runtime, queueService, {
      maxConcurrentAgents: 3
    });

    // Create test agents
    const agentAConfig: AgentConfig = {
      name: 'agent-a',
      model: 'gpt-3.5-turbo',
      maxRetries: 3,
      timeout: 30000,
      temperature: 0.7,
      tools: []
    };

    const agentALogic: AgentLogic = async (input: any) => {
      return {
        output: { result: `A processed: ${JSON.stringify(input)}` },
        metadata: {}
      };
    };

    const agentBConfig: AgentConfig = {
      name: 'agent-b',
      model: 'gpt-3.5-turbo',
      maxRetries: 3,
      timeout: 30000,
      temperature: 0.7,
      tools: []
    };

    const agentBLogic: AgentLogic = async (input: any) => {
      return {
        output: { result: `B processed: ${JSON.stringify(input)}` },
        metadata: {}
      };
    };

    const agentCConfig: AgentConfig = {
      name: 'agent-c',
      model: 'gpt-3.5-turbo',
      maxRetries: 3,
      timeout: 30000,
      temperature: 0.7,
      tools: []
    };

    const agentCLogic: AgentLogic = async (input: any) => {
      return {
        output: { result: `C processed: ${JSON.stringify(input)}` },
        metadata: {}
      };
    };

    runtime.createAgent(agentAConfig, agentALogic);
    runtime.createAgent(agentBConfig, agentBLogic);
    runtime.createAgent(agentCConfig, agentCLogic);
  });

  afterAll(async () => {
    await orchestrator.shutdown();
    await runtime.shutdown();
  });

  test('debe persistir tareas después de restart (simulado)', async () => {
    const tasks = [];
    
    for (let i = 0; i < 5; i++) {
      tasks.push(
        orchestrator.executeTask('agent-a', { testId: i }, i)
      );
    }

    const results = await Promise.all(tasks);

    expect(results).toHaveLength(5);
    results.forEach((result, index) => {
      expect(result.status).toBe('completed');
      expect(result.output).toHaveProperty('result');
    });

    const queueLength = await orchestrator.getQueueLength();
    expect(queueLength).toBe(0);
  }, 10000);

  test('debe ejecutar workflow multi-agente con dependencias', async () => {
    const workflow: WorkflowDefinition = {
      name: 'test-workflow',
      description: 'Test workflow with dependencies',
      entryPoint: 'step1',
      steps: [
        {
          id: 'step1',
          agent: 'agent-a',
          next: 'step2'
        },
        {
          id: 'step2',
          agent: 'agent-b',
          next: 'step3'
        },
        {
          id: 'step3',
          agent: 'agent-c'
        }
      ]
    };

    orchestrator.registerWorkflow(workflow);

    const { executionId, results } = await orchestrator.executeWorkflow(
      'test-workflow',
      { initial: 'test-data' }
    );

    expect(executionId).toBeDefined();
    expect(results.size).toBe(3);
    expect(results.get('step1')?.status).toBe('completed');
    expect(results.get('step2')?.status).toBe('completed');
    expect(results.get('step3')?.status).toBe('completed');

    const trace = orchestrator.getTrace(executionId);
    expect(trace).toBeDefined();
    expect(trace!.rootNode.children).toHaveLength(3);
  }, 15000);

  test('debe calcular costos correctamente para workflow complejo', async () => {
    const workflow: WorkflowDefinition = {
      name: 'cost-tracking-workflow',
      description: 'Workflow for testing cost tracking',
      entryPoint: 'step1',
      steps: [
        {
          id: 'step1',
          agent: 'agent-a',
          next: 'step2'
        },
        {
          id: 'step2',
          agent: 'agent-b'
        }
      ]
    };

    orchestrator.registerWorkflow(workflow);

    const { executionId } = await orchestrator.executeWorkflow(
      'cost-tracking-workflow',
      { test: true }
    );

    orchestrator.trackCost({
      executionId,
      model: 'gpt-3.5-turbo',
      cost: 0.01,
      currency: 'USD',
      tokens: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150
      }
    });

    orchestrator.trackCost({
      executionId,
      model: 'gpt-3.5-turbo',
      cost: 0.02,
      currency: 'USD',
      tokens: {
        promptTokens: 150,
        completionTokens: 75,
        totalTokens: 225
      }
    });

    const executionCosts = orchestrator.getCostsByExecution(executionId);
    expect(executionCosts).toHaveLength(2);

    const totalCost = executionCosts.reduce((sum, c) => sum + c.cost, 0);
    expect(totalCost).toBe(0.03);

    const totalTokens = executionCosts.reduce((sum, c) => sum + c.tokens.totalTokens, 0);
    expect(totalTokens).toBe(375);
  }, 10000);

  test('debe ejecutar tareas en paralelo correctamente', async () => {
    const parallelTasks = [
      { agentId: 'agent-a', input: { id: 1 } },
      { agentId: 'agent-b', input: { id: 2 } },
      { agentId: 'agent-c', input: { id: 3 } }
    ];

    const startTime = Date.now();
    const results = await orchestrator.executeParallel(parallelTasks);
    const duration = Date.now() - startTime;

    expect(results).toHaveLength(3);
    results.forEach(result => {
      expect(result.status).toBe('completed');
    });

    expect(duration).toBeLessThan(5000);
  }, 10000);

  test('debe rastrear traces correctamente', async () => {
    const workflow: WorkflowDefinition = {
      name: 'trace-test-workflow',
      description: 'Workflow for testing traces',
      entryPoint: 'step1',
      steps: [
        {
          id: 'step1',
          agent: 'agent-a',
          next: 'step2'
        },
        {
          id: 'step2',
          agent: 'agent-b'
        }
      ]
    };

    orchestrator.registerWorkflow(workflow);

    const { executionId } = await orchestrator.executeWorkflow(
      'trace-test-workflow',
      { traceTest: true }
    );

    const trace = orchestrator.getTrace(executionId);
    
    expect(trace).toBeDefined();
    expect(trace!.rootNode).toBeDefined();
    expect(trace!.rootNode.name).toBe('trace-test-workflow');
    expect(trace!.rootNode.type).toBe('workflow');
    expect(trace!.rootNode.children).toHaveLength(2);
    expect(trace!.rootNode.completedAt).toBeDefined();
    expect(trace!.rootNode.duration).toBeGreaterThan(0);

    const allTraces = orchestrator.getAllTraces();
    expect(allTraces.length).toBeGreaterThan(0);
  }, 10000);
});
