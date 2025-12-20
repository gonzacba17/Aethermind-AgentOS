import { PrismaClient, type Prisma } from '@prisma/client';
import type { LogEntry, Trace, CostInfo, ExecutionResult, LogLevel, AgentStatus, TraceNode } from '@aethermind/core';
import type { StoreInterface, PaginatedResult, AgentRecord } from './PostgresStore';

/**
 * PrismaStore - Type-safe data access using Prisma Client
 * 
 * Replaces PostgresStore with Prisma Client for:
 * - Enhanced type safety
 * - Better maintainability
 * - Automatic query optimization
 * - Transaction support
 * 
 * @see PostgresStore for the original implementation
 * @see StoreInterface for method contracts
 */
export class PrismaStore implements StoreInterface {
  private prisma: PrismaClient;
  private connected = false;

  constructor() {
    this.prisma = new PrismaClient({
      log: process.env['NODE_ENV'] === 'development' 
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' }
          ] 
        : ['error'],
    });

    if (process.env['NODE_ENV'] === 'development') {
      this.prisma.$on('query', (e: { duration: number; query: string }) => {
        if (e.duration > 100) {
          console.warn(`[Slow Query] ${e.duration}ms: ${e.query}`);
        }
      });
    }
  }

  async connect(): Promise<boolean> {
    try {
      await this.prisma.$connect();
      this.connected = true;
      console.log('Prisma connected successfully');
      return true;
    } catch (error) {
      console.error('Failed to connect via Prisma:', error);
      this.connected = false;
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getPrisma(): PrismaClient {
    return this.prisma;
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
    this.connected = false;
  }

  async addAgent(agent: AgentRecord): Promise<void> {
    try {
      await this.prisma.agent.create({
        data: {
          id: agent.id,
          userId: agent.userId,
          name: agent.name,
          model: agent.model,
          config: agent.config as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      console.error('Failed to add agent:', error);
    }
  }

  async getAgents(options: {
    userId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<PaginatedResult<AgentRecord>> {
    try {
      const where: { userId?: string } = {};
      if (options.userId) where.userId = options.userId;

      const limit = Math.min(options.limit || 100, 1000);
      const offset = options.offset || 0;

      const [data, total] = await Promise.all([
        this.prisma.agent.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.agent.count({ where }),
      ]);

      return {
        data: data.map(agent => ({
          id: agent.id,
          userId: agent.userId,
          name: agent.name,
          model: agent.model,
          config: agent.config,
          createdAt: agent.createdAt || undefined,
          updatedAt: agent.updatedAt || undefined,
        })),
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
      };
    } catch (error) {
      console.error('Failed to get agents:', error);
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
      const agent = await this.prisma.agent.findUnique({ where: { id } });
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
      console.error('Failed to get agent:', error);
      return undefined;
    }
  }

  async deleteAgent(id: string): Promise<boolean> {
    try {
      await this.prisma.agent.delete({ where: { id } });
      return true;
    } catch (error) {
      console.error('Failed to delete agent:', error);
      return false;
    }
  }

  // Logs
  async addLog(entry: LogEntry): Promise<void> {
    try {
      await this.prisma.log.create({
        data: {
          id: entry.id,
          executionId: entry.executionId || null,
          agentId: entry.agentId || null,
          level: entry.level,
          message: entry.message,
          metadata: (entry.metadata ?? null) as Prisma.InputJsonValue,
          timestamp: entry.timestamp,
        },
      });
    } catch (error) {
      console.error('Failed to add log:', error);
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
      const where: { level?: string; agentId?: string; executionId?: string } = {};
      if (options.level) where.level = options.level;
      if (options.agentId) where.agentId = options.agentId;
      if (options.executionId) where.executionId = options.executionId;

      const limit = Math.min(options.limit || 100, 1000);
      const offset = options.offset || 0;

      const [data, total] = await Promise.all([
        this.prisma.log.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.log.count({ where }),
      ]);

      return {
        data: data.map(log => ({
          id: log.id,
          executionId: log.executionId || undefined,
          agentId: log.agentId || undefined,
          level: log.level as LogLevel,
          message: log.message,
          metadata: log.metadata as Record<string, unknown> | undefined,
          timestamp: log.timestamp || new Date(),
        })),
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
      };
    } catch (error) {
      console.error('Failed to get logs:', error);
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
      return await this.prisma.log.count();
    } catch (error) {
      console.error('Failed to get log count:', error);
      return 0;
    }
  }

  async clearLogs(): Promise<void> {
    try {
      await this.prisma.log.deleteMany();
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  // Traces
  async addTrace(trace: Trace): Promise<void> {
    try {
      await this.prisma.trace.upsert({
        where: { id: trace.id },
        update: {
          treeData: trace.rootNode as unknown as Prisma.InputJsonValue,
        },
        create: {
          id: trace.id,
          executionId: trace.executionId,
          treeData: trace.rootNode as unknown as Prisma.InputJsonValue,
          createdAt: trace.createdAt,
        },
      });
    } catch (error) {
      console.error('Failed to add trace:', error);
    }
  }

  async getTrace(executionId: string): Promise<Trace | undefined> {
    try {
      const trace = await this.prisma.trace.findFirst({
        where: { executionId },
      });

      if (!trace) return undefined;

      return {
        id: trace.id,
        executionId: trace.executionId || '',
        rootNode: trace.treeData as unknown as TraceNode,
        createdAt: trace.createdAt || new Date(),
      };
    } catch (error) {
      console.error('Failed to get trace:', error);
      return undefined;
    }
  }

  async getAllTraces(): Promise<Trace[]> {
    try {
      const traces = await this.prisma.trace.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      return traces.map(trace => ({
        id: trace.id,
        executionId: trace.executionId || '',
        rootNode: trace.treeData as unknown as TraceNode,
        createdAt: trace.createdAt || new Date(),
      }));
    } catch (error) {
      console.error('Failed to get all traces:', error);
      return [];
    }
  }

  // Costs
  async addCost(cost: CostInfo): Promise<void> {
    try {
      await this.prisma.cost.create({
        data: {
          id: crypto.randomUUID(),
          executionId: cost.executionId,
          model: cost.model,
          promptTokens: cost.tokens.promptTokens,
          completionTokens: cost.tokens.completionTokens,
          totalTokens: cost.tokens.totalTokens,
          cost: cost.cost,
          currency: cost.currency,
        },
      });
    } catch (error) {
      console.error('Failed to add cost:', error);
    }
  }

  async getCosts(options: {
    executionId?: string;
    model?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<PaginatedResult<CostInfo>> {
    try {
      const where: { executionId?: string; model?: string } = {};
      if (options.executionId) where.executionId = options.executionId;
      if (options.model) where.model = options.model;

      const limit = Math.min(options.limit || 100, 1000);
      const offset = options.offset || 0;

      const [data, total] = await Promise.all([
        this.prisma.cost.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.cost.count({ where }),
      ]);

      return {
        data: data.map(cost => ({
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
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
      };
    } catch (error) {
      console.error('Failed to get costs:', error);
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
      const result = await this.prisma.cost.aggregate({
        _sum: { cost: true },
      });
      return parseFloat(result._sum.cost?.toString() || '0');
    } catch (error) {
      console.error('Failed to get total cost:', error);
      return 0;
    }
  }

  async getCostByModel(): Promise<Record<string, number>> {
    try {
      const results = await this.prisma.cost.groupBy({
        by: ['model'],
        _sum: { cost: true },
      });

      const byModel: Record<string, number> = {};
      for (const result of results) {
        byModel[result.model] = parseFloat(result._sum.cost?.toString() || '0');
      }
      return byModel;
    } catch (error) {
      console.error('Failed to get cost by model:', error);
      return {};
    }
  }

  // Executions
  async addExecution(result: ExecutionResult & { userId: string }): Promise<void> {
    try {
      await this.prisma.execution.upsert({
        where: { id: result.executionId },
        update: {
          status: result.status,
          output: result.output as Prisma.InputJsonValue,
          error: result.error?.message || null,
          completedAt: result.completedAt,
          durationMs: result.duration,
        },
        create: {
          id: result.executionId,
          userId: result.userId,
          agentId: result.agentId,
          status: result.status,
          input: result.output as Prisma.InputJsonValue,
          output: result.output as Prisma.InputJsonValue,
          error: result.error?.message || null,
          startedAt: result.startedAt,
          completedAt: result.completedAt,
          durationMs: result.duration,
        },
      });
    } catch (error) {
      console.error('Failed to add execution:', error);
    }
  }

  async getExecution(executionId: string): Promise<ExecutionResult | undefined> {
    try {
      const execution = await this.prisma.execution.findUnique({
        where: { id: executionId },
      });

      if (!execution) return undefined;

      return {
        executionId: execution.id,
        agentId: execution.agentId || '',
        status: execution.status as AgentStatus,
        output: execution.output,
        error: execution.error ? new Error(execution.error) : undefined,
        startedAt: execution.startedAt || new Date(),
        completedAt: execution.completedAt || undefined,
        duration: execution.durationMs || 0,
      };
    } catch (error) {
      console.error('Failed to get execution:', error);
      return undefined;
    }
  }

  async getAllExecutions(): Promise<ExecutionResult[]> {
    try {
      const executions = await this.prisma.execution.findMany({
        orderBy: { startedAt: 'desc' },
        take: 100,
      });

      return executions.map(execution => ({
        executionId: execution.id,
        agentId: execution.agentId || '',
        status: execution.status as AgentStatus,
        output: execution.output,
        error: execution.error ? new Error(execution.error) : undefined,
        startedAt: execution.startedAt || new Date(),
        completedAt: execution.completedAt || undefined,
        duration: execution.durationMs || 0,
      }));
    } catch (error) {
      console.error('Failed to get all executions:', error);
      return [];
    }
  }

  async getExecutionsByAgent(agentId: string): Promise<ExecutionResult[]> {
    try {
      const executions = await this.prisma.execution.findMany({
        where: { agentId },
        orderBy: { startedAt: 'desc' },
        take: 100,
      });

      return executions.map(execution => ({
        executionId: execution.id,
        agentId: execution.agentId || '',
        status: execution.status as AgentStatus,
        output: execution.output,
        error: execution.error ? new Error(execution.error) : undefined,
        startedAt: execution.startedAt || new Date(),
        completedAt: execution.completedAt || undefined,
        duration: execution.durationMs || 0,
      }));
    } catch (error) {
      console.error('Failed to get executions by agent:', error);
      return [];
    }
  }
}

export function createPrismaStore(): PrismaStore {
  return new PrismaStore();
}
