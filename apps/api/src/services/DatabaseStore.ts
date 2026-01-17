import { db } from '../db';
import { agents, logs, traces, costs, executions } from '../db/schema';
import { eq, and, count as countFn, desc, sql, sum } from 'drizzle-orm';
import type { LogEntry, Trace, CostInfo, ExecutionResult, LogLevel, AgentStatus, TraceNode } from '@aethermind/core';
import type { StoreInterface, PaginatedResult, AgentRecord } from './PostgresStore';
import logger from '../utils/logger';

/**
 * DatabaseStore - Type-safe data access using Drizzle ORM
 * Replaces PrismaStore with Drizzle for enhanced type safety
 */
export class DatabaseStore implements StoreInterface {
  private connected = false;

  constructor() {}

  async connect(): Promise<boolean> {
    try {
      await db.select().from(agents).limit(1);
      this.connected = true;
      logger.info('Database connected successfully');
      return true;
    } catch (error) {
      logger.error('Failed to connect to database', { error });
      this.connected = false;
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getDrizzle(): any {
    return db;
  }

  // Legacy alias for backward compatibility
  getPrisma(): any {
    return db;
  }

  async close(): Promise<void> {
    this.connected = false;
  }

  async addAgent(agent: AgentRecord): Promise<void> {
    try {
      await db.insert(agents).values({
        id: agent.id,
        userId: agent.userId,
        name: agent.name,
        model: agent.model,
        config: agent.config,
      });
    } catch (error) {
      logger.error('Failed to add agent', { error });
    }
  }

  async getAgents(options: {
    userId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<PaginatedResult<AgentRecord>> {
    try {
      const limit = Math.min(options.limit || 100, 1000);
      const offset = options.offset || 0;

      const whereConditions = options.userId ? [eq(agents.userId, options.userId)] : [];
      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      const [data, totalResult] = await Promise.all([
        db.select()
          .from(agents)
          .where(whereClause)
          .orderBy(desc(agents.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: countFn() })
          .from(agents)
          .where(whereClause),
      ]);

      const total = totalResult[0]?.count || 0;

      return {
        data: data.map((agent: any) => ({
          id: agent.id,
          userId: agent.userId,
          name: agent.name,
          model: agent.model,
          config: agent.config,
          createdAt: agent.createdAt || undefined,
          updatedAt: agent.updatedAt || undefined,
        })),
        total: Number(total),
        offset,
        limit,
        hasMore: offset + limit < Number(total),
      };
    } catch (error) {
      logger.error('Failed to get agents', { error });
      return {
        data: [],
        total: 0,
        offset: options.offset || 0,
        limit: options.limit || 100,
        hasMore: false,
      };
    }
  }

  async getAgent(id: string): Promise<AgentRecord | undefined> {
    try {
      const [agent] = await db.select()
        .from(agents)
        .where(eq(agents.id, id))
        .limit(1);

      if (!agent) return undefined;

      return {
        id: agent.id,
        userId: agent.userId,
        name: agent.name,
        model: agent.model,
        config: agent.config,
        createdAt: agent.createdAt || undefined,
        updatedAt: agent.updatedAt || undefined,
      };
    } catch (error) {
      logger.error('Failed to get agent', { error });
      return undefined;
    }
  }

  async deleteAgent(id: string): Promise<boolean> {
    try {
      await db.delete(agents).where(eq(agents.id, id));
      return true;
    } catch (error) {
      console.error('Failed to delete agent:', error);
      return false;
    }
  }

  async addLog(entry: LogEntry): Promise<void> {
    try {
      await db.insert(logs).values({
        id: entry.id,
        executionId: entry.executionId || null,
        agentId: entry.agentId || null,
        level: entry.level,
        message: entry.message,
        metadata: entry.metadata ?? null,
        timestamp: entry.timestamp,
      });
    } catch (error) {
      logger.error('Failed to add log', { error });
    }
  }

  async getLogs(options: {
    level?: string;
    agentId?: string;
    executionId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<PaginatedResult<LogEntry>> {
    try {
      const limit = Math.min(options.limit || 100, 1000);
      const offset = options.offset || 0;

      const whereConditions = [];
      if (options.level) whereConditions.push(eq(logs.level, options.level));
      if (options.agentId) whereConditions.push(eq(logs.agentId, options.agentId));
      if (options.executionId) whereConditions.push(eq(logs.executionId, options.executionId));
      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      const [data, totalResult] = await Promise.all([
        db.select()
          .from(logs)
          .where(whereClause)
          .orderBy(desc(logs.timestamp))
          .limit(limit)
          .offset(offset),
        db.select({ count: countFn() })
          .from(logs)
          .where(whereClause),
      ]);

      const total = totalResult[0]?.count || 0;

      return {
        data: data.map((log: any) => ({
          id: log.id,
          executionId: log.executionId || undefined,
          agentId: log.agentId || undefined,
          level: log.level as LogLevel,
          message: log.message,
          metadata: log.metadata as Record<string, unknown> | undefined,
          timestamp: log.timestamp || new Date(),
        })),
        total: Number(total),
        offset,
        limit,
        hasMore: offset + limit < Number(total),
      };
    } catch (error) {
      logger.error('Failed to get logs', { error });
      return {
        data: [],
        total: 0,
        offset: options.offset || 0,
        limit: options.limit || 100,
        hasMore: false,
      };
    }
  }

  async getLogCount(): Promise<number> {
    try {
      const [result] = await db.select({ count: countFn() }).from(logs);
      return Number(result?.count || 0);
    } catch (error) {
      logger.error('Failed to get log count', { error });
      return 0;
    }
  }

  async clearLogs(): Promise<void> {
    try {
      await db.delete(logs);
    } catch (error) {
      logger.error('Failed to clear logs', { error });
    }
  }

  async addTrace(trace: Trace): Promise<void> {
    try {
      await db.insert(traces)
        .values({
          id: trace.id,
          executionId: trace.executionId,
          treeData: trace.rootNode as unknown as any,
          createdAt: trace.createdAt,
        })
        .onConflictDoUpdate({
          target: traces.id,
          set: {
            treeData: trace.rootNode as unknown as any,
          },
        });
    } catch (error) {
      logger.error('Failed to add trace', { error });
    }
  }

  async getTrace(executionId: string): Promise<Trace | undefined> {
    try {
      const [trace] = await db.select()
        .from(traces)
        .where(eq(traces.executionId, executionId))
        .limit(1);

      if (!trace) return undefined;

      return {
        id: trace.id,
        executionId: trace.executionId || '',
        rootNode: trace.treeData as unknown as TraceNode,
        createdAt: trace.createdAt || new Date(),
      };
    } catch (error) {
      logger.error('Failed to get trace', { error });
      return undefined;
    }
  }

  async getAllTraces(): Promise<Trace[]> {
    try {
      const traceList = await db.select()
        .from(traces)
        .orderBy(desc(traces.createdAt))
        .limit(100);

      return traceList.map((trace: any) => ({
        id: trace.id,
        executionId: trace.executionId || '',
        rootNode: trace.treeData as unknown as TraceNode,
        createdAt: trace.createdAt || new Date(),
      }));
    } catch (error) {
      logger.error('Failed to get all traces', { error });
      return [];
    }
  }

  async addCost(cost: CostInfo): Promise<void> {
    try {
      await db.insert(costs).values({
        id: crypto.randomUUID(),
        executionId: cost.executionId,
        model: cost.model,
        promptTokens: cost.tokens.promptTokens,
        completionTokens: cost.tokens.completionTokens,
        totalTokens: cost.tokens.totalTokens,
        cost: cost.cost.toString(),
        currency: cost.currency,
      });
    } catch (error) {
      logger.error('Failed to add cost', { error });
    }
  }

  async getCosts(options: {
    executionId?: string;
    model?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<PaginatedResult<CostInfo>> {
    try {
      const limit = Math.min(options.limit || 100, 1000);
      const offset = options.offset || 0;

      const whereConditions = [];
      if (options.executionId) whereConditions.push(eq(costs.executionId, options.executionId));
      if (options.model) whereConditions.push(eq(costs.model, options.model));
      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      const [data, totalResult] = await Promise.all([
        db.select()
          .from(costs)
          .where(whereClause)
          .orderBy(desc(costs.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: countFn() })
          .from(costs)
          .where(whereClause),
      ]);

      const total = totalResult[0]?.count || 0;

      return {
        data: data.map((cost: any) => ({
          executionId: cost.executionId || '',
          model: cost.model,
          tokens: {
            promptTokens: cost.promptTokens,
            completionTokens: cost.completionTokens,
            totalTokens: cost.totalTokens,
          },
          cost: parseFloat(cost.cost.toString()),
          currency: cost.currency || 'USD',
        })),
        total: Number(total),
        offset,
        limit,
        hasMore: offset + limit < Number(total),
      };
    } catch (error) {
      logger.error('Failed to get costs', { error });
      return {
        data: [],
        total: 0,
        offset: options.offset || 0,
        limit: options.limit || 100,
        hasMore: false,
      };
    }
  }

  async getTotalCost(): Promise<number> {
    try {
      const [result] = await db.select({ total: sum(costs.cost) }).from(costs);
      return parseFloat(result?.total?.toString() || '0');
    } catch (error) {
      logger.error('Failed to get total cost', { error });
      return 0;
    }
  }

  async getCostByModel(): Promise<Record<string, number>> {
    try {
      const results = await db.select({
        model: costs.model,
        total: sum(costs.cost),
      })
        .from(costs)
        .groupBy(costs.model);

      const byModel: Record<string, number> = {};
      for (const result of results) {
        byModel[result.model] = parseFloat(result.total?.toString() || '0');
      }
      return byModel;
    } catch (error) {
      logger.error('Failed to get cost by model', { error });
      return {};
    }
  }

  async addExecution(result: ExecutionResult & { userId: string }): Promise<void> {
    try {
      await db.insert(executions)
        .values({
          id: result.executionId,
          userId: result.userId,
          agentId: result.agentId,
          status: result.status,
          input: result.output,
          output: result.output,
          error: result.error?.message || null,
          startedAt: result.startedAt,
          completedAt: result.completedAt,
          durationMs: result.duration,
        })
        .onConflictDoUpdate({
          target: executions.id,
          set: {
            status: result.status,
            output: result.output,
            error: result.error?.message || null,
            completedAt: result.completedAt,
            durationMs: result.duration,
          },
        });
    } catch (error) {
      logger.error('Failed to add execution', { error });
    }
  }

  async getExecution(executionId: string): Promise<ExecutionResult | undefined> {
    try {
      const [execution] = await db.select()
        .from(executions)
        .where(eq(executions.id, executionId))
        .limit(1);

      if (!execution) return undefined;

      return {
        executionId: execution.id,
        agentId: execution.agentId || '',
        status: execution.status as AgentStatus,
        output: execution.output,
        error: execution.error ? new Error(execution.error) : undefined,
        startedAt: execution.startedAt || new Date(),
        completedAt: execution.completedAt || new Date(),
        duration: execution.durationMs || 0,
      };
    } catch (error) {
      logger.error('Failed to get execution', { error });
      return undefined;
    }
  }

  async getAllExecutions(): Promise<ExecutionResult[]> {
    try {
      const executionList = await db.select()
        .from(executions)
        .orderBy(desc(executions.startedAt))
        .limit(100);

      return executionList.map((execution: any) => ({
        executionId: execution.id,
        agentId: execution.agentId || '',
        status: execution.status as AgentStatus,
        output: execution.output,
        error: execution.error ? new Error(execution.error) : undefined,
        startedAt: execution.startedAt || new Date(),
        completedAt: execution.completedAt || new Date(),
        duration: execution.durationMs || 0,
      }));
    } catch (error) {
      logger.error('Failed to get all executions', { error });
      return [];
    }
  }

  async getExecutionsByAgent(agentId: string): Promise<ExecutionResult[]> {
    try {
      const executionList = await db.select()
        .from(executions)
        .where(eq(executions.agentId, agentId))
        .orderBy(desc(executions.startedAt))
        .limit(100);

      return executionList.map((execution: any) => ({
        executionId: execution.id,
        agentId: execution.agentId || '',
        status: execution.status as AgentStatus,
        output: execution.output,
        error: execution.error ? new Error(execution.error) : undefined,
        startedAt: execution.startedAt || new Date(),
        completedAt: execution.completedAt || new Date(),
        duration: execution.durationMs || 0,
      }));
    } catch (error) {
      logger.error('Failed to get executions by agent', { error });
      return [];
    }
  }
}

export function createDatabaseStore(): DatabaseStore {
  return new DatabaseStore();
}
