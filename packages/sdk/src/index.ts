import {
  Agent,
  AgentRuntime,
  createRuntime,
  Orchestrator,
  createOrchestrator,
  WorkflowEngine,
  createWorkflowEngine,
  createOpenAIProvider,
  createAnthropicProvider,
  createOllamaProvider,
  StructuredLogger,
  createLogger,
  TaskQueueService,
} from '@aethermind/core';

import type {
  AgentConfig,
  AgentLogic,
  AgentContext,
  OrchestratorConfig,
  WorkflowDefinition,
  ExecutionResult,
  LLMProvider,
  LogEntry,
} from '@aethermind/core';

export type {
  AgentConfig,
  AgentLogic,
  AgentContext,
  OrchestratorConfig,
  WorkflowDefinition,
  ExecutionResult,
  LLMProvider,
  LogEntry,
};

export interface CreateAgentOptions {
  name: string;
  model?: string;
  systemPrompt?: string;
  tools?: unknown[];
  maxRetries?: number;
  timeout?: number;
  temperature?: number;
  maxTokens?: number;
  logic: AgentLogic;
}

export interface StartOrchestratorOptions {
  agents: Agent[];
  config?: Partial<OrchestratorConfig>;
  provider?: LLMProviderOptions;
  workflows?: WorkflowDefinition[];
  onLog?: (entry: LogEntry) => void;
  redisUrl?: string;
}

export interface LLMProviderOptions {
  type: 'openai' | 'anthropic' | 'ollama';
  apiKey?: string;
  baseUrl?: string;
}

export interface AethermindInstance {
  runtime: AgentRuntime;
  orchestrator: Orchestrator;
  workflowEngine: WorkflowEngine;
  logger: StructuredLogger;
  executeTask: (agentName: string, input: unknown) => Promise<ExecutionResult>;
  executeWorkflow: (workflowName: string, input: unknown) => Promise<{ executionId: string; results: Map<string, ExecutionResult> }>;
  getAgentState: (agentName: string) => Record<string, unknown> | undefined;
  on: (event: string, handler: (...args: unknown[]) => void) => () => void;
  shutdown: () => Promise<void>;
}

let globalRuntime: AgentRuntime | null = null;
let globalOrchestrator: Orchestrator | null = null;

export function createAgent(options: CreateAgentOptions): Agent {
  const runtime = globalRuntime || createRuntime();
  if (!globalRuntime) {
    globalRuntime = runtime;
  }

  const config: AgentConfig = {
    name: options.name,
    model: options.model || 'gpt-4',
    systemPrompt: options.systemPrompt,
    tools: options.tools || [],
    maxRetries: options.maxRetries ?? 3,
    timeout: options.timeout ?? 30000,
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens,
  };

  return runtime.createAgent(config, options.logic);
}

export function startOrchestrator(options: StartOrchestratorOptions): AethermindInstance {
  const runtime = globalRuntime || createRuntime();
  globalRuntime = runtime;

  if (options.provider) {
    const provider = createProvider(options.provider);
    runtime.setDefaultProvider(provider);
  }

  for (const agent of options.agents) {
    if (!runtime.getAgent(agent.id)) {
      runtime.createAgent(agent.config, async (ctx) => {
        return await agent.execute(ctx.input);
      });
    }
  }

  // Create TaskQueueService
  const redisUrl = options.redisUrl || process.env['REDIS_URL'] || 'redis://localhost:6379';
  const parsedUrl = new URL(redisUrl);
  const queueService = new TaskQueueService('aethermind-tasks', {
    redis: {
      host: parsedUrl.hostname,
      port: parseInt(parsedUrl.port) || 6379,
    }
  });

  const orchestrator = createOrchestrator(runtime, queueService, options.config);
  globalOrchestrator = orchestrator;

  const workflowEngine = createWorkflowEngine(orchestrator);

  if (options.workflows) {
    for (const workflow of options.workflows) {
      workflowEngine.registerWorkflow(workflow);
    }
  }

  const logger = runtime.getLogger();

  if (options.onLog) {
    logger.onLog(options.onLog);
  }

  const instance: AethermindInstance = {
    runtime,
    orchestrator,
    workflowEngine,
    logger,

    async executeTask(agentName: string, input: unknown): Promise<ExecutionResult> {
      const agent = runtime.getAgentByName(agentName);
      if (!agent) {
        throw new Error(`Agent not found: ${agentName}`);
      }
      return orchestrator.executeTask(agent.id, input);
    },

    async executeWorkflow(workflowName: string, input: unknown) {
      return orchestrator.executeWorkflow(workflowName, input);
    },

    getAgentState(agentName: string): Record<string, unknown> | undefined {
      const agent = runtime.getAgentByName(agentName);
      if (!agent) return undefined;
      return agent.getState().toObject();
    },

    on(event: string, handler: (...args: unknown[]) => void): () => void {
      return runtime.on(event, handler);
    },

    async shutdown(): Promise<void> {
      await orchestrator.shutdown();
      await runtime.shutdown();
      globalRuntime = null;
      globalOrchestrator = null;
    },
  };

  return instance;
}

function createProvider(options: LLMProviderOptions): LLMProvider {
  switch (options.type) {
    case 'openai':
      if (!options.apiKey) {
        throw new Error('OpenAI API key is required');
      }
      return createOpenAIProvider(options.apiKey, options.baseUrl);

    case 'anthropic':
      if (!options.apiKey) {
        throw new Error('Anthropic API key is required');
      }
      return createAnthropicProvider(options.apiKey, options.baseUrl);

    case 'ollama':
      return createOllamaProvider(options.baseUrl);

    default:
      throw new Error(`Unknown provider type: ${options.type}`);
  }
}

export async function executeTask(
  agentName: string,
  input: unknown
): Promise<ExecutionResult> {
  if (!globalOrchestrator) {
    throw new Error('Orchestrator not started. Call startOrchestrator() first.');
  }
  const runtime = globalOrchestrator.getRuntime();
  const agent = runtime.getAgentByName(agentName);
  if (!agent) {
    throw new Error(`Agent not found: ${agentName}`);
  }
  return globalOrchestrator.executeTask(agent.id, input);
}

export function getAgentState(agentName: string): Record<string, unknown> | undefined {
  if (!globalRuntime) {
    throw new Error('Runtime not initialized. Call createAgent() or startOrchestrator() first.');
  }
  const agent = globalRuntime.getAgentByName(agentName);
  if (!agent) return undefined;
  return agent.getState().toObject();
}

export function getRuntime(): AgentRuntime | null {
  return globalRuntime;
}

export function getOrchestrator(): Orchestrator | null {
  return globalOrchestrator;
}

export { createRuntime, createOrchestrator, createWorkflowEngine, createLogger };
export { createOpenAIProvider, createAnthropicProvider, createOllamaProvider };
