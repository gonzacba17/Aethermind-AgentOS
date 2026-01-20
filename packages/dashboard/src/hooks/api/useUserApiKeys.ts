import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

// Types
export interface UserApiKey {
  id: string;
  provider: 'openai' | 'anthropic' | 'cohere' | 'google' | 'azure' | 'custom';
  name: string;
  maskedKey: string;
  isValid: boolean;
  lastValidated?: string;
  createdAt: string;
}

export interface AddApiKeyData {
  provider: UserApiKey['provider'];
  name: string;
  apiKey: string;
}

// Query keys
export const userApiKeyKeys = {
  all: ['user-api-keys'] as const,
  list: () => [...userApiKeyKeys.all, 'list'] as const,
  usage: (provider: string) => [...userApiKeyKeys.all, 'usage', provider] as const,
};

// Get provider display info
export function getProviderInfo(provider: string) {
  const providers: Record<string, { name: string; color: string; icon: string }> = {
    openai: { name: 'OpenAI', color: 'text-emerald-500', icon: '🤖' },
    anthropic: { name: 'Anthropic', color: 'text-orange-500', icon: '🧠' },
    cohere: { name: 'Cohere', color: 'text-purple-500', icon: '💬' },
    google: { name: 'Google AI', color: 'text-blue-500', icon: '🔵' },
    azure: { name: 'Azure OpenAI', color: 'text-cyan-500', icon: '☁️' },
    custom: { name: 'Custom', color: 'text-gray-500', icon: '🔧' },
  };
  return providers[provider] || providers.custom;
}

/**
 * Hook to fetch user's configured API keys
 */
export function useUserApiKeys() {
  return useQuery({
    queryKey: userApiKeyKeys.list(),
    queryFn: async () => {
      const response = await apiRequest<{ keys: UserApiKey[] }>('/api/user/api-keys');
      return response.keys;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to add a new API key
 */
export function useAddApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddApiKeyData) => {
      const response = await apiRequest<{ key: UserApiKey }>('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return response.key;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userApiKeyKeys.list() });
    },
  });
}

/**
 * Hook to delete an API key
 */
export function useDeleteApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (keyId: string) => {
      await apiRequest(`/api/user/api-keys/${keyId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userApiKeyKeys.list() });
    },
  });
}

/**
 * Hook to re-validate an API key
 */
export function useValidateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (keyId: string) => {
      const response = await apiRequest<{ valid: boolean; error?: string }>(
        `/api/user/api-keys/${keyId}/validate`,
        { method: 'POST' }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userApiKeyKeys.list() });
    },
  });
}

/**
 * Hook to get usage for a specific provider
 */
export function useProviderUsage(provider: string) {
  return useQuery({
    queryKey: userApiKeyKeys.usage(provider),
    queryFn: async () => {
      const response = await apiRequest<{ provider: string; message: string; usage: any }>(
        `/api/user/api-keys/${provider}/usage`
      );
      return response;
    },
    enabled: !!provider,
    staleTime: 60 * 1000, // 1 minute
  });
}
