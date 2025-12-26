/**
 * @aethermind/core-shared - Shared utilities and types
 * 
 * This package contains logic shared between the client SDK and server API
 */

// Cost utilities
export {
  OPENAI_MODEL_COSTS,
  ANTHROPIC_MODEL_COSTS,
  OLLAMA_MODEL_COSTS,
  MODEL_PRICING,
  calculateCost,
  getModelPricing,
  type TokenUsage,
  type ModelCost,
} from './cost/pricing.js';

// Token utilities
export {
  estimateTokens,
  estimateMessagesTokens,
} from './utils/tokens.js';
