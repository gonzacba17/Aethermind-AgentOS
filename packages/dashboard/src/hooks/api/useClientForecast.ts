import { useQuery } from '@tanstack/react-query';
import { API_URL } from '@/lib/config';
import { getAuthToken } from '@/lib/auth-utils';

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

async function fetchWithClientToken<T>(path: string): Promise<T> {
  const token = getAuthToken() || '';
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'X-Client-Token': token,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export function useClientForecast() {
  return useQuery({
    queryKey: clientForecastKeys.monthly(),
    queryFn: () => fetchWithClientToken<ClientForecast>('/api/client/forecast'),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function useClientForecastByModel() {
  return useQuery({
    queryKey: clientForecastKeys.byModel(),
    queryFn: async () => {
      const res = await fetchWithClientToken<{ data: ModelForecast[]; daysRemaining: number }>(
        '/api/client/forecast/by-model',
      );
      return res.data;
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}
