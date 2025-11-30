import type { LogEntry, Trace, CostInfo, ExecutionResult } from '@aethermind/core';
import type { StoreInterface, PaginatedResult, AgentRecord } from './PostgresStore';

export class InMemoryStore implements StoreInterface {
  private agents: Map<string, AgentRecord> = new Map();
  private logs: LogEntry[] = [];
  private traces: Map<string, Trace> = new Map();
  private costs: CostInfo[] = [];
  private executions: Map<string, ExecutionResult> = new Map();
  private maxLogs = 10000;

  addAgent(agent: AgentRecord): void {
    this.agents.set(agent.id, agent);
  }

  getAgents(options: {
    userId?: string;
    limit?: number;
    offset?: number;
  } = {}): PaginatedResult<AgentRecord> {
    const offset = options.offset || 0;
    const limit = options.limit || 100;

    let filtered = Array.from(this.agents.values());
    if (options.userId) {
      filtered = filtered.filter(a => a.userId === options.userId);
    }

    const total = filtered.length;
    const data = filtered.slice(offset, offset + limit);

    return { data, total, offset, limit, hasMore: offset + limit < total };
  }

  getAgent(id: string): AgentRecord | undefined {
    return this.agents.get(id);
  }

  deleteAgent(id: string): boolean {
    return this.agents.delete(id);
  }

  addLog(entry: LogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  getLogs(options: {
    level?: string;
    agentId?: string;
    executionId?: string;
    limit?: number;
    offset?: number;
  } = {}): PaginatedResult<LogEntry> {
    const offset = options.offset || 0;
    const limit = options.limit || 100;

    let filtered = [...this.logs];

    if (options.level) {
      filtered = filtered.filter((l) => l.level === options.level);
    }
    if (options.agentId) {
      filtered = filtered.filter((l) => l.agentId === options.agentId);
    }
    if (options.executionId) {
      filtered = filtered.filter((l) => l.executionId === options.executionId);
    }

    const total = filtered.length;
    const data = filtered.slice(offset, offset + limit);

    return {
      data,
      total,
      offset,
      limit,
      hasMore: offset + limit < total
    };
  }

  getLogCount(): number {
    return this.logs.length;
  }

  clearLogs(): void {
    this.logs = [];
  }

  addTrace(trace: Trace): void {
    this.traces.set(trace.executionId, trace);
  }

  getTrace(executionId: string): Trace | undefined {
    return this.traces.get(executionId);
  }

  getAllTraces(): Trace[] {
    return Array.from(this.traces.values());
  }

  addCost(cost: CostInfo): void {
    this.costs.push(cost);
  }

  getCosts(options: {
    executionId?: string;
    model?: string;
    limit?: number;
    offset?: number;
  } = {}): PaginatedResult<CostInfo> {
    const offset = options.offset || 0;
    const limit = options.limit || 100;

    let filtered = [...this.costs];

    if (options.executionId) {
      filtered = filtered.filter((c) => c.executionId === options.executionId);
    }
    if (options.model) {
      filtered = filtered.filter((c) => c.model === options.model);
    }

    const total = filtered.length;
    const data = filtered.slice(offset, offset + limit);

    return {
      data,
      total,
      offset,
      limit,
      hasMore: offset + limit < total
    };
  }

  getTotalCost(): number {
    return this.costs.reduce((sum, c) => sum + c.cost, 0);
  }

  getCostByModel(): Record<string, number> {
    const byModel: Record<string, number> = {};
    for (const cost of this.costs) {
      byModel[cost.model] = (byModel[cost.model] || 0) + cost.cost;
    }
    return byModel;
  }

  addExecution(result: ExecutionResult & { userId: string }): void {
    this.executions.set(result.executionId, result);
  }

  getExecution(executionId: string): ExecutionResult | undefined {
    return this.executions.get(executionId);
  }

  getAllExecutions(): ExecutionResult[] {
    return Array.from(this.executions.values());
  }

  getExecutionsByAgent(agentId: string): ExecutionResult[] {
    return Array.from(this.executions.values()).filter(
      (e) => e.agentId === agentId
    );
  }
}
