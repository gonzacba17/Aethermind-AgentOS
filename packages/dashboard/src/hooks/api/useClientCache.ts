'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';

// ============================================
// Types
// ============================================

export interface CacheSettings {
  enabled: boolean;
  similarityThreshold: number;
  ttlSeconds: number;
  deterministicTtlSeconds: number | null;
  updatedAt?: string;
}

export interface CacheStats {
  hitRate: number;
  totalRequests: number;
  cacheHits: number;
  totalSavedUsd: number;
  cacheSize: number;
  deterministicCount: number;
  topCachedPrompts: Array<{
    promptPreview: string;
    hitCount: number;
    savedUsd: number;
  }>;
  period: string;
}

// ============================================
// Query Keys
// ============================================

export const clientCacheKeys = {
  settings: ['client-cache-settings'] as const,
  stats: (period: string) => ['client-cache-stats', period] as const,
};

// ============================================
// Hooks
// ============================================

export function useCacheStats(period: string = '30d') {
  return useQuery<CacheStats>({
    queryKey: clientCacheKeys.stats(period),
    queryFn: () => apiRequest<CacheStats>(`/api/client/cache/stats?period=${period}`),
    staleTime: 30_000,
  });
}

export function useCacheSettings() {
  return useQuery<CacheSettings>({
    queryKey: clientCacheKeys.settings,
    queryFn: () => apiRequest<CacheSettings>('/api/client/cache/settings'),
    staleTime: 30_000,
  });
}

export function useUpdateCacheSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: Partial<CacheSettings>) =>
      apiRequest<CacheSettings>('/api/client/cache/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientCacheKeys.settings });
    },
  });
}

export function usePurgeCache() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<{ purged: number }>('/api/client/cache/entries', {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientCacheKeys.settings });
      queryClient.invalidateQueries({ queryKey: ['client-cache-stats'] });
    },
  });
}
