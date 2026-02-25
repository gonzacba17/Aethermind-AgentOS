import { getAuthToken, clearAuthToken } from './auth-utils';

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || '';
// Normalize: strip trailing /api and trailing slashes to prevent /api/api/... duplication.
// All endpoints in this file already prepend /api/, so API_BASE must be the bare origin.
const API_BASE = RAW_API_URL.replace(/\/api\/?$/, '').replace(/\/+$/, '');

// Retry configuration
const DEFAULT_RETRIES = 3;
const RETRY_DELAY_BASE = 1000;
const MAX_RETRY_DELAY = 30000;


function getRetryDelay(attempt: number): number {
  const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(delay + jitter, MAX_RETRY_DELAY);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Build headers for API requests.
 * Sends X-Client-Token instead of Authorization: Bearer (B2B beta).
 */
function getHeaders(additionalHeaders?: Record<string, string>): HeadersInit {
  const headers: Record<string, string> = {
    ...(additionalHeaders || {}),
  };

  if (typeof window !== 'undefined') {
    const token = getAuthToken();
    if (token) {
      headers['X-Client-Token'] = token;
    }
  }

  return headers;
}

async function handleApiError(response: Response, endpoint: string): Promise<never> {
  const status = response.status;

  if (status === 401) {
    console.error(`[API] 401 on ${endpoint}`);
    if (typeof window !== 'undefined') {
      clearAuthToken();
    }
  }

  let errorMessage = `API request failed: ${status}`;
  let errorCode = 'API_ERROR';

  try {
    const errorData = await response.json();
    errorMessage = errorData.message || errorData.error || errorMessage;
    errorCode = errorData.code || errorCode;
  } catch {
    // Use default
  }

  const error = new Error(errorMessage) as Error & { status: number; code: string };
  error.status = status;
  error.code = errorCode;
  throw error;
}

/**
 * Make an API request with automatic retry.
 * No token refresh — B2B beta tokens don't expire.
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  retries: number = DEFAULT_RETRIES
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: getHeaders(options.headers as Record<string, string>),
      });

      if (!response.ok) {
        await handleApiError(response, endpoint);
      }

      const text = await response.text();
      if (!text) return {} as T;

      return JSON.parse(text);
    } catch (error) {
      lastError = error as Error;

      const status = (error as any).status;
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw error;
      }

      if (attempt < retries) {
        const delay = getRetryDelay(attempt);
        console.log(`[API] Retrying ${endpoint} in ${delay}ms (attempt ${attempt + 1}/${retries})`);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('API request failed after retries');
}

export { apiRequest, API_BASE }

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
