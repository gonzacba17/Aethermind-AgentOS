import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/config';
import { getAuthToken } from '@/lib/auth-utils';

export const clientBudgetKeys = {
  all: ['clientBudgets'] as const,
  list: () => [...clientBudgetKeys.all, 'list'] as const,
  status: () => [...clientBudgetKeys.all, 'status'] as const,
};

export interface BudgetEvaluation {
  status: 'ok' | 'warning' | 'exceeded';
  percentUsed: number;
  remaining: number;
  spentUsd: number;
}

export interface ClientBudget {
  id: string;
  clientId: string;
  type: 'monthly' | 'daily';
  limitUsd: number;
  alertThresholds: number[];
  createdAt: string;
  updatedAt: string;
  evaluation: BudgetEvaluation | null;
}

export interface CreateClientBudgetData {
  type: 'monthly' | 'daily';
  limitUsd: number;
  alertThresholds?: number[];
}

async function fetchWithClientToken<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken() || '';
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'X-Client-Token': token,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    ...init,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export function useClientBudgets() {
  return useQuery({
    queryKey: clientBudgetKeys.list(),
    queryFn: () => fetchWithClientToken<{ budgets: ClientBudget[] }>('/api/client/budgets'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useClientBudgetStatus() {
  return useQuery({
    queryKey: clientBudgetKeys.status(),
    queryFn: () => fetchWithClientToken<BudgetEvaluation & { noBudget?: boolean }>('/api/client/budget-status'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useCreateClientBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClientBudgetData) =>
      fetchWithClientToken<{ budget: ClientBudget; updated: boolean }>('/api/client/budgets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientBudgetKeys.all });
    },
  });
}

export function useDeleteClientBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchWithClientToken<{ deleted: boolean }>(`/api/client/budgets/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientBudgetKeys.all });
    },
  });
}
