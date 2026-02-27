/**
 * PromptClassifier — deterministic, sub-millisecond prompt complexity classification.
 *
 * Vendored copy for the SDK (same logic as apps/api/src/services/PromptClassifier.ts).
 * Keep in sync — this runs on the client side to classify prompts before routing.
 *
 * Does NOT call any LLM — purely heuristic-based.
 */

export type PromptComplexity = 'simple' | 'medium' | 'complex';

const REASONING_KEYWORDS = [
  'analyze', 'analyse', 'compare', 'contrast', 'explain why',
  'step by step', 'step-by-step', 'reason', 'reasoning',
  'evaluate', 'assess', 'critique', 'synthesize', 'synthesise',
  'break down', 'breakdown', 'trade-off', 'tradeoff',
  'pros and cons', 'advantages and disadvantages', 'implications',
  'in-depth', 'in depth', 'comprehensive', 'thorough', 'elaborate',
  'justify', 'argue', 'debate', 'consider', 'weigh',
  'differentiate', 'distinguish',
];

const MULTI_STEP_MARKERS = [
  /(?:^|\n)\s*\d+[\.\)]\s/gm,
  /(?:^|\n)\s*[-*•]\s/gm,
  /\b(?:first|second|third|then|next|finally|lastly|after that|additionally)\b/gi,
];

export function estimateTokens(text: string): number {
  if (!text) return 0;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.ceil(wordCount * 1.3);
}

export function countReasoningKeywords(text: string): number {
  if (!text) return 0;
  const lowerText = text.toLowerCase();
  let count = 0;
  for (const keyword of REASONING_KEYWORDS) {
    if (lowerText.includes(keyword)) count++;
  }
  return count;
}

export function countInstructions(text: string): number {
  if (!text) return 0;
  let maxCount = 0;
  for (const pattern of MULTI_STEP_MARKERS) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches) maxCount = Math.max(maxCount, matches.length);
  }
  return maxCount;
}

export function classifyPrompt(text: string): PromptComplexity {
  if (!text || text.trim().length === 0) return 'simple';

  const tokens = estimateTokens(text);
  const reasoningCount = countReasoningKeywords(text);
  const instructionCount = countInstructions(text);

  if (tokens > 800) return 'complex';
  if (reasoningCount >= 3) return 'complex';
  if (instructionCount >= 3) return 'complex';
  if (tokens < 200 && reasoningCount === 0) return 'simple';

  return 'medium';
}
