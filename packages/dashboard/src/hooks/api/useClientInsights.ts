'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';

// ============================================
// Types
// ============================================

export interface ClientInsight {
  id: string;
  type: 'peak_hours' | 'underutilized_agent' | 'overloaded_agent' | 'similar_agents' | 'routing_suggestion' | 'cache_suggestion';
  data: Record<string, unknown>;
  estimatedSavingsUsd: number | null;
  acknowledged: boolean;
  appliedAt?: string | null;
  dismissedAt?: string | null;
  createdAt: string;
}

// ============================================
// Query Keys
// ============================================

export const clientInsightKeys = {
  all: ['client-insights'] as const,
  patterns: () => [...clientInsightKeys.all, 'patterns'] as const,
  history: () => [...clientInsightKeys.all, 'history'] as const,
};

// ============================================
// Hooks
// ============================================

export function useClientInsights() {
  return useQuery<{ insights: ClientInsight[] }>({
    queryKey: clientInsightKeys.patterns(),
    queryFn: () => apiRequest<{ insights: ClientInsight[] }>('/client/insights/patterns'),
    staleTime: 30_000,
  });
}

export function useClientInsightsHistory() {
  return useQuery<{ insights: ClientInsight[] }>({
    queryKey: clientInsightKeys.history(),
    queryFn: () => apiRequest<{ insights: ClientInsight[] }>('/client/insights/history'),
    staleTime: 30_000,
  });
}

export function useApplyInsight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (insightId: string) =>
      apiRequest<{ success: boolean; appliedAt: string }>(`/client/insights/${insightId}/apply`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientInsightKeys.all });
    },
  });
}

export function useDismissInsight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (insightId: string) =>
      apiRequest<{ success: boolean; dismissedAt: string }>(`/client/insights/${insightId}/dismiss`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientInsightKeys.all });
    },
  });
}
