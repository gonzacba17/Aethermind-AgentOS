import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { fetchCostSummary, fetchCostHistory, CostSummary, CostInfo } from '@/lib/api';
import { MOCK_COST_SUMMARY, MOCK_COST_HISTORY, shouldUseMockData } from '@/lib/mock-data';
import { 
  startOfDay, 
  startOfWeek, 
  startOfMonth, 
  startOfQuarter, 
  startOfYear,
  subDays,
  format as formatDate,
} from 'date-fns';

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
  return useQuery({
    queryKey: costKeys.summary(),
    queryFn: async () => {
      if (shouldUseMockData()) {
        return MOCK_COST_SUMMARY;
      }
      return fetchCostSummary();
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: shouldUseMockData() ? false : 2 * 60 * 1000, // Don't refetch mock data
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
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/costs/budget`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          // No budget configured - return default
          return {
            limit: 0,
            spent: 0,
            remaining: 0,
            percentUsed: 0,
            period: 'monthly' as const,
          };
        }
        throw new Error('Failed to fetch budget');
      }
      
      return response.json();
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
  return useQuery({
    queryKey: costKeys.daily(period),
    queryFn: async () => {
      const dateRange = getDateRangeForPeriod(period as CostFilters['period']);
      const costs = await fetchCostHistory({
        startDate: dateRange.from,
        endDate: dateRange.to,
      });
      
      // Group by day
      const dailyMap = new Map<string, { cost: number; tokens: number; executions: number }>();
      
      for (const cost of costs) {
        const date = formatDate(new Date(cost.timestamp), 'yyyy-MM-dd');
        const existing = dailyMap.get(date) || { cost: 0, tokens: 0, executions: 0 };
        dailyMap.set(date, {
          cost: existing.cost + cost.cost,
          tokens: existing.tokens + cost.totalTokens,
          executions: existing.executions + 1,
        });
      }
      
      // Convert to array and calculate changes
      const dailyCosts: DailyCost[] = [];
      const sortedDates = Array.from(dailyMap.keys()).sort().reverse();
      
      for (let i = 0; i < sortedDates.length; i++) {
        const date = sortedDates[i];
        const data = dailyMap.get(date)!;
        const prevData = i < sortedDates.length - 1 
          ? dailyMap.get(sortedDates[i + 1]) 
          : null;
        
        const change = prevData && prevData.cost > 0
          ? ((data.cost - prevData.cost) / prevData.cost) * 100
          : 0;
        
        dailyCosts.push({
          date,
          cost: data.cost,
          tokens: data.tokens,
          executions: data.executions,
          change: Math.round(change * 10) / 10,
        });
      }
      
      return dailyCosts.slice(0, 7); // Last 7 days
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
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
  return useQuery({
    queryKey: costKeys.byModel(period),
    queryFn: async () => {
      const summary = await fetchCostSummary();
      
      const modelColors: Record<string, string> = {
        'gpt-4': 'bg-violet-500',
        'gpt-4-turbo': 'bg-violet-400',
        'gpt-3.5-turbo': 'bg-emerald-500',
        'claude-3': 'bg-blue-500',
        'claude-3-opus': 'bg-blue-600',
        'claude-3-sonnet': 'bg-blue-400',
      };
      
      const total = summary.total || 0;
      
      return Object.entries(summary.byModel || {}).map(([model, data]) => ({
        model,
        usage: total > 0 ? Math.round((data.cost / total) * 100) : 0,
        cost: data.cost,
        tokens: data.tokens,
        color: modelColors[model.toLowerCase()] || 'bg-amber-500',
      }));
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
