import type { TelemetryEvent } from '../transport/types.js';
import { calculateCost, type TokenUsage } from '../pricing/index.js';
import { budgetChecker } from '../budget/BudgetChecker.js';
import { routerService } from '../routing/RouterService.js';
import { cacheService, type CacheHit } from '../cache/CacheService.js';
import { compressionService, type CompressionResult } from '../compression/CompressionService.js';

/**
 * Request context captured before API call
 */
export interface RequestContext {
  model: string;
  timestamp: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'ollama';
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
   * Instrument the provider SDK.
   * @param sdkModule - Optional pre-loaded SDK module (from dynamic import).
   */
  abstract instrument(sdkModule?: any): void;

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
   * Uses vendored pricing data from ../pricing/
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
   * Check budget before executing an LLM call.
   * Throws AethermindBudgetExceededError if budget is exceeded.
   * Fails silently on network errors (non-blocking).
   */
  protected async checkBudget(): Promise<void> {
    await budgetChecker.check();
  }

  /**
   * Resolve model using RouterService.
   * Fails silently on errors (non-blocking) — returns original model.
   */
  protected async resolveModelWithRouter(
    originalModel: string,
    promptText: string
  ): Promise<{
    model: string;
    wasRouted: boolean;
    originalModel: string;
    complexity?: string;
  }> {
    try {
      return await routerService.resolveModel(originalModel, promptText);
    } catch (error) {
      // Fail-open: any error → use original model
      return { model: originalModel, wasRouted: false, originalModel };
    }
  }

  /**
   * Check cache before executing an LLM call.
   * Fail-open: returns null on any error.
   */
  protected async checkCache(prompt: string, model: string): Promise<CacheHit | null> {
    try {
      return await cacheService.lookup(prompt, model);
    } catch {
      return null;
    }
  }

  /**
   * Store response in cache after a successful LLM call.
   * Fire-and-forget: doesn't block the caller.
   */
  protected storeInCache(
    prompt: string,
    response: string,
    model: string,
    tokensUsed: number,
    costUsd: number
  ): void {
    try {
      cacheService.store(prompt, response, model, tokensUsed, costUsd);
    } catch {
      // Silently ignore
    }
  }

  /**
   * Compress prompt using CompressionService.
   * Position: after checkCache (no compress if cache hit) and before checkBudget.
   * Fail-open: any error → use original prompt.
   */
  protected async compress(
    prompt: string,
    model: string
  ): Promise<CompressionResult> {
    try {
      return await compressionService.compress(prompt, model);
    } catch {
      // Fail-open: use original prompt
      return {
        prompt,
        wasCompressed: false,
        originalTokens: 0,
        finalTokens: 0,
      };
    }
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
