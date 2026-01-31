import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthToken } from '@/lib/auth-utils';
import { shouldUseMockData } from '@/lib/mock-data';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (typeof window !== 'undefined') {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
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

// Mock data generators
function generateMockForecast(horizonDays: number): Forecast {
  const periods: ForecastPeriod[] = [];
  let baseCost = 5 + Math.random() * 10;

  for (let i = 0; i < horizonDays; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i + 1);
    const variation = (Math.random() - 0.5) * 2;
    const cost = baseCost + variation;
    baseCost = cost;

    periods.push({
      date: date.toISOString(),
      predicted_cost: cost,
      confidence_interval: [cost * 0.8, cost * 1.2],
      trend: variation > 0.5 ? 'up' : variation < -0.5 ? 'down' : 'stable',
    });
  }

  const totalProjectedCost = periods.reduce((sum, p) => sum + p.predicted_cost, 0);

  return {
    periods,
    summary: {
      totalProjectedCost,
      averageDailyCost: totalProjectedCost / horizonDays,
      costTrend: 'stable',
    },
  };
}

function generateMockAnomalies(): Anomaly[] {
  return [
    {
      timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
      value: 25.5,
      expectedRange: [8, 15],
      severity: 'high',
      reason: 'Unusual spike in API calls',
    },
    {
      timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
      value: 18.2,
      expectedRange: [10, 16],
      severity: 'medium',
      reason: 'Above average token usage',
    },
  ];
}

function generateMockAlerts(): PredictiveAlert[] {
  return [
    {
      id: 'alert-1',
      type: 'budget_forecast',
      priority: 'high',
      message: 'Projected to exceed monthly budget by 15% at current rate',
      timestamp: new Date().toISOString(),
      acknowledged: false,
    },
    {
      id: 'alert-2',
      type: 'anomaly',
      priority: 'medium',
      message: 'Unusual usage pattern detected in the last 24 hours',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      acknowledged: true,
    },
  ];
}

/**
 * Hook to fetch cost forecast
 */
export function useForecast(horizonDays: number = 7) {
  return useQuery({
    queryKey: forecastingKeys.forecast(horizonDays),
    queryFn: async (): Promise<Forecast> => {
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 800));
        return generateMockForecast(horizonDays);
      }

      try {
        const response = await fetch(
          `${API_BASE}/api/forecasting/forecast?horizonDays=${horizonDays}`,
          { headers: getHeaders() }
        );

        if (!response.ok) throw new Error('Failed to fetch forecast');
        const data = await response.json();
        return data.forecast || data;
      } catch (error) {
        console.warn('[useForecast] API failed, using mock data:', error);
        return generateMockForecast(horizonDays);
      }
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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 600));
        return {
          period: {
            start: new Date(Date.now() - days * 86400000).toISOString(),
            end: new Date().toISOString(),
          },
          anomalies: generateMockAnomalies(),
          costTrend: { direction: 'up', strength: 0.3 },
          usageTrend: { direction: 'stable', strength: 0.1 },
          seasonalPattern: {
            hourly: Array(24).fill(0).map(() => Math.random() * 10),
            daily: [0.8, 1.2, 1.1, 1.0, 0.9, 0.6, 0.5],
          },
          statistics: { mean: 12.5, std: 3.2 },
          dataPoints: days * 24,
        };
      }

      try {
        const response = await fetch(
          `${API_BASE}/api/forecasting/patterns?days=${days}`,
          { headers: getHeaders() }
        );

        if (!response.ok) throw new Error('Failed to fetch patterns');
        return response.json();
      } catch (error) {
        console.warn('[usePatterns] API failed, using mock data:', error);
        return {
          period: {
            start: new Date(Date.now() - days * 86400000).toISOString(),
            end: new Date().toISOString(),
          },
          anomalies: generateMockAnomalies(),
          costTrend: { direction: 'up', strength: 0.3 },
          usageTrend: { direction: 'stable', strength: 0.1 },
          seasonalPattern: {
            hourly: Array(24).fill(0).map(() => Math.random() * 10),
            daily: [0.8, 1.2, 1.1, 1.0, 0.9, 0.6, 0.5],
          },
          statistics: { mean: 12.5, std: 3.2 },
          dataPoints: days * 24,
        };
      }
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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 500));
        const anomalies = generateMockAnomalies();
        return { anomalies, count: anomalies.length };
      }

      try {
        const response = await fetch(
          `${API_BASE}/api/forecasting/anomalies?days=${days}`,
          { headers: getHeaders() }
        );

        if (!response.ok) throw new Error('Failed to fetch anomalies');
        return response.json();
      } catch (error) {
        console.warn('[useAnomalies] API failed, using mock data:', error);
        const anomalies = generateMockAnomalies();
        return { anomalies, count: anomalies.length };
      }
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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 400));
        const alerts = generateMockAlerts();
        return { alerts, count: alerts.length };
      }

      try {
        const response = await fetch(
          `${API_BASE}/api/forecasting/alerts`,
          { headers: getHeaders() }
        );

        if (!response.ok) throw new Error('Failed to fetch alerts');
        return response.json();
      } catch (error) {
        console.warn('[useForecastingAlerts] API failed, using mock data:', error);
        const alerts = generateMockAlerts();
        return { alerts, count: alerts.length };
      }
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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 500));
        return {
          hourly: Array(24).fill(0).map((_, i) => {
            // Simulate higher usage during work hours
            if (i >= 9 && i <= 17) return 5 + Math.random() * 10;
            return 1 + Math.random() * 3;
          }),
          daily: [3.5, 8.2, 9.1, 8.8, 8.5, 5.2, 4.1], // Sun-Sat
          labels: {
            hourly: Array(24).fill(0).map((_, i) => `${i}:00`),
            daily: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          },
        };
      }

      try {
        const response = await fetch(
          `${API_BASE}/api/forecasting/seasonal?days=${days}`,
          { headers: getHeaders() }
        );

        if (!response.ok) throw new Error('Failed to fetch seasonal patterns');
        return response.json();
      } catch (error) {
        console.warn('[useSeasonalPatterns] API failed, using mock data:', error);
        return {
          hourly: Array(24).fill(0).map((_, i) => {
            if (i >= 9 && i <= 17) return 5 + Math.random() * 10;
            return 1 + Math.random() * 3;
          }),
          daily: [3.5, 8.2, 9.1, 8.8, 8.5, 5.2, 4.1],
          labels: {
            hourly: Array(24).fill(0).map((_, i) => `${i}:00`),
            daily: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          },
        };
      }
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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 300));
        return { success: true };
      }

      const response = await fetch(`${API_BASE}/api/forecasting/alerts/acknowledge`, {
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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 700));
        const currentSpend = 45;
        const limitAmount = 100;
        const projectedFinalSpend = currentSpend + (Math.random() * 60 + 20);

        return {
          budgetId,
          budgetName: 'Monthly AI Budget',
          currentSpend,
          limitAmount,
          projectedFinalSpend,
          willExceed: projectedFinalSpend > limitAmount,
          daysUntilExceeded: projectedFinalSpend > limitAmount ? Math.floor(Math.random() * 10) + 5 : undefined,
          confidence: 0.82,
          projection: Array(days).fill(0).map((_, i) => ({
            date: new Date(Date.now() + i * 86400000).toISOString(),
            projectedSpend: currentSpend + (projectedFinalSpend - currentSpend) * (i / days),
            remainingBudget: limitAmount - (currentSpend + (projectedFinalSpend - currentSpend) * (i / days)),
            utilizationPercent: ((currentSpend + (projectedFinalSpend - currentSpend) * (i / days)) / limitAmount) * 100,
          })),
        };
      }

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
