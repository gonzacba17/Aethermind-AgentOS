import { QueryClient } from '@tanstack/react-query';

/**
 * React Query Client Configuration
 *
 * - staleTime 0: data is always considered stale, so navigating to a page
 *   or refocusing the tab triggers a background revalidation immediately
 * - refetchOnWindowFocus: true — ensures fresh data when the user returns
 * - refetchOnMount: true — ensures fresh data on navigation
 * - Garbage collection after 5 minutes of inactivity
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: 5 * 60 * 1000,
        retry: 1,
        retryDelay: 2000,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
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
