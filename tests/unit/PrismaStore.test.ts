import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { PrismaStore } from './PrismaStore.js';
import { LogEntry, Trace, CostInfo, ExecutionResult } from '@aethermind/core';

describe('PrismaStore', () => {
  let store: PrismaStore;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    store = new PrismaStore();
    await store.connect();
  });

  afterAll(async () => {
    await store.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.log.deleteMany();
    await prisma.trace.deleteMany();
    await prisma.cost.deleteMany();
    await prisma.execution.deleteMany();
    await prisma.agent.deleteMany();
  });

  describe('Connection', () => {
    it('should connect successfully', async () => {
      expect(store.isConnected()).toBe(true);
    });

    it('should return connection status', () => {
      const isConnected = store.isConnected();
      expect(typeof isConnected).toBe('boolean');
    });
  });

  describe('Logs', () => {
    const createTestLog = (overrides = {}): LogEntry => ({
      id: crypto.randomUUID(),
      level: 'info',
      message: 'Test log message',
      timestamp: new Date(),
      ...overrides,
    });

    it('should create log entry', async () => {
      const log = createTestLog();
      await store.addLog(log);

      const logs = await store.getLogs({ limit: 10 });
      expect(logs.data).toHaveLength(1);
      expect(logs.data[0].message).toBe('Test log message');
    });

    it('should retrieve logs with pagination', async () => {
      for (let i = 0; i < 15; i++) {
        await store.addLog(createTestLog({ message: `Log ${i}` }));
      }

      const page1 = await store.getLogs({ limit: 10, offset: 0 });
      expect(page1.data).toHaveLength(10);
      expect(page1.total).toBe(15);
      expect(page1.hasMore).toBe(true);

      const page2 = await store.getLogs({ limit: 10, offset: 10 });
      expect(page2.data).toHaveLength(5);
      expect(page2.hasMore).toBe(false);
    });

    it('should filter logs by level', async () => {
      await store.addLog(createTestLog({ level: 'info' }));
      await store.addLog(createTestLog({ level: 'error' }));
      await store.addLog(createTestLog({ level: 'warn' }));

      const errorLogs = await store.getLogs({ level: 'error' });
      expect(errorLogs.data).toHaveLength(1);
      expect(errorLogs.data[0].level).toBe('error');
    });

    it('should filter logs by executionId', async () => {
      const executionId = crypto.randomUUID();
      await store.addLog(createTestLog({ executionId }));
      await store.addLog(createTestLog({ executionId: crypto.randomUUID() }));

      const logs = await store.getLogs({ executionId });
      expect(logs.data).toHaveLength(1);
      expect(logs.data[0].executionId).toBe(executionId);
    });

    it('should filter logs by agentId', async () => {
      const agentId = crypto.randomUUID();
      await prisma.agent.create({
        data: { id: agentId, name: 'Test Agent', model: 'gpt-4' },
      });

      await store.addLog(createTestLog({ agentId }));
      await store.addLog(createTestLog({ agentId: crypto.randomUUID() }));

      const logs = await store.getLogs({ agentId });
      expect(logs.data).toHaveLength(1);
      expect(logs.data[0].agentId).toBe(agentId);
    });

    it('should enforce max limit of 1000', async () => {
      const logs = await store.getLogs({ limit: 5000 });
      expect(logs.limit).toBe(1000);
    });

    it('should return logs ordered by timestamp desc', async () => {
      const now = new Date();
      await store.addLog(createTestLog({ message: 'First', timestamp: new Date(now.getTime() - 2000) }));
      await store.addLog(createTestLog({ message: 'Third', timestamp: new Date(now.getTime() + 2000) }));
      await store.addLog(createTestLog({ message: 'Second', timestamp: now }));

      const logs = await store.getLogs();
      expect(logs.data[0].message).toBe('Third');
      expect(logs.data[1].message).toBe('Second');
      expect(logs.data[2].message).toBe('First');
    });

    it('should handle logs with metadata', async () => {
      const metadata = { userId: '123', action: 'login' };
      await store.addLog(createTestLog({ metadata }));

      const logs = await store.getLogs();
      expect(logs.data[0].metadata).toEqual(metadata);
    });

    it('should get log count', async () => {
      await store.addLog(createTestLog());
      await store.addLog(createTestLog());

      const count = await store.getLogCount();
      expect(count).toBe(2);
    });

    it('should clear all logs', async () => {
      await store.addLog(createTestLog());
      await store.addLog(createTestLog());
      await store.clearLogs();

      const count = await store.getLogCount();
      expect(count).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      const invalidLog = { id: 'invalid-uuid' } as any;
      await expect(store.addLog(invalidLog)).resolves.not.toThrow();
    });
  });

  describe('Executions', () => {
    const createTestExecution = (overrides = {}): ExecutionResult => ({
      executionId: crypto.randomUUID(),
      agentId: crypto.randomUUID(),
      status: 'completed',
      output: { result: 'success' },
      startedAt: new Date(),
      completedAt: new Date(),
      duration: 1000,
      ...overrides,
    });

    beforeEach(async () => {
      const agentId = crypto.randomUUID();
      await prisma.agent.create({
        data: { id: agentId, name: 'Test Agent', model: 'gpt-4' },
      });
    });

    it('should create execution', async () => {
      const execution = createTestExecution();
      await store.addExecution(execution);

      const retrieved = await store.getExecution(execution.executionId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.status).toBe('completed');
    });

    it('should update execution status', async () => {
      const execution = createTestExecution({ status: 'running' });
      await store.addExecution(execution);

      const updated = { ...execution, status: 'completed', completedAt: new Date() };
      await store.addExecution(updated);

      const retrieved = await store.getExecution(execution.executionId);
      expect(retrieved?.status).toBe('completed');
    });

    it('should retrieve execution by id', async () => {
      const execution = createTestExecution();
      await store.addExecution(execution);

      const retrieved = await store.getExecution(execution.executionId);
      expect(retrieved?.executionId).toBe(execution.executionId);
      expect(retrieved?.agentId).toBe(execution.agentId);
    });

    it('should return undefined for non-existent execution', async () => {
      const result = await store.getExecution(crypto.randomUUID());
      expect(result).toBeUndefined();
    });

    it('should get all executions with limit', async () => {
      for (let i = 0; i < 150; i++) {
        await store.addExecution(createTestExecution());
      }

      const executions = await store.getAllExecutions();
      expect(executions.length).toBe(100);
    });

    it('should get executions by agentId', async () => {
      const agentId = crypto.randomUUID();
      await prisma.agent.create({
        data: { id: agentId, name: 'Agent 2', model: 'gpt-3.5-turbo' },
      });

      await store.addExecution(createTestExecution({ agentId }));
      await store.addExecution(createTestExecution({ agentId }));
      await store.addExecution(createTestExecution());

      const executions = await store.getExecutionsByAgent(agentId);
      expect(executions).toHaveLength(2);
      executions.forEach(exec => expect(exec.agentId).toBe(agentId));
    });

    it('should order executions by startedAt desc', async () => {
      const now = new Date();
      await store.addExecution(createTestExecution({ startedAt: new Date(now.getTime() - 2000) }));
      await store.addExecution(createTestExecution({ startedAt: new Date(now.getTime() + 2000) }));

      const executions = await store.getAllExecutions();
      expect(executions[0].startedAt.getTime()).toBeGreaterThan(executions[1].startedAt.getTime());
    });

    it('should store execution with error', async () => {
      const execution = createTestExecution({
        status: 'failed',
        error: new Error('Test error'),
      });
      await store.addExecution(execution);

      const retrieved = await store.getExecution(execution.executionId);
      expect(retrieved?.status).toBe('failed');
      expect(retrieved?.error?.message).toBe('Test error');
    });

    it('should cascade delete logs when execution deleted', async () => {
      const execution = createTestExecution();
      await store.addExecution(execution);

      const log = {
        id: crypto.randomUUID(),
        executionId: execution.executionId,
        level: 'info',
        message: 'Test',
        timestamp: new Date(),
      };
      await store.addLog(log);

      await prisma.execution.delete({ where: { id: execution.executionId } });

      const logs = await store.getLogs({ executionId: execution.executionId });
      expect(logs.data).toHaveLength(0);
    });

    it('should cascade delete traces when execution deleted', async () => {
      const execution = createTestExecution();
      await store.addExecution(execution);

      const trace: Trace = {
        id: crypto.randomUUID(),
        executionId: execution.executionId,
        rootNode: { type: 'root', children: [] },
        createdAt: new Date(),
      };
      await store.addTrace(trace);

      await prisma.execution.delete({ where: { id: execution.executionId } });

      const retrieved = await store.getTrace(execution.executionId);
      expect(retrieved).toBeUndefined();
    });

    it('should cascade delete costs when execution deleted', async () => {
      const execution = createTestExecution();
      await store.addExecution(execution);

      const cost: CostInfo = {
        executionId: execution.executionId,
        model: 'gpt-4',
        tokens: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        cost: 0.015,
        currency: 'USD',
      };
      await store.addCost(cost);

      await prisma.execution.delete({ where: { id: execution.executionId } });

      const costs = await store.getCosts({ executionId: execution.executionId });
      expect(costs.data).toHaveLength(0);
    });
  });

  describe('Traces', () => {
    const createTestTrace = (overrides = {}): Trace => ({
      id: crypto.randomUUID(),
      executionId: crypto.randomUUID(),
      rootNode: {
        type: 'workflow',
        name: 'Test Workflow',
        children: [
          { type: 'step', name: 'Step 1', children: [] },
          { type: 'step', name: 'Step 2', children: [] },
        ],
      },
      createdAt: new Date(),
      ...overrides,
    });

    it('should store trace tree', async () => {
      const trace = createTestTrace();
      await store.addTrace(trace);

      const retrieved = await store.getTrace(trace.executionId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.rootNode.type).toBe('workflow');
    });

    it('should retrieve trace by executionId', async () => {
      const trace = createTestTrace();
      await store.addTrace(trace);

      const retrieved = await store.getTrace(trace.executionId);
      expect(retrieved?.executionId).toBe(trace.executionId);
      expect(retrieved?.rootNode.children).toHaveLength(2);
    });

    it('should upsert trace on duplicate', async () => {
      const trace = createTestTrace();
      await store.addTrace(trace);

      const updated = {
        ...trace,
        rootNode: { ...trace.rootNode, name: 'Updated Workflow' },
      };
      await store.addTrace(updated);

      const retrieved = await store.getTrace(trace.executionId);
      expect(retrieved?.rootNode.name).toBe('Updated Workflow');
    });

    it('should get all traces with limit', async () => {
      for (let i = 0; i < 150; i++) {
        await store.addTrace(createTestTrace());
      }

      const traces = await store.getAllTraces();
      expect(traces.length).toBe(100);
    });

    it('should order traces by createdAt desc', async () => {
      const now = new Date();
      await store.addTrace(createTestTrace({ createdAt: new Date(now.getTime() - 2000) }));
      await store.addTrace(createTestTrace({ createdAt: new Date(now.getTime() + 2000) }));

      const traces = await store.getAllTraces();
      expect(traces[0].createdAt.getTime()).toBeGreaterThan(traces[1].createdAt.getTime());
    });

    it('should return undefined for non-existent trace', async () => {
      const result = await store.getTrace(crypto.randomUUID());
      expect(result).toBeUndefined();
    });

    it('should preserve complex trace tree structure', async () => {
      const trace = createTestTrace({
        rootNode: {
          type: 'workflow',
          name: 'Complex',
          children: [
            {
              type: 'parallel',
              children: [
                { type: 'step', name: 'A', children: [] },
                { type: 'step', name: 'B', children: [] },
              ],
            },
          ],
        },
      });
      await store.addTrace(trace);

      const retrieved = await store.getTrace(trace.executionId);
      expect(retrieved?.rootNode.children[0].type).toBe('parallel');
      expect(retrieved?.rootNode.children[0].children).toHaveLength(2);
    });
  });

  describe('Costs', () => {
    const createTestCost = (overrides = {}): CostInfo => ({
      executionId: crypto.randomUUID(),
      model: 'gpt-4',
      tokens: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      cost: 0.015,
      currency: 'USD',
      ...overrides,
    });

    it('should accumulate costs per execution', async () => {
      const executionId = crypto.randomUUID();
      await store.addCost(createTestCost({ executionId, cost: 0.01 }));
      await store.addCost(createTestCost({ executionId, cost: 0.02 }));

      const costs = await store.getCosts({ executionId });
      expect(costs.data).toHaveLength(2);
      const total = costs.data.reduce((sum, c) => sum + c.cost, 0);
      expect(total).toBeCloseTo(0.03, 2);
    });

    it('should track costs per model', async () => {
      await store.addCost(createTestCost({ model: 'gpt-4', cost: 0.015 }));
      await store.addCost(createTestCost({ model: 'gpt-3.5-turbo', cost: 0.002 }));
      await store.addCost(createTestCost({ model: 'gpt-4', cost: 0.020 }));

      const byModel = await store.getCostByModel();
      expect(byModel['gpt-4']).toBeCloseTo(0.035, 2);
      expect(byModel['gpt-3.5-turbo']).toBeCloseTo(0.002, 2);
    });

    it('should filter costs by executionId', async () => {
      const executionId = crypto.randomUUID();
      await store.addCost(createTestCost({ executionId }));
      await store.addCost(createTestCost());

      const costs = await store.getCosts({ executionId });
      expect(costs.data).toHaveLength(1);
      expect(costs.data[0].executionId).toBe(executionId);
    });

    it('should filter costs by model', async () => {
      await store.addCost(createTestCost({ model: 'gpt-4' }));
      await store.addCost(createTestCost({ model: 'gpt-3.5-turbo' }));

      const costs = await store.getCosts({ model: 'gpt-4' });
      expect(costs.data).toHaveLength(1);
      expect(costs.data[0].model).toBe('gpt-4');
    });

    it('should paginate costs', async () => {
      for (let i = 0; i < 15; i++) {
        await store.addCost(createTestCost());
      }

      const page1 = await store.getCosts({ limit: 10, offset: 0 });
      expect(page1.data).toHaveLength(10);
      expect(page1.hasMore).toBe(true);

      const page2 = await store.getCosts({ limit: 10, offset: 10 });
      expect(page2.data).toHaveLength(5);
      expect(page2.hasMore).toBe(false);
    });

    it('should enforce max limit of 1000', async () => {
      const costs = await store.getCosts({ limit: 5000 });
      expect(costs.limit).toBe(1000);
    });

    it('should get total cost', async () => {
      await store.addCost(createTestCost({ cost: 0.01 }));
      await store.addCost(createTestCost({ cost: 0.02 }));
      await store.addCost(createTestCost({ cost: 0.03 }));

      const total = await store.getTotalCost();
      expect(total).toBeCloseTo(0.06, 2);
    });

    it('should order costs by createdAt desc', async () => {
      await store.addCost(createTestCost({ cost: 0.01 }));
      await new Promise(resolve => setTimeout(resolve, 10));
      await store.addCost(createTestCost({ cost: 0.02 }));

      const costs = await store.getCosts();
      expect(costs.data[0].cost).toBe(0.02);
    });

    it('should handle decimal precision', async () => {
      await store.addCost(createTestCost({ cost: 0.123456 }));

      const costs = await store.getCosts();
      expect(costs.data[0].cost).toBeCloseTo(0.123456, 6);
    });

    it('should store token counts', async () => {
      const cost = createTestCost({
        tokens: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
      });
      await store.addCost(cost);

      const costs = await store.getCosts();
      expect(costs.data[0].tokens.promptTokens).toBe(200);
      expect(costs.data[0].tokens.completionTokens).toBe(100);
      expect(costs.data[0].tokens.totalTokens).toBe(300);
    });

    it('should handle zero costs', async () => {
      await store.addCost(createTestCost({ cost: 0 }));

      const total = await store.getTotalCost();
      expect(total).toBe(0);
    });
  });
});
