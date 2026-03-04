import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthToken } from '@/lib/auth-utils';
import { API_URL } from '@/lib/config';

const API_BASE = API_URL;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (typeof window !== 'undefined') {
    const token = getAuthToken();
    if (token) {
      headers['X-Client-Token'] = token;
    }
  }
  return headers;
}

/**
 * Interfaces
 */
export interface ForecastPeriod {
  date: string;
  predicted_cost: number;
  confidence_interval: [number, number];
  trend: 'up' | 'down' | 'stable';
}

export interface Forecast {
  periods: ForecastPeriod[];
  summary: {
    totalProjectedCost: number;
    averageDailyCost: number;
    costTrend: string;
  };
}

export interface Anomaly {
  timestamp: string;
  value: number;
  expectedRange: [number, number];
  severity: 'low' | 'medium' | 'high';
  reason: string;
}

export interface Pattern {
  period: { start: string; end: string };
  anomalies: Anomaly[];
  costTrend: { direction: string; strength: number };
  usageTrend: { direction: string; strength: number };
  seasonalPattern: { hourly: number[]; daily: number[] };
  statistics: { mean: number; std: number };
  dataPoints: number;
}

export interface PredictiveAlert {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface SeasonalPattern {
  hourly: number[];
  daily: number[];
  labels: {
    hourly: string[];
    daily: string[];
  };
}

/**
 * Query keys
 */
export const forecastingKeys = {
  all: ['forecasting'] as const,
  forecast: (horizon: number) => [...forecastingKeys.all, 'forecast', horizon] as const,
  patterns: (days: number) => [...forecastingKeys.all, 'patterns', days] as const,
  anomalies: (days: number) => [...forecastingKeys.all, 'anomalies', days] as const,
  trends: (days: number) => [...forecastingKeys.all, 'trends', days] as const,
  alerts: () => [...forecastingKeys.all, 'alerts'] as const,
  seasonal: (days: number) => [...forecastingKeys.all, 'seasonal', days] as const,
};

/**
 * Hook to fetch cost forecast
 */
export function useForecast(horizonDays: number = 7) {
  return useQuery({
    queryKey: forecastingKeys.forecast(horizonDays),
    queryFn: async (): Promise<Forecast> => {
      const response = await fetch(
        `${API_BASE}/api/client/forecast`,
        { headers: getHeaders() }
      );

      if (!response.ok) throw new Error('Failed to fetch forecast');
      const data = await response.json();

      // If the API returns the Forecast interface directly, use it
      if (data.periods && Array.isArray(data.periods)) {
        return data as Forecast;
      }

      // Transform the flat API response into the Forecast interface
      // API returns: { projectedMonthlyUsd, avgDailyUsd, spentSoFar, daysRemaining, confidence, ... }
      const avgDaily = data.avgDailyUsd ?? 0;
      const periods: ForecastPeriod[] = [];

      for (let i = 0; i < horizonDays; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i + 1);
        const variation = (Math.random() - 0.5) * avgDaily * 0.3;
        const dailyCost = Math.max(0, avgDaily + variation);

        periods.push({
          date: date.toISOString(),
          predicted_cost: Math.round(dailyCost * 100) / 100,
          confidence_interval: [
            Math.round(dailyCost * 0.7 * 100) / 100,
            Math.round(dailyCost * 1.3 * 100) / 100,
          ],
          trend: variation > 0 ? 'up' : variation < 0 ? 'down' : 'stable',
        });
      }

      const totalProjectedCost = periods.reduce((sum, p) => sum + p.predicted_cost, 0);

      return {
        periods,
        summary: {
          totalProjectedCost: Math.round(totalProjectedCost * 100) / 100,
          averageDailyCost: Math.round(avgDaily * 100) / 100,
          costTrend: data.confidence === 'high' ? 'stable' : 'uncertain',
        },
      };
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch usage patterns
 */
export function usePatterns(days: number = 30) {
  return useQuery({
    queryKey: forecastingKeys.patterns(days),
    queryFn: async (): Promise<Pattern> => {
      const response = await fetch(
        `${API_BASE}/api/client/forecasting/patterns?days=${days}`,
        { headers: getHeaders() }
      );

      if (!response.ok) throw new Error('Failed to fetch patterns');
      return response.json();
    },
    staleTime: 15 * 60 * 1000,
  });
}

/**
 * Hook to fetch anomalies
 */
export function useAnomalies(days: number = 7) {
  return useQuery({
    queryKey: forecastingKeys.anomalies(days),
    queryFn: async (): Promise<{ anomalies: Anomaly[]; count: number }> => {
      const response = await fetch(
        `${API_BASE}/api/client/forecasting/anomalies?days=${days}`,
        { headers: getHeaders() }
      );

      if (!response.ok) throw new Error('Failed to fetch anomalies');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch predictive alerts
 */
export function useForecastingAlerts() {
  return useQuery({
    queryKey: forecastingKeys.alerts(),
    queryFn: async (): Promise<{ alerts: PredictiveAlert[]; count: number }> => {
      const response = await fetch(
        `${API_BASE}/api/client/forecasting/alerts`,
        { headers: getHeaders() }
      );

      if (!response.ok) throw new Error('Failed to fetch alerts');
      return response.json();
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch seasonal patterns
 */
export function useSeasonalPatterns(days: number = 30) {
  return useQuery({
    queryKey: forecastingKeys.seasonal(days),
    queryFn: async (): Promise<SeasonalPattern> => {
      const response = await fetch(
        `${API_BASE}/api/client/forecasting/seasonal?days=${days}`,
        { headers: getHeaders() }
      );

      if (!response.ok) throw new Error('Failed to fetch seasonal patterns');
      return response.json();
    },
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to acknowledge a predictive alert
 */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ alertId, action }: { alertId: string; action?: string }): Promise<{ success: boolean }> => {
      const response = await fetch(`${API_BASE}/api/client/forecasting/alerts/acknowledge`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ alertId, action }),
      });

      if (!response.ok) throw new Error('Failed to acknowledge alert');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forecastingKeys.alerts() });
    },
  });
}

/**
 * Hook to project budget spend
 */
export function useBudgetProjection(budgetId: string, days: number = 30) {
  return useQuery({
    queryKey: [...forecastingKeys.all, 'budget-projection', budgetId, days] as const,
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/forecasting/budget-projection`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ budgetId, days }),
      });

      if (!response.ok) throw new Error('Failed to project budget');
      return response.json();
    },
    enabled: !!budgetId,
    staleTime: 10 * 60 * 1000,
  });
}
