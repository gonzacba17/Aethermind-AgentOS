import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { fetchLogs, LogEntry } from '@/lib/api';
import { MOCK_LOGS, shouldUseMockData } from '@/lib/mock-data';

/**
 * Query key factory for logs
 */
export const logKeys = {
  all: ['logs'] as const,
  lists: () => [...logKeys.all, 'list'] as const,
  list: (filters: LogFilters) => [...logKeys.lists(), filters] as const,
};

export interface LogFilters {
  level?: string[];
  source?: string[];
  agentId?: string;
  executionId?: string;
  traceId?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface EnhancedLogEntry extends LogEntry {
  source?: string;
}

interface LogsResponse {
  logs: EnhancedLogEntry[];
  total: number;
}

/**
 * Hook to fetch logs
 * Falls back to mock data if API is not configured
 * 
 * @param filters - Optional filters for the log list
 * @param options - Additional React Query options
 */
export function useLogs(
  filters: LogFilters = {},
  options?: Omit<UseQueryOptions<LogsResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: logKeys.list(filters),
    queryFn: async () => {
      // Use mock data if API is not configured (demo mode)
      let logs: LogEntry[];
      let total: number;
      
      if (shouldUseMockData()) {
        logs = [...MOCK_LOGS];
        total = MOCK_LOGS.length;
      } else {
        const response = await fetchLogs({
          level: filters.level?.[0],
          agentId: filters.agentId,
          executionId: filters.executionId,
          limit: filters.limit || 100,
          offset: filters.offset || 0,
        });
        logs = response.logs || [];
        total = response.total;
      }
      
      // Apply additional client-side filters
      if (filters.level && filters.level.length > 0) {
        logs = logs.filter(log => filters.level!.includes(log.level));
      }
      
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        logs = logs.filter(log => 
          log.message.toLowerCase().includes(searchLower) ||
          (log.agentId && log.agentId.toLowerCase().includes(searchLower))
        );
      }
      
      // Add source from metadata or agentId
      const enhancedLogs: EnhancedLogEntry[] = logs.map(log => ({
        ...log,
        source: log.metadata?.source as string || log.agentId || 'system',
      }));
      
      // Filter by source if specified
      if (filters.source && filters.source.length > 0) {
        return {
          logs: enhancedLogs.filter(log => filters.source!.includes(log.source || '')),
          total,
        };
      }
      
      return {
        logs: enhancedLogs,
        total,
      };
    },
    staleTime: 10 * 1000, // 10 seconds - logs are more real-time
    refetchInterval: shouldUseMockData() ? false : 15 * 1000, // Don't refetch mock data
    ...options,
  });
}

/**
 * Hook for log statistics (counts by level)
 */
export function useLogStats() {
  return useQuery({
    queryKey: [...logKeys.all, 'stats'],
    queryFn: async () => {
      const response = await fetchLogs({ limit: 1000 });
      const logs = response.logs || [];
      
      const stats = {
        total: response.total,
        debug: logs.filter(l => l.level === 'debug').length,
        info: logs.filter(l => l.level === 'info').length,
        warn: logs.filter(l => l.level === 'warn').length,
        error: logs.filter(l => l.level === 'error').length,
      };
      
      return stats;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/**
 * Get unique sources from logs (for filter dropdown)
 */
export function useLogSources() {
  const { data } = useLogs({ limit: 500 });
  
  const sources = data?.logs
    .map(log => log.source)
    .filter((source, index, self) => source && self.indexOf(source) === index)
    .sort() || [];
  
  return sources;
}

/**
 * Export logs to file
 */
export async function exportLogs(
  logs: EnhancedLogEntry[], 
  format: 'csv' | 'json' = 'csv'
): Promise<void> {
  let content: string;
  let mimeType: string;
  let extension: string;
  
  if (format === 'json') {
    content = JSON.stringify(logs, null, 2);
    mimeType = 'application/json';
    extension = 'json';
  } else {
    const headers = ['timestamp', 'level', 'source', 'message'];
    const rows = logs.map(l => [
      `"${l.timestamp}"`,
      l.level,
      `"${l.source || ''}"`,
      `"${l.message.replace(/"/g, '""')}"`,
    ]);
    content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    mimeType = 'text/csv';
    extension = 'csv';
  }
  
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `logs-export-${new Date().toISOString().split('T')[0]}.${extension}`;
  a.click();
  URL.revokeObjectURL(url);
}
