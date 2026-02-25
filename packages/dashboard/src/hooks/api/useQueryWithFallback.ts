import { useRef } from 'react';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { shouldUseMockData } from '@/lib/mock-data';
import { useMockDataContext } from '@/contexts/MockDataContext';

/**
 * Create a React Query hook that transparently falls back to mock data
 * when the API is not configured or a request fails.
 *
 * Replaces the ~15-line boilerplate pattern repeated in every API hook:
 * ```
 * if (shouldUseMockData()) { reportMockFallback(...); return MOCK; }
 * try { return await fetcher(); } catch { reportMockFallback(...); return MOCK; }
 * ```
 *
 * @param key       React Query cache key
 * @param fetcher   Async function that calls the real API
 * @param mockData  Static mock data to return as fallback
 * @param hookName  Name of the calling hook (for debugging/reporting)
 * @param options   Additional React Query options (staleTime, refetchInterval, etc.)
 */
export function useQueryWithFallback<T>(
  key: readonly unknown[],
  fetcher: () => Promise<T>,
  mockData: T,
  hookName: string,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>,
) {
  const { reportMockFallback } = useMockDataContext();
  const reportedRef = useRef(false);

  return useQuery<T>({
    queryKey: key,
    queryFn: async () => {
      if (shouldUseMockData()) {
        if (!reportedRef.current) {
          reportMockFallback(hookName, 'NEXT_PUBLIC_API_URL not configured');
          reportedRef.current = true;
        }
        return mockData;
      }

      try {
        return await fetcher();
      } catch (error) {
        console.warn(`[${hookName}] API request failed, using mock data:`, error);
        if (!reportedRef.current) {
          reportMockFallback(hookName, `API request failed: ${(error as Error).message}`);
          reportedRef.current = true;
        }
        return mockData;
      }
    },
    staleTime: 60 * 1000, // Default 1 minute, overridable via options
    retry: 1,
    ...options,
  });
}
