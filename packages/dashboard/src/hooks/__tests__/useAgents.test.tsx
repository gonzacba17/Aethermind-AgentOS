/**
 * Tests for useAgents hook
 * 
 * These are example tests to demonstrate the testing pattern.
 * In a real project, you would use Jest/Vitest with React Testing Library.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAgents, useCreateAgent, useDeleteAgent } from '../api/useAgents';
import type { ReactNode } from 'react';

// Create a wrapper for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useAgents', () => {
  it('should fetch agents successfully', async () => {
    const { result } = renderHook(() => useAgents(), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for data
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should have data
    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  it('should filter agents by status', async () => {
    const { result } = renderHook(
      () => useAgents({ status: ['idle'] }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // All agents should have idle status
    result.current.data?.data?.forEach((agent: { status: string }) => {
      expect(agent.status).toBe('idle');
    });
  });

  it('should search agents by name', async () => {
    const { result } = renderHook(
      () => useAgents({ search: 'test' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // All agents should contain 'test' in their name
    result.current.data?.data?.forEach((agent: { name: string }) => {
      expect(agent.name.toLowerCase()).toContain('test');
    });
  });
});

describe('useCreateAgent', () => {
  it('should create an agent', async () => {
    const { result } = renderHook(() => useCreateAgent(), {
      wrapper: createWrapper(),
    });

    const newAgent = {
      name: 'Test Agent',
      model: 'gpt-4',
      systemPrompt: 'You are a test agent',
    };

    // Trigger mutation
    result.current.mutate(newAgent);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should return the created agent
    expect(result.current.data).toBeDefined();
    expect(result.current.data?.name).toBe(newAgent.name);
  });

  it('should handle validation errors', async () => {
    const { result } = renderHook(() => useCreateAgent(), {
      wrapper: createWrapper(),
    });

    // Try to create with empty name
    result.current.mutate({
      name: '',
      model: 'gpt-4',
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useDeleteAgent', () => {
  it('should delete an agent', async () => {
    const { result } = renderHook(() => useDeleteAgent(), {
      wrapper: createWrapper(),
    });

    // Delete an agent
    result.current.mutate('agent-1');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
