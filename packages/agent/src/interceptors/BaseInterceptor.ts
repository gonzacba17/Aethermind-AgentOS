import type { TelemetryEvent } from '../transport/types.js';
import { calculateCost, type TokenUsage } from '@aethermind/core-shared';

/**
 * Request context captured before API call
 */
export interface RequestContext {
  model: string;
  timestamp: string;
  provider: 'openai' | 'anthropic';
}

/**
 * Response context captured after API call
 */
export interface ResponseContext {
  tokens: TokenUsage;
  latency: number;
  status: 'success' | 'error';
  error?: string;
}

/**
 * Base interceptor class for LLM provider instrumentation
 * 
 * Subclasses implement provider-specific interception logic
 * for OpenAI, Anthropic, etc.
 */
export abstract class BaseInterceptor {
  protected isInstrumented = false;

  /**
   * Instrument the provider SDK
   * Subclasses override to monkey-patch the specific SDK
   */
  abstract instrument(): void;

  /**
   * Remove instrumentation
   * Restore original SDK behavior
   */
  abstract uninstrument(): void;

  /**
   * Capture telemetry event from request and response
   * 
   * @param request - Request context
   * @param response - Response context
   * @returns Complete telemetry event
   */
  protected captureEvent(
    request: RequestContext,
    response: ResponseContext
  ): TelemetryEvent {
    const cost = this.calculateCost(request.model, response.tokens);

    return {
      timestamp: request.timestamp,
      provider: request.provider,
      model: request.model,
      tokens: response.tokens,
      cost,
      latency: response.latency,
      status: response.status,
      ...(response.error && { error: response.error }),
    };
  }

  /**
   * Calculate cost for this request
   * Uses shared pricing data from @aethermind/core-shared
   */
  protected calculateCost(model: string, tokens: TokenUsage): number {
    return calculateCost(model, tokens);
  }

  /**
   * Check if instrumentation is active
   */
  isActive(): boolean {
    return this.isInstrumented;
  }

  /**
   * Safely execute function and capture errors
   */
  protected async safeExecute<T>(
    fn: () => Promise<T>,
    onError?: (error: Error) => void
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      // Log error but don't break user's app
      console.error('[Aethermind] Interceptor error:', err.message);
      
      if (onError) {
        onError(err);
      }
      
      // Re-throw to maintain original behavior
      throw error;
    }
  }
}
