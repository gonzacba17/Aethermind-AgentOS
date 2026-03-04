import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { getAuthToken } from '@/lib/auth-utils';
import { API_URL } from '@/lib/config';

const API_BASE = API_URL;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (typeof window !== 'undefined') {
    const token = getAuthToken();
    if (token) {
      headers['X-Client-Token'] = token;
    }
  }
  return headers;
}

/**
 * Workflow interfaces
 */
export interface WorkflowStep {
  id: string;
  agent: string;
  next?: string | string[];
  condition?: string;
  parallel?: boolean;
}

export interface Workflow {
  name: string;
  description?: string;
  steps: WorkflowStep[];
  entryPoint: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowsResponse {
  data: Workflow[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface CreateWorkflowData {
  name: string;
  description?: string;
  steps: WorkflowStep[];
  entryPoint: string;
}

export interface WorkflowEstimate {
  workflowName: string;
  estimatedCost: number;
  currency: string;
  breakdown: Record<string, number>;
  tokenCount: number;
  confidence: number;
  basedOn: string;
  timestamp: string;
}

export interface WorkflowExecution {
  executionId: string;
  workflowName: string;
  status: 'completed' | 'failed' | 'running';
  output: any;
  duration: number;
  stepResults: Record<string, any>;
}

/**
 * Query keys
 */
export const workflowKeys = {
  all: ['workflows'] as const,
  list: () => [...workflowKeys.all, 'list'] as const,
  detail: (name: string) => [...workflowKeys.all, name] as const,
  estimate: (name: string) => [...workflowKeys.detail(name), 'estimate'] as const,
};

/**
 * Hook to fetch all workflows
 */
export function useWorkflows(
  options?: Omit<UseQueryOptions<WorkflowsResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: workflowKeys.list(),
    queryFn: async (): Promise<WorkflowsResponse> => {
      const response = await fetch(`${API_BASE}/api/client/workflows`, {
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch workflows');
      }

      const data = await response.json();
      return {
        data: data.data || data || [],
        total: data.total || (data.data || data || []).length,
        limit: data.limit || 50,
        offset: data.offset || 0,
        hasMore: data.hasMore || false,
      };
    },
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

/**
 * Hook to fetch a single workflow by name
 */
export function useWorkflow(
  name: string,
  options?: Omit<UseQueryOptions<Workflow | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: workflowKeys.detail(name),
    queryFn: async (): Promise<Workflow | null> => {
      if (!name) return null;

      const response = await fetch(`${API_BASE}/api/client/workflows/${encodeURIComponent(name)}`, {
        headers: getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch workflow');
      }

      return response.json();
    },
    enabled: !!name,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

/**
 * Hook to create a new workflow
 */
export function useCreateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateWorkflowData): Promise<{ name: string; message: string }> => {
      const response = await fetch(`${API_BASE}/api/client/workflows`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to create workflow');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.list() });
    },
  });
}

/**
 * Hook to update a workflow
 */
export function useUpdateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, data }: { name: string; data: Partial<CreateWorkflowData> }): Promise<{ name: string; message: string }> => {
      const response = await fetch(`${API_BASE}/api/client/workflows/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to update workflow');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.detail(variables.name) });
      queryClient.invalidateQueries({ queryKey: workflowKeys.list() });
    },
  });
}

/**
 * Hook to delete a workflow
 */
export function useDeleteWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/api/client/workflows/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to delete workflow');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.list() });
    },
  });
}

/**
 * Hook to estimate workflow cost
 */
export function useEstimateWorkflow() {
  return useMutation({
    mutationFn: async ({ name, input }: { name: string; input?: any }): Promise<WorkflowEstimate> => {
      const response = await fetch(`${API_BASE}/api/client/workflows/${encodeURIComponent(name)}/estimate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ input }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to estimate workflow cost');
      }

      return response.json();
    },
  });
}

/**
 * Hook to execute a workflow
 */
export function useExecuteWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, input }: { name: string; input: any }): Promise<WorkflowExecution> => {
      const response = await fetch(`${API_BASE}/api/client/workflows/${encodeURIComponent(name)}/execute`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ input }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to execute workflow');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate related queries after execution
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      queryClient.invalidateQueries({ queryKey: ['costs'] });
    },
  });
}
