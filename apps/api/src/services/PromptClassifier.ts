/**
 * PromptClassifier — deterministic, sub-millisecond prompt complexity classification.
 *
 * Used by both the API (for analytics) and the SDK (for routing decisions).
 * Does NOT call any LLM — purely heuristic-based.
 *
 * Classification rules:
 * - Simple: < 200 estimated tokens AND no reasoning keywords
 * - Complex: > 800 estimated tokens OR 3+ reasoning keywords OR multi-step instructions
 * - Medium: everything else
 */

export type PromptComplexity = 'simple' | 'medium' | 'complex';

/**
 * Reasoning keywords that indicate higher complexity.
 * Case-insensitive matching.
 */
const REASONING_KEYWORDS = [
  'analyze',
  'analyse',
  'compare',
  'contrast',
  'explain why',
  'step by step',
  'step-by-step',
  'reason',
  'reasoning',
  'evaluate',
  'assess',
  'critique',
  'synthesize',
  'synthesise',
  'break down',
  'breakdown',
  'trade-off',
  'tradeoff',
  'pros and cons',
  'advantages and disadvantages',
  'implications',
  'in-depth',
  'in depth',
  'comprehensive',
  'thorough',
  'elaborate',
  'justify',
  'argue',
  'debate',
  'consider',
  'weigh',
  'differentiate',
  'distinguish',
];

/**
 * Multi-step instruction markers.
 * These indicate the prompt has multiple distinct tasks.
 */
const MULTI_STEP_MARKERS = [
  /(?:^|\n)\s*\d+[\.\)]\s/gm,           // "1. " or "1) " at start of line
  /(?:^|\n)\s*[-*•]\s/gm,                // "- " or "* " bullet points
  /\b(?:first|second|third|then|next|finally|lastly|after that|additionally)\b/gi,
];

/**
 * Estimate token count from text.
 * Rough approximation: ~4 characters per token for English text.
 * This is intentionally simple and fast.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Split by whitespace for word count, then multiply by ~1.3 to account for subword tokens
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.ceil(wordCount * 1.3);
}

/**
 * Count reasoning keywords in text.
 * Uses case-insensitive matching. 
 * Only counts each keyword once (presence, not frequency).
 */
export function countReasoningKeywords(text: string): number {
  if (!text) return 0;
  const lowerText = text.toLowerCase();
  let count = 0;
  for (const keyword of REASONING_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      count++;
    }
  }
  return count;
}

/**
 * Count distinct instructions/steps in the prompt.
 */
export function countInstructions(text: string): number {
  if (!text) return 0;
  let maxCount = 0;
  for (const pattern of MULTI_STEP_MARKERS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches) {
      maxCount = Math.max(maxCount, matches.length);
    }
  }
  return maxCount;
}

/**
 * Classify prompt complexity.
 *
 * Rules:
 * - Simple: < 200 estimated tokens AND 0 reasoning keywords
 * - Complex: > 800 estimated tokens OR 3+ reasoning keywords OR 3+ distinct instructions
 * - Medium: everything else
 *
 * Performance: < 1ms on typical prompts. No LLM calls.
 */
export function classifyPrompt(text: string): PromptComplexity {
  if (!text || text.trim().length === 0) {
    return 'simple';
  }

  const tokens = estimateTokens(text);
  const reasoningCount = countReasoningKeywords(text);
  const instructionCount = countInstructions(text);

  // Complex thresholds
  if (tokens > 800) return 'complex';
  if (reasoningCount >= 3) return 'complex';
  if (instructionCount >= 3) return 'complex';

  // Simple thresholds
  if (tokens < 200 && reasoningCount === 0) return 'simple';

  // Everything else
  return 'medium';
}
