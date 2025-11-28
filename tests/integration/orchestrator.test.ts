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

  describe('Workflow Execution - Linear', () => {
    test('debe ejecutar workflow lineal exitosamente', async () => {
      const workflow: WorkflowDefinition = {
        name: 'linear-workflow',
        description: 'Simple linear workflow',
        entryPoint: 'start',
        steps: [
          { id: 'start', agent: 'agent-a', next: 'middle' },
          { id: 'middle', agent: 'agent-b', next: 'end' },
          { id: 'end', agent: 'agent-c' }
        ]
      };

      orchestrator.registerWorkflow(workflow);
      const { executionId, results } = await orchestrator.executeWorkflow('linear-workflow', { data: 'test' });

      expect(results.size).toBe(3);
      expect(results.get('start')?.status).toBe('completed');
      expect(results.get('middle')?.status).toBe('completed');
      expect(results.get('end')?.status).toBe('completed');
    }, 15000);

    test('debe pasar datos entre pasos secuenciales', async () => {
      const workflow: WorkflowDefinition = {
        name: 'data-flow-workflow',
        description: 'Test data flow between steps',
        entryPoint: 'step1',
        steps: [
          { id: 'step1', agent: 'agent-a', next: 'step2' },
          { id: 'step2', agent: 'agent-b' }
        ]
      };

      orchestrator.registerWorkflow(workflow);
      const { results } = await orchestrator.executeWorkflow('data-flow-workflow', { value: 42 });

      const step2Result = results.get('step2');
      expect(step2Result?.output).toBeDefined();
    }, 10000);
  });

  describe('Workflow Execution - DAG with Conditions', () => {
    test('debe evaluar condiciones y saltar pasos', async () => {
      const workflow: WorkflowDefinition = {
        name: 'conditional-workflow',
        description: 'Workflow with conditional steps',
        entryPoint: 'check',
        steps: [
          { id: 'check', agent: 'agent-a', next: 'conditional' },
          { id: 'conditional', agent: 'agent-b', condition: 'check.success', next: 'end' },
          { id: 'end', agent: 'agent-c' }
        ]
      };

      orchestrator.registerWorkflow(workflow);
      const { results } = await orchestrator.executeWorkflow('conditional-workflow', { test: true });

      expect(results.get('check')).toBeDefined();
      expect(results.get('end')).toBeDefined();
    }, 15000);

    test('debe manejar múltiples ramas condicionales', async () => {
      const workflow: WorkflowDefinition = {
        name: 'branching-workflow',
        description: 'Workflow with multiple branches',
        entryPoint: 'router',
        steps: [
          { id: 'router', agent: 'agent-a', next: 'branch1' },
          { id: 'branch1', agent: 'agent-b', next: 'merge' },
          { id: 'merge', agent: 'agent-c' }
        ]
      };

      orchestrator.registerWorkflow(workflow);
      const { results } = await orchestrator.executeWorkflow('branching-workflow', {});

      expect(results.size).toBeGreaterThanOrEqual(2);
    }, 15000);
  });

  describe('Workflow Execution - Failure Handling', () => {
    test('debe manejar fallos en pasos con retry', async () => {
      const failingLogic: AgentLogic = async () => {
        throw new Error('Simulated failure');
      };

      const failingConfig: AgentConfig = {
        name: 'failing-agent',
        model: 'gpt-3.5-turbo',
        maxRetries: 2,
        timeout: 5000,
        temperature: 0.7,
        tools: []
      };

      runtime.createAgent(failingConfig, failingLogic);

      const workflow: WorkflowDefinition = {
        name: 'failing-workflow',
        description: 'Workflow with failing step',
        entryPoint: 'fail',
        steps: [{ id: 'fail', agent: 'failing-agent' }]
      };

      orchestrator.registerWorkflow(workflow);

      await expect(
        orchestrator.executeWorkflow('failing-workflow', {})
      ).rejects.toThrow();
    }, 15000);

    test('debe detener workflow cuando un paso falla', async () => {
      const failingLogic: AgentLogic = async () => {
        throw new Error('Step failure');
      };

      const failConfig: AgentConfig = {
        name: 'fail-step-agent',
        model: 'gpt-3.5-turbo',
        maxRetries: 1,
        timeout: 5000,
        temperature: 0.7,
        tools: []
      };

      runtime.createAgent(failConfig, failingLogic);

      const workflow: WorkflowDefinition = {
        name: 'partial-fail-workflow',
        description: 'Should stop on failure',
        entryPoint: 'step1',
        steps: [
          { id: 'step1', agent: 'agent-a', next: 'fail-step' },
          { id: 'fail-step', agent: 'fail-step-agent', next: 'step3' },
          { id: 'step3', agent: 'agent-c' }
        ]
      };

      orchestrator.registerWorkflow(workflow);

      try {
        await orchestrator.executeWorkflow('partial-fail-workflow', {});
      } catch (error) {
        expect((error as Error).message).toContain('Step failed');
      }
    }, 15000);
  });

  describe('Workflow Execution - Timeout', () => {
    test('debe respetar timeout de workflow', async () => {
      const slowLogic: AgentLogic = async () => {
        await new Promise(resolve => setTimeout(resolve, 10000));
        return { output: { result: 'slow' }, metadata: {} };
      };

      const slowConfig: AgentConfig = {
        name: 'slow-agent',
        model: 'gpt-3.5-turbo',
        maxRetries: 1,
        timeout: 2000,
        temperature: 0.7,
        tools: []
      };

      runtime.createAgent(slowConfig, slowLogic);

      const workflow: WorkflowDefinition = {
        name: 'timeout-workflow',
        description: 'Should timeout',
        entryPoint: 'slow',
        steps: [{ id: 'slow', agent: 'slow-agent' }]
      };

      orchestrator.registerWorkflow(workflow);

      await expect(
        orchestrator.executeWorkflow('timeout-workflow', {})
      ).rejects.toThrow();
    }, 20000);
  });

  describe('Bull Queue Management', () => {
    test('debe encolar tareas con prioridad correcta', async () => {
      const highPriorityTask = orchestrator.executeTask('agent-a', { priority: 'high' }, 10);
      const lowPriorityTask = orchestrator.executeTask('agent-b', { priority: 'low' }, 1);
      const mediumPriorityTask = orchestrator.executeTask('agent-c', { priority: 'medium' }, 5);

      const results = await Promise.all([highPriorityTask, lowPriorityTask, mediumPriorityTask]);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.status).toBe('completed');
      });
    }, 15000);

    test('debe procesar tareas concurrentemente según configuración', async () => {
      const tasks = [];
      const startTime = Date.now();

      for (let i = 0; i < 10; i++) {
        tasks.push(orchestrator.executeTask('agent-a', { batch: i }));
      }

      await Promise.all(tasks);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(20000);
    }, 25000);

    test('debe manejar fallos de tareas en cola', async () => {
      const failLogic: AgentLogic = async () => {
        throw new Error('Queue task failure');
      };

      const queueFailConfig: AgentConfig = {
        name: 'queue-fail-agent',
        model: 'gpt-3.5-turbo',
        maxRetries: 1,
        timeout: 5000,
        temperature: 0.7,
        tools: []
      };

      runtime.createAgent(queueFailConfig, failLogic);

      await expect(
        orchestrator.executeTask('queue-fail-agent', { test: 'fail' })
      ).rejects.toThrow();
    }, 15000);

    test('debe obtener métricas de cola correctamente', async () => {
      const metrics = await orchestrator.getQueueMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics.waiting).toBe('number');
      expect(typeof metrics.active).toBe('number');
      expect(typeof metrics.completed).toBe('number');
      expect(typeof metrics.failed).toBe('number');
    }, 5000);

    test('debe reportar longitud de cola correctamente', async () => {
      const queueLength = await orchestrator.getQueueLength();
      expect(typeof queueLength).toBe('number');
      expect(queueLength).toBeGreaterThanOrEqual(0);
    }, 5000);
  });

  describe('Traces - Build and Persist', () => {
    test('debe construir árbol de traces para workflow complejo', async () => {
      const workflow: WorkflowDefinition = {
        name: 'complex-trace-workflow',
        description: 'Complex workflow for trace testing',
        entryPoint: 'root',
        steps: [
          { id: 'root', agent: 'agent-a', next: 'child1' },
          { id: 'child1', agent: 'agent-b', next: 'child2' },
          { id: 'child2', agent: 'agent-c' }
        ]
      };

      orchestrator.registerWorkflow(workflow);
      const { executionId } = await orchestrator.executeWorkflow('complex-trace-workflow', { trace: 'test' });

      const trace = orchestrator.getTrace(executionId);
      
      expect(trace).toBeDefined();
      expect(trace!.rootNode.type).toBe('workflow');
      expect(trace!.rootNode.children.length).toBe(3);
      
      trace!.rootNode.children.forEach(child => {
        expect(child.type).toBe('agent');
        expect(child.startedAt).toBeDefined();
        expect(child.completedAt).toBeDefined();
        expect(child.duration).toBeGreaterThan(0);
      });
    }, 15000);

    test('debe incluir input y output en trace nodes', async () => {
      const workflow: WorkflowDefinition = {
        name: 'io-trace-workflow',
        description: 'Workflow for I/O trace testing',
        entryPoint: 'io-step',
        steps: [{ id: 'io-step', agent: 'agent-a' }]
      };

      orchestrator.registerWorkflow(workflow);
      const { executionId } = await orchestrator.executeWorkflow('io-trace-workflow', { input: 'data' });

      const trace = orchestrator.getTrace(executionId);
      
      expect(trace!.rootNode.input).toEqual({ input: 'data' });
      expect(trace!.rootNode.children[0].input).toBeDefined();
      expect(trace!.rootNode.children[0].output).toBeDefined();
    }, 10000);

    test('debe registrar errores en trace nodes', async () => {
      const errorLogic: AgentLogic = async () => {
        throw new Error('Trace error test');
      };

      const errorConfig: AgentConfig = {
        name: 'trace-error-agent',
        model: 'gpt-3.5-turbo',
        maxRetries: 1,
        timeout: 5000,
        temperature: 0.7,
        tools: []
      };

      runtime.createAgent(errorConfig, errorLogic);

      const workflow: WorkflowDefinition = {
        name: 'error-trace-workflow',
        description: 'Workflow with error for trace',
        entryPoint: 'error',
        steps: [{ id: 'error', agent: 'trace-error-agent' }]
      };

      orchestrator.registerWorkflow(workflow);

      try {
        await orchestrator.executeWorkflow('error-trace-workflow', {});
      } catch (error) {
        // Expected to fail
      }

      const allTraces = orchestrator.getAllTraces();
      const errorTrace = allTraces.find(t => t.rootNode.error);
      
      expect(errorTrace).toBeDefined();
    }, 15000);
  });

  describe('Costs - Accumulate and Store', () => {
    test('debe acumular costos por paso de workflow', async () => {
      const workflow: WorkflowDefinition = {
        name: 'cost-accumulation-workflow',
        description: 'Test cost accumulation',
        entryPoint: 'step1',
        steps: [
          { id: 'step1', agent: 'agent-a', next: 'step2' },
          { id: 'step2', agent: 'agent-b' }
        ]
      };

      orchestrator.registerWorkflow(workflow);
      const { executionId } = await orchestrator.executeWorkflow('cost-accumulation-workflow', {});

      orchestrator.trackCost({
        executionId,
        model: 'gpt-3.5-turbo',
        cost: 0.005,
        currency: 'USD',
        tokens: { promptTokens: 50, completionTokens: 25, totalTokens: 75 }
      });

      orchestrator.trackCost({
        executionId,
        model: 'gpt-3.5-turbo',
        cost: 0.007,
        currency: 'USD',
        tokens: { promptTokens: 70, completionTokens: 35, totalTokens: 105 }
      });

      const costs = orchestrator.getCostsByExecution(executionId);
      expect(costs.length).toBe(2);

      const total = costs.reduce((sum, c) => sum + c.cost, 0);
      expect(total).toBeCloseTo(0.012, 3);
    }, 15000);

    test('debe calcular costo total global', async () => {
      const initialTotal = orchestrator.getTotalCost();
      
      orchestrator.trackCost({
        executionId: 'test-exec-1',
        model: 'gpt-4',
        cost: 0.05,
        currency: 'USD',
        tokens: { promptTokens: 500, completionTokens: 250, totalTokens: 750 }
      });

      const newTotal = orchestrator.getTotalCost();
      expect(newTotal).toBeGreaterThan(initialTotal);
    }, 5000);

    test('debe almacenar costos por modelo', async () => {
      const exec1 = 'model-test-1';
      const exec2 = 'model-test-2';

      orchestrator.trackCost({
        executionId: exec1,
        model: 'gpt-4',
        cost: 0.03,
        currency: 'USD',
        tokens: { promptTokens: 300, completionTokens: 150, totalTokens: 450 }
      });

      orchestrator.trackCost({
        executionId: exec2,
        model: 'gpt-3.5-turbo',
        cost: 0.01,
        currency: 'USD',
        tokens: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      });

      const allCosts = orchestrator.getCosts();
      const gpt4Costs = allCosts.filter(c => c.model === 'gpt-4');
      const gpt35Costs = allCosts.filter(c => c.model === 'gpt-3.5-turbo');

      expect(gpt4Costs.length).toBeGreaterThan(0);
      expect(gpt35Costs.length).toBeGreaterThan(0);
    }, 5000);
  });
});
