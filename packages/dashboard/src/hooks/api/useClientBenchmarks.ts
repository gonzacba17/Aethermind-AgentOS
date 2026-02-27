'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';

// ============================================
// Types
// ============================================

export interface BenchmarkData {
  avgCostPerRequest: number;
  p50CostPerRequest: number;
  p90CostPerRequest: number;
  avgCacheHitRate: number;
  avgCompressionRatio: number;
  sampleSize: number;
}

export interface ClientBenchmarkMetrics {
  costPerRequest: number;
  cacheHitRate: number;
  compressionRatio: number;
  totalRequests: number;
}

export interface BenchmarkComparison {
  client: ClientBenchmarkMetrics;
  benchmark: BenchmarkData | null;
  reason?: string;
  insights: string[];
}

// ============================================
// Query Keys
// ============================================

export const clientBenchmarkKeys = {
  all: ['client-benchmarks'] as const,
  comparison: () => [...clientBenchmarkKeys.all, 'comparison'] as const,
};

// ============================================
// Hooks
// ============================================

export function useClientBenchmarks() {
  return useQuery<BenchmarkComparison>({
    queryKey: clientBenchmarkKeys.comparison(),
    queryFn: () => apiRequest<BenchmarkComparison>('/client/benchmarks'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
