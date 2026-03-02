import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

/**
 * Query key factory for client metrics
 */
export const clientMetricsKeys = {
  all: ['clientMetrics'] as const,
  totals: (period: string) => [...clientMetricsKeys.all, 'totals', period] as const,
  byModel: (period: string) => [...clientMetricsKeys.all, 'byModel', period] as const,
  timeseries: (period: string) => [...clientMetricsKeys.all, 'timeseries', period] as const,
};

// ---------- Types ----------

export interface ClientMetrics {
  totalCost: number;
  totalTokens: number;
  totalEvents: number;
  avgLatency: number;
  errorCount: number;
  successRate: number;
  period: string;
}

export interface ClientMetricsByModel {
  model: string;
  cost: number;
  tokens: number;
  count: number;
  avgLatency: number;
}

export interface ClientTimeseriesPoint {
  date: string;
  cost: number;
  tokens: number;
  events: number;
}

// ---------- Hooks ----------

/**
 * Totals: cost, tokens, events, avg latency, error count, success rate
 */
export function useClientMetrics(period: string = '30d') {
  return useQuery({
    queryKey: clientMetricsKeys.totals(period),
    queryFn: () =>
      apiRequest<ClientMetrics>(`/api/client/metrics?period=${period}`),
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
}

/**
 * Breakdown by model
 */
export function useClientMetricsByModel(period: string = '30d') {
  return useQuery({
    queryKey: clientMetricsKeys.byModel(period),
    queryFn: async () => {
      const res = await apiRequest<{ data: ClientMetricsByModel[]; period: string }>(
        `/api/client/metrics/by-model?period=${period}`,
      );
      return res.data;
    },
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
}

/**
 * Daily time series for charts
 */
export function useClientTimeseries(period: string = '30d') {
  return useQuery({
    queryKey: clientMetricsKeys.timeseries(period),
    queryFn: async () => {
      const res = await apiRequest<{ data: ClientTimeseriesPoint[]; period: string }>(
        `/api/client/metrics/timeseries?period=${period}`,
      );
      return res.data;
    },
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
}
