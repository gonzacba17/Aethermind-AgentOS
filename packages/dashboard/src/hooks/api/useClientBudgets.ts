import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export const clientBudgetKeys = {
  all: ['clientBudgets'] as const,
  list: () => [...clientBudgetKeys.all, 'list'] as const,
  status: () => [...clientBudgetKeys.all, 'status'] as const,
};

export interface BudgetEvaluation {
  status: 'ok' | 'warning' | 'exceeded';
  percentUsed: number;
  remaining: number;
  spent: number;
  limit: number;
  period: 'daily' | 'weekly' | 'monthly';
  budgetId?: string;
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

export function useClientBudgets() {
  return useQuery({
    queryKey: clientBudgetKeys.list(),
    queryFn: () => apiRequest<{ budgets: ClientBudget[] }>('/api/client/budgets'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useClientBudgetStatus() {
  return useQuery({
    queryKey: clientBudgetKeys.status(),
    queryFn: async () => {
      try {
        return await apiRequest<BudgetEvaluation>('/api/client/budget-status');
      } catch (error) {
        if ((error as any).status === 404) {
          return null; // No budget configured
        }
        throw error;
      }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useCreateClientBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClientBudgetData) =>
      apiRequest<{ budget: ClientBudget; updated: boolean }>('/api/client/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      apiRequest<{ deleted: boolean }>(`/api/client/budgets/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientBudgetKeys.all });
    },
  });
}
