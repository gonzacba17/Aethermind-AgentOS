'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';

// ============================================
// Types
// ============================================

export interface RoutingRules {
  id?: string;
  enabled: boolean;
  simpleModel: string;
  mediumModel: string;
  complexModel: string;
  updatedAt?: string;
}

export interface ProviderHealthEntry {
  provider: string;
  status: 'ok' | 'degraded' | 'down';
  latencyMs: number | null;
  lastCheckedAt: string | null;
  errorMessage: string | null;
  avg24hLatency: number | null;
  requests24h: number;
}

export interface OptimizationData {
  totalCost: number;
  totalRequests: number;
  expensiveModelCost: number;
  expensiveModelCount: number;
  redirectablePercent: number;
  estimatedMonthlySavings: number;
  routedRequests: number;
  period: string;
}

export interface ABInsightEntry {
  originalModel: string;
  routedModel: string;
  avgCost: number;
  count: number;
  avgLatency: number;
  fallbackCount: number;
  qualityRating: string;
}

// ============================================
// Hooks
// ============================================

export function useRoutingRules() {
  return useQuery<RoutingRules>({
    queryKey: ['routing-rules'],
    queryFn: () => apiRequest<RoutingRules>('/client/routing/rules'),
    staleTime: 30_000,
  });
}

export function useUpdateRoutingRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rules: Partial<RoutingRules> & { enabled: boolean }) =>
      apiRequest<{ rule: RoutingRules; created: boolean }>('/client/routing/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rules),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routing-rules'] });
    },
  });
}

export function useProviderHealth() {
  return useQuery<{ providers: ProviderHealthEntry[] }>({
    queryKey: ['provider-health'],
    queryFn: () => apiRequest<{ providers: ProviderHealthEntry[] }>('/client/routing/provider-health'),
    refetchInterval: 60_000, // Refresh every minute
    staleTime: 30_000,
  });
}

export function useOptimizationData(period: string = '30d') {
  return useQuery<OptimizationData>({
    queryKey: ['optimization-data', period],
    queryFn: () => apiRequest<OptimizationData>(`/client/routing/optimization?period=${period}`),
    staleTime: 60_000,
  });
}

export function useABInsights(period: string = '30d') {
  return useQuery<{ data: ABInsightEntry[]; period: string }>({
    queryKey: ['ab-insights', period],
    queryFn: () => apiRequest<{ data: ABInsightEntry[]; period: string }>(`/client/routing/ab-insights?period=${period}`),
    staleTime: 60_000,
  });
}
