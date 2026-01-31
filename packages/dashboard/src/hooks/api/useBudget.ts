import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { getAuthToken } from '@/lib/auth-utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Query key factory for budgets
 */
export const budgetKeys = {
  all: ['budgets'] as const,
  current: () => [...budgetKeys.all, 'current'] as const,
  list: () => [...budgetKeys.all, 'list'] as const,
  detail: (id: string) => [...budgetKeys.all, id] as const,
  alerts: () => [...budgetKeys.all, 'alerts'] as const,
};

export interface Budget {
  id: string;
  name: string;
  limitAmount: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  period: 'daily' | 'weekly' | 'monthly';
  scope: 'user' | 'organization' | 'project';
  scopeId?: string;
  alertThresholds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface BudgetStatus {
  limit: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  period: 'daily' | 'weekly' | 'monthly';
  isOverBudget: boolean;
  warningLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

export interface CreateBudgetData {
  name: string;
  limitAmount: number;
  period: 'daily' | 'weekly' | 'monthly';
  scope?: 'user' | 'organization' | 'project';
  scopeId?: string;
  alertThresholds?: number[];
}

/**
 * Get authorization headers
 */
function getHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

/**
 * Hook to fetch current budget status
 * Returns the user's active budget with current spend
 */
export function useBudget(
  options?: Omit<UseQueryOptions<BudgetStatus>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: budgetKeys.current(),
    queryFn: async (): Promise<BudgetStatus> => {
      const response = await fetch(`${API_BASE}/api/costs/budget`, {
        headers: getHeaders(),
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          // No budget configured - return default
          return {
            limit: 0,
            spent: 0,
            remaining: 0,
            percentUsed: 0,
            period: 'monthly',
            isOverBudget: false,
            warningLevel: 'none',
          };
        }
        throw new Error('Failed to fetch budget status');
      }
      
      const data = await response.json();
      
      // Calculate warning level based on percentage used
      const percentUsed = data.percentUsed || (data.limit > 0 ? (data.spent / data.limit) * 100 : 0);
      let warningLevel: BudgetStatus['warningLevel'] = 'none';
      
      if (percentUsed >= 100) warningLevel = 'critical';
      else if (percentUsed >= 90) warningLevel = 'high';
      else if (percentUsed >= 75) warningLevel = 'medium';
      else if (percentUsed >= 50) warningLevel = 'low';
      
      return {
        limit: data.limit || 0,
        spent: data.spent || 0,
        remaining: data.remaining || (data.limit - data.spent) || 0,
        percentUsed: Math.round(percentUsed * 100) / 100,
        period: data.period || 'monthly',
        isOverBudget: percentUsed >= 100,
        warningLevel,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
    ...options,
  });
}

/**
 * Hook to fetch all budgets for the user
 */
export function useBudgets(
  options?: Omit<UseQueryOptions<Budget[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: budgetKeys.list(),
    queryFn: async (): Promise<Budget[]> => {
      const response = await fetch(`${API_BASE}/api/budgets`, {
        headers: getHeaders(),
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error('Failed to fetch budgets');
      }
      
      const data = await response.json();
      return data.budgets || data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
}

/**
 * Hook to create a new budget
 */
export function useCreateBudget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateBudgetData): Promise<Budget> => {
      const response = await fetch(`${API_BASE}/api/budgets`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to create budget');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}

/**
 * Hook to update an existing budget
 */
export function useUpdateBudget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      data 
    }: { 
      id: string; 
      data: Partial<CreateBudgetData> 
    }): Promise<Budget> => {
      const response = await fetch(`${API_BASE}/api/budgets/${id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to update budget');
      }
      
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: budgetKeys.current() });
      queryClient.invalidateQueries({ queryKey: budgetKeys.list() });
    },
  });
}

/**
 * Hook to delete a budget
 */
export function useDeleteBudget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/api/budgets/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete budget');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}

/**
 * Hook to fetch a single budget by ID
 */
export function useBudgetDetail(
  id: string,
  options?: Omit<UseQueryOptions<Budget | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: budgetKeys.detail(id),
    queryFn: async (): Promise<Budget | null> => {
      if (!id) return null;

      const response = await fetch(`${API_BASE}/api/budgets/${id}`, {
        headers: getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch budget');
      }

      return response.json();
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

/**
 * Hook to fetch budget usage (current spend vs limit)
 */
export function useBudgetUsage(budgetId: string) {
  return useQuery({
    queryKey: [...budgetKeys.detail(budgetId), 'usage'] as const,
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/budgets/${budgetId}/usage`, {
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch budget usage');
      }

      return response.json();
    },
    enabled: !!budgetId,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to pause/resume a budget
 */
export function usePauseBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, paused }: { id: string; paused: boolean }): Promise<Budget> => {
      const response = await fetch(`${API_BASE}/api/budgets/${id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: paused ? 'paused' : 'active' }),
      });

      if (!response.ok) {
        throw new Error('Failed to update budget status');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: budgetKeys.list() });
    },
  });
}

/**
 * Budget progress component helper
 * Returns color and status based on budget usage
 */
export function getBudgetProgressInfo(percentUsed: number): {
  color: string;
  bgColor: string;
  status: string;
  variant: 'default' | 'warning' | 'danger';
} {
  if (percentUsed >= 100) {
    return {
      color: 'text-destructive',
      bgColor: 'bg-destructive',
      status: 'Over Budget',
      variant: 'danger',
    };
  }
  if (percentUsed >= 90) {
    return {
      color: 'text-red-500',
      bgColor: 'bg-red-500',
      status: 'Critical',
      variant: 'danger',
    };
  }
  if (percentUsed >= 75) {
    return {
      color: 'text-amber-500',
      bgColor: 'bg-amber-500',
      status: 'Warning',
      variant: 'warning',
    };
  }
  if (percentUsed >= 50) {
    return {
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500',
      status: 'Moderate',
      variant: 'warning',
    };
  }
  return {
    color: 'text-primary',
    bgColor: 'bg-primary',
    status: 'On Track',
    variant: 'default',
  };
}
