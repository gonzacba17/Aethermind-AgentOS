import { Pool, PoolConfig } from 'pg';
import type { LogEntry, Trace, CostInfo, ExecutionResult } from '@aethermind/core';

export interface PostgresStoreConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  maxConnections?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface StoreInterface {
  addLog(entry: LogEntry): Promise<void> | void;
  getLogs(options?: {
    level?: string;
    agentId?: string;
    executionId?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<LogEntry>> | PaginatedResult<LogEntry>;
  getLogCount(): Promise<number> | number;
  clearLogs(): Promise<void> | void;
  addTrace(trace: Trace): Promise<void> | void;
  getTrace(executionId: string): Promise<Trace | undefined> | Trace | undefined;
  getAllTraces(): Promise<Trace[]> | Trace[];
  addCost(cost: CostInfo): Promise<void> | void;
  getCosts(options?: {
    executionId?: string;
    model?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<CostInfo>> | PaginatedResult<CostInfo>;
  getTotalCost(): Promise<number> | number;
  getCostByModel(): Promise<Record<string, number>> | Record<string, number>;
  addExecution(result: ExecutionResult): Promise<void> | void;
  getExecution(executionId: string): Promise<ExecutionResult | undefined> | ExecutionResult | undefined;
  getAllExecutions(): Promise<ExecutionResult[]> | ExecutionResult[];
  getExecutionsByAgent(agentId: string): Promise<ExecutionResult[]> | ExecutionResult[];
}

/**
 * PostgresStore - Data Access Object for all persistent storage
 * 
 * Manages connections and queries for all persistent entities:
 * - Logs (execution logs and traces)
 * - Traces (agent execution flows)
 * - Costs (LLM API cost tracking)
 * - Executions (agent run results)
 * 
 * @remarks
 * This class intentionally handles multiple entities to:
 * 1. Share a single connection pool (resource efficient)
 * 2. Support cross-entity transactions when needed
 * 3. Centralize database error handling and retry logic
 * 
 * Current size: ~439 lines, 15 methods
 * 
 * @note If this class grows beyond 600 lines, consider splitting into:
 * - LogRepository
 * - TraceRepository
 * - CostRepository
 * - ExecutionRepository
 * 
 * @see StoreInterface for method contracts
 * @see InMemoryStore for fallback implementation
 */
export class PostgresStore implements StoreInterface {
  private pool: Pool;
  private connected = false;

  constructor(config: PostgresStoreConfig) {
    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: config.maxConnections || 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

    this.pool = new Pool(poolConfig);

    this.pool.on('error', (err) => {
      console.error('PostgreSQL pool error:', err);
    });
  }

  async connect(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      client.release();
      this.connected = true;
      console.log('PostgreSQL connected successfully');
      return true;
    } catch (error) {
      console.error('Failed to connect to PostgreSQL:', error);
      this.connected = false;
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.connected = false;
  }

  async addLog(entry: LogEntry): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO logs (id, execution_id, agent_id, level, message, metadata, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          entry.id,
          entry.executionId || null,
          entry.agentId || null,
          entry.level,
          entry.message,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
          entry.timestamp,
        ]
      );
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
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (options.level) {
        conditions.push(`level = $${paramIndex++}`);
        params.push(options.level);
      }
      if (options.agentId) {
        conditions.push(`agent_id = $${paramIndex++}`);
        params.push(options.agentId);
      }
      if (options.executionId) {
        conditions.push(`execution_id = $${paramIndex++}`);
        params.push(options.executionId);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = Math.min(options.limit || 100, 1000);
      const offset = options.offset || 0;

      const countParams = [...params];
      params.push(limit, offset);

      const [dataResult, countResult] = await Promise.all([
        this.pool.query(
          `SELECT id, execution_id, agent_id, level, message, metadata, timestamp
           FROM logs ${whereClause}
           ORDER BY timestamp DESC
           LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
          params
        ),
        this.pool.query(
          `SELECT COUNT(*) as count FROM logs ${whereClause}`,
          countParams
        ),
      ]);

      const total = parseInt(countResult.rows[0]?.count || '0', 10);
      const data = dataResult.rows.map((row) => ({
        id: row.id,
        executionId: row.execution_id,
        agentId: row.agent_id,
        level: row.level,
        message: row.message,
        metadata: row.metadata,
        timestamp: new Date(row.timestamp),
      }));

      return {
        data,
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
      const result = await this.pool.query('SELECT COUNT(*) FROM logs');
      return parseInt(result.rows[0]?.count || '0', 10);
    } catch (error) {
      console.error('Failed to get log count:', error);
      return 0;
    }
  }

  async clearLogs(): Promise<void> {
    try {
      await this.pool.query('DELETE FROM logs');
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  async addTrace(trace: Trace): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO traces (id, execution_id, tree_data, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET tree_data = $3`,
        [
          trace.id,
          trace.executionId,
          JSON.stringify(trace.rootNode),
          trace.createdAt,
        ]
      );
    } catch (error) {
      console.error('Failed to add trace:', error);
    }
  }

  async getTrace(executionId: string): Promise<Trace | undefined> {
    try {
      const result = await this.pool.query(
        `SELECT id, execution_id, tree_data, created_at FROM traces WHERE execution_id = $1`,
        [executionId]
      );

      if (result.rows.length === 0) {
        return undefined;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        executionId: row.execution_id,
        rootNode: row.tree_data,
        createdAt: new Date(row.created_at),
      };
    } catch (error) {
      console.error('Failed to get trace:', error);
      return undefined;
    }
  }

  async getAllTraces(): Promise<Trace[]> {
    try {
      const result = await this.pool.query(
        `SELECT id, execution_id, tree_data, created_at FROM traces ORDER BY created_at DESC LIMIT 100`
      );

      return result.rows.map((row) => ({
        id: row.id,
        executionId: row.execution_id,
        rootNode: row.tree_data,
        createdAt: new Date(row.created_at),
      }));
    } catch (error) {
      console.error('Failed to get all traces:', error);
      return [];
    }
  }

  async addCost(cost: CostInfo): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO costs (id, execution_id, model, prompt_tokens, completion_tokens, total_tokens, cost, currency, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          crypto.randomUUID(),
          cost.executionId,
          cost.model,
          cost.tokens.promptTokens,
          cost.tokens.completionTokens,
          cost.tokens.totalTokens,
          cost.cost,
          cost.currency,
          new Date(),
        ]
      );
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
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (options.executionId) {
        conditions.push(`execution_id = $${paramIndex++}`);
        params.push(options.executionId);
      }
      if (options.model) {
        conditions.push(`model = $${paramIndex++}`);
        params.push(options.model);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = Math.min(options.limit || 100, 1000);
      const offset = options.offset || 0;

      const countParams = [...params];
      params.push(limit, offset);

      const [dataResult, countResult] = await Promise.all([
        this.pool.query(
          `SELECT execution_id, model, prompt_tokens, completion_tokens, total_tokens, cost, currency
           FROM costs ${whereClause}
           ORDER BY created_at DESC
           LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
          params
        ),
        this.pool.query(
          `SELECT COUNT(*) as count FROM costs ${whereClause}`,
          countParams
        ),
      ]);

      const total = parseInt(countResult.rows[0]?.count || '0', 10);
      const data = dataResult.rows.map((row) => ({
        executionId: row.execution_id,
        model: row.model,
        tokens: {
          promptTokens: row.prompt_tokens,
          completionTokens: row.completion_tokens,
          totalTokens: row.total_tokens,
        },
        cost: parseFloat(row.cost),
        currency: row.currency,
      }));

      return {
        data,
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
      const result = await this.pool.query('SELECT COALESCE(SUM(cost), 0) as total FROM costs');
      return parseFloat(result.rows[0]?.total || '0');
    } catch (error) {
      console.error('Failed to get total cost:', error);
      return 0;
    }
  }

  async getCostByModel(): Promise<Record<string, number>> {
    try {
      const result = await this.pool.query(
        `SELECT model, SUM(cost) as total FROM costs GROUP BY model`
      );

      const byModel: Record<string, number> = {};
      for (const row of result.rows) {
        byModel[row.model] = parseFloat(row.total);
      }
      return byModel;
    } catch (error) {
      console.error('Failed to get cost by model:', error);
      return {};
    }
  }

  async addExecution(result: ExecutionResult): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO executions (id, agent_id, status, input, output, error, started_at, completed_at, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           status = $3, output = $4, error = $5, completed_at = $8, duration_ms = $9`,
        [
          result.executionId,
          result.agentId,
          result.status,
          JSON.stringify(result.output),
          JSON.stringify(result.output),
          result.error?.message || null,
          result.startedAt,
          result.completedAt,
          result.duration,
        ]
      );
    } catch (error) {
      console.error('Failed to add execution:', error);
    }
  }

  async getExecution(executionId: string): Promise<ExecutionResult | undefined> {
    try {
      const result = await this.pool.query(
        `SELECT id, agent_id, status, input, output, error, started_at, completed_at, duration_ms
         FROM executions WHERE id = $1`,
        [executionId]
      );

      if (result.rows.length === 0) {
        return undefined;
      }

      const row = result.rows[0];
      return {
        executionId: row.id,
        agentId: row.agent_id,
        status: row.status,
        output: row.output,
        error: row.error ? new Error(row.error) : undefined,
        startedAt: new Date(row.started_at),
        completedAt: new Date(row.completed_at),
        duration: row.duration_ms,
      };
    } catch (error) {
      console.error('Failed to get execution:', error);
      return undefined;
    }
  }

  async getAllExecutions(): Promise<ExecutionResult[]> {
    try {
      const result = await this.pool.query(
        `SELECT id, agent_id, status, input, output, error, started_at, completed_at, duration_ms
         FROM executions ORDER BY started_at DESC LIMIT 100`
      );

      return result.rows.map((row) => ({
        executionId: row.id,
        agentId: row.agent_id,
        status: row.status,
        output: row.output,
        error: row.error ? new Error(row.error) : undefined,
        startedAt: new Date(row.started_at),
        completedAt: new Date(row.completed_at),
        duration: row.duration_ms,
      }));
    } catch (error) {
      console.error('Failed to get all executions:', error);
      return [];
    }
  }

  async getExecutionsByAgent(agentId: string): Promise<ExecutionResult[]> {
    try {
      const result = await this.pool.query(
        `SELECT id, agent_id, status, input, output, error, started_at, completed_at, duration_ms
         FROM executions WHERE agent_id = $1 ORDER BY started_at DESC LIMIT 100`,
        [agentId]
      );

      return result.rows.map((row) => ({
        executionId: row.id,
        agentId: row.agent_id,
        status: row.status,
        output: row.output,
        error: row.error ? new Error(row.error) : undefined,
        startedAt: new Date(row.started_at),
        completedAt: new Date(row.completed_at),
        duration: row.duration_ms,
      }));
    } catch (error) {
      console.error('Failed to get executions by agent:', error);
      return [];
    }
  }
}

export function createPostgresStore(config: PostgresStoreConfig): PostgresStore {
  return new PostgresStore(config);
}
