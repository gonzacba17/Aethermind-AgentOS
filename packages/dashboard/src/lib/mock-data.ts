/**
 * Mock data for demo purposes when API is not available
 */

import type { Agent, Trace, LogEntry, CostSummary, CostInfo } from './api';

export const MOCK_AGENTS: Agent[] = [
  {
    id: 'agent-1',
    name: 'Research Assistant',
    model: 'gpt-4',
    status: 'idle',
    config: {
      name: 'Research Assistant',
      model: 'gpt-4',
      systemPrompt: 'You are a helpful research assistant that provides accurate, well-sourced information.',
      maxRetries: 3,
      timeout: 60000,
      temperature: 0.7,
      maxTokens: 2000,
    },
  },
  {
    id: 'agent-2',
    name: 'Code Reviewer',
    model: 'gpt-4-turbo',
    status: 'running',
    config: {
      name: 'Code Reviewer',
      model: 'gpt-4-turbo',
      systemPrompt: 'You are an expert code reviewer who identifies bugs, security issues, and suggests improvements.',
      maxRetries: 2,
      timeout: 120000,
      temperature: 0.3,
      maxTokens: 4000,
    },
  },
  {
    id: 'agent-3',
    name: 'Content Writer',
    model: 'gpt-3.5-turbo',
    status: 'completed',
    config: {
      name: 'Content Writer',
      model: 'gpt-3.5-turbo',
      systemPrompt: 'You are a creative content writer who produces engaging blog posts and articles.',
      maxRetries: 3,
      timeout: 90000,
      temperature: 0.8,
      maxTokens: 3000,
    },
  },
  {
    id: 'agent-4',
    name: 'Data Analyzer',
    model: 'claude-3-sonnet',
    status: 'idle',
    config: {
      name: 'Data Analyzer',
      model: 'claude-3-sonnet',
      systemPrompt: 'You are a data analyst who interprets datasets and provides actionable insights.',
      maxRetries: 3,
      timeout: 180000,
      temperature: 0.2,
      maxTokens: 5000,
    },
  },
];

export const MOCK_TRACES: Trace[] = [
  {
    id: 'trace-1',
    executionId: 'exec-1',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    rootNode: {
      id: 'node-1',
      name: 'Research Workflow',
      type: 'workflow',
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      completedAt: new Date(Date.now() - 3540000).toISOString(),
      duration: 60000,
      children: [
        {
          id: 'node-1-1',
          parentId: 'node-1',
          name: 'Research Assistant',
          type: 'agent',
          startedAt: new Date(Date.now() - 3600000).toISOString(),
          completedAt: new Date(Date.now() - 3580000).toISOString(),
          duration: 20000,
          input: { query: 'What are the latest trends in AI?' },
          output: { result: 'AI trends include LLMs, multimodal models, and agent systems...' },
          children: [
            {
              id: 'node-1-1-1',
              parentId: 'node-1-1',
              name: 'GPT-4 Call',
              type: 'llm',
              startedAt: new Date(Date.now() - 3595000).toISOString(),
              completedAt: new Date(Date.now() - 3580000).toISOString(),
              duration: 15000,
              children: [],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'trace-2',
    executionId: 'exec-2',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    rootNode: {
      id: 'node-2',
      name: 'Code Review Workflow',
      type: 'workflow',
      startedAt: new Date(Date.now() - 7200000).toISOString(),
      completedAt: new Date(Date.now() - 7100000).toISOString(),
      duration: 100000,
      error: 'Rate limit exceeded',
      children: [],
    },
  },
  {
    id: 'trace-3',
    executionId: 'exec-3',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    rootNode: {
      id: 'node-3',
      name: 'Content Generation',
      type: 'workflow',
      startedAt: new Date(Date.now() - 86400000).toISOString(),
      completedAt: new Date(Date.now() - 86300000).toISOString(),
      duration: 100000,
      children: [],
    },
  },
];

export const MOCK_LOGS: LogEntry[] = [
  {
    id: 'log-1',
    timestamp: new Date(Date.now() - 60000).toISOString(),
    level: 'info',
    message: 'Agent "Research Assistant" started execution',
    agentId: 'agent-1',
    executionId: 'exec-1',
  },
  {
    id: 'log-2',
    timestamp: new Date(Date.now() - 55000).toISOString(),
    level: 'debug',
    message: 'Sending request to OpenAI API',
    agentId: 'agent-1',
    executionId: 'exec-1',
    metadata: { model: 'gpt-4', tokens: 1500 },
  },
  {
    id: 'log-3',
    timestamp: new Date(Date.now() - 50000).toISOString(),
    level: 'info',
    message: 'Received response from OpenAI API',
    agentId: 'agent-1',
    executionId: 'exec-1',
  },
  {
    id: 'log-4',
    timestamp: new Date(Date.now() - 30000).toISOString(),
    level: 'warn',
    message: 'High token usage detected: 4500 tokens',
    agentId: 'agent-2',
    executionId: 'exec-2',
  },
  {
    id: 'log-5',
    timestamp: new Date(Date.now() - 10000).toISOString(),
    level: 'error',
    message: 'Rate limit exceeded. Retrying in 5 seconds...',
    agentId: 'agent-2',
    executionId: 'exec-2',
    metadata: { retryCount: 1, maxRetries: 3 },
  },
];

export const MOCK_COST_SUMMARY: CostSummary = {
  total: 127.45,
  totalTokens: 2540000,
  executionCount: 156,
  byModel: {
    'gpt-4': { count: 45, tokens: 890000, cost: 62.30 },
    'gpt-4-turbo': { count: 32, tokens: 640000, cost: 32.00 },
    'gpt-3.5-turbo': { count: 67, tokens: 820000, cost: 24.60 },
    'claude-3-sonnet': { count: 12, tokens: 190000, cost: 8.55 },
  },
};

export const MOCK_COST_HISTORY: CostInfo[] = [
  {
    id: 'cost-1',
    executionId: 'exec-1',
    agentId: 'agent-1',
    agentName: 'Research Assistant',
    model: 'gpt-4',
    promptTokens: 1200,
    completionTokens: 800,
    totalTokens: 2000,
    cost: 0.06,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'cost-2',
    executionId: 'exec-2',
    agentId: 'agent-2',
    agentName: 'Code Reviewer',
    model: 'gpt-4-turbo',
    promptTokens: 3500,
    completionTokens: 1500,
    totalTokens: 5000,
    cost: 0.25,
    timestamp: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'cost-3',
    executionId: 'exec-3',
    agentId: 'agent-3',
    agentName: 'Content Writer',
    model: 'gpt-3.5-turbo',
    promptTokens: 800,
    completionTokens: 1200,
    totalTokens: 2000,
    cost: 0.004,
    timestamp: new Date(Date.now() - 86400000).toISOString(),
  },
];

/**
 * Check if we should use mock data (API not configured)
 * This is true when NEXT_PUBLIC_API_URL is not set, empty, or undefined
 */
export function shouldUseMockData(): boolean {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  // Use mock data if API_URL is not set, empty string, or undefined
  return !apiUrl || apiUrl.trim() === '' || apiUrl === 'undefined';
}
