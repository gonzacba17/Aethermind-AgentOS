import { BaseInterceptor, type RequestContext, type ResponseContext } from './BaseInterceptor.js';
import { isInitialized, getConfig } from '../config/index.js';
import type { TelemetryEvent } from '../transport/types.js';
import { retryWithBackoff } from '../utils/retry.js';

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
 * Can be used in TWO modes:
 *
 * 1. **Standalone** (recommended for new users):
 *    Pass `apiKey` (and optionally `endpoint`) in the constructor config.
 *    No need to call `initAethermind()` first.
 *
 * 2. **Global SDK mode** (existing flow):
 *    Call `initAethermind()` first, then create OllamaInterceptor
 *    with an event callback.
 *
 * @example Standalone usage (works in CJS and ESM)
 * ```js
 * const { OllamaInterceptor } = require("@aethermind/agent");
 *
 * const ollama = new OllamaInterceptor({
 *   apiKey: "sk_your_key",
 *   host: "http://localhost:11434",
 * });
 *
 * const result = await ollama.chatCompletion({
 *   model: "llama3",
 *   messages: [{ role: "user", content: "Hello!" }],
 * });
 * console.log(result.message.content);
 * ```
 *
 * @example Global SDK usage (existing flow)
 * ```ts
 * import { initAethermind, OllamaInterceptor, getTransport } from "@aethermind/agent";
 *
 * initAethermind({ apiKey: "sk_..." });
 * const transport = getTransport();
 * const ollama = new OllamaInterceptor(
 *   (event) => transport.send(event),
 *   { host: "http://localhost:11434" }
 * );
 * ```
 */

export interface OllamaConfig {
  /** Ollama host URL (default: http://localhost:11434) */
  host?: string;
  /** Request timeout in ms (default: 120000) */
  timeoutMs?: number;
  /** API key for standalone telemetry — if set, OllamaInterceptor sends telemetry directly */
  apiKey?: string;
  /** Aethermind API endpoint for standalone mode (default: https://aethermind-agentos-production.up.railway.app) */
  endpoint?: string;
  /** Agent ID for telemetry attribution (optional) */
  agentId?: string;
  /** Session ID for telemetry attribution (optional) */
  sessionId?: string;
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
  private standaloneApiKey?: string;
  private standaloneEndpoint: string;
  private agentId?: string;
  private sessionId?: string;
  /** Buffer for standalone mode */
  private standaloneBuffer: TelemetryEvent[] = [];
  private standaloneFlushTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Create an Ollama interceptor.
   *
   * Overloaded constructors:
   * - `new OllamaInterceptor(config)` — standalone mode (pass apiKey in config)
   * - `new OllamaInterceptor(callback, config?)` — global SDK mode (existing flow)
   */
  constructor(configOrCallback?: OllamaConfig | ((event: TelemetryEvent) => void), config?: OllamaConfig) {
    super();

    let resolvedConfig: OllamaConfig | undefined;

    if (typeof configOrCallback === 'function') {
      // Legacy mode: new OllamaInterceptor(callback, config?)
      this.eventCallback = configOrCallback;
      resolvedConfig = config;
    } else if (configOrCallback && typeof configOrCallback === 'object') {
      // Standalone mode: new OllamaInterceptor({ apiKey, host, ... })
      resolvedConfig = configOrCallback;
    }

    this.host = resolvedConfig?.host || process.env['OLLAMA_HOST'] || 'http://localhost:11434';
    this.timeoutMs = resolvedConfig?.timeoutMs || 120_000;
    this.agentId = resolvedConfig?.agentId;
    this.sessionId = resolvedConfig?.sessionId;

    // Standalone mode: if apiKey is in config, use self-contained transport
    if (resolvedConfig?.apiKey) {
      this.standaloneApiKey = resolvedConfig.apiKey;
      this.standaloneEndpoint = resolvedConfig.endpoint
        || process.env['AETHERMIND_ENDPOINT']
        || 'https://aethermind-agentos-production.up.railway.app';

      // Set up auto-flush every 5 seconds
      this.standaloneFlushTimer = setInterval(() => {
        void this.flushStandaloneBuffer();
      }, 5000);

      // Don't block Node from exiting
      if (this.standaloneFlushTimer && typeof this.standaloneFlushTimer === 'object' && 'unref' in this.standaloneFlushTimer) {
        this.standaloneFlushTimer.unref();
      }
    } else {
      this.standaloneEndpoint = '';
    }
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
   * Flush any pending standalone events and clean up timers.
   * Call this before your process exits to ensure all telemetry is sent.
   */
  async destroy(): Promise<void> {
    if (this.standaloneFlushTimer) {
      clearInterval(this.standaloneFlushTimer);
      this.standaloneFlushTimer = null;
    }
    await this.flushStandaloneBuffer();
  }

  /**
   * POST /api/chat — Ollama native chat API
   */
  async chatCompletion(request: OllamaChatRequest): Promise<OllamaChatResponse> {
    if (!this.isTelemetryEnabled()) {
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
      if (this.agentId) event.agentId = this.agentId;
      if (this.sessionId) event.sessionId = this.sessionId;

      this.sendEvent(event);
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
    if (!this.isTelemetryEnabled()) {
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
      if (this.agentId) event.agentId = this.agentId;
      if (this.sessionId) event.sessionId = this.sessionId;

      this.sendEvent(event);
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
    const body = {
      model: request.model,
      messages: request.messages,
      stream: false,
      ...request.options,
    };

    if (!this.isTelemetryEnabled()) {
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
      if (this.agentId) event.agentId = this.agentId;
      if (this.sessionId) event.sessionId = this.sessionId;

      this.sendEvent(event);
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

  /**
   * Check if telemetry is enabled.
   * In standalone mode: always enabled (user passed apiKey).
   * In global mode: check getConfig().enabled.
   * If neither mode is configured: telemetry is disabled.
   */
  private isTelemetryEnabled(): boolean {
    // Standalone mode — always enabled
    if (this.standaloneApiKey) return true;

    // Callback mode with global SDK
    if (this.eventCallback) {
      if (isInitialized()) {
        try {
          const config = getConfig();
          return config.enabled;
        } catch {
          return true; // callback was set, assume enabled
        }
      }
      return true; // callback was set but SDK not initialized — still send events
    }

    // No apiKey, no callback — telemetry disabled (just proxy to Ollama)
    return false;
  }

  /**
   * Route event to the appropriate destination.
   * - Standalone mode: buffer → flush to API directly
   * - Callback mode: call the user-provided callback
   */
  private sendEvent(event: TelemetryEvent): void {
    if (this.standaloneApiKey) {
      this.standaloneBuffer.push(event);
      // Flush immediately if buffer has 50+ events
      if (this.standaloneBuffer.length >= 50) {
        void this.flushStandaloneBuffer();
      }
      return;
    }

    if (this.eventCallback) {
      this.eventCallback(event);
    }
  }

  /**
   * Flush standalone buffer to the Aethermind ingestion API.
   */
  private async flushStandaloneBuffer(): Promise<void> {
    if (this.standaloneBuffer.length === 0 || !this.standaloneApiKey) return;

    const events = this.standaloneBuffer;
    this.standaloneBuffer = [];

    const sendFn = async () => {
      const resp = await fetch(`${this.standaloneEndpoint}/v1/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.standaloneApiKey!,
        },
        body: JSON.stringify({ events }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Ingestion API error: ${resp.status} - ${text}`);
      }
    };

    try {
      await retryWithBackoff(sendFn, {
        maxRetries: 2,
        initialDelayMs: 500,
        maxDelayMs: 3000,
        backoffMultiplier: 2,
      });
    } catch (err) {
      console.error('[Aethermind] Failed to send telemetry:', (err as Error).message);
      // Don't re-throw — telemetry failures should not break the user's app
    }
  }

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
    if (this.agentId) event.agentId = this.agentId;
    if (this.sessionId) event.sessionId = this.sessionId;

    this.sendEvent(event);
  }
}
