'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createQueryClient } from '@/lib/query-client';

interface QueryProviderProps {
  children: React.ReactNode;
}

/**
 * React Query Provider Component
 * 
 * Wraps the application with React Query context and provides:
 * - QueryClient instance for data fetching
 * - DevTools in development mode for debugging
 * 
 * Uses useState to ensure one QueryClient instance per component lifecycle,
 * preventing hydration mismatches in Next.js.
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // Create a stable QueryClient instance
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools only in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools 
          initialIsOpen={false}
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}
