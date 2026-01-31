import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

// Types
export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  plan: 'free' | 'pro' | 'enterprise';
  apiKey: string;
  organizationId: string | null;
  hasCompletedOnboarding: boolean;
  onboardingStep: string;
  usageCount: number;
  usageLimit: number;
  maxAgents: number;
  logRetentionDays: number;
  subscriptionStatus: string;
  isFirstTimeUser?: boolean;
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
 * Hook to fetch user profile including API key
 */
export function useUserProfile() {
  return useQuery({
    queryKey: userProfileKeys.me(),
    queryFn: async () => {
      const response = await apiRequest<{ user: UserProfile }>('/api/auth/me');
      return response.user;
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
      // Test the connection by hitting the health endpoint with the API key
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/health`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
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
 * Hook to regenerate API key
 */
export function useRegenerateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest<{ apiKey: string }>('/api/auth/regenerate-api-key', {
        method: 'POST',
      });
      return response.apiKey;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userProfileKeys.me() });
    },
  });
}
