import { useQuery } from '@tanstack/react-query';
import { API_URL } from '@/lib/config';

export const clientAnalyticsKeys = {
  all: ['clientAnalytics'] as const,
  agents: (period: string) => [...clientAnalyticsKeys.all, 'agents', period] as const,
  workflows: (period: string) => [...clientAnalyticsKeys.all, 'workflows', period] as const,
  comparison: (period: string) => [...clientAnalyticsKeys.all, 'comparison', period] as const,
};

export interface AgentCost {
  agentId: string;
  cost: number;
  tokens: number;
  requests: number;
  avgLatency: number;
}

export interface WorkflowCost {
  sessionId: string;
  cost: number;
  tokens: number;
  requests: number;
  avgLatency: number;
}

export interface PeriodComparison {
  period: string;
  current: { cost: number; tokens: number; requests: number };
  previous: { cost: number; tokens: number; requests: number };
  delta: { cost: number; costPercent: number; tokens: number; requests: number };
}

async function fetchWithClientToken<T>(path: string): Promise<T> {
  const token = localStorage.getItem('clientToken') || '';
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

export function useAgentCosts(period: string = '30d') {
  return useQuery({
    queryKey: clientAnalyticsKeys.agents(period),
    queryFn: async () => {
      const res = await fetchWithClientToken<{ data: AgentCost[]; period: string }>(
        `/api/client/analytics/agents?period=${period}`,
      );
      return res.data;
    },
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });
}

export function useWorkflowCosts(period: string = '30d') {
  return useQuery({
    queryKey: clientAnalyticsKeys.workflows(period),
    queryFn: async () => {
      const res = await fetchWithClientToken<{ data: WorkflowCost[]; period: string }>(
        `/api/client/analytics/workflows?period=${period}`,
      );
      return res.data;
    },
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });
}

export function usePeriodComparison(period: string = 'month') {
  return useQuery({
    queryKey: clientAnalyticsKeys.comparison(period),
    queryFn: () =>
      fetchWithClientToken<PeriodComparison>(`/api/client/analytics/comparison?period=${period}`),
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });
}

export function exportAnalyticsCSV(period: string = '30d'): void {
  const token = localStorage.getItem('clientToken') || '';
  const url = `${API_URL}/api/client/analytics/export?period=${period}`;

  fetch(url, {
    headers: { 'X-Client-Token': token },
    credentials: 'include',
  })
    .then((res) => res.blob())
    .then((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `aethermind-usage-${period}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    })
    .catch((err) => console.error('CSV export failed:', err));
}
