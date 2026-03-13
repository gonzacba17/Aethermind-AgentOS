import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { API_URL } from '@/lib/config';

// Types
export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  plan: 'free' | 'pro' | 'enterprise';
  sdkApiKeyPrefix: string | null;
  organizationId: string | null;
  hasCompletedOnboarding: boolean;
  onboardingStep: string;
  usageCount: number;
  usageLimit: number;
  maxAgents: number;
  logRetentionDays: number;
  subscriptionStatus: string;
}

export interface SDKConnectionStatus {
  connected: boolean;
  lastPing?: string;
  version?: string;
  error?: string;
}

// Query keys
export const userProfileKeys = {
  all: ['user-profile'] as const,
  me: () => [...userProfileKeys.all, 'me'] as const,
  sdkStatus: () => [...userProfileKeys.all, 'sdk-status'] as const,
};

/**
 * Hook to fetch user profile including SDK API key prefix
 */
export function useUserProfile() {
  return useQuery({
    queryKey: userProfileKeys.me(),
    queryFn: async () => {
      const response = await apiRequest<{
        id: string;
        companyName: string;
        sdkApiKeyPrefix?: string | null;
        hasCompletedOnboarding?: boolean;
        onboardingStep?: string;
      }>('/api/client/me');
      return {
        id: response.id,
        email: '',
        name: response.companyName,
        plan: 'pro' as UserProfile['plan'],
        sdkApiKeyPrefix: response.sdkApiKeyPrefix ?? null,
        organizationId: null,
        hasCompletedOnboarding: response.hasCompletedOnboarding ?? true,
        onboardingStep: response.onboardingStep || 'complete',
        usageCount: 0,
        usageLimit: 10000,
        maxAgents: 100,
        logRetentionDays: 90,
        subscriptionStatus: 'active',
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

/**
 * Hook to test SDK connection
 */
export function useTestSDKConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (apiKey: string): Promise<SDKConnectionStatus> => {
      const response = await fetch(`${API_URL}/health`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Connection failed');
      }

      const data = await response.json();
      return {
        connected: true,
        lastPing: new Date().toISOString(),
        version: data.version || '1.0.0',
      };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(userProfileKeys.sdkStatus(), data);
    },
  });
}

/**
 * Hook to regenerate SDK API key.
 * Returns the new key plaintext (shown once).
 */
export function useRegenerateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest<{
        sdkApiKey: string;
        sdkApiKeyShownOnce: boolean;
        message: string;
      }>('/api/client/regenerate-sdk-key', {
        method: 'POST',
      });
      return response.sdkApiKey;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userProfileKeys.me() });
    },
    onError: (error) => {
      console.error('[useRegenerateApiKey] Failed:', error);
    },
  });
}
