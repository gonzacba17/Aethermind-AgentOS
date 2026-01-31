import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { getAuthToken } from '@/lib/auth-utils';
import { shouldUseMockData } from '@/lib/mock-data';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (typeof window !== 'undefined') {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
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

// Mock data
const MOCK_WORKFLOWS: Workflow[] = [
  {
    name: 'customer-support',
    description: 'Handle customer support tickets automatically',
    steps: [
      { id: 'classify', agent: 'classifier-agent', next: 'respond' },
      { id: 'respond', agent: 'response-agent', next: 'review' },
      { id: 'review', agent: 'review-agent' },
    ],
    entryPoint: 'classify',
    createdAt: new Date().toISOString(),
  },
  {
    name: 'content-pipeline',
    description: 'Generate and review content',
    steps: [
      { id: 'generate', agent: 'writer-agent', next: ['edit', 'review'], parallel: true },
      { id: 'edit', agent: 'editor-agent', next: 'publish' },
      { id: 'review', agent: 'reviewer-agent', next: 'publish' },
      { id: 'publish', agent: 'publisher-agent' },
    ],
    entryPoint: 'generate',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
];

/**
 * Hook to fetch all workflows
 */
export function useWorkflows(
  options?: Omit<UseQueryOptions<WorkflowsResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: workflowKeys.list(),
    queryFn: async (): Promise<WorkflowsResponse> => {
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 500));
        return {
          data: MOCK_WORKFLOWS,
          total: MOCK_WORKFLOWS.length,
          limit: 50,
          offset: 0,
          hasMore: false,
        };
      }

      try {
        const response = await fetch(`${API_BASE}/api/workflows`, {
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
      } catch (error) {
        console.warn('[useWorkflows] API failed, using mock data:', error);
        return {
          data: MOCK_WORKFLOWS,
          total: MOCK_WORKFLOWS.length,
          limit: 50,
          offset: 0,
          hasMore: false,
        };
      }
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

      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 300));
        return MOCK_WORKFLOWS.find(w => w.name === name) || null;
      }

      try {
        const response = await fetch(`${API_BASE}/api/workflows/${encodeURIComponent(name)}`, {
          headers: getHeaders(),
        });

        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error('Failed to fetch workflow');
        }

        return response.json();
      } catch (error) {
        console.warn('[useWorkflow] API failed, using mock data:', error);
        return MOCK_WORKFLOWS.find(w => w.name === name) || null;
      }
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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 500));
        const newWorkflow: Workflow = {
          ...data,
          createdAt: new Date().toISOString(),
        };
        MOCK_WORKFLOWS.push(newWorkflow);
        return { name: data.name, message: 'Workflow created' };
      }

      const response = await fetch(`${API_BASE}/api/workflows`, {
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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 500));
        const index = MOCK_WORKFLOWS.findIndex(w => w.name === name);
        if (index !== -1) {
          MOCK_WORKFLOWS[index] = { ...MOCK_WORKFLOWS[index], ...data, updatedAt: new Date().toISOString() };
        }
        return { name, message: 'Workflow updated' };
      }

      const response = await fetch(`${API_BASE}/api/workflows/${encodeURIComponent(name)}`, {
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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 500));
        const index = MOCK_WORKFLOWS.findIndex(w => w.name === name);
        if (index !== -1) {
          MOCK_WORKFLOWS.splice(index, 1);
        }
        return;
      }

      const response = await fetch(`${API_BASE}/api/workflows/${encodeURIComponent(name)}`, {
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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 800));
        return {
          workflowName: name,
          estimatedCost: Math.random() * 0.5 + 0.1,
          currency: 'USD',
          breakdown: {
            'step-1': 0.05,
            'step-2': 0.08,
            'step-3': 0.03,
          },
          tokenCount: Math.floor(Math.random() * 5000) + 1000,
          confidence: 0.85,
          basedOn: 'historical average',
          timestamp: new Date().toISOString(),
        };
      }

      const response = await fetch(`${API_BASE}/api/workflows/${encodeURIComponent(name)}/estimate`, {
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
      if (shouldUseMockData()) {
        await new Promise(r => setTimeout(r, 2000));
        return {
          executionId: `exec-${Date.now()}`,
          workflowName: name,
          status: 'completed',
          output: { result: 'Mock execution completed successfully' },
          duration: Math.floor(Math.random() * 5000) + 1000,
          stepResults: {
            'step-1': { status: 'completed', output: 'Step 1 done' },
            'step-2': { status: 'completed', output: 'Step 2 done' },
          },
        };
      }

      const response = await fetch(`${API_BASE}/api/workflows/${encodeURIComponent(name)}/execute`, {
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
