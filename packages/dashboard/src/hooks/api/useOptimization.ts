import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthToken } from '@/lib/auth-utils';
import { shouldUseMockData } from '@/lib/mock-data';
import { API_URL } from '@/lib/config';

const API_BASE = API_URL;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (typeof window !== 'undefined') {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
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

// Mock data
const MOCK_MODELS: ModelInfo[] = [
  {
    model: 'gpt-4',
    provider: 'openai',
    tier: 'premium',
    pricing: { inputPer1kTokens: 0.03, outputPer1kTokens: 0.06 },
    contextWindow: 8192,
    capabilities: ['reasoning', 'coding', 'analysis'],
  },
  {
    model: 'gpt-4-turbo',
    provider: 'openai',
    tier: 'premium',
    pricing: { inputPer1kTokens: 0.01, outputPer1kTokens: 0.03 },
    contextWindow: 128000,
    capabilities: ['reasoning', 'coding', 'analysis', 'long-context'],
  },
  {
    model: 'gpt-3.5-turbo',
    provider: 'openai',
    tier: 'standard',
    pricing: { inputPer1kTokens: 0.0005, outputPer1kTokens: 0.0015 },
    contextWindow: 16384,
    capabilities: ['general', 'coding'],
  },
  {
    model: 'claude-3-opus',
    provider: 'anthropic',
    tier: 'premium',
    pricing: { inputPer1kTokens: 0.015, outputPer1kTokens: 0.075 },
    contextWindow: 200000,
    capabilities: ['reasoning', 'analysis', 'long-context'],
  },
  {
    model: 'claude-3-sonnet',
    provider: 'anthropic',
    tier: 'standard',
    pricing: { inputPer1kTokens: 0.003, outputPer1kTokens: 0.015 },
    contextWindow: 200000,
    capabilities: ['general', 'coding', 'analysis'],
  },
  {
    model: 'claude-3-haiku',
    provider: 'anthropic',
    tier: 'economy',
    pricing: { inputPer1kTokens: 0.00025, outputPer1kTokens: 0.00125 },
    contextWindow: 200000,
    capabilities: ['general', 'fast'],
  },
];

const MOCK_RECOMMENDATIONS: OptimizationRecommendation[] = [
  {
    id: '1',
    title: 'Switch to GPT-3.5-Turbo for simple queries',
    description: 'Analysis shows 40% of your queries could use a cheaper model without quality loss.',
    estimatedSavings: 45.50,
    priority: 1,
    implementation: 'Add routing rule to classify query complexity',
    impact: 'high',
  },
  {
    id: '2',
    title: 'Implement response caching',
    description: '15% of queries are repeated within 24 hours.',
    estimatedSavings: 22.30,
    priority: 2,
    implementation: 'Enable Redis cache for identical prompts',
    impact: 'medium',
  },
  {
    id: '3',
    title: 'Reduce max tokens for classification tasks',
    description: 'Classification agents use more tokens than needed.',
    estimatedSavings: 12.80,
    priority: 3,
    implementation: 'Set max_tokens=256 for classifier agents',
    impact: 'low',
  },
];

/**
 * Hook to fetch optimization report
 */
export function useOptimizationReport() {
  return useQuery({
    queryKey: optimizationKeys.report(),
    queryFn: async (): Promise<OptimizationReport> => {
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 700));
        return {
          organizationId: 'mock-org',
          period: {
            start: new Date(Date.now() - 30 * 86400000).toISOString(),
            end: new Date().toISOString(),
          },
          summary: {
            totalCost: 245.80,
            potentialSavings: 80.60,
            inefficiencies: 3,
          },
          recommendations: MOCK_RECOMMENDATIONS,
        };
      }

      try {
        const response = await fetch(`${API_BASE}/api/optimization/report`, {
          headers: getHeaders(),
        });

        if (!response.ok) throw new Error('Failed to fetch optimization report');
        return response.json();
      } catch (error) {
        console.warn('[useOptimizationReport] API failed, using mock data:', error);
        return {
          organizationId: 'mock-org',
          period: {
            start: new Date(Date.now() - 30 * 86400000).toISOString(),
            end: new Date().toISOString(),
          },
          summary: {
            totalCost: 245.80,
            potentialSavings: 80.60,
            inefficiencies: 3,
          },
          recommendations: MOCK_RECOMMENDATIONS,
        };
      }
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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 500));
        return { models: MOCK_MODELS };
      }

      try {
        const response = await fetch(`${API_BASE}/api/optimization/models`, {
          headers: getHeaders(),
        });

        if (!response.ok) throw new Error('Failed to fetch models');
        return response.json();
      } catch (error) {
        console.warn('[useAvailableModels] API failed, using mock data:', error);
        return { models: MOCK_MODELS };
      }
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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 400));
        return {
          rules: [
            {
              id: '1',
              name: 'Simple queries to GPT-3.5',
              priority: 1,
              conditions: [{ field: 'estimated_tokens', operator: 'lt', value: 500 }],
              action: { type: 'route_to', model: 'gpt-3.5-turbo' },
            },
          ],
        };
      }

      try {
        const response = await fetch(`${API_BASE}/api/optimization/rules`, {
          headers: getHeaders(),
        });

        if (!response.ok) throw new Error('Failed to fetch routing rules');
        return response.json();
      } catch (error) {
        console.warn('[useRoutingRules] API failed, using mock data:', error);
        return { rules: [] };
      }
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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 300));
        const modelInfo = MOCK_MODELS.find(m => m.model === model) || MOCK_MODELS[0];
        const inputCost = (inputTokens / 1000) * modelInfo.pricing.inputPer1kTokens;
        const outputCost = (outputTokens / 1000) * modelInfo.pricing.outputPer1kTokens;

        return {
          model,
          inputTokens,
          outputTokens,
          estimatedCost: inputCost + outputCost,
          breakdown: { inputCost, outputCost },
          currency: 'USD',
        };
      }

      const response = await fetch(`${API_BASE}/api/optimization/estimate`, {
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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 500));
        const currentModel = MOCK_MODELS.find(m => m.model === model);
        if (!currentModel) {
          return { currentModel: model, alternatives: [] };
        }

        const currentCost = currentModel.pricing.inputPer1kTokens + currentModel.pricing.outputPer1kTokens;
        const alternatives = MOCK_MODELS
          .filter(m => m.model !== model)
          .map(m => {
            const altCost = m.pricing.inputPer1kTokens + m.pricing.outputPer1kTokens;
            const savings = ((currentCost - altCost) / currentCost) * 100;
            return {
              model: m.model,
              provider: m.provider,
              estimatedCost: altCost,
              savingsPercent: savings,
              capabilities: m.capabilities,
              tradeoffs: savings > 50 ? 'Reduced capability' : savings > 20 ? 'Minor quality difference' : 'Similar quality',
            };
          })
          .filter(a => a.savingsPercent >= minSavingsPercent)
          .sort((a, b) => b.savingsPercent - a.savingsPercent)
          .slice(0, maxAlternatives);

        return { currentModel: model, alternatives };
      }

      const response = await fetch(`${API_BASE}/api/optimization/alternatives`, {
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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 500));
        return {
          message: 'Rule added successfully',
          rule: { ...rule, id: `rule-${Date.now()}` },
        };
      }

      const response = await fetch(`${API_BASE}/api/optimization/rules`, {
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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 300));
        return;
      }

      const response = await fetch(`${API_BASE}/api/optimization/rules/${ruleId}`, {
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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 400));
        return {
          totalRequests: 1250,
          compressedRequests: 480,
          compressionRate: 38.4,
          totalSavedTokens: 125000,
          totalSavedUsd: 4.50,
          avgCompressionPercent: 28.5,
          period,
        };
      }

      try {
        const response = await fetch(`${API_BASE}/api/client/optimization/stats?period=${period}`, {
          headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch compression stats');
        return response.json();
      } catch (error) {
        console.warn('[useCompressionStats] API failed, using mock data:', error);
        return {
          totalRequests: 0,
          compressedRequests: 0,
          compressionRate: 0,
          totalSavedTokens: 0,
          totalSavedUsd: 0,
          avgCompressionPercent: 0,
          period,
        };
      }
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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 300));
        return { compressionEnabled: false, minCompressionRatio: 0.15 };
      }

      try {
        const response = await fetch(`${API_BASE}/api/client/optimization/settings`, {
          headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch settings');
        return response.json();
      } catch {
        return { compressionEnabled: false, minCompressionRatio: 0.15 };
      }
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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 300));
        return {
          compressionEnabled: settings.compressionEnabled ?? false,
          minCompressionRatio: settings.minCompressionRatio ?? 0.15,
        };
      }

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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 500));
        const tokens = Math.ceil(prompt.split(/\s+/).length * 1.3);
        return {
          originalTokens: tokens,
          estimatedCompressedTokens: Math.floor(tokens * 0.75),
          compressionRatio: 0.75,
          issues: [
            {
              type: 'courtesy_padding',
              description: 'Removed courtesy phrase',
              originalSnippet: 'Could you please',
              fixedSnippet: '',
              tokensSaved: 4,
            },
          ],
          compressedPrompt: prompt.replace(/Could you please /gi, ''),
          model: model || null,
        };
      }

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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 600));
        return { duplicates: [] };
      }

      try {
        const response = await fetch(`${API_BASE}/api/client/optimization/system-prompts`, {
          headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch system prompts');
        return response.json();
      } catch {
        return { duplicates: [] };
      }
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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 400));
        return {
          templates: [
            { useCase: 'classification', name: 'Classification Agent', template: 'You are a classification agent...', estimatedTokens: 150 },
            { useCase: 'extraction', name: 'Data Extraction Agent', template: 'You are a data extraction agent...', estimatedTokens: 180 },
            { useCase: 'summarization', name: 'Summarization Agent', template: 'You are a summarization agent...', estimatedTokens: 120 },
            { useCase: 'qa', name: 'Q&A Agent', template: 'You are a Q&A agent...', estimatedTokens: 100 },
          ],
        };
      }

      try {
        const response = await fetch(`${API_BASE}/api/client/optimization/system-prompts/templates`, {
          headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch templates');
        return response.json();
      } catch {
        return { templates: [] };
      }
    },
    staleTime: 60 * 60 * 1000,
  });
}
