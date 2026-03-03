import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useRef } from 'react';
import { fetchCostSummary, fetchCostHistory, apiRequest, CostSummary, CostInfo } from '@/lib/api';
import { MOCK_COST_SUMMARY, MOCK_COST_HISTORY, shouldUseMockData } from '@/lib/mock-data';
import { useMockDataContext } from '@/contexts/MockDataContext';
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
  format as formatDate,
} from 'date-fns';

// Metrics response from /api/client/metrics (telemetry-based)
interface ClientMetricsResponse {
  totalCost: number;
  totalTokens: number;
  totalEvents: number;
  avgLatency: number;
  errorCount: number;
  successRate: number;
  period: string;
}

// Metrics by model from /api/client/metrics/by-model
interface ClientMetricsByModelEntry {
  model: string;
  cost: number;
  tokens: number;
  count: number;
  avgLatency: number;
}

/**
 * Query key factory for costs
 */
export const costKeys = {
  all: ['costs'] as const,
  summary: () => [...costKeys.all, 'summary'] as const,
  budget: () => [...costKeys.all, 'budget'] as const,
  daily: (period: string) => [...costKeys.all, 'daily', period] as const,
  history: (filters: CostFilters) => [...costKeys.all, 'history', filters] as const,
  prediction: () => [...costKeys.all, 'prediction'] as const,
  byModel: (period: string) => [...costKeys.all, 'byModel', period] as const,
};

export interface CostFilters {
  period?: 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  from?: string;
  to?: string;
  agentId?: string;
  model?: string;
}

export interface DailyCost {
  date: string;
  cost: number;
  tokens: number;
  executions: number;
  change: number; // Percentage change from previous day
}

export interface CostByModel {
  model: string;
  usage: number; // Percentage of total
  cost: number;
  tokens: number;
  color: string;
}

/**
 * Hook to fetch cost summary
 * Falls back to mock data if API is not configured
 */
export function useCostSummary(
  options?: Omit<UseQueryOptions<CostSummary>, 'queryKey' | 'queryFn'>
) {
  const { reportMockFallback } = useMockDataContext();
  const reportedRef = useRef(false);

  return useQuery({
    queryKey: costKeys.summary(),
    queryFn: async () => {
      if (shouldUseMockData()) {
        if (!reportedRef.current) {
          reportMockFallback('useCostSummary', 'NEXT_PUBLIC_API_URL not configured');
          reportedRef.current = true;
        }
        return MOCK_COST_SUMMARY;
      }

      try {
        // Use telemetry-based metrics endpoint (same as dashboard main)
        const metrics = await apiRequest<ClientMetricsResponse>('/api/client/metrics?period=30d');
        
        // Also get by-model breakdown
        let byModel: Record<string, { count: number; tokens: number; cost: number }> = {};
        try {
          const byModelRes = await apiRequest<{ data: ClientMetricsByModelEntry[] }>('/api/client/metrics/by-model?period=30d');
          for (const entry of (byModelRes.data ?? [])) {
            byModel[entry.model] = {
              count: entry.count,
              tokens: entry.tokens,
              cost: entry.cost,
            };
          }
        } catch {
          // by-model is optional, continue without it
        }

        return {
          total: metrics.totalCost ?? 0,
          totalTokens: metrics.totalTokens ?? 0,
          executionCount: metrics.totalEvents ?? 0,
          byModel,
        } as CostSummary;
      } catch (error) {
        console.warn('[useCostSummary] API request failed, using mock data:', error);
        if (!reportedRef.current) {
          reportMockFallback('useCostSummary', `API request failed: ${(error as Error).message}`);
          reportedRef.current = true;
        }
        return MOCK_COST_SUMMARY;
      }
    },
    staleTime: 60 * 1000,
    refetchInterval: shouldUseMockData() ? false : 2 * 60 * 1000,
    retry: 1,
    ...options,
  });
}

/**
 * Hook to fetch budget status
 * Falls back to mock data if API is not configured
 */
export function useBudget(
  options?: Omit<UseQueryOptions<BudgetInfo>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: costKeys.budget(),
    queryFn: async () => {
      // Use mock data if API is not configured
      if (shouldUseMockData()) {
        return {
          limit: 500,
          spent: 127.45,
          remaining: 372.55,
          percentUsed: 25.49,
          period: 'monthly' as const,
        };
      }
      
      try {
        return await apiRequest<BudgetInfo>('/api/client/budget-status');
      } catch (error) {
        if ((error as any).status === 404) {
          return {
            limit: 0,
            spent: 0,
            remaining: 0,
            percentUsed: 0,
            period: 'monthly' as const,
          };
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

export interface BudgetInfo {
  limit: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  period: 'daily' | 'weekly' | 'monthly';
}

/**
 * Hook to fetch cost history with period filtering
 */
export function useCostHistory(
  filters: CostFilters = {},
  options?: Omit<UseQueryOptions<CostInfo[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: costKeys.history(filters),
    queryFn: async () => {
      const dateRange = getDateRangeForPeriod(filters.period || 'month');
      
      return fetchCostHistory({
        startDate: filters.from || dateRange.from,
        endDate: filters.to || dateRange.to,
        agentId: filters.agentId,
      });
    },
    staleTime: 60 * 1000,
    ...options,
  });
}

/**
 * Hook to fetch daily cost breakdown
 */
export function useDailyCosts(
  period: string = 'week',
  options?: Omit<UseQueryOptions<DailyCost[]>, 'queryKey' | 'queryFn'>
) {
  const { reportMockFallback } = useMockDataContext();
  const reportedRef = useRef(false);

  return useQuery({
    queryKey: costKeys.daily(period),
    queryFn: async () => {
      if (shouldUseMockData()) {
        if (!reportedRef.current) {
          reportMockFallback('useDailyCosts', 'NEXT_PUBLIC_API_URL not configured');
          reportedRef.current = true;
        }
        return [];
      }

      try {
        // Map period names to API format
        const periodMap: Record<string, string> = {
          today: '1d',
          yesterday: '2d',
          week: '7d',
          month: '30d',
          quarter: '90d',
          year: '365d',
        };
        const apiPeriod = periodMap[period] || '30d';
        const data = await apiRequest<DailyCost[]>(`/api/client/costs/daily?period=${apiPeriod}`);
        return data ?? [];
      } catch (error) {
        console.warn('[useDailyCosts] API request failed:', error);
        if (!reportedRef.current) {
          reportMockFallback('useDailyCosts', `API request failed: ${(error as Error).message}`);
          reportedRef.current = true;
        }
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

/**
 * Hook to fetch costs grouped by model
 */
export function useCostsByModel(
  period: string = 'month',
  options?: Omit<UseQueryOptions<CostByModel[]>, 'queryKey' | 'queryFn'>
) {
  const { reportMockFallback } = useMockDataContext();
  const reportedRef = useRef(false);

  return useQuery({
    queryKey: costKeys.byModel(period),
    queryFn: async () => {
      if (shouldUseMockData()) {
        if (!reportedRef.current) {
          reportMockFallback('useCostsByModel', 'NEXT_PUBLIC_API_URL not configured');
          reportedRef.current = true;
        }
        return [];
      }

      const modelColors: Record<string, string> = {
        'gpt-4': 'bg-violet-500',
        'gpt-4-turbo': 'bg-violet-400',
        'gpt-4o': 'bg-violet-600',
        'gpt-4o-mini': 'bg-emerald-500',
        'gpt-3.5-turbo': 'bg-emerald-400',
        'claude-3': 'bg-blue-500',
        'claude-3-opus': 'bg-blue-600',
        'claude-3-sonnet': 'bg-blue-400',
        'claude-3-haiku': 'bg-blue-300',
      };

      try {
        const periodMap: Record<string, string> = {
          today: '1d',
          yesterday: '2d',
          week: '7d',
          month: '30d',
          quarter: '90d',
          year: '365d',
        };
        const apiPeriod = periodMap[period] || '30d';
        interface ByModelEntry {
          model: string;
          provider: string;
          cost: number;
          requests: number;
          tokens: number;
          usage: number;
        }
        const data = await apiRequest<ByModelEntry[]>(`/api/client/costs/by-model?period=${apiPeriod}`);
        
        return (data ?? []).map(entry => {
          const colorKey = Object.keys(modelColors).find(k => entry.model.toLowerCase().includes(k));
          return {
            model: entry.model,
            usage: entry.usage,
            cost: entry.cost,
            tokens: entry.tokens,
            color: colorKey ? modelColors[colorKey]! : 'bg-amber-500',
          };
        });
      } catch (error) {
        console.warn('[useCostsByModel] API request failed:', error);
        if (!reportedRef.current) {
          reportMockFallback('useCostsByModel', `API request failed: ${(error as Error).message}`);
          reportedRef.current = true;
        }
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

/**
 * Hook for cost prediction (placeholder - needs backend implementation)
 */
export function useCostPrediction(
  options?: Omit<UseQueryOptions<CostPrediction>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: costKeys.prediction(),
    queryFn: async () => {
      // TODO: Implement when backend endpoint is ready
      const summary = await fetchCostSummary();
      
      // Simple linear projection based on current spend
      const today = new Date();
      const dayOfMonth = today.getDate();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      
      const projectedMonthEnd = (summary.total / dayOfMonth) * daysInMonth;
      
      return {
        currentSpend: summary.total,
        projectedMonthEnd: Math.round(projectedMonthEnd * 100) / 100,
        confidence: 70, // Low confidence for simple projection
        confidenceRange: {
          low: projectedMonthEnd * 0.8,
          high: projectedMonthEnd * 1.2,
        },
        trend: 'stable' as const,
        trendPercentage: 0,
        basedOnDays: dayOfMonth,
      };
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    ...options,
  });
}

export interface CostPrediction {
  currentSpend: number;
  projectedMonthEnd: number;
  confidence: number;
  confidenceRange: {
    low: number;
    high: number;
  };
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
  basedOnDays: number;
}

/**
 * Export cost report
 */
export async function exportCostReport(
  period: string,
  format: 'csv' | 'pdf' = 'csv'
): Promise<void> {
  const dateRange = getDateRangeForPeriod(period as CostFilters['period']);
  const costs = await fetchCostHistory({
    startDate: dateRange.from,
    endDate: dateRange.to,
  });
  
  if (format === 'csv') {
    const headers = ['timestamp', 'model', 'tokens', 'cost', 'executionId'];
    const rows = costs.map(c => [
      `"${c.timestamp}"`,
      c.model,
      c.totalTokens.toString(),
      c.cost.toFixed(4),
      c.executionId,
    ]);
    const content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cost-report-${period}-${formatDate(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  // TODO: Implement PDF generation when backend supports it
}

/**
 * Helper to get date range for a period
 */
function getDateRangeForPeriod(period?: CostFilters['period']): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  
  switch (period) {
    case 'today':
      return { from: startOfDay(now).toISOString(), to };
    case 'yesterday':
      const yesterday = subDays(now, 1);
      return { 
        from: startOfDay(yesterday).toISOString(), 
        to: startOfDay(now).toISOString() 
      };
    case 'week':
      return { from: startOfWeek(now).toISOString(), to };
    case 'month':
      return { from: startOfMonth(now).toISOString(), to };
    case 'quarter':
      return { from: startOfQuarter(now).toISOString(), to };
    case 'year':
      return { from: startOfYear(now).toISOString(), to };
    default:
      return { from: startOfMonth(now).toISOString(), to };
  }
}
