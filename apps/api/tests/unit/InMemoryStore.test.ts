import { InMemoryStore } from '../../src/services/InMemoryStore';
import type { LogEntry, Trace, CostInfo, ExecutionResult } from '@aethermind/core';

describe('InMemoryStore', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  describe('Log Management', () => {
    it('adds and retrieves logs', () => {
      const log: LogEntry = {
        timestamp: new Date(),
        level: 'info',
        message: 'Test log',
        agentId: 'agent-1',
        executionId: 'exec-1'
      };

      store.addLog(log);
      const result = store.getLogs();

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(log);
      expect(result.total).toBe(1);
    });

    it('filters logs by level', () => {
      store.addLog({ timestamp: new Date(), level: 'info', message: 'Info log', agentId: 'agent-1' });
      store.addLog({ timestamp: new Date(), level: 'error', message: 'Error log', agentId: 'agent-1' });
      store.addLog({ timestamp: new Date(), level: 'info', message: 'Another info', agentId: 'agent-1' });

      const result = store.getLogs({ level: 'info' });

      expect(result.data).toHaveLength(2);
      expect(result.data.every(log => log.level === 'info')).toBe(true);
    });

    it('filters logs by agentId', () => {
      store.addLog({ timestamp: new Date(), level: 'info', message: 'Log 1', agentId: 'agent-1' });
      store.addLog({ timestamp: new Date(), level: 'info', message: 'Log 2', agentId: 'agent-2' });
      store.addLog({ timestamp: new Date(), level: 'info', message: 'Log 3', agentId: 'agent-1' });

      const result = store.getLogs({ agentId: 'agent-1' });

      expect(result.data).toHaveLength(2);
      expect(result.data.every(log => log.agentId === 'agent-1')).toBe(true);
    });

    it('filters logs by executionId', () => {
      store.addLog({ timestamp: new Date(), level: 'info', message: 'Log 1', agentId: 'agent-1', executionId: 'exec-1' });
      store.addLog({ timestamp: new Date(), level: 'info', message: 'Log 2', agentId: 'agent-1', executionId: 'exec-2' });

      const result = store.getLogs({ executionId: 'exec-1' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].executionId).toBe('exec-1');
    });

    it('paginates logs correctly', () => {
      for (let i = 0; i < 10; i++) {
        store.addLog({ timestamp: new Date(), level: 'info', message: `Log ${i}`, agentId: 'agent-1' });
      }

      const page1 = store.getLogs({ limit: 5, offset: 0 });
      expect(page1.data).toHaveLength(5);
      expect(page1.hasMore).toBe(true);

      const page2 = store.getLogs({ limit: 5, offset: 5 });
      expect(page2.data).toHaveLength(5);
      expect(page2.hasMore).toBe(false);
    });

    it('enforces max log limit', () => {
      for (let i = 0; i < 10100; i++) {
        store.addLog({ timestamp: new Date(), level: 'info', message: `Log ${i}`, agentId: 'agent-1' });
      }

      const count = store.getLogCount();
      expect(count).toBeLessThanOrEqual(10000);
    });

    it('clears all logs', () => {
      store.addLog({ timestamp: new Date(), level: 'info', message: 'Log', agentId: 'agent-1' });
      expect(store.getLogCount()).toBe(1);

      store.clearLogs();
      expect(store.getLogCount()).toBe(0);
    });
  });

  describe('Trace Management', () => {
    it('adds and retrieves trace', () => {
      const trace: Trace = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        startTime: Date.now(),
        endTime: Date.now() + 1000,
        status: 'completed',
        steps: []
      };

      store.addTrace(trace);
      const retrieved = store.getTrace('exec-1');

      expect(retrieved).toEqual(trace);
    });

    it('returns undefined for non-existent trace', () => {
      const trace = store.getTrace('non-existent');
      expect(trace).toBeUndefined();
    });

    it('retrieves all traces', () => {
      const trace1: Trace = { executionId: 'exec-1', agentId: 'agent-1', startTime: Date.now(), status: 'completed', steps: [] };
      const trace2: Trace = { executionId: 'exec-2', agentId: 'agent-2', startTime: Date.now(), status: 'failed', steps: [] };

      store.addTrace(trace1);
      store.addTrace(trace2);

      const all = store.getAllTraces();
      expect(all).toHaveLength(2);
    });
  });

  describe('Cost Management', () => {
    it('adds and retrieves costs', () => {
      const cost: CostInfo = {
        executionId: 'exec-1',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.015
      };

      store.addCost(cost);
      const result = store.getCosts();

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(cost);
    });

    it('filters costs by executionId', () => {
      store.addCost({ executionId: 'exec-1', model: 'gpt-4', inputTokens: 100, outputTokens: 50, cost: 0.015 });
      store.addCost({ executionId: 'exec-2', model: 'gpt-4', inputTokens: 100, outputTokens: 50, cost: 0.015 });

      const result = store.getCosts({ executionId: 'exec-1' });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].executionId).toBe('exec-1');
    });

    it('filters costs by model', () => {
      store.addCost({ executionId: 'exec-1', model: 'gpt-4', inputTokens: 100, outputTokens: 50, cost: 0.015 });
      store.addCost({ executionId: 'exec-2', model: 'gpt-3.5-turbo', inputTokens: 100, outputTokens: 50, cost: 0.002 });

      const result = store.getCosts({ model: 'gpt-4' });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].model).toBe('gpt-4');
    });

    it('calculates total cost', () => {
      store.addCost({ executionId: 'exec-1', model: 'gpt-4', inputTokens: 100, outputTokens: 50, cost: 0.015 });
      store.addCost({ executionId: 'exec-2', model: 'gpt-4', inputTokens: 100, outputTokens: 50, cost: 0.010 });

      const total = store.getTotalCost();
      expect(total).toBeCloseTo(0.025, 3);
    });

    it('calculates cost by model', () => {
      store.addCost({ executionId: 'exec-1', model: 'gpt-4', inputTokens: 100, outputTokens: 50, cost: 0.015 });
      store.addCost({ executionId: 'exec-2', model: 'gpt-4', inputTokens: 100, outputTokens: 50, cost: 0.010 });
      store.addCost({ executionId: 'exec-3', model: 'gpt-3.5-turbo', inputTokens: 100, outputTokens: 50, cost: 0.002 });

      const byModel = store.getCostByModel();
      expect(byModel['gpt-4']).toBeCloseTo(0.025, 3);
      expect(byModel['gpt-3.5-turbo']).toBeCloseTo(0.002, 3);
    });
  });

  describe('Execution Management', () => {
    it('adds and retrieves execution', () => {
      const execution: ExecutionResult = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        success: true,
        startTime: Date.now(),
        endTime: Date.now() + 1000
      };

      store.addExecution(execution);
      const retrieved = store.getExecution('exec-1');

      expect(retrieved).toEqual(execution);
    });

    it('returns undefined for non-existent execution', () => {
      const execution = store.getExecution('non-existent');
      expect(execution).toBeUndefined();
    });

    it('retrieves all executions', () => {
      const exec1: ExecutionResult = { executionId: 'exec-1', agentId: 'agent-1', success: true, startTime: Date.now(), endTime: Date.now() };
      const exec2: ExecutionResult = { executionId: 'exec-2', agentId: 'agent-2', success: false, startTime: Date.now(), endTime: Date.now() };

      store.addExecution(exec1);
      store.addExecution(exec2);

      const all = store.getAllExecutions();
      expect(all).toHaveLength(2);
    });

    it('filters executions by agentId', () => {
      store.addExecution({ executionId: 'exec-1', agentId: 'agent-1', success: true, startTime: Date.now(), endTime: Date.now() });
      store.addExecution({ executionId: 'exec-2', agentId: 'agent-2', success: true, startTime: Date.now(), endTime: Date.now() });
      store.addExecution({ executionId: 'exec-3', agentId: 'agent-1', success: false, startTime: Date.now(), endTime: Date.now() });

      const byAgent = store.getExecutionsByAgent('agent-1');
      expect(byAgent).toHaveLength(2);
      expect(byAgent.every(e => e.agentId === 'agent-1')).toBe(true);
    });
  });
});
