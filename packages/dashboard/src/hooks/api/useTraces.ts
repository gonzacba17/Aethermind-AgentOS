import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

/**
 * Query key factory for traces
 */
export const traceKeys = {
  all: ['traces'] as const,
  lists: () => [...traceKeys.all, 'list'] as const,
  list: (filters: TraceFilters) => [...traceKeys.lists(), filters] as const,
  details: () => [...traceKeys.all, 'detail'] as const,
  detail: (id: string) => [...traceKeys.details(), id] as const,
};

export interface TraceFilters {
  status?: string[];
  agentId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface TraceListItem {
  id: string;
  name: string;
  agent: string;
  status: 'success' | 'running' | 'error';
  duration: string;
  timestamp: string;
  steps: number;
  workflowId?: string;
  totalCost?: number;
}

interface TracesResponse {
  data: TraceListItem[];
  total: number;
}

/** Shape returned by GET /api/client/traces (gateway agent_traces) */
interface BackendTrace {
  id: string;
  traceId: string;
  agentName: string;
  workflowId?: string;
  status: string;
  totalCost: number;
  latencyMs: number;
  steps: number;
  startedAt: string;
  createdAt: string;
  agents: Array<{
    agentId: string;
    agentName: string;
    model: string;
    provider: string;
    status: string;
    costUsd: number;
    latencyMs: number;
    workflowStep?: number;
    parentAgentId?: string;
  }>;
}

/**
 * Hook to fetch list of traces
 */
export function useTraces(
  filters: TraceFilters = {},
  options?: Omit<UseQueryOptions<TracesResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: traceKeys.list(filters),
    queryFn: async (): Promise<TracesResponse> => {
      const response = await apiRequest<{ data: BackendTrace[]; total: number }>('/api/client/traces');

      const traces: TraceListItem[] = (response.data || []).map(t => ({
        id: t.id,
        name: t.agentName || t.traceId || 'Unknown',
        agent: t.agents?.[0]?.agentName || t.agentName || 'gateway',
        status: t.status === 'error' ? 'error' : 'success' as const,
        duration: t.latencyMs > 0 ? `${(t.latencyMs / 1000).toFixed(1)}s` : '-',
        timestamp: new Date(t.createdAt).toLocaleString(),
        steps: t.steps || t.agents?.length || 1,
        workflowId: t.workflowId,
        totalCost: t.totalCost,
      }));

      let filtered = traces;

      if (filters.status && filters.status.length > 0) {
        filtered = filtered.filter(t => filters.status!.includes(t.status));
      }

      if (filters.agentId) {
        filtered = filtered.filter(t =>
          t.agent.toLowerCase().includes(filters.agentId!.toLowerCase())
        );
      }

      return { data: filtered, total: filtered.length };
    },
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000,
    refetchIntervalInBackground: true,
    retry: 1,
    ...options,
  });
}

/**
 * Extended trace detail with steps for the detail page
 */
export interface TraceStep {
  id: string;
  name: string;
  type: 'llm' | 'tool' | 'function' | 'other';
  status: string;
  duration: number;
  startTime: string;
  endTime?: string;
  input?: any;
  output?: any;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost?: number;
  error?: string;
  model?: string;
  provider?: string;
  parentAgentId?: string;
  workflowStep?: number;
}

export interface TraceDetail {
  id: string;
  name: string;
  agent: string;
  agentId?: string;
  workflowId?: string;
  parentAgentId?: string;
  status: 'success' | 'running' | 'error';
  duration: string;
  timestamp: string;
  steps: TraceStep[];
  rootNode?: any;
  createdAt: string;
  completedAt?: string;
  totalTokens?: number;
  totalCost?: number;
}

/**
 * Hook to fetch a single trace by ID
 */
export function useTrace(
  id: string,
  options?: Omit<UseQueryOptions<TraceDetail>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: traceKeys.detail(id),
    queryFn: async (): Promise<TraceDetail> => {
      const trace = await apiRequest<any>(`/api/client/traces/${id}`);

      const agents = trace.agents || [];
      const steps: TraceStep[] = agents.map((a: any, i: number) => ({
        id: a.agentId || `step-${i}`,
        name: a.agentName || a.agentId || `Step ${i + 1}`,
        type: 'llm' as const,
        status: a.status === 'error' ? 'error' : 'success',
        duration: a.latencyMs || 0,
        startTime: a.startedAt || trace.createdAt,
        endTime: a.completedAt,
        tokens: a.inputTokens || a.outputTokens ? {
          prompt: a.inputTokens || 0,
          completion: a.outputTokens || 0,
          total: (a.inputTokens || 0) + (a.outputTokens || 0),
        } : undefined,
        cost: a.costUsd,
        error: a.error,
        model: a.model,
        provider: a.provider,
        parentAgentId: a.parentAgentId,
        workflowStep: a.workflowStep,
      }));

      return {
        id: trace.id || trace.traceId,
        name: agents[0]?.agentName || trace.traceId || 'Unknown',
        agent: agents[0]?.agentName || 'gateway',
        agentId: agents[0]?.agentId,
        workflowId: trace.workflowId,
        parentAgentId: agents[0]?.parentAgentId,
        status: trace.status === 'error' ? 'error' : 'success',
        duration: trace.latencyMs > 0 ? `${(trace.latencyMs / 1000).toFixed(1)}s` : '-',
        timestamp: new Date(trace.createdAt).toLocaleString(),
        steps,
        createdAt: trace.createdAt,
        completedAt: agents[agents.length - 1]?.completedAt,
        totalTokens: steps.reduce((sum, s) => sum + (s.tokens?.total || 0), 0),
        totalCost: trace.totalCost,
      };
    },
    enabled: !!id,
    staleTime: 10 * 1000,
    ...options,
  });
}

/**
 * Hook to get trace statistics for the dashboard
 */
export function useTraceStats() {
  return useQuery({
    queryKey: [...traceKeys.all, 'stats'],
    queryFn: async () => {
      const response = await apiRequest<{ data: BackendTrace[]; total: number }>('/api/client/traces');
      const traces = response.data || [];

      const stats = {
        total: traces.length,
        success: traces.filter(t => t.status !== 'error').length,
        running: 0,
        error: traces.filter(t => t.status === 'error').length,
        avgDuration: 0,
      };

      const totalLatency = traces.reduce((s, t) => s + (t.latencyMs || 0), 0);
      stats.avgDuration = traces.length > 0 ? totalLatency / traces.length : 0;

      return {
        ...stats,
        successRate: stats.total > 0
          ? ((stats.success / stats.total) * 100).toFixed(1)
          : '0',
        errorRate: stats.total > 0
          ? ((stats.error / stats.total) * 100).toFixed(1)
          : '0',
      };
    },
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000,
    refetchIntervalInBackground: true,
  });
}

/**
 * Export trace data - downloads as file
 */
export async function exportTraces(
  traces: TraceListItem[],
  format: 'csv' | 'json' = 'csv'
): Promise<void> {
  let content: string;
  let mimeType: string;
  let extension: string;

  if (format === 'json') {
    content = JSON.stringify(traces, null, 2);
    mimeType = 'application/json';
    extension = 'json';
  } else {
    const headers = ['id', 'name', 'agent', 'status', 'duration', 'timestamp', 'steps'];
    const rows = traces.map(t => [
      t.id,
      `"${t.name}"`,
      `"${t.agent}"`,
      t.status,
      t.duration,
      `"${t.timestamp}"`,
      t.steps.toString(),
    ]);
    content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    mimeType = 'text/csv';
    extension = 'csv';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `traces-export-${new Date().toISOString().split('T')[0]}.${extension}`;
  a.click();
  URL.revokeObjectURL(url);
}
