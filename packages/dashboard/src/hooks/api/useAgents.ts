import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { 
  fetchAgents, 
  fetchAgent, 
  createAgent, 
  executeAgent,
  Agent 
} from '@/lib/api';
import { MOCK_AGENTS, shouldUseMockData } from '@/lib/mock-data';

/**
 * Query key factory for agents
 * Centralized to ensure consistency across components
 */
export const agentKeys = {
  all: ['agents'] as const,
  lists: () => [...agentKeys.all, 'list'] as const,
  list: (filters: AgentFilters) => [...agentKeys.lists(), filters] as const,
  details: () => [...agentKeys.all, 'detail'] as const,
  detail: (id: string) => [...agentKeys.details(), id] as const,
  logs: (id: string) => [...agentKeys.detail(id), 'logs'] as const,
};

export interface AgentFilters {
  search?: string;
  status?: string[];
  model?: string[];
  limit?: number;
  offset?: number;
}

interface AgentsResponse {
  data: Agent[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Hook to fetch list of agents
 * Falls back to mock data if API is not configured
 * 
 * @param filters - Optional filters for the agent list
 * @param options - Additional React Query options
 */
export function useAgents(
  filters: AgentFilters = {},
  options?: Omit<UseQueryOptions<AgentsResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: agentKeys.list(filters),
    queryFn: async () => {
      // Helper function to return filtered mock data
      const getMockData = () => {
        let filteredAgents = [...MOCK_AGENTS];
        
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          filteredAgents = filteredAgents.filter(
            agent => 
              agent.name.toLowerCase().includes(searchLower) ||
              agent.model.toLowerCase().includes(searchLower)
          );
        }
        
        if (filters.status && filters.status.length > 0) {
          filteredAgents = filteredAgents.filter(
            agent => filters.status!.includes(agent.status)
          );
        }
        
        return {
          data: filteredAgents,
          total: MOCK_AGENTS.length,
          offset: filters.offset || 0,
          limit: filters.limit || 20,
          hasMore: false,
        };
      };

      // Use mock data if API is not configured (demo mode)
      if (shouldUseMockData()) {
        return getMockData();
      }
      
      // Try to fetch from API, fallback to mock data on error
      try {
        const result = await fetchAgents();
        
        // Handle legacy API response (array) vs new paginated response
        if (Array.isArray(result)) {
          let filteredAgents = result;
          
          if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filteredAgents = filteredAgents.filter(
              agent => 
                agent.name.toLowerCase().includes(searchLower) ||
                agent.model.toLowerCase().includes(searchLower)
            );
          }
          
          if (filters.status && filters.status.length > 0) {
            filteredAgents = filteredAgents.filter(
              agent => filters.status!.includes(agent.status)
            );
          }
          
          if (filters.model && filters.model.length > 0) {
            filteredAgents = filteredAgents.filter(
              agent => filters.model!.includes(agent.model)
            );
          }
          
          return {
            data: filteredAgents,
            total: result.length,
            offset: filters.offset || 0,
            limit: filters.limit || 20,
            hasMore: false,
          };
        }
        
        return result as AgentsResponse;
      } catch (error) {
        console.warn('[useAgents] API request failed, using mock data:', error);
        return getMockData();
      }
    },
    staleTime: 30 * 1000,
    refetchInterval: shouldUseMockData() ? false : 60 * 1000,
    retry: 1, // Only retry once, then fallback to mock
    ...options,
  });
}

/**
 * Hook to fetch a single agent by ID
 * 
 * @param id - Agent ID
 * @param options - Additional React Query options
 */
export function useAgent(
  id: string,
  options?: Omit<UseQueryOptions<Agent>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: agentKeys.detail(id),
    queryFn: () => fetchAgent(id),
    enabled: !!id,
    staleTime: 30 * 1000,
    ...options,
  });
}

/**
 * Hook to create a new agent
 * Automatically invalidates the agents list on success
 */
export function useCreateAgent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createAgent,
    onSuccess: () => {
      // Invalidate all agent lists to refetch with new agent
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
    },
    onError: (error) => {
      console.error('Failed to create agent:', error);
    },
  });
}

/**
 * Hook to update an existing agent
 * Updates both the list and detail caches on success
 */
export function useUpdateAgent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Agent['config']> }) => {
      // Note: Update endpoint may need to be added to API
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/agents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update agent');
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Update the specific agent in cache
      queryClient.setQueryData(agentKeys.detail(variables.id), data);
      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
    },
  });
}

/**
 * Hook to delete an agent
 * Removes from cache and invalidates lists on success
 */
export function useDeleteAgent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/agents/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete agent');
    },
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: agentKeys.detail(id) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
    },
  });
}

/**
 * Hook to execute an agent
 * Useful for testing agents or running one-off tasks
 */
export function useExecuteAgent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: unknown }) => 
      executeAgent(id, input),
    onSuccess: () => {
      // Execution may have updated agent state or created new traces/logs
      queryClient.invalidateQueries({ queryKey: agentKeys.all });
      queryClient.invalidateQueries({ queryKey: ['traces'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['costs'] });
    },
  });
}

/**
 * Hook to toggle agent status (pause/resume)
 */
export function useToggleAgentStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'paused' }) => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/agents/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Failed to update agent status');
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(agentKeys.detail(variables.id), data);
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
    },
  });
}
