import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export interface TrialStatus {
  plan: 'trial' | 'starter' | 'growth' | 'pro' | string;
  isTrialActive: boolean;
  trialDaysRemaining: number | null;
  trialExpiresAt: string | null;
}

export const trialKeys = {
  status: ['trial-status'] as const,
};

export function useTrialStatus() {
  return useQuery({
    queryKey: trialKeys.status,
    queryFn: () => apiRequest<TrialStatus>('/api/client/trial-status'),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    retry: 1,
  });
}
