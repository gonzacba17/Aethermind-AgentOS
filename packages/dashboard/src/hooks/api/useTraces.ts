import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { fetchTraces, fetchTrace, Trace } from '@/lib/api';
import { MOCK_TRACES, shouldUseMockData } from '@/lib/mock-data';

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
}

interface TracesResponse {
  data: TraceListItem[];
  total: number;
}

/**
 * Hook to fetch list of traces
 * Falls back to mock data if API is not configured
 * 
 * @param filters - Optional filters for the trace list
 * @param options - Additional React Query options
 */
export function useTraces(
  filters: TraceFilters = {},
  options?: Omit<UseQueryOptions<TracesResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: traceKeys.list(filters),
    queryFn: async () => {
      // Use mock data if API is not configured (demo mode)
      const traces = shouldUseMockData() ? MOCK_TRACES : await fetchTraces();
      
      // Transform API response to list format
      const transformedTraces: TraceListItem[] = traces.map(trace => ({
        id: trace.id,
        name: trace.rootNode?.name || 'Unknown',
        agent: trace.rootNode?.type === 'agent' ? trace.rootNode.name : 'System',
        status: trace.rootNode?.error ? 'error' : 
                trace.rootNode?.completedAt ? 'success' : 'running',
        duration: trace.rootNode?.duration 
          ? `${(trace.rootNode.duration / 1000).toFixed(1)}s` 
          : 'ongoing',
        timestamp: new Date(trace.createdAt).toLocaleString(),
        steps: countNodes(trace.rootNode),
      }));
      
      // Apply filters client-side if API doesn't support them
      let filteredTraces = transformedTraces;
      
      if (filters.status && filters.status.length > 0) {
        filteredTraces = filteredTraces.filter(
          trace => filters.status!.includes(trace.status)
        );
      }
      
      if (filters.agentId) {
        filteredTraces = filteredTraces.filter(
          trace => trace.agent.toLowerCase().includes(filters.agentId!.toLowerCase())
        );
      }
      
      return {
        data: filteredTraces,
        total: filteredTraces.length,
      };
    },
    staleTime: 15 * 1000, // 15 seconds - traces update more frequently
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
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
}

export interface TraceDetail {
  id: string;
  name: string;
  agent: string;
  agentId?: string;
  status: 'success' | 'running' | 'error';
  duration: string;
  timestamp: string;
  steps: TraceStep[];
  rootNode?: Trace['rootNode'];
  createdAt: string;
  completedAt?: string;
  totalTokens?: number;
  totalCost?: number;
}

/**
 * Hook to fetch a single trace by ID
 * 
 * @param id - Trace ID
 * @param options - Additional React Query options
 */
export function useTrace(
  id: string,
  options?: Omit<UseQueryOptions<TraceDetail>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: traceKeys.detail(id),
    queryFn: async (): Promise<TraceDetail> => {
      const trace = await fetchTrace(id);
      
      // Transform to detail format
      const steps: TraceStep[] = extractSteps(trace.rootNode);
      
      return {
        id: trace.id,
        name: trace.rootNode?.name || 'Unknown',
        agent: trace.rootNode?.type === 'agent' ? trace.rootNode.name : 'System',
        agentId: (trace.rootNode as any)?.agentId,
        status: trace.rootNode?.error ? 'error' : 
                trace.rootNode?.completedAt ? 'success' : 'running',
        duration: trace.rootNode?.duration 
          ? `${(trace.rootNode.duration / 1000).toFixed(1)}s` 
          : 'ongoing',
        timestamp: new Date(trace.createdAt).toLocaleString(),
        steps,
        rootNode: trace.rootNode,
        createdAt: trace.createdAt,
        completedAt: trace.rootNode?.completedAt,
        totalTokens: steps.reduce((sum, s) => sum + (s.tokens?.total || 0), 0),
        totalCost: steps.reduce((sum, s) => sum + (s.cost || 0), 0),
      };
    },
    enabled: !!id,
    staleTime: 10 * 1000, // 10 seconds - individual trace may still be updating
    ...options,
  });
}

/**
 * Extract steps from the trace tree
 */
function extractSteps(node: Trace['rootNode'] | undefined, steps: TraceStep[] = []): TraceStep[] {
  if (!node) return steps;
  
  // Cast to any to access potentially extended fields
  const n = node as any;
  
  // Add this node as a step
  steps.push({
    id: n.id || `step-${steps.length}`,
    name: n.name || 'Unknown Step',
    type: mapNodeType(n.type),
    status: n.error ? 'error' : n.completedAt ? 'success' : 'running',
    duration: n.duration || 0,
    startTime: n.createdAt || n.startedAt || new Date().toISOString(),
    endTime: n.completedAt,
    input: n.input,
    output: n.output,
    tokens: n.tokens,
    cost: n.cost,
    error: n.error,
  });
  
  // Recursively add children
  if (n.children) {
    for (const child of n.children) {
      extractSteps(child as any, steps);
    }
  }
  
  return steps;
}

/**
 * Map node type to step type
 */
function mapNodeType(type: string | undefined): TraceStep['type'] {
  if (!type) return 'other';
  const lower = type.toLowerCase();
  if (lower.includes('llm') || lower.includes('model')) return 'llm';
  if (lower.includes('tool')) return 'tool';
  if (lower.includes('function')) return 'function';
  return 'other';
}

/**
 * Hook to get trace statistics for the dashboard
 */
export function useTraceStats() {
  return useQuery({
    queryKey: [...traceKeys.all, 'stats'],
    queryFn: async () => {
      const traces = await fetchTraces();
      
      const now = Date.now();
      const last24h = now - 24 * 60 * 60 * 1000;
      
      // Filter traces from last 24 hours
      const recentTraces = traces.filter(
        trace => new Date(trace.createdAt).getTime() > last24h
      );
      
      const stats = {
        total: recentTraces.length,
        success: 0,
        running: 0,
        error: 0,
        avgDuration: 0,
      };
      
      let totalDuration = 0;
      let completedCount = 0;
      
      for (const trace of recentTraces) {
        if (trace.rootNode?.error) {
          stats.error++;
        } else if (trace.rootNode?.completedAt) {
          stats.success++;
          if (trace.rootNode.duration) {
            totalDuration += trace.rootNode.duration;
            completedCount++;
          }
        } else {
          stats.running++;
        }
      }
      
      stats.avgDuration = completedCount > 0 ? totalDuration / completedCount : 0;
      
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
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/**
 * Helper to count total nodes in a trace tree
 */
function countNodes(node: Trace['rootNode'] | undefined): number {
  if (!node) return 0;
  let count = 1;
  if (node.children) {
    for (const child of node.children) {
      count += countNodes(child as any);
    }
  }
  return count;
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
