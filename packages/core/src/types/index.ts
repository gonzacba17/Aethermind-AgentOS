import { z } from 'zod';

export const AgentStatusSchema = z.enum(['idle', 'running', 'completed', 'failed', 'timeout']);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);
export type LogLevel = z.infer<typeof LogLevelSchema>;

export const AgentConfigSchema = z.object({
  name: z.string().min(1),
  model: z.string().default('gpt-4'),
  systemPrompt: z.string().optional(),
  maxRetries: z.number().int().min(0).default(3),
  timeout: z.number().int().min(1000).default(30000),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).optional(),
  tools: z.array(z.any()).default([]),
  metadata: z.record(z.unknown()).optional(),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export interface AgentContext {
  agentId: string;
  executionId: string;
  input: unknown;
  state: Map<string, unknown>;
  logger: LoggerInterface;
  emit: (event: string, data: unknown) => void;
}

export type AgentLogic = (ctx: AgentContext) => Promise<unknown>;

export interface AgentDefinition {
  config: AgentConfig;
  logic: AgentLogic;
}

export interface ExecutionResult {
  executionId: string;
  agentId: string;
  status: AgentStatus;
  output: unknown;
  error?: Error;
  startedAt: Date;
  completedAt: Date;
  duration: number;
  tokenUsage?: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CostInfo {
  executionId: string;
  model: string;
  tokens: TokenUsage;
  cost: number;
  currency: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  agentId?: string;
  executionId?: string;
  metadata?: Record<string, unknown>;
}

export interface LoggerInterface {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

export interface TraceNode {
  id: string;
  parentId?: string;
  name: string;
  type: 'agent' | 'tool' | 'llm' | 'workflow';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
  children: TraceNode[];
  metadata?: Record<string, unknown>;
}

export interface Trace {
  id: string;
  executionId: string;
  rootNode: TraceNode;
  createdAt: Date;
}

export const OrchestratorConfigSchema = z.object({
  maxConcurrentAgents: z.number().int().min(1).default(10),
  defaultTimeout: z.number().int().min(1000).default(60000),
  retryPolicy: z.object({
    maxRetries: z.number().int().min(0).default(3),
    baseDelay: z.number().int().min(100).default(1000),
    maxDelay: z.number().int().min(1000).default(30000),
  }).default({}),
  enableTracing: z.boolean().default(true),
  enableCostTracking: z.boolean().default(true),
});
export type OrchestratorConfig = z.infer<typeof OrchestratorConfigSchema>;

export interface WorkflowStep {
  id: string;
  agent: string;
  next?: string | string[];
  condition?: string;
  parallel?: boolean;
}

export interface WorkflowDefinition {
  name: string;
  description?: string;
  steps: WorkflowStep[];
  entryPoint: string;
}

export interface LLMProvider {
  name: string;
  chat(messages: ChatMessage[], config: LLMRequestConfig): Promise<LLMResponse>;
  estimateCost(tokenUsage: TokenUsage): number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface LLMRequestConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  tokenUsage: TokenUsage;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type EventType =
  | 'agent:started'
  | 'agent:completed'
  | 'agent:failed'
  | 'agent:log'
  | 'execution:started'
  | 'execution:completed'
  | 'execution:failed'
  | 'workflow:started'
  | 'workflow:step:completed'
  | 'workflow:completed'
  | 'workflow:failed';

export interface AgentEvent {
  type: EventType;
  timestamp: Date;
  agentId?: string;
  executionId?: string;
  data: unknown;
}

// Cost Estimation Types
export interface ModelPricing {
  model: string;
  provider: string;
  inputCostPer1K: number;
  outputCostPer1K: number;
  currency: string;
}

export interface StepCostEstimate {
  stepId: string;
  agentName: string;
  model: string;
  estimatedTokens: TokenUsage;
  estimatedCost: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface CostEstimate {
  totalCost: number;
  totalTokens: TokenUsage;
  currency: string;
  breakdown: StepCostEstimate[];
  confidence: 'high' | 'medium' | 'low';
  basedOn: 'historical' | 'heuristic';
  timestamp: Date;
}

