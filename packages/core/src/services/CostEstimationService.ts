import type {
    WorkflowDefinition,
    WorkflowStep,
    AgentConfig,
    TokenUsage,
    CostEstimate,
    StepCostEstimate,
    ModelPricing,
    ExecutionResult,
    CostInfo,
} from '../types/index.js';
import type { AgentRuntime } from '../agent/AgentRuntime.js';
import { MODEL_COSTS as OPENAI_COSTS } from '../providers/OpenAIProvider.js';
import { MODEL_COSTS as ANTHROPIC_COSTS } from '../providers/AnthropicProvider.js';
import { MODEL_COSTS as OLLAMA_COSTS } from '../providers/OllamaProvider.js';

interface PaginatedResult<T> {
    data: T[];
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
}

interface MinimalStore {
    getAllExecutions(): Promise<ExecutionResult[]> | ExecutionResult[];
    getCosts(options?: { executionId?: string; model?: string; limit?: number; offset?: number }): Promise<PaginatedResult<CostInfo>> | PaginatedResult<CostInfo>;
}

/**
 * Service for estimating the cost of workflow executions before they run.
 * Uses historical data when available, falls back to heuristic estimation.
 */
export class CostEstimationService {
    private runtime: AgentRuntime;
    private store: MinimalStore;

    // Default token estimates when no historical data is available
    private readonly DEFAULT_PROMPT_TOKENS = 1000;
    private readonly DEFAULT_COMPLETION_TOKENS = 500;

    constructor(runtime: AgentRuntime, store: MinimalStore) {
        this.runtime = runtime;
        this.store = store;
    }

    /**
     * Estimates the total cost of executing a workflow
     */
    async estimateWorkflowCost(
        workflow: WorkflowDefinition,
        input: unknown
    ): Promise<CostEstimate> {
        const stepEstimates: StepCostEstimate[] = [];
        let totalCost = 0;
        let totalPromptTokens = 0;
        let totalCompletionTokens = 0;
        let overallConfidence: 'high' | 'medium' | 'low' = 'high';

        // Get historical data for this workflow if available
        const historicalTokens = await this.getHistoricalTokenAverage(workflow.name);

        for (const step of workflow.steps) {
            const stepEstimate = await this.estimateStepCost(
                step,
                workflow.name,
                historicalTokens
            );

            stepEstimates.push(stepEstimate);
            totalCost += stepEstimate.estimatedCost;
            totalPromptTokens += stepEstimate.estimatedTokens.promptTokens;
            totalCompletionTokens += stepEstimate.estimatedTokens.completionTokens;

            // Overall confidence is the lowest of all steps
            if (stepEstimate.confidence === 'low') {
                overallConfidence = 'low';
            } else if (stepEstimate.confidence === 'medium' && overallConfidence !== 'low') {
                overallConfidence = 'medium';
            }
        }

        return {
            totalCost,
            totalTokens: {
                promptTokens: totalPromptTokens,
                completionTokens: totalCompletionTokens,
                totalTokens: totalPromptTokens + totalCompletionTokens,
            },
            currency: 'USD',
            breakdown: stepEstimates,
            confidence: overallConfidence,
            basedOn: historicalTokens ? 'historical' : 'heuristic',
            timestamp: new Date(),
        };
    }

    /**
     * Estimates the cost of a single workflow step
     */
    private async estimateStepCost(
        step: WorkflowStep,
        workflowName: string,
        historicalTokens: TokenUsage | null
    ): Promise<StepCostEstimate> {
        // Get the agent configuration
        const agent = this.runtime.getAgentByName(step.agent);
        if (!agent) {
            throw new Error(`Agent not found: ${step.agent}`);
        }

        const agentConfig = agent.config as AgentConfig;
        const model = agentConfig.model || 'gpt-4';

        // Determine token usage
        let estimatedTokens: TokenUsage;
        let confidence: 'high' | 'medium' | 'low';

        if (historicalTokens) {
            // Use historical average
            estimatedTokens = historicalTokens;
            confidence = 'high';
        } else {
            // Use heuristic estimation based on system prompt length
            const promptLength = agentConfig.systemPrompt?.length || 0;
            const estimatedPromptTokens = Math.max(
                this.DEFAULT_PROMPT_TOKENS,
                Math.floor(promptLength / 4) // Rough estimate: 1 token ≈ 4 characters
            );
            const estimatedCompletionTokens = agentConfig.maxTokens || this.DEFAULT_COMPLETION_TOKENS;

            estimatedTokens = {
                promptTokens: estimatedPromptTokens,
                completionTokens: estimatedCompletionTokens,
                totalTokens: estimatedPromptTokens + estimatedCompletionTokens,
            };
            confidence = 'medium';
        }

        // Get pricing for the model
        const pricing = this.getModelPricing(model);

        // Calculate cost
        const inputCost = (estimatedTokens.promptTokens / 1000) * pricing.inputCostPer1K;
        const outputCost = (estimatedTokens.completionTokens / 1000) * pricing.outputCostPer1K;
        const estimatedCost = inputCost + outputCost;

        return {
            stepId: step.id,
            agentName: step.agent,
            model,
            estimatedTokens,
            estimatedCost,
            confidence,
        };
    }

    /**
     * Gets pricing information for a specific model
     */
    getModelPricing(model: string): ModelPricing {
        // Determine provider based on model name
        let provider: string;
        let costs: { input: number; output: number };

        if (model.startsWith('gpt-') || model.startsWith('o1-')) {
            provider = 'openai';
            costs = OPENAI_COSTS[model] || OPENAI_COSTS['gpt-4']!;
        } else if (model.startsWith('claude-')) {
            provider = 'anthropic';
            costs = ANTHROPIC_COSTS[model] || ANTHROPIC_COSTS['claude-3-5-sonnet-20241022']!;
        } else {
            // Assume Ollama or other local model
            provider = 'ollama';
            costs = OLLAMA_COSTS[model] || { input: 0, output: 0 };
        }

        return {
            model,
            provider,
            inputCostPer1K: costs.input,
            outputCostPer1K: costs.output,
            currency: 'USD',
        };
    }

    /**
     * Gets the average token usage from historical executions of a workflow
     */
    private async getHistoricalTokenAverage(workflowName: string): Promise<TokenUsage | null> {
        try {
            // Get all executions (limited to recent ones)
            const allExecutions = await this.store.getAllExecutions();

            // Filter executions that match this workflow
            // Note: We don't have a direct workflow name in ExecutionResult,
            // so we'll need to infer from agent patterns or use all executions
            // For now, we'll use a simple average of recent executions

            if (allExecutions.length === 0) {
                return null;
            }

            // Get costs for recent executions
            const recentCostsResult = await this.store.getCosts({ limit: 10 });

            if (recentCostsResult.data.length === 0) {
                return null;
            }

            // Calculate average
            const totalPrompt = recentCostsResult.data.reduce((sum: number, cost: CostInfo) => sum + cost.tokens.promptTokens, 0);
            const totalCompletion = recentCostsResult.data.reduce((sum: number, cost: CostInfo) => sum + cost.tokens.completionTokens, 0);
            const count = recentCostsResult.data.length;

            return {
                promptTokens: Math.floor(totalPrompt / count),
                completionTokens: Math.floor(totalCompletion / count),
                totalTokens: Math.floor((totalPrompt + totalCompletion) / count),
            };
        } catch (error) {
            // Note: console is available in Node.js environment
            if (typeof console !== 'undefined') {
                console.warn('Failed to get historical token average:', error);
            }
            return null;
        }
    }
}

export function createCostEstimationService(
    runtime: AgentRuntime,
    store: MinimalStore
): CostEstimationService {
    return new CostEstimationService(runtime, store);
}
