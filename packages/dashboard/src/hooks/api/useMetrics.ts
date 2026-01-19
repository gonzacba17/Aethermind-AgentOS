import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { fetchAgents, fetchTraces, fetchCostSummary, fetchLogs } from '@/lib/api';

/**
 * Query key for dashboard metrics
 */
export const metricsKeys = {
  all: ['metrics'] as const,
  current: () => [...metricsKeys.all, 'current'] as const,
};

export interface DashboardMetrics {
  // Agent metrics
  activeAgents: number;
  totalAgents: number;
  
  // Execution metrics
  totalExecutions24h: number;
  tracesRunning: number;
  successRate: string;
  errorRate: string;
  
  // Cost metrics
  costToday: number;
  costMTD: number;
  tokensUsed24h: number;
  
  // Performance metrics
  avgResponseTime: number;
  
  // Log metrics
  errorCount24h: number;
  warningCount24h: number;
  
  // Timestamp
  timestamp: string;
}

/**
 * Hook to fetch aggregated dashboard metrics
 * 
 * This combines data from multiple endpoints into a single
 * dashboard-friendly format. In production, this should
 * ideally be a single optimized endpoint on the backend.
 */
export function useMetrics(
  options?: Omit<UseQueryOptions<DashboardMetrics>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: metricsKeys.current(),
    queryFn: async () => {
      // Fetch data from multiple sources in parallel
      const [agents, traces, costSummary, logs] = await Promise.all([
        fetchAgents().catch(() => []),
        fetchTraces().catch(() => []),
        fetchCostSummary().catch(() => ({ 
          total: 0, 
          totalTokens: 0, 
          executionCount: 0, 
          byModel: {} 
        })),
        fetchLogs({ limit: 500 }).catch(() => ({ logs: [], total: 0 })),
      ]);
      
      // Calculate agent metrics
      const agentList = Array.isArray(agents) ? agents : (agents as any)?.data || [];
      const activeAgents = agentList.filter(
        (a: any) => a.status === 'active' || a.status === 'running'
      ).length;
      
      // Calculate trace metrics
      const traceList = Array.isArray(traces) ? traces : [];
      const now = Date.now();
      const last24h = now - 24 * 60 * 60 * 1000;
      
      const recentTraces = traceList.filter(
        (t: any) => new Date(t.createdAt).getTime() > last24h
      );
      
      let successCount = 0;
      let errorCount = 0;
      let runningCount = 0;
      let totalDuration = 0;
      let completedCount = 0;
      
      for (const trace of recentTraces) {
        const rootNode = (trace as any).rootNode;
        if (rootNode?.error) {
          errorCount++;
        } else if (rootNode?.completedAt) {
          successCount++;
          if (rootNode.duration) {
            totalDuration += rootNode.duration;
            completedCount++;
          }
        } else {
          runningCount++;
        }
      }
      
      const totalTraces = recentTraces.length;
      const successRate = totalTraces > 0 
        ? ((successCount / totalTraces) * 100).toFixed(1)
        : '100';
      const errorRate = totalTraces > 0
        ? ((errorCount / totalTraces) * 100).toFixed(1)
        : '0';
      
      // Calculate cost metrics
      const { total: costMTD, totalTokens } = costSummary;
      
      // Estimate today's cost (rough approximation)
      const today = new Date();
      const dayOfMonth = today.getDate();
      const costToday = dayOfMonth > 0 ? costMTD / dayOfMonth : 0;
      
      // Calculate log metrics
      const logList = logs.logs || [];
      const recentLogs = logList.filter(
        (l: any) => new Date(l.timestamp).getTime() > last24h
      );
      
      const errorLogs = recentLogs.filter((l: any) => l.level === 'error').length;
      const warningLogs = recentLogs.filter((l: any) => l.level === 'warn' || l.level === 'warning').length;
      
      // Calculate average response time
      const avgResponseTime = completedCount > 0 
        ? Math.round(totalDuration / completedCount) / 1000 
        : 0;
      
      return {
        activeAgents,
        totalAgents: agentList.length,
        totalExecutions24h: recentTraces.length,
        tracesRunning: runningCount,
        successRate,
        errorRate,
        costToday: Math.round(costToday * 100) / 100,
        costMTD: Math.round(costMTD * 100) / 100,
        tokensUsed24h: totalTokens,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        errorCount24h: errorLogs,
        warningCount24h: warningLogs,
        timestamp: new Date().toISOString(),
      };
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
    ...options,
  });
}

/**
 * Hook for trace time series data (for charts)
 */
export function useTraceTimeSeries(
  period: '24h' | '7d' | '30d' = '24h'
) {
  return useQuery({
    queryKey: ['metrics', 'traces', 'timeseries', period],
    queryFn: async () => {
      const traces = await fetchTraces();
      const traceList = Array.isArray(traces) ? traces : [];
      
      const now = Date.now();
      const periods = {
        '24h': { duration: 24 * 60 * 60 * 1000, buckets: 24, label: 'hour' },
        '7d': { duration: 7 * 24 * 60 * 60 * 1000, buckets: 7, label: 'day' },
        '30d': { duration: 30 * 24 * 60 * 60 * 1000, buckets: 30, label: 'day' },
      };
      
      const { duration, buckets } = periods[period];
      const bucketSize = duration / buckets;
      const startTime = now - duration;
      
      // Initialize buckets
      const data: { time: string; traces: number; errors: number }[] = [];
      
      for (let i = 0; i < buckets; i++) {
        const bucketStart = startTime + (i * bucketSize);
        const bucketEnd = bucketStart + bucketSize;
        
        const bucketTraces = traceList.filter((t: any) => {
          const time = new Date(t.createdAt).getTime();
          return time >= bucketStart && time < bucketEnd;
        });
        
        const errorCount = bucketTraces.filter(
          (t: any) => t.rootNode?.error
        ).length;
        
        data.push({
          time: new Date(bucketStart).toISOString(),
          traces: bucketTraces.length,
          errors: errorCount,
        });
      }
      
      return data;
    },
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
}
