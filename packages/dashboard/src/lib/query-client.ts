import { QueryClient } from '@tanstack/react-query';

/**
 * React Query Client Configuration
 *
 * Tuned to avoid 429s with 14+ dashboard widgets:
 * - 1 min staleTime so cached data is reused across mounts
 * - No refetch on window-focus or mount — prevents burst of 14+ requests
 * - Single retry with flat 2 s delay to stay under rate limits
 * - Garbage collection after 5 minutes of inactivity
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 1,
        retryDelay: 2000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 1,
        retryDelay: 1000,
      },
    },
  });
}

// Singleton instance for client-side
let queryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // Server: always create a new instance
    return createQueryClient();
  }
  
  // Client: reuse existing instance or create new
  if (!queryClient) {
    queryClient = createQueryClient();
  }
  
  return queryClient;
}
