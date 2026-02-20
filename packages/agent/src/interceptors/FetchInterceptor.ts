import { BaseInterceptor, type RequestContext, type ResponseContext } from './BaseInterceptor.js';
import { getConfig, isInitialized } from '../config/index.js';
import type { TelemetryEvent } from '../transport/types.js';

/**
 * Supported LLM API hostnames for fetch interception
 */
const LLM_HOSTS: Record<string, 'openai' | 'anthropic'> = {
  'api.openai.com': 'openai',
  'api.anthropic.com': 'anthropic',
};

/**
 * Fetch Interceptor
 *
 * Intercepts globalThis.fetch calls to OpenAI and Anthropic API endpoints,
 * extracting telemetry (model, tokens, cost, latency) without requiring
 * the user to install or use provider SDKs.
 *
 * Works alongside OpenAIInterceptor and AnthropicInterceptor — the SDK
 * interceptors cover SDK-specific features (streaming, etc.) while this
 * interceptor covers raw fetch() usage.
 *
 * @example
 * ```typescript
 * const interceptor = new FetchInterceptor((event) => {
 *   transport.send(event);
 * });
 * interceptor.instrument();
 *
 * // Now all fetch() calls to OpenAI/Anthropic are tracked
 * await fetch('https://api.openai.com/v1/chat/completions', { ... });
 * ```
 */
export class FetchInterceptor extends BaseInterceptor {
  private eventCallback?: (event: TelemetryEvent) => void;
  private originalFetch?: typeof globalThis.fetch;

  constructor(eventCallback?: (event: TelemetryEvent) => void) {
    super();
    this.eventCallback = eventCallback;
  }

  /**
   * Instrument globalThis.fetch
   */
  instrument(): void {
    if (this.isInstrumented) {
      console.warn('[Aethermind] Fetch already instrumented');
      return;
    }

    if (typeof globalThis.fetch !== 'function') {
      console.warn('[Aethermind] globalThis.fetch not available, skipping fetch instrumentation');
      return;
    }

    this.originalFetch = globalThis.fetch;

    const self = this;
    globalThis.fetch = function instrumentedFetch(
      input: any,
      init?: any,
    ): Promise<Response> {
      return self.interceptFetch(input, init);
    };

    this.isInstrumented = true;
  }

  /**
   * Remove instrumentation and restore original fetch
   */
  uninstrument(): void {
    if (!this.isInstrumented) {
      return;
    }

    if (this.originalFetch) {
      globalThis.fetch = this.originalFetch;
      this.originalFetch = undefined;
    }

    this.isInstrumented = false;
  }

  /**
   * Intercept a fetch call — pass through non-LLM URLs, capture telemetry for LLM URLs
   */
  private async interceptFetch(
    input: any,
    init?: any,
  ): Promise<Response> {
    const url = this.extractUrl(input);
    const provider = url ? this.matchProvider(url) : null;

    // Non-LLM URL or config disabled — pass through untouched
    if (!provider || !this.shouldIntercept()) {
      return this.originalFetch!(input, init);
    }

    const startTime = Date.now();
    const model = this.extractModelFromRequest(init);

    const request: RequestContext = {
      model: model || (provider === 'openai' ? 'gpt-3.5-turbo' : 'claude-3-5-sonnet-20241022'),
      timestamp: new Date().toISOString(),
      provider,
    };

    try {
      const response = await this.originalFetch!(input, init);
      const latency = Date.now() - startTime;

      // Clone response so we can read the body without consuming it
      try {
        const cloned = response.clone();
        const body = await cloned.json();
        const tokens = this.extractTokens(provider, body);

        if (tokens) {
          const responseContext: ResponseContext = {
            tokens,
            latency,
            status: 'success',
          };

          const event = this.captureEvent(request, responseContext);
          if (this.eventCallback) {
            this.eventCallback(event);
          }
        }
      } catch {
        // Response parsing failed — not JSON or no usage field.
        // Silently skip telemetry; never break the caller.
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

      // Re-throw to maintain original behavior
      throw error;
    }
  }

  /**
   * Extract URL string from fetch input (string, URL, or Request)
   */
  private extractUrl(input: any): string | null {
    try {
      if (typeof input === 'string') {
        return input;
      }
      if (input instanceof URL) {
        return input.href;
      }
      if (input && typeof (input as Request).url === 'string') {
        return (input as Request).url;
      }
    } catch {
      // Silently fail
    }
    return null;
  }

  /**
   * Check if a URL matches a known LLM API host
   */
  private matchProvider(url: string): 'openai' | 'anthropic' | null {
    try {
      const parsed = new URL(url);
      return LLM_HOSTS[parsed.hostname] || null;
    } catch {
      // Invalid URL — not an LLM endpoint
      return null;
    }
  }

  /**
   * Check if interception should proceed (SDK initialized and enabled)
   */
  private shouldIntercept(): boolean {
    try {
      if (!isInitialized()) return false;
      const config = getConfig();
      return config.enabled;
    } catch {
      return false;
    }
  }

  /**
   * Extract model name from request body JSON
   */
  private extractModelFromRequest(init?: any): string | null {
    try {
      if (!init?.body) return null;
      const bodyStr = typeof init.body === 'string' ? init.body : null;
      if (!bodyStr) return null;
      const parsed = JSON.parse(bodyStr);
      return typeof parsed.model === 'string' ? parsed.model : null;
    } catch {
      return null;
    }
  }

  /**
   * Extract token usage from response body based on provider format
   */
  private extractTokens(
    provider: 'openai' | 'anthropic',
    body: any,
  ): { promptTokens: number; completionTokens: number; totalTokens: number } | null {
    try {
      const usage = body?.usage;
      if (!usage) return null;

      if (provider === 'openai') {
        return {
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0,
        };
      }

      // Anthropic
      const input = usage.input_tokens || 0;
      const output = usage.output_tokens || 0;
      return {
        promptTokens: input,
        completionTokens: output,
        totalTokens: input + output,
      };
    } catch {
      return null;
    }
  }
}
