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
   * Instrument Anthropic SDK
   */
  instrument(): void {
    if (this.isInstrumented) {
      console.warn('[Aethermind] Anthropic already instrumented');
      return;
    }

    try {
      const Anthropic = this.getAnthropicConstructor();
      
      if (!Anthropic) {
        console.warn('[Aethermind] Anthropic SDK not found, skipping instrumentation');
        return;
      }

      // Store original method
      originalMessagesCreate = Anthropic.prototype.messages?.create;

      if (!originalMessagesCreate) {
        console.warn('[Aethermind] Anthropic messages.create not found');
        return;
      }

      // Monkey-patch the create method
      const self = this;
      Anthropic.prototype.messages.create = function (this: any, ...args: any[]) {
        return self.interceptCreate.call(this, originalMessagesCreate, args);
      };

      this.isInstrumented = true;
      console.log('[Aethermind] Anthropic SDK instrumented successfully');
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

    const startTime = Date.now();
    const params = args[0] || {};
    
    const request: RequestContext = {
      model: params.model || 'claude-3-5-sonnet-20241022',
      timestamp: new Date().toISOString(),
      provider: 'anthropic',
    };

    try {
      // Call original method
      const response = await originalMethod.apply(this, args);
      
      const latency = Date.now() - startTime;

      // Extract usage from response
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
        
        if (this.eventCallback) {
          this.eventCallback(event);
        }
      }

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;
      
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
      
      if (this.eventCallback) {
        this.eventCallback(event);
      }

      throw error;
    }
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
