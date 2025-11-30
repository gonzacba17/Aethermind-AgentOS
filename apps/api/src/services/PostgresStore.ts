/**
 * PostgresStore Type Definitions
 * 
 * This file contains type definitions for the store interface.
 * The actual implementation is in PrismaStore.ts
 */

import type { LogEntry, Trace, CostInfo, ExecutionResult } from '@aethermind/core';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface AgentRecord {
  id: string;
  userId: string;
  name: string;
  model: string;
  config: any;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StoreInterface {
  // Agents
  addAgent(agent: AgentRecord): void | Promise<void>;
  getAgents(options?: {
    userId?: string;
    limit?: number;
    offset?: number;
  }): PaginatedResult<AgentRecord> | Promise<PaginatedResult<AgentRecord>>;
  getAgent(id: string): AgentRecord | undefined | Promise<AgentRecord | undefined>;
  deleteAgent(id: string): boolean | Promise<boolean>;

  // Logs
  addLog(entry: LogEntry): void | Promise<void>;
  getLogs(options?: {
    level?: string;
    agentId?: string;
    executionId?: string;
    limit?: number;
    offset?: number;
  }): PaginatedResult<LogEntry> | Promise<PaginatedResult<LogEntry>>;
  getLogCount(): number | Promise<number>;
  clearLogs(): void | Promise<void>;

  // Traces
  addTrace(trace: Trace): void | Promise<void>;
  getTrace(executionId: string): Trace | undefined | Promise<Trace | undefined>;
  getAllTraces(): Trace[] | Promise<Trace[]>;

  // Costs
  addCost(cost: CostInfo): void | Promise<void>;
  getCosts(options?: {
    executionId?: string;
    model?: string;
    limit?: number;
    offset?: number;
  }): PaginatedResult<CostInfo> | Promise<PaginatedResult<CostInfo>>;
  getTotalCost(): number | Promise<number>;
  getCostByModel(): Record<string, number> | Promise<Record<string, number>>;

  // Executions
  addExecution(result: ExecutionResult & { userId: string }): void | Promise<void>;
  getExecution(executionId: string): ExecutionResult | undefined | Promise<ExecutionResult | undefined>;
  getAllExecutions(): ExecutionResult[] | Promise<ExecutionResult[]>;
  getExecutionsByAgent(agentId: string): ExecutionResult[] | Promise<ExecutionResult[]>;
}
