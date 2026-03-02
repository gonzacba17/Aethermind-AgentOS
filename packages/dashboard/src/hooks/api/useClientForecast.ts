import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export const clientForecastKeys = {
  all: ['clientForecast'] as const,
  monthly: () => [...clientForecastKeys.all, 'monthly'] as const,
  byModel: () => [...clientForecastKeys.all, 'byModel'] as const,
};

export interface ClientForecast {
  projectedMonthlyUsd: number;
  avgDailyUsd: number;
  spentSoFar: number;
  daysRemaining: number;
  daysWithData: number;
  confidence: 'low' | 'medium' | 'high';
  budget: {
    limitUsd: number;
    percentProjected: number | null;
  } | null;
}

export interface ModelForecast {
  model: string;
  projectedMonthlyUsd: number;
  avgDailyUsd: number;
  spentSoFar: number;
  confidence: 'low' | 'medium' | 'high';
}

export function useClientForecast() {
  return useQuery({
    queryKey: clientForecastKeys.monthly(),
    queryFn: () => apiRequest<ClientForecast>('/api/client/forecast'),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function useClientForecastByModel() {
  return useQuery({
    queryKey: clientForecastKeys.byModel(),
    queryFn: async () => {
      const res = await apiRequest<{ data: ModelForecast[]; daysRemaining: number }>(
        '/api/client/forecast/by-model',
      );
      return res.data;
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}
