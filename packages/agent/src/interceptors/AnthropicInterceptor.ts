import { BaseInterceptor, type RequestContext, type ResponseContext } from './BaseInterceptor.js';
import { getConfig } from '../config/index.js';
import type { TelemetryEvent } from '../transport/types.js';

// Store reference to original Anthropic methods
let originalMessagesCreate: any = null;

/**
 * Anthropic SDK Interceptor
 * 
 * Monkey-patches the Anthropic SDK to automatically capture telemetry
 * 
 * @example
 * ```typescript
 * const interceptor = new AnthropicInterceptor();
 * interceptor.instrument();
 * 
 * // Now all Anthropic calls are automatically tracked
 * const anthropic = new Anthropic({ apiKey: '...' });
 * await anthropic.messages.create({ ... });
 * ```
 */
export class AnthropicInterceptor extends BaseInterceptor {
  private eventCallback?: (event: TelemetryEvent) => void;

  constructor(eventCallback?: (event: TelemetryEvent) => void) {
    super();
    this.eventCallback = eventCallback;
  }

  /**
   * Instrument Anthropic SDK.
   * @param sdkModule - Pre-loaded @anthropic-ai/sdk module (from dynamic import). Falls back to require().
   */
  instrument(sdkModule?: any): void {
    if (this.isInstrumented) return;

    try {
      const Anthropic = sdkModule
        ? (sdkModule.default || sdkModule.Anthropic || sdkModule)
        : this.getAnthropicConstructor();

      if (!Anthropic) return;

      // Store original method
      originalMessagesCreate = Anthropic.prototype.messages?.create;
      if (!originalMessagesCreate) return;

      // Monkey-patch the create method
      const self = this;
      Anthropic.prototype.messages.create = function (this: any, ...args: any[]) {
        return self.interceptCreate.call(this, originalMessagesCreate, args);
      };

      this.isInstrumented = true;
      console.log('[Aethermind] Anthropic instrumented');
    } catch (error) {
      console.error('[Aethermind] Failed to instrument Anthropic:', error);
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
      const Anthropic = this.getAnthropicConstructor();
      
      if (Anthropic && originalMessagesCreate) {
        Anthropic.prototype.messages.create = originalMessagesCreate;
      }

      this.isInstrumented = false;
      console.log('[Aethermind] Anthropic SDK uninstrumented');
    } catch (error) {
      console.error('[Aethermind] Failed to uninstrument Anthropic:', error);
    }
  }

  /**
   * Intercept messages.create call
   */
  private async interceptCreate(originalMethod: any, args: any[]): Promise<any> {
    const config = getConfig();

    if (!config.enabled) {
      return originalMethod.apply(this, args);
    }

    const params = args[0] || {};
    const originalModel = params.model || 'claude-3-5-sonnet-20241022';

    // ---- Phase 3: Cache check (before all other hooks) ----
    const promptText = this.extractPromptText(params);
    const cacheResult = await this.checkCache(promptText, originalModel);

    if (cacheResult) {
      // Construct synthetic Anthropic Message response
      const syntheticResponse = {
        id: `msg_cache_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: cacheResult.response,
        }],
        model: cacheResult.model,
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 0,
          output_tokens: 0,
        },
      };

      // Emit telemetry event with cache hit
      if (this.eventCallback) {
        this.eventCallback({
          timestamp: new Date().toISOString(),
          provider: 'anthropic',
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
      // Apply compressed prompt back to params
      this.applyCompressedPrompt(params, compressionResult.prompt);
      args[0] = params;
    }

    // Budget enforcement — check before executing LLM call
    await this.checkBudget();

    const startTime = Date.now();

    // ---- Phase 2: Model Routing ----
    const routingResult = await this.resolveModelWithRouter(originalModel, finalPromptText);

    if (routingResult.wasRouted) {
      params.model = routingResult.model;
      args[0] = params;
    }

    const request: RequestContext = {
      model: routingResult.model,
      timestamp: new Date().toISOString(),
      provider: 'anthropic',
    };

    try {
      const response = await originalMethod.apply(this, args);

      const latency = Date.now() - startTime;
      const usage = response.usage;

      if (usage) {
        const responseContext: ResponseContext = {
          tokens: {
            promptTokens: usage.input_tokens || 0,
            completionTokens: usage.output_tokens || 0,
            totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
          },
          latency,
          status: 'success',
        };

        const event = this.captureEvent(request, responseContext);

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

        if (this.eventCallback) {
          this.eventCallback(event);
        }

        // ---- Phase 3: Store in cache (fire-and-forget) ----
        // The compressed prompt is what goes into cache (intentional)
        const responseText = response.content?.[0]?.type === 'text'
          ? response.content[0].text
          : null;
        if (responseText) {
          const totalTokens = (usage.input_tokens || 0) + (usage.output_tokens || 0);
          const cost = this.calculateCost(routingResult.model, {
            promptTokens: usage.input_tokens || 0,
            completionTokens: usage.output_tokens || 0,
            totalTokens,
          });
          this.storeInCache(
            finalPromptText,
            responseText,
            routingResult.model,
            totalTokens,
            cost
          );
        }
      }

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;
      const statusCode = (error as any)?.status || (error as any)?.statusCode || 0;

      // ---- Phase 2: Automatic fallback ----
      if (routingResult.wasRouted && statusCode >= 400) {
        console.warn(
          `[Aethermind] Routed model ${routingResult.model} failed (${statusCode}), ` +
          `retrying with original model ${originalModel}`
        );

        try {
          params.model = originalModel;
          args[0] = params;

          const fbStart = Date.now();
          const fbResponse = await originalMethod.apply(this, args);
          const fbLatency = Date.now() - fbStart;

          const usage = fbResponse.usage;
          if (usage) {
            const responseContext: ResponseContext = {
              tokens: {
                promptTokens: usage.input_tokens || 0,
                completionTokens: usage.output_tokens || 0,
                totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
              },
              latency: fbLatency,
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

          return fbResponse;
        } catch (fbError) {
          const fbLatency = Date.now() - startTime;
          const responseContext: ResponseContext = {
            tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            latency: fbLatency,
            status: 'error',
            error: fbError instanceof Error ? fbError.message : String(fbError),
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

          throw fbError;
        }
      }
      
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

      const event = this.captureEvent(request, responseContext);
      
      if (routingResult.wasRouted) {
        event.originalModel = routingResult.originalModel;
        event.routedModel = routingResult.model;
      }

      if (this.eventCallback) {
        this.eventCallback(event);
      }

      throw error;
    }
  }

  /**
   * Apply compressed prompt back to the Anthropic params.
   * Replaces the last user message content with the compressed version.
   */
  private applyCompressedPrompt(params: any, compressedPrompt: string): void {
    if (!params.messages || !Array.isArray(params.messages)) return;

    const userMessages = params.messages.filter((m: any) => m.role === 'user');
    if (userMessages.length > 0) {
      const lastUserMsg = userMessages[userMessages.length - 1];
      if (typeof lastUserMsg.content === 'string') {
        lastUserMsg.content = compressedPrompt;
      } else if (Array.isArray(lastUserMsg.content)) {
        // Anthropic supports content blocks — replace text blocks
        for (const block of lastUserMsg.content) {
          if (block.type === 'text') {
            block.text = compressedPrompt;
            break;
          }
        }
      }
    }
  }

  /**
   * Extract prompt text from Anthropic params for classification
   */
  private extractPromptText(params: any): string {
    const parts: string[] = [];
    if (params.system) {
      parts.push(typeof params.system === 'string' ? params.system : '');
    }
    if (params.messages && Array.isArray(params.messages)) {
      for (const msg of params.messages) {
        if (msg.role === 'user') {
          if (typeof msg.content === 'string') parts.push(msg.content);
          else if (Array.isArray(msg.content)) {
            for (const block of msg.content) {
              if (block.type === 'text') parts.push(block.text || '');
            }
          }
        }
      }
    }
    return parts.join(' ');
  }

  /**
   * Get Anthropic constructor (dynamically loaded)
   */
  private getAnthropicConstructor(): any {
    try {
      if (typeof require !== 'undefined') {
        const anthropicModule = require('@anthropic-ai/sdk');
        return anthropicModule.default || anthropicModule.Anthropic || anthropicModule;
      }
      return null;
    } catch {
      return null;
    }
  }
}
