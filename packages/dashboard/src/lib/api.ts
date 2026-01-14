import { getAuthToken, clearAuthToken } from './auth-utils';
import { LANDING_PAGE_URL } from './config';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

// Helper to include JWT token in headers
function getHeaders(additionalHeaders?: Record<string, string>): HeadersInit {
  const headers: Record<string, string> = {
    ...(additionalHeaders || {}),
  };
  
  // Get JWT token from localStorage (client-side only)
  if (typeof window !== 'undefined') {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  return headers;
}

// Helper to handle API errors
// Note: Auto-redirect disabled - dashboard should handle auth errors internally
async function handleApiError(response: Response, endpoint: string): Promise<never> {
  const status = response.status;
  
  // Handle 401 Unauthorized - token expired or invalid
  if (status === 401) {
    console.error(`[API] 401 Unauthorized on ${endpoint} - Not authenticated`);
    
    // Clear invalid token
    if (typeof window !== 'undefined') {
      clearAuthToken();
      
      // REDIRECT DISABLED: Dashboard should stay accessible without auth
      // Previously this redirected to: LANDING_PAGE_URL
      // To re-enable auth: uncomment line below OR implement /login route in dashboard
      // window.location.href = LANDING_PAGE_URL;
    }
  }
  
  // Try to parse error message from response
  let errorMessage = `API request failed: ${status}`;
  try {
    const errorData = await response.json();
    errorMessage = errorData.message || errorData.error || errorMessage;
  } catch {
    // Use default error message if JSON parsing fails
  }
  
  throw new Error(errorMessage);
}

export interface Agent {
  id: string;
  name: string;
  model: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'timeout';
  config: {
    name: string;
    model: string;
    systemPrompt?: string;
    maxRetries: number;
    timeout: number;
    temperature: number;
    maxTokens?: number;
  };
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  agentId?: string;
  executionId?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionResult {
  executionId: string;
  agentId: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'timeout';
  output: unknown;
  error?: { message: string };
  startedAt: string;
  completedAt: string;
  duration: number;
}

export interface TraceNode {
  id: string;
  parentId?: string;
  name: string;
  type: 'agent' | 'tool' | 'llm' | 'workflow';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
  children: TraceNode[];
}

export interface Trace {
  id: string;
  executionId: string;
  rootNode: TraceNode;
  createdAt: string;
}

export interface CostSummary {
  total: number;
  totalTokens: number;
  executionCount: number;
  byModel: Record<string, { count: number; tokens: number; cost: number }>;
}

export interface CostEstimate {
  workflowName: string;
  estimatedCost: number;
  currency: string;
  breakdown: StepCostEstimate[];
  tokenCount: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  confidence: 'high' | 'medium' | 'low';
  basedOn: 'historical' | 'heuristic';
  timestamp: string;
}

export interface StepCostEstimate {
  stepId: string;
  agentName: string;
  model: string;
  estimatedTokens: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  estimatedCost: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface CostInfo {
  id: string;
  executionId: string;
  agentId?: string;
  agentName?: string;
  workflowName?: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: string;
}

export async function fetchAgents(): Promise<Agent[]> {
  const res = await fetch(`${API_BASE}/api/agents`, {
    headers: getHeaders(),
  });
  if (!res.ok) await handleApiError(res, '/api/agents');
  return res.json();
}

export async function fetchAgent(id: string): Promise<Agent> {
  const res = await fetch(`${API_BASE}/api/agents/${id}`, {
    headers: getHeaders(),
  });
  if (!res.ok) await handleApiError(res, `/api/agents/${id}`);
  return res.json();
}

export async function createAgent(data: {
  name: string;
  model?: string;
  systemPrompt?: string;
  description?: string;
  tags?: string[];
  provider?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<Agent> {
  const res = await fetch(`${API_BASE}/api/agents`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) await handleApiError(res, '/api/agents');
  return res.json();
}

export async function executeAgent(
  id: string,
  input: unknown
): Promise<ExecutionResult> {
  const res = await fetch(`${API_BASE}/api/agents/${id}/execute`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ input }),
  });
  if (!res.ok) await handleApiError(res, `/api/agents/${id}/execute`);
  return res.json();
}

export async function fetchLogs(params?: {
  level?: string;
  agentId?: string;
  executionId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: LogEntry[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.level) searchParams.set('level', params.level);
  if (params?.agentId) searchParams.set('agentId', params.agentId);
  if (params?.executionId) searchParams.set('executionId', params.executionId);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));

  const res = await fetch(`${API_BASE}/api/logs?${searchParams}`, {
    headers: getHeaders(),
  });
  if (!res.ok) await handleApiError(res, '/api/logs');
  return res.json();
}

export async function fetchTraces(): Promise<Trace[]> {
  const res = await fetch(`${API_BASE}/api/traces`, {
    headers: getHeaders(),
  });
  if (!res.ok) await handleApiError(res, '/api/traces');
  return res.json();
}

export async function fetchTrace(id: string): Promise<Trace> {
  const res = await fetch(`${API_BASE}/api/traces/${id}`, {
    headers: getHeaders(),
  });
  if (!res.ok) await handleApiError(res, `/api/traces/${id}`);
  return res.json();
}

export async function fetchCostSummary(): Promise<CostSummary> {
  const res = await fetch(`${API_BASE}/api/costs/summary`, {
    headers: getHeaders(),
  });
  if (!res.ok) await handleApiError(res, '/api/costs/summary');
  return res.json();
}

export async function fetchExecutions(): Promise<ExecutionResult[]> {
  const res = await fetch(`${API_BASE}/api/executions`, {
    headers: getHeaders(),
  });
  if (!res.ok) await handleApiError(res, '/api/executions');
  return res.json();
}

export async function fetchHealth(): Promise<{ status: string; timestamp: string }> {
  const res = await fetch(`${API_BASE}/api/health`, {
    headers: getHeaders(),
  });
  if (!res.ok) await handleApiError(res, '/api/health');
  return res.json();
}

export async function estimateWorkflowCost(
  workflowName: string,
  input: unknown
): Promise<CostEstimate> {
  const res = await fetch(`${API_BASE}/api/workflows/${workflowName}/estimate`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ input }),
  });
  if (!res.ok) await handleApiError(res, `/api/workflows/${workflowName}/estimate`);
  return res.json();
}

export async function fetchCostHistory(params?: {
  startDate?: string;
  endDate?: string;
  agentId?: string;
  workflowName?: string;
}): Promise<CostInfo[]> {
  const searchParams = new URLSearchParams();
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);
  if (params?.agentId) searchParams.set('agentId', params.agentId);
  if (params?.workflowName) searchParams.set('workflowName', params.workflowName);

  const res = await fetch(`${API_BASE}/api/costs?${searchParams}`, {
    headers: getHeaders(),
  });
  if (!res.ok) await handleApiError(res, '/api/costs');
  return res.json();
}
