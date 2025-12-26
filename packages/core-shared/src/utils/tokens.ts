/**
 * Token estimation utilities
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
 * Rough estimation of tokens from text
 * Rule of thumb: 1 token ≈ 4 characters for English text
 * 
 * @param text - Input text to estimate
 * @returns Estimated number of tokens
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }
  
  // Rough heuristic: 1 token per 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens for an array of messages
 */
export function estimateMessagesTokens(messages: Array<{ role: string; content: string }>): number {
  let total = 0;
  
  for (const msg of messages) {
    // Add tokens for role and content
    total += estimateTokens(msg.role);
    total += estimateTokens(msg.content);
    // Add a few tokens for message structure
    total += 4;
  }
  
  // Add tokens for message array structure
  total += 3;
  
  return total;
}
