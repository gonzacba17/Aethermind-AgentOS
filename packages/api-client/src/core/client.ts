import type {
  Agent,
  LogEntryDTO,
  ExecutionResultDTO,
  TraceDTO,
  CostSummary,
  CostEstimate,
  CostInfo
} from '@aethermind/types';

export interface ClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class AethermindClient {
  private config: ClientConfig & { timeout: number };

  constructor(config: ClientConfig) {
    this.config = {
      timeout: 30000,
      ...config
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>)
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeout
    );

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(
          error.message || `Request failed: ${response.statusText}`,
          response.status,
          error
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        error instanceof Error ? error.message : 'Unknown error',
        0
      );
    }
  }

  async fetchAgents(): Promise<Agent[]> {
    return this.request<Agent[]>('/api/agents');
  }

  async fetchAgent(id: string): Promise<Agent> {
    return this.request<Agent>(`/api/agents/${id}`);
  }

  async createAgent(data: {
    name: string;
    model?: string;
    systemPrompt?: string;
  }): Promise<Agent> {
    return this.request<Agent>('/api/agents', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async executeAgent(id: string, input: unknown): Promise<ExecutionResultDTO> {
    return this.request<ExecutionResultDTO>(`/api/agents/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify({ input })
    });
  }

  async fetchLogs(params?: {
    level?: string;
    agentId?: string;
    executionId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: LogEntryDTO[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.level) searchParams.set('level', params.level);
    if (params?.agentId) searchParams.set('agentId', params.agentId);
    if (params?.executionId) searchParams.set('executionId', params.executionId);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));

    return this.request<{ logs: LogEntryDTO[]; total: number }>(
      `/api/logs?${searchParams}`
    );
  }

  async fetchTraces(): Promise<TraceDTO[]> {
    return this.request<TraceDTO[]>('/api/traces');
  }

  async fetchTrace(id: string): Promise<TraceDTO> {
    return this.request<TraceDTO>(`/api/traces/${id}`);
  }

  async fetchCostSummary(): Promise<CostSummary> {
    return this.request<CostSummary>('/api/costs/summary');
  }

  async fetchCostHistory(params?: {
    startDate?: string;
    endDate?: string;
    agentId?: string;
    workflowName?: string;
  }): Promise<CostInfo[]> {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);
    if (params?.agentId) searchParams.set('agentId', params.agentId);
    if (params?.workflowName) searchParams.set('workflowName', params.workflowName);

    return this.request<CostInfo[]>(`/api/costs?${searchParams}`);
  }

  async estimateWorkflowCost(
    workflowName: string,
    input: unknown
  ): Promise<CostEstimate> {
    return this.request<CostEstimate>(
      `/api/workflows/${workflowName}/estimate`,
      {
        method: 'POST',
        body: JSON.stringify({ input })
      }
    );
  }

  async fetchExecutions(): Promise<ExecutionResultDTO[]> {
    return this.request<ExecutionResultDTO[]>('/api/executions');
  }

  async fetchHealth(): Promise<{ status: string; timestamp: string }> {
    return this.request<{ status: string; timestamp: string }>('/api/health');
  }
}

export function createClient(config: ClientConfig): AethermindClient {
  return new AethermindClient(config);
}
