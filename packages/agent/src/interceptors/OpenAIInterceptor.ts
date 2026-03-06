import { BaseInterceptor, type RequestContext, type ResponseContext } from './BaseInterceptor.js';
import { getConfig } from '../config/index.js';
import type { TelemetryEvent } from '../transport/types.js';

// Store reference to original OpenAI methods
let originalCreate: any = null;

/**
 * OpenAI SDK Interceptor
 * 
 * Monkey-patches the OpenAI SDK to automatically capture:
 * - Model used
 * - Token consumption
 * - Cost
 * - Latency
 * - Errors
 * 
 * @example
 * ```typescript
 * const interceptor = new OpenAIInterceptor();
 * interceptor.instrument();
 * 
 * // Now all OpenAI calls are automatically tracked
 * const openai = new OpenAI({ apiKey: '...' });
 * await openai.chat.completions.create({ ... });
 * ```
 */
export class OpenAIInterceptor extends BaseInterceptor {
  private eventCallback?: (event: TelemetryEvent) => void;

  constructor(eventCallback?: (event: TelemetryEvent) => void) {
    super();
    this.eventCallback = eventCallback;
  }

  /**
   * Instrument OpenAI SDK.
   * @param sdkModule - Pre-loaded openai module (from dynamic import). Falls back to require().
   */
  instrument(sdkModule?: any): void {
    if (this.isInstrumented) return;

    try {
      const OpenAI = sdkModule
        ? (sdkModule.default || sdkModule.OpenAI || sdkModule)
        : this.getOpenAIConstructor();

      if (!OpenAI) return;

      // Store original method
      originalCreate = OpenAI.prototype.chat?.completions?.create;
      if (!originalCreate) return;

      // Monkey-patch the create method
      const self = this;
      OpenAI.prototype.chat.completions.create = function (this: any, ...args: any[]) {
        return self.interceptCreate.call(this, originalCreate, args);
      };

      this.isInstrumented = true;
      console.log('[Aethermind] OpenAI instrumented');
    } catch (error) {
      console.error('[Aethermind] Failed to instrument OpenAI:', error);
    }
  }

  /**
   * Remove instrumentation
   */
  uninstrument(): void {
    if (!this.isInstrumented) {
      return;
    }

    try {
      const OpenAI = this.getOpenAIConstructor();
      
      if (OpenAI && originalCreate) {
        OpenAI.prototype.chat.completions.create = originalCreate;
      }

      this.isInstrumented = false;
      console.log('[Aethermind] OpenAI SDK uninstrumented');
    } catch (error) {
      console.error('[Aethermind] Failed to uninstrument OpenAI:', error);
    }
  }

  /**
   * Intercept chat.completions.create call
   */
  private async interceptCreate(originalMethod: any, args: any[]): Promise<any> {
    const config = getConfig();

    if (!config.enabled) {
      // SDK disabled, pass through
      return originalMethod.apply(this, args);
    }

    const params = args[0] || {};
    const originalModel = params.model || 'gpt-3.5-turbo';

    // ---- Phase 3: Cache check (before all other hooks) ----
    const promptText = this.extractPromptText(params);
    const cacheResult = await this.checkCache(promptText, originalModel);

    if (cacheResult) {
      // Construct synthetic OpenAI ChatCompletion response
      const syntheticResponse = {
        id: `chatcmpl-cache-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: cacheResult.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: cacheResult.response,
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      };

      // Emit telemetry event with cache hit
      if (this.eventCallback) {
        this.eventCallback({
          timestamp: new Date().toISOString(),
          provider: 'openai',
          model: cacheResult.model,
          tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          cost: 0,
          latency: 0,
          status: 'success',
          cacheHit: true,
          cacheSavedUsd: cacheResult.costUsd,
        });
      }

      return syntheticResponse;
    }

    // ---- Phase 4: Prompt compression (after cache, before budget) ----
    const compressionResult = await this.compress(promptText, originalModel);
    let finalPromptText = promptText;

    if (compressionResult.wasCompressed) {
      finalPromptText = compressionResult.prompt;
      // Apply compressed prompt back to params messages
      this.applyCompressedPrompt(params, compressionResult.prompt);
      args[0] = params;
    }

    // Budget enforcement — check before executing LLM call
    await this.checkBudget();

    const startTime = Date.now();

    // ---- Phase 2: Model Routing ----
    const routingResult = await this.resolveModelWithRouter(originalModel, finalPromptText);

    // Apply routed model to params if routing occurred
    if (routingResult.wasRouted) {
      params.model = routingResult.model;
      args[0] = params;
    }

    const request: RequestContext = {
      model: routingResult.model,
      timestamp: new Date().toISOString(),
      provider: 'openai',
    };

    try {
      // Call original method with (potentially routed) model
      const response = await originalMethod.apply(this, args);

      const latency = Date.now() - startTime;

      // Extract usage from response
      const usage = response.usage;

      if (usage) {
        const responseContext: ResponseContext = {
          tokens: {
            promptTokens: usage.prompt_tokens || 0,
            completionTokens: usage.completion_tokens || 0,
            totalTokens: usage.total_tokens || 0,
          },
          latency,
          status: 'success',
        };

        // Capture event with routing metadata
        const event = this.captureEvent(request, responseContext);

        // Add routing metadata
        if (routingResult.wasRouted) {
          event.originalModel = routingResult.originalModel;
          event.routedModel = routingResult.model;
        }

        // Add compression metadata
        if (compressionResult.wasCompressed) {
          event.compressionApplied = true;
          event.originalTokens = compressionResult.originalTokens;
          event.compressedTokens = compressionResult.finalTokens;
          event.tokensSaved = compressionResult.originalTokens - compressionResult.finalTokens;
        }

        // Send to callback (BatchTransport in production)
        if (this.eventCallback) {
          this.eventCallback(event);
        }

        // ---- Phase 3: Store in cache (fire-and-forget) ----
        // The compressed prompt is what goes into cache (intentional)
        const responseText = response.choices?.[0]?.message?.content;
        if (responseText) {
          const cost = this.calculateCost(routingResult.model, {
            promptTokens: usage.prompt_tokens || 0,
            completionTokens: usage.completion_tokens || 0,
            totalTokens: usage.total_tokens || 0,
          });
          this.storeInCache(
            finalPromptText,
            responseText,
            routingResult.model,
            usage.total_tokens || 0,
            cost
          );
        }
      }

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;
      const statusCode = (error as any)?.status || (error as any)?.statusCode || 0;
      
      // ---- Phase 2: Automatic fallback ----
      // If routed model failed with 4xx/5xx → retry with original model
      if (routingResult.wasRouted && statusCode >= 400) {
        console.warn(
          `[Aethermind] Routed model ${routingResult.model} failed (${statusCode}), ` +
          `retrying with original model ${originalModel}`
        );

        try {
          // Restore original model
          params.model = originalModel;
          args[0] = params;

          const fallbackStartTime = Date.now();
          const fallbackResponse = await originalMethod.apply(this, args);
          const fallbackLatency = Date.now() - fallbackStartTime;

          const usage = fallbackResponse.usage;
          if (usage) {
            const responseContext: ResponseContext = {
              tokens: {
                promptTokens: usage.prompt_tokens || 0,
                completionTokens: usage.completion_tokens || 0,
                totalTokens: usage.total_tokens || 0,
              },
              latency: fallbackLatency,
              status: 'success',
            };

            const event = this.captureEvent(
              { ...request, model: originalModel },
              responseContext
            );
            event.originalModel = routingResult.originalModel;
            event.routedModel = routingResult.model;
            event.fallbackUsed = true;

            if (this.eventCallback) {
              this.eventCallback(event);
            }
          }

          return fallbackResponse;
        } catch (fallbackError) {
          // Fallback also failed — record and re-throw original error
          const fbLatency = Date.now() - startTime;
          const responseContext: ResponseContext = {
            tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            latency: fbLatency,
            status: 'error',
            error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          };

          const event = this.captureEvent(
            { ...request, model: originalModel },
            responseContext
          );
          event.originalModel = routingResult.originalModel;
          event.routedModel = routingResult.model;
          event.fallbackUsed = true;

          if (this.eventCallback) {
            this.eventCallback(event);
          }

          throw fallbackError;
        }
      }

      // Normal error path (no routing or non-retryable)
      const responseContext: ResponseContext = {
        tokens: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        latency,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };

      // Capture error event
      const event = this.captureEvent(request, responseContext);
      
      if (routingResult.wasRouted) {
        event.originalModel = routingResult.originalModel;
        event.routedModel = routingResult.model;
      }

      if (this.eventCallback) {
        this.eventCallback(event);
      }

      // Re-throw to maintain original behavior
      throw error;
    }
  }

  /**
   * Apply compressed prompt back to the messages array.
   * Replaces the content of user/system messages with the compressed version.
   */
  private applyCompressedPrompt(params: any, compressedPrompt: string): void {
    if (!params.messages || !Array.isArray(params.messages)) return;

    // For simplicity, replace the last user message content with compressed prompt
    // The compressed prompt is the full concatenation, but we apply it to the last user msg
    const userMessages = params.messages.filter((m: any) => m.role === 'user');
    if (userMessages.length > 0) {
      const lastUserMsg = userMessages[userMessages.length - 1];
      if (typeof lastUserMsg.content === 'string') {
        lastUserMsg.content = compressedPrompt;
      }
    }
  }

  /**
   * Extract prompt text from OpenAI chat params for classification
   */
  private extractPromptText(params: any): string {
    if (!params.messages || !Array.isArray(params.messages)) return '';
    return params.messages
      .filter((m: any) => m.role === 'user' || m.role === 'system')
      .map((m: any) => typeof m.content === 'string' ? m.content : '')
      .join(' ');
  }

  /**
   * Get OpenAI constructor (dynamically loaded)
   */
  private getOpenAIConstructor(): any {
    try {
      // Try to require OpenAI from the user's node_modules
      // In Node.js environment
      if (typeof require !== 'undefined') {
        return require('openai').default || require('openai');
      }
      
      // In ES modules or browser, would need different approach
      // For now, return null if not in CommonJS environment
      return null;
    } catch {
      return null;
    }
  }
}
