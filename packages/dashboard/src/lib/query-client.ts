import { QueryClient } from '@tanstack/react-query';

/**
 * React Query Client Configuration
 * 
 * Configured for optimal dashboard performance:
 * - 30 second stale time to reduce unnecessary refetches
 * - 3 retries with exponential backoff for resilience
 * - Window focus refetch for fresh data when returning to tab
 * - Garbage collection after 5 minutes of inactivity
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data considered fresh for 30 seconds
        staleTime: 30 * 1000,
        
        // Keep unused data in cache for 5 minutes
        gcTime: 5 * 60 * 1000,
        
        // Retry failed requests 3 times with exponential backoff
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        
        // Refetch when window regains focus
        refetchOnWindowFocus: true,
        
        // Don't refetch on mount if data is fresh
        refetchOnMount: true,
        
        // Refetch on reconnect
        refetchOnReconnect: true,
      },
      mutations: {
        // Retry mutations once on failure
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
