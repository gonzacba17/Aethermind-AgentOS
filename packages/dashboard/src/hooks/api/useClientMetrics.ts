import { useQuery } from '@tanstack/react-query';
import { API_URL } from '@/lib/config';

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

// ---------- Fetch helpers ----------

async function fetchWithClientToken<T>(path: string): Promise<T> {
  const token = localStorage.getItem('clientToken') || '';
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'X-Client-Token': token,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}`);
  }
  return res.json();
}

// ---------- Hooks ----------

/**
 * Totals: cost, tokens, events, avg latency, error count, success rate
 */
export function useClientMetrics(period: string = '30d') {
  return useQuery({
    queryKey: clientMetricsKeys.totals(period),
    queryFn: () =>
      fetchWithClientToken<ClientMetrics>(
        `/api/client/metrics?period=${period}`,
      ),
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
      const res = await fetchWithClientToken<{ data: ClientMetricsByModel[]; period: string }>(
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
      const res = await fetchWithClientToken<{ data: ClientTimeseriesPoint[]; period: string }>(
        `/api/client/metrics/timeseries?period=${period}`,
      );
      return res.data;
    },
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
}
