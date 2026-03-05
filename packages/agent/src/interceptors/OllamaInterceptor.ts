import { BaseInterceptor, type RequestContext, type ResponseContext } from './BaseInterceptor.js';
import { getConfig } from '../config/index.js';
import type { TelemetryEvent } from '../transport/types.js';

/**
 * Ollama Interceptor
 *
 * Wraps calls to a local Ollama instance and captures telemetry.
 * Unlike OpenAI/Anthropic interceptors, this does NOT monkey-patch an SDK.
 * Instead it provides explicit methods you call directly:
 *
 *   - chatCompletion()  →  POST /api/chat  (Ollama native API)
 *   - generate()        →  POST /api/generate (Ollama native API)
 *   - openaiChat()      →  POST /v1/chat/completions (OpenAI-compatible API)
 *
 * All methods automatically send telemetry events through the SDK transport.
 *
 * @example
 * ```typescript
 * import { OllamaInterceptor } from '@aethermind/agent';
 *
 * const ollama = new OllamaInterceptor(sendEvent, {
 *   host: 'http://localhost:11434',
 * });
 *
 * const result = await ollama.chatCompletion({
 *   model: 'llama3',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * ```
 */

export interface OllamaConfig {
  /** Ollama host URL (default: http://localhost:11434) */
  host?: string;
  /** Request timeout in ms (default: 120000) */
  timeoutMs?: number;
}

export interface OllamaChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  options?: Record<string, any>;
}

export interface OllamaChatResponse {
  model: string;
  message: { role: string; content: string };
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: Record<string, any>;
}

export interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaInterceptor extends BaseInterceptor {
  private eventCallback?: (event: TelemetryEvent) => void;
  private host: string;
  private timeoutMs: number;

  constructor(eventCallback?: (event: TelemetryEvent) => void, config?: OllamaConfig) {
    super();
    this.eventCallback = eventCallback;
    this.host = config?.host || process.env['OLLAMA_HOST'] || 'http://localhost:11434';
    this.timeoutMs = config?.timeoutMs || 120_000;
  }

  /**
   * Not applicable for Ollama — this interceptor is explicit, not monkey-patching.
   */
  instrument(): void {
    this.isInstrumented = true;
    console.log(`[Aethermind] Ollama interceptor ready (host: ${this.host})`);
  }

  uninstrument(): void {
    this.isInstrumented = false;
  }

  /**
   * POST /api/chat — Ollama native chat API
   */
  async chatCompletion(request: OllamaChatRequest): Promise<OllamaChatResponse> {
    const config = getConfig();
    if (!config.enabled) {
      return this.rawPost<OllamaChatResponse>('/api/chat', { ...request, stream: false });
    }

    const startTime = Date.now();
    const reqCtx: RequestContext = {
      model: request.model,
      timestamp: new Date().toISOString(),
      provider: 'ollama',
    };

    try {
      const response = await this.rawPost<OllamaChatResponse>('/api/chat', {
        ...request,
        stream: false,
      });

      const latency = Date.now() - startTime;
      const promptTokens = response.prompt_eval_count ?? null;
      const completionTokens = response.eval_count ?? null;
      const totalTokens = (promptTokens != null && completionTokens != null)
        ? promptTokens + completionTokens
        : null;

      const respCtx: ResponseContext = {
        tokens: {
          promptTokens: promptTokens ?? 0,
          completionTokens: completionTokens ?? 0,
          totalTokens: totalTokens ?? 0,
        },
        latency,
        status: 'success',
      };

      const event = this.captureEvent(reqCtx, respCtx);
      // Ollama is local — cost is always 0
      event.cost = 0;

      if (this.eventCallback) {
        this.eventCallback(event);
      }

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.emitErrorEvent(reqCtx, latency, error);
      throw error;
    }
  }

  /**
   * POST /api/generate — Ollama native generate API
   */
  async generate(request: OllamaGenerateRequest): Promise<OllamaGenerateResponse> {
    const config = getConfig();
    if (!config.enabled) {
      return this.rawPost<OllamaGenerateResponse>('/api/generate', { ...request, stream: false });
    }

    const startTime = Date.now();
    const reqCtx: RequestContext = {
      model: request.model,
      timestamp: new Date().toISOString(),
      provider: 'ollama',
    };

    try {
      const response = await this.rawPost<OllamaGenerateResponse>('/api/generate', {
        ...request,
        stream: false,
      });

      const latency = Date.now() - startTime;
      const promptTokens = response.prompt_eval_count ?? null;
      const completionTokens = response.eval_count ?? null;
      const totalTokens = (promptTokens != null && completionTokens != null)
        ? promptTokens + completionTokens
        : null;

      const respCtx: ResponseContext = {
        tokens: {
          promptTokens: promptTokens ?? 0,
          completionTokens: completionTokens ?? 0,
          totalTokens: totalTokens ?? 0,
        },
        latency,
        status: 'success',
      };

      const event = this.captureEvent(reqCtx, respCtx);
      event.cost = 0;

      if (this.eventCallback) {
        this.eventCallback(event);
      }

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.emitErrorEvent(reqCtx, latency, error);
      throw error;
    }
  }

  /**
   * POST /v1/chat/completions — OpenAI-compatible API
   * Useful when Ollama runs behind an OpenAI-compatible proxy.
   */
  async openaiChat(request: OllamaChatRequest): Promise<any> {
    const config = getConfig();
    const body = {
      model: request.model,
      messages: request.messages,
      stream: false,
      ...request.options,
    };

    if (!config.enabled) {
      return this.rawPost('/v1/chat/completions', body);
    }

    const startTime = Date.now();
    const reqCtx: RequestContext = {
      model: request.model,
      timestamp: new Date().toISOString(),
      provider: 'ollama',
    };

    try {
      const response = await this.rawPost<any>('/v1/chat/completions', body);
      const latency = Date.now() - startTime;

      const usage = response.usage;
      const promptTokens = usage?.prompt_tokens ?? null;
      const completionTokens = usage?.completion_tokens ?? null;
      const totalTokens = usage?.total_tokens ?? (
        (promptTokens != null && completionTokens != null) ? promptTokens + completionTokens : null
      );

      const respCtx: ResponseContext = {
        tokens: {
          promptTokens: promptTokens ?? 0,
          completionTokens: completionTokens ?? 0,
          totalTokens: totalTokens ?? 0,
        },
        latency,
        status: 'success',
      };

      const event = this.captureEvent(reqCtx, respCtx);
      event.cost = 0;

      if (this.eventCallback) {
        this.eventCallback(event);
      }

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.emitErrorEvent(reqCtx, latency, error);
      throw error;
    }
  }

  /**
   * Check if Ollama is reachable
   */
  async ping(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(this.host, { signal: controller.signal });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }

  // ─── Private helpers ───────────────────────────────

  private async rawPost<T>(path: string, body: any): Promise<T> {
    const url = `${this.host}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      const msg = (error as Error).message || '';
      if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('abort')) {
        throw new Error(
          `Ollama not running at ${this.host}. ` +
          `Start it with: ollama serve`
        );
      }
      throw error;
    }

    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama API error ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  private emitErrorEvent(reqCtx: RequestContext, latency: number, error: unknown): void {
    const respCtx: ResponseContext = {
      tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      latency,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };

    const event = this.captureEvent(reqCtx, respCtx);
    event.cost = 0;

    if (this.eventCallback) {
      this.eventCallback(event);
    }
  }
}
