/**
 * Shared pricing data for LLM models
 * Used by both SDK (agent) and API (server) for consistent cost calculation
 */

/**
 * Token usage interface
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Model cost structure (per 1K tokens)
 */
export interface ModelCost {
  input: number;  // Cost per 1K input tokens in USD
  output: number; // Cost per 1K output tokens in USD
}

/**
 * OpenAI model pricing (as of December 2024)
 * Source: https://openai.com/pricing
 */
export const OPENAI_MODEL_COSTS: Record<string, ModelCost> = {
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4-turbo-2024-04-09': { input: 0.01, output: 0.03 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-2024-11-20': { input: 0.0025, output: 0.01 },
  'gpt-4o-2024-08-06': { input: 0.0025, output: 0.01 },
  'gpt-4o-2024-05-13': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4o-mini-2024-07-18': { input: 0.00015, output: 0.0006 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-3.5-turbo-0125': { input: 0.0005, output: 0.0015 },
  'o1-preview': { input: 0.015, output: 0.06 },
  'o1-preview-2024-09-12': { input: 0.015, output: 0.06 },
  'o1-mini': { input: 0.003, output: 0.012 },
  'o1-mini-2024-09-12': { input: 0.003, output: 0.012 },
};

/**
 * Anthropic (Claude) model pricing (as of December 2024)
 * Source: https://www.anthropic.com/pricing
 */
export const ANTHROPIC_MODEL_COSTS: Record<string, ModelCost> = {
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-3-5-sonnet-20240620': { input: 0.003, output: 0.015 },
  'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
};

/**
 * Ollama models (local, no cost)
 */
export const OLLAMA_MODEL_COSTS: Record<string, ModelCost> = {
  'llama2': { input: 0, output: 0 },
  'llama3': { input: 0, output: 0 },
  'mistral': { input: 0, output: 0 },
  'mixtral': { input: 0, output: 0 },
  'codellama': { input: 0, output: 0 },
};

/**
 * Unified pricing map
 */
export const MODEL_PRICING = {
  openai: OPENAI_MODEL_COSTS,
  anthropic: ANTHROPIC_MODEL_COSTS,
  ollama: OLLAMA_MODEL_COSTS,
};

/**
 * Calculate cost for a given model and token usage
 * 
 * @param model - Model name (e.g., "gpt-4", "claude-3-5-sonnet-20241022")
 * @param tokens - Token usage (prompt, completion, total)
 * @returns Cost in USD
 * 
 * @example
 * ```typescript
 * const cost = calculateCost('gpt-4', {
 *   promptTokens: 1000,
 *   completionTokens: 500,
 *   totalTokens: 1500
 * });
 * // cost = 0.06 (1000/1000 * 0.03 + 500/1000 * 0.06)
 * ```
 */
export function calculateCost(model: string, tokens: TokenUsage): number {
  // Determine provider and get pricing
  let costs: ModelCost;

  if (model.startsWith('gpt-') || model.startsWith('o1-')) {
    costs = OPENAI_MODEL_COSTS[model] || OPENAI_MODEL_COSTS['gpt-4'] || { input: 0, output: 0 };
  } else if (model.startsWith('claude-')) {
    costs = ANTHROPIC_MODEL_COSTS[model] || ANTHROPIC_MODEL_COSTS['claude-3-5-sonnet-20241022'] || { input: 0, output: 0 };
  } else {
    // Assume Ollama or local model (no cost)
    costs = { input: 0, output: 0 };
  }

  const inputCost = (tokens.promptTokens / 1000) * costs.input;
  const outputCost = (tokens.completionTokens / 1000) * costs.output;

  return inputCost + outputCost;
}

/**
 * Get pricing information for a specific model
 */
export function getModelPricing(model: string): ModelCost | null {
  if (model.startsWith('gpt-') || model.startsWith('o1-')) {
    return OPENAI_MODEL_COSTS[model] || OPENAI_MODEL_COSTS['gpt-4'] || null;
  } else if (model.startsWith('claude-')) {
    return ANTHROPIC_MODEL_COSTS[model] || ANTHROPIC_MODEL_COSTS['claude-3-5-sonnet-20241022'] || null;
  } else if (OLLAMA_MODEL_COSTS[model]) {
    return OLLAMA_MODEL_COSTS[model] || null;
  }
  return null;
}
