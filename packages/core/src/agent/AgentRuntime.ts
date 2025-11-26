import EventEmitter from 'eventemitter3';
import type { AgentConfig, AgentLogic, ExecutionResult, LLMProvider, ChatMessage, AgentContext } from '../types/index.js';
import { Agent } from './Agent.js';
import { StructuredLogger } from '../logger/StructuredLogger.js';

export interface AgentRuntimeConfig {
  defaultProvider?: LLMProvider;
  maxConcurrentExecutions?: number;
}

export class AgentRuntime {
  private agents: Map<string, Agent> = new Map();
  private agentConfigs: Map<string, { config: AgentConfig; logic: AgentLogic }> = new Map();
  private providers: Map<string, LLMProvider> = new Map();
  private defaultProvider?: LLMProvider;
  private emitter: EventEmitter.EventEmitter;
  private logger: StructuredLogger;
  private runningExecutions: Set<string> = new Set();
  private maxConcurrentExecutions: number;

  constructor(config: AgentRuntimeConfig = {}) {
    this.emitter = new EventEmitter.EventEmitter();
    this.logger = new StructuredLogger({}, this.emitter);
    this.defaultProvider = config.defaultProvider;
    this.maxConcurrentExecutions = config.maxConcurrentExecutions || 10;
  }

  registerProvider(name: string, provider: LLMProvider): void {
    this.providers.set(name, provider);
    this.logger.info(`Registered provider: ${name}`);
  }

  getProvider(name: string): LLMProvider | undefined {
    return this.providers.get(name) || this.defaultProvider;
  }

  setDefaultProvider(provider: LLMProvider): void {
    this.defaultProvider = provider;
  }

  createAgent(config: AgentConfig, logic: AgentLogic): Agent {
    const agent = new Agent(config, logic, this.emitter);
    this.agents.set(agent.id, agent);
    this.agentConfigs.set(agent.id, { config, logic });
    this.logger.info(`Created agent: ${config.name}`, { agentId: agent.id });
    return agent;
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  getAgentByName(name: string): Agent | undefined {
    for (const agent of this.agents.values()) {
      if (agent.getName() === name) {
        return agent;
      }
    }
    return undefined;
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  removeAgent(id: string): boolean {
    const agent = this.agents.get(id);
    if (agent) {
      this.logger.info(`Removed agent: ${agent.getName()}`, { agentId: id });
      return this.agents.delete(id);
    }
    return false;
  }

  async executeAgent(agentId: string, input: unknown): Promise<ExecutionResult> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    if (this.runningExecutions.size >= this.maxConcurrentExecutions) {
      throw new Error('Maximum concurrent executions reached');
    }

    const executionKey = `${agentId}:${Date.now()}`;
    this.runningExecutions.add(executionKey);

    try {
      return await agent.execute(input);
    } finally {
      this.runningExecutions.delete(executionKey);
    }
  }

  async chat(
    agentId: string,
    messages: ChatMessage[],
    providerName?: string
  ): Promise<{ content: string; tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const provider = providerName
      ? this.providers.get(providerName)
      : this.defaultProvider;

    if (!provider) {
      throw new Error('No LLM provider configured');
    }

    const systemPrompt = agent.config.systemPrompt;
    const allMessages: ChatMessage[] = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const response = await provider.chat(allMessages, {
      model: agent.getModel(),
      temperature: agent.config.temperature,
      maxTokens: agent.config.maxTokens,
    });

    return {
      content: response.content,
      tokenUsage: response.tokenUsage,
    };
  }

  on(event: string, handler: (...args: unknown[]) => void): () => void {
    this.emitter.on(event, handler);
    return () => this.emitter.off(event, handler);
  }

  getEmitter(): EventEmitter.EventEmitter {
    return this.emitter;
  }

  getLogger(): StructuredLogger {
    return this.logger;
  }

  getRunningExecutionsCount(): number {
    return this.runningExecutions.size;
  }

  /**
   * Reload an agent with new configuration
   * If reload fails, the previous configuration is restored
   */
  async reloadAgent(agentId: string, newConfig: AgentConfig, newLogic: AgentLogic): Promise<void> {
    const existingAgent = this.agents.get(agentId);
    const existingConfig = this.agentConfigs.get(agentId);

    if (!existingAgent || !existingConfig) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Store previous config for rollback
    const previousConfig = existingConfig.config;
    const previousLogic = existingConfig.logic;

    try {
      // Create new agent with updated config
      const newAgent = new Agent(newConfig, newLogic, this.emitter);

      // Replace the agent
      this.agents.set(agentId, newAgent);
      this.agentConfigs.set(agentId, { config: newConfig, logic: newLogic });

      this.logger.info(`Reloaded agent: ${newConfig.name}`, { agentId });

      // Emit reload success event
      this.emitter.emit('agent:reloaded', {
        agentId,
        agentName: newConfig.name,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Rollback to previous configuration
      this.logger.error(`Failed to reload agent ${agentId}, rolling back`, { error });

      const rolledBackAgent = new Agent(previousConfig, previousLogic, this.emitter);
      this.agents.set(agentId, rolledBackAgent);
      this.agentConfigs.set(agentId, { config: previousConfig, logic: previousLogic });

      // Emit reload failed event
      this.emitter.emit('agent:reload-failed', {
        agentId,
        agentName: previousConfig.name,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down agent runtime');
    this.agents.clear();
    this.providers.clear();
    this.runningExecutions.clear();
    this.emitter.removeAllListeners();
  }
}

export function createRuntime(config?: AgentRuntimeConfig): AgentRuntime {
  return new AgentRuntime(config);
}
