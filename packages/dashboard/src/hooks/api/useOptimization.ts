import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthToken } from '@/lib/auth-utils';
import { API_URL } from '@/lib/config';

const API_BASE = API_URL;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (typeof window !== 'undefined') {
    const token = getAuthToken();
    if (token) {
      headers['X-Client-Token'] = token;
    }
  }
  return headers;
}

/**
 * Interfaces
 */
export interface OptimizationRecommendation {
  id: string;
  title: string;
  description: string;
  estimatedSavings: number;
  priority: number;
  implementation: string;
  impact: 'high' | 'medium' | 'low';
}

export interface OptimizationReport {
  organizationId: string;
  period: { start: string; end: string };
  summary: {
    totalCost: number;
    potentialSavings: number;
    inefficiencies: number;
  };
  recommendations: OptimizationRecommendation[];
}

export interface ModelInfo {
  model: string;
  provider: 'openai' | 'anthropic' | 'cohere' | 'google' | 'azure';
  tier: string;
  pricing: {
    inputPer1kTokens: number;
    outputPer1kTokens: number;
  };
  contextWindow: number;
  capabilities: string[];
}

export interface ModelAlternative {
  model: string;
  provider: string;
  estimatedCost: number;
  savingsPercent: number;
  capabilities: string[];
  tradeoffs: string;
}

export interface RoutingRule {
  id: string;
  name: string;
  priority: number;
  conditions: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  action: {
    type: 'route_to' | 'throttle' | 'reject';
    model?: string;
    maxRequests?: number;
    reason?: string;
  };
}

export interface CostEstimate {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  breakdown: {
    inputCost: number;
    outputCost: number;
  };
  currency: string;
}

/**
 * Query keys
 */
export const optimizationKeys = {
  all: ['optimization'] as const,
  report: () => [...optimizationKeys.all, 'report'] as const,
  models: () => [...optimizationKeys.all, 'models'] as const,
  rules: () => [...optimizationKeys.all, 'rules'] as const,
  compressionStats: () => [...optimizationKeys.all, 'compressionStats'] as const,
  compressionSettings: () => [...optimizationKeys.all, 'compressionSettings'] as const,
  systemPrompts: () => [...optimizationKeys.all, 'systemPrompts'] as const,
  systemPromptTemplates: () => [...optimizationKeys.all, 'systemPromptTemplates'] as const,
};

/**
 * Hook to fetch optimization report
 */
export function useOptimizationReport() {
  return useQuery({
    queryKey: optimizationKeys.report(),
    queryFn: async (): Promise<OptimizationReport> => {
      const response = await fetch(`${API_BASE}/api/client/optimization/report`, {
        headers: getHeaders(),
      });

      if (!response.ok) throw new Error('Failed to fetch optimization report');
      return response.json();
    },
    staleTime: 15 * 60 * 1000,
  });
}

/**
 * Hook to fetch available models
 */
export function useAvailableModels() {
  return useQuery({
    queryKey: optimizationKeys.models(),
    queryFn: async (): Promise<{ models: ModelInfo[] }> => {
      const response = await fetch(`${API_BASE}/api/client/optimization/models`, {
        headers: getHeaders(),
      });

      if (!response.ok) throw new Error('Failed to fetch models');
      return response.json();
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

/**
 * Hook to fetch routing rules
 */
export function useRoutingRules() {
  return useQuery({
    queryKey: optimizationKeys.rules(),
    queryFn: async (): Promise<{ rules: RoutingRule[] }> => {
      const response = await fetch(`${API_BASE}/api/client/optimization/rules`, {
        headers: getHeaders(),
      });

      if (!response.ok) throw new Error('Failed to fetch routing rules');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to estimate cost
 */
export function useEstimateCost() {
  return useMutation({
    mutationFn: async ({
      model,
      inputTokens,
      outputTokens,
    }: {
      model: string;
      inputTokens: number;
      outputTokens: number;
    }): Promise<CostEstimate> => {
      const response = await fetch(`${API_BASE}/api/client/optimization/estimate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ model, inputTokens, outputTokens }),
      });

      if (!response.ok) throw new Error('Failed to estimate cost');
      return response.json();
    },
  });
}

/**
 * Hook to find cheaper alternatives
 */
export function useFindAlternatives() {
  return useMutation({
    mutationFn: async ({
      model,
      maxAlternatives = 5,
      minSavingsPercent = 0,
    }: {
      model: string;
      maxAlternatives?: number;
      minSavingsPercent?: number;
    }): Promise<{ currentModel: string; alternatives: ModelAlternative[] }> => {
      const response = await fetch(`${API_BASE}/api/client/optimization/alternatives`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ model, maxAlternatives, minSavingsPercent }),
      });

      if (!response.ok) throw new Error('Failed to find alternatives');
      return response.json();
    },
  });
}

/**
 * Hook to add a routing rule
 */
export function useAddRoutingRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: Omit<RoutingRule, 'id'>): Promise<{ message: string; rule: RoutingRule }> => {
      const response = await fetch(`${API_BASE}/api/client/optimization/rules`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(rule),
      });

      if (!response.ok) throw new Error('Failed to add routing rule');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: optimizationKeys.rules() });
    },
  });
}

/**
 * Hook to delete a routing rule
 */
export function useDeleteRoutingRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ruleId: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/api/client/optimization/rules/${ruleId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });

      if (!response.ok) throw new Error('Failed to delete routing rule');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: optimizationKeys.rules() });
    },
  });
}

// ============================================
// Phase 4 — Compression Hooks
// ============================================

export interface CompressionStats {
  totalRequests: number;
  compressedRequests: number;
  compressionRate: number;
  totalSavedTokens: number;
  totalSavedUsd: number;
  avgCompressionPercent: number;
  period: string;
}

export interface CompressionSettings {
  compressionEnabled: boolean;
  minCompressionRatio: number;
  updatedAt?: string;
}

export interface PromptAnalysisResult {
  originalTokens: number;
  estimatedCompressedTokens: number;
  compressionRatio: number;
  issues: Array<{
    type: string;
    description: string;
    originalSnippet: string;
    fixedSnippet: string;
    tokensSaved: number;
  }>;
  compressedPrompt: string;
  model: string | null;
}

export interface SystemPromptDuplicate {
  agentIds: string[];
  similarity: number;
  previewA: string;
  previewB: string;
}

export interface SystemPromptTemplate {
  useCase: string;
  name: string;
  template: string;
  estimatedTokens: number;
}

/**
 * Hook to fetch compression stats
 */
export function useCompressionStats(period = '30d') {
  return useQuery({
    queryKey: [...optimizationKeys.compressionStats(), period],
    queryFn: async (): Promise<CompressionStats> => {
      const response = await fetch(`${API_BASE}/api/client/optimization/stats?period=${period}`, {
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch compression stats');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch compression settings
 */
export function useCompressionSettings() {
  return useQuery({
    queryKey: optimizationKeys.compressionSettings(),
    queryFn: async (): Promise<CompressionSettings> => {
      const response = await fetch(`${API_BASE}/api/client/optimization/settings`, {
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to update compression settings
 */
export function useUpdateCompressionSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<CompressionSettings>): Promise<CompressionSettings> => {
      const response = await fetch(`${API_BASE}/api/client/optimization/settings`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(settings),
      });

      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: optimizationKeys.compressionSettings() });
    },
  });
}

/**
 * Hook to analyze a prompt
 */
export function useAnalyzePrompt() {
  return useMutation({
    mutationFn: async ({ prompt, model }: { prompt: string; model?: string }): Promise<PromptAnalysisResult> => {
      const response = await fetch(`${API_BASE}/api/client/optimization/analyze`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ prompt, model }),
      });

      if (!response.ok) throw new Error('Failed to analyze prompt');
      return response.json();
    },
  });
}

/**
 * Hook to fetch system prompt analysis
 */
export function useSystemPrompts() {
  return useQuery({
    queryKey: optimizationKeys.systemPrompts(),
    queryFn: async (): Promise<{ duplicates: SystemPromptDuplicate[] }> => {
      const response = await fetch(`${API_BASE}/api/client/optimization/system-prompts`, {
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch system prompts');
      return response.json();
    },
    staleTime: 15 * 60 * 1000,
  });
}

/**
 * Hook to fetch system prompt templates
 */
export function useSystemPromptTemplates() {
  return useQuery({
    queryKey: optimizationKeys.systemPromptTemplates(),
    queryFn: async (): Promise<{ templates: SystemPromptTemplate[] }> => {
      const response = await fetch(`${API_BASE}/api/client/optimization/system-prompts/templates`, {
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
    staleTime: 60 * 60 * 1000,
  });
}
