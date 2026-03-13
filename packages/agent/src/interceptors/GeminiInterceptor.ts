import { BaseInterceptor, type RequestContext, type ResponseContext } from './BaseInterceptor.js';
import { getConfig } from '../config/index.js';
import type { TelemetryEvent } from '../transport/types.js';

// Store reference to original Gemini methods
let originalGenerateContent: any = null;

/**
 * Google Gemini SDK Interceptor
 *
 * Monkey-patches the Google Generative AI SDK to automatically capture telemetry.
 * Supports both `@google/generative-ai` and `@google/genai` package names.
 *
 * @example
 * ```typescript
 * const interceptor = new GeminiInterceptor();
 * interceptor.instrument();
 *
 * // Now all Gemini calls are automatically tracked
 * const genAI = new GoogleGenerativeAI('...');
 * const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
 * await model.generateContent('Hello');
 * ```
 */
export class GeminiInterceptor extends BaseInterceptor {
  private eventCallback?: (event: TelemetryEvent) => void;
  private generativeModelPrototype: any = null;

  constructor(eventCallback?: (event: TelemetryEvent) => void) {
    super();
    this.eventCallback = eventCallback;
  }

  /**
   * Instrument Gemini SDK.
   * @param sdkModule - Pre-loaded @google/generative-ai or @google/genai module. Falls back to require().
   */
  instrument(sdkModule?: any): void {
    if (this.isInstrumented) return;

    try {
      const GenerativeModel = sdkModule
        ? this.extractGenerativeModelPrototype(sdkModule)
        : this.getGenerativeModelPrototype();

      if (!GenerativeModel) return;

      // Store original method
      originalGenerateContent = GenerativeModel.generateContent;
      if (!originalGenerateContent) return;

      this.generativeModelPrototype = GenerativeModel;

      // Monkey-patch the generateContent method
      const self = this;
      GenerativeModel.generateContent = function (this: any, ...args: any[]) {
        return self.interceptGenerateContent(this, originalGenerateContent, args);
      };

      this.isInstrumented = true;
      console.log('[Aethermind] Gemini instrumented');
    } catch (error) {
      console.error('[Aethermind] Failed to instrument Gemini:', error);
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
      if (this.generativeModelPrototype && originalGenerateContent) {
        this.generativeModelPrototype.generateContent = originalGenerateContent;
      }

      this.isInstrumented = false;
      console.log('[Aethermind] Gemini SDK uninstrumented');
    } catch (error) {
      console.error('[Aethermind] Failed to uninstrument Gemini:', error);
    }
  }

  /**
   * Intercept generateContent call
   */
  private async interceptGenerateContent(
    modelInstance: any,
    originalMethod: any,
    args: any[]
  ): Promise<any> {
    const config = getConfig();

    if (!config.enabled) {
      return originalMethod.apply(modelInstance, args);
    }

    const originalModel = modelInstance.model || modelInstance.modelName || 'gemini-1.5-flash';
    // Strip "models/" prefix if present (Gemini SDK often uses "models/gemini-1.5-flash")
    const cleanModel = originalModel.replace(/^models\//, '');

    // ---- Phase 3: Cache check (before all other hooks) ----
    const promptText = this.extractPromptText(args);
    const cacheResult = await this.checkCache(promptText, cleanModel);

    if (cacheResult) {
      // Construct synthetic Gemini GenerateContentResponse
      const syntheticResponse = {
        response: {
          text: () => cacheResult.response,
          candidates: [{
            content: {
              parts: [{ text: cacheResult.response }],
              role: 'model',
            },
            finishReason: 'STOP',
          }],
          usageMetadata: {
            promptTokenCount: 0,
            candidatesTokenCount: 0,
            totalTokenCount: 0,
          },
        },
      };

      // Emit telemetry event with cache hit
      if (this.eventCallback) {
        this.eventCallback({
          timestamp: new Date().toISOString(),
          provider: 'gemini',
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
    const compressionResult = await this.compress(promptText, cleanModel);
    let finalPromptText = promptText;

    if (compressionResult.wasCompressed) {
      finalPromptText = compressionResult.prompt;
      // Apply compressed prompt back to args
      this.applyCompressedPrompt(args, compressionResult.prompt);
    }

    // Budget enforcement — check before executing LLM call
    await this.checkBudget();

    const startTime = Date.now();

    // ---- Phase 2: Model Routing ----
    const routingResult = await this.resolveModelWithRouter(cleanModel, finalPromptText);

    // Apply routed model if routing occurred
    if (routingResult.wasRouted) {
      // Gemini SDK stores model on the instance; we can't easily swap it for cross-provider routing
      // Only apply if the routed model is also a Gemini model
      if (routingResult.model.startsWith('gemini-')) {
        modelInstance.model = `models/${routingResult.model}`;
      }
    }

    const request: RequestContext = {
      model: routingResult.model,
      timestamp: new Date().toISOString(),
      provider: 'gemini',
    };

    try {
      const result = await originalMethod.apply(modelInstance, args);

      const latency = Date.now() - startTime;
      const response = result.response || result;
      const usage = response.usageMetadata;

      if (usage) {
        const promptTokens = usage.promptTokenCount || 0;
        const completionTokens = usage.candidatesTokenCount || 0;
        const totalTokens = usage.totalTokenCount || (promptTokens + completionTokens);

        const responseContext: ResponseContext = {
          tokens: {
            promptTokens,
            completionTokens,
            totalTokens,
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
        const responseText = this.extractResponseText(response);
        if (responseText) {
          const cost = this.calculateCost(routingResult.model, {
            promptTokens,
            completionTokens,
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

      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      const statusCode = (error as any)?.status || (error as any)?.statusCode || 0;

      // ---- Phase 2: Automatic fallback ----
      if (routingResult.wasRouted && statusCode >= 400) {
        console.warn(
          `[Aethermind] Routed model ${routingResult.model} failed (${statusCode}), ` +
          `retrying with original model ${cleanModel}`
        );

        try {
          // Restore original model
          modelInstance.model = `models/${cleanModel}`;

          const fbStart = Date.now();
          const fbResult = await originalMethod.apply(modelInstance, args);
          const fbLatency = Date.now() - fbStart;

          const fbResponse = fbResult.response || fbResult;
          const usage = fbResponse.usageMetadata;
          if (usage) {
            const promptTokens = usage.promptTokenCount || 0;
            const completionTokens = usage.candidatesTokenCount || 0;
            const totalTokens = usage.totalTokenCount || (promptTokens + completionTokens);

            const responseContext: ResponseContext = {
              tokens: { promptTokens, completionTokens, totalTokens },
              latency: fbLatency,
              status: 'success',
            };

            const event = this.captureEvent(
              { ...request, model: cleanModel },
              responseContext
            );
            event.originalModel = routingResult.originalModel;
            event.routedModel = routingResult.model;
            event.fallbackUsed = true;

            if (this.eventCallback) {
              this.eventCallback(event);
            }
          }

          return fbResult;
        } catch (fbError) {
          const fbLatency = Date.now() - startTime;
          const responseContext: ResponseContext = {
            tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            latency: fbLatency,
            status: 'error',
            error: fbError instanceof Error ? fbError.message : String(fbError),
          };

          const event = this.captureEvent(
            { ...request, model: cleanModel },
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
   * Extract prompt text from Gemini generateContent args
   */
  private extractPromptText(args: any[]): string {
    const input = args[0];
    if (!input) return '';

    // String input
    if (typeof input === 'string') return input;

    // Array of Parts
    if (Array.isArray(input)) {
      return input
        .filter((p: any) => typeof p === 'string' || p?.text)
        .map((p: any) => typeof p === 'string' ? p : p.text)
        .join(' ');
    }

    // GenerateContentRequest object
    if (input.contents) {
      const parts: string[] = [];
      const contents = Array.isArray(input.contents) ? input.contents : [input.contents];
      for (const content of contents) {
        if (content.parts) {
          for (const part of content.parts) {
            if (typeof part === 'string') parts.push(part);
            else if (part.text) parts.push(part.text);
          }
        }
      }
      return parts.join(' ');
    }

    return '';
  }

  /**
   * Extract response text from Gemini response
   */
  private extractResponseText(response: any): string | null {
    // Try response.text() method
    if (typeof response.text === 'function') {
      try {
        return response.text();
      } catch {
        // fall through
      }
    }

    // Try candidates
    if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.candidates[0].content.parts[0].text;
    }

    return null;
  }

  /**
   * Apply compressed prompt back to the Gemini args.
   */
  private applyCompressedPrompt(args: any[], compressedPrompt: string): void {
    const input = args[0];
    if (!input) return;

    // String input — replace directly
    if (typeof input === 'string') {
      args[0] = compressedPrompt;
      return;
    }

    // Array of Parts — replace first text part
    if (Array.isArray(input)) {
      for (let i = 0; i < input.length; i++) {
        if (typeof input[i] === 'string') {
          input[i] = compressedPrompt;
          return;
        }
        if (input[i]?.text) {
          input[i].text = compressedPrompt;
          return;
        }
      }
      return;
    }

    // GenerateContentRequest object
    if (input.contents) {
      const contents = Array.isArray(input.contents) ? input.contents : [input.contents];
      for (const content of contents) {
        if (content.parts) {
          for (const part of content.parts) {
            if (part.text) {
              part.text = compressedPrompt;
              return;
            }
          }
        }
      }
    }
  }

  /**
   * Extract GenerativeModel prototype from a pre-loaded module.
   */
  private extractGenerativeModelPrototype(sdkModule: any): any {
    const mod = sdkModule.default || sdkModule;
    const GM = mod.GenerativeModel;
    if (GM?.prototype?.generateContent) {
      return GM.prototype;
    }
    return null;
  }

  /**
   * Get GenerativeModel prototype (dynamically loaded via require).
   * Tries both @google/generative-ai and @google/genai package names.
   */
  private getGenerativeModelPrototype(): any {
    try {
      if (typeof require !== 'undefined') {
        // Try @google/generative-ai first (most common)
        try {
          const genaiModule = require('@google/generative-ai');
          const GenerativeModel = genaiModule.GenerativeModel;
          if (GenerativeModel?.prototype?.generateContent) {
            return GenerativeModel.prototype;
          }
        } catch {
          // Not found, try next
        }

        // Try @google/genai (newer package name)
        try {
          const genaiModule = require('@google/genai');
          const GenerativeModel = genaiModule.GenerativeModel;
          if (GenerativeModel?.prototype?.generateContent) {
            return GenerativeModel.prototype;
          }
        } catch {
          // Not found either
        }
      }

      return null;
    } catch {
      return null;
    }
  }
}
