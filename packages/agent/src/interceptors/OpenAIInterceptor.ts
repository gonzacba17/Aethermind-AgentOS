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
   * Instrument OpenAI SDK
   */
  instrument(): void {
    if (this.isInstrumented) {
      console.warn('[Aethermind] OpenAI already instrumented');
      return;
    }

    try {
      // Dynamically import OpenAI SDK if available
      const OpenAI = this.getOpenAIConstructor();
      
      if (!OpenAI) {
        console.warn('[Aethermind] OpenAI SDK not found, skipping instrumentation');
        return;
      }

      // Store original method
      originalCreate = OpenAI.prototype.chat?.completions?.create;

      if (!originalCreate) {
        console.warn('[Aethermind] OpenAI chat.completions.create not found');
        return;
      }

      // Monkey-patch the create method
      const self = this;
      OpenAI.prototype.chat.completions.create = function (this: any, ...args: any[]) {
        return self.interceptCreate.call(this, originalCreate, args);
      };

      this.isInstrumented = true;
      console.log('[Aethermind] OpenAI SDK instrumented successfully');
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

    const startTime = Date.now();
    const params = args[0] || {};
    
    const request: RequestContext = {
      model: params.model || 'gpt-3.5-turbo',
      timestamp: new Date().toISOString(),
      provider: 'openai',
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
            promptTokens: usage.prompt_tokens || 0,
            completionTokens: usage.completion_tokens || 0,
            totalTokens: usage.total_tokens || 0,
          },
          latency,
          status: 'success',
        };

        // Capture event
        const event = this.captureEvent(request, responseContext);
        
        // Send to callback (BatchTransport in production)
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

      // Capture error event
      const event = this.captureEvent(request, responseContext);
      
      if (this.eventCallback) {
        this.eventCallback(event);
      }

      // Re-throw to maintain original behavior
      throw error;
    }
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
