import { ensureInit } from './_init.js';
import { _require } from './_require.js';
import { getTransport } from '@aethermind/agent';

let _ollamaModule: any = null;

function getOllamaDefault(): any {
  if (_ollamaModule) return _ollamaModule;

  ensureInit();

  try {
    const mod = _require('ollama');
    _ollamaModule = mod.default || mod;
  } catch {
    throw new Error('ollama not installed. Run: npm install ollama');
  }

  return _ollamaModule;
}

/**
 * Send a telemetry event via the shared BatchTransport.
 * Fails silently — telemetry must never break the user's app.
 */
function sendTelemetry(event: any): void {
  try {
    const transport = getTransport();
    transport.send(event);
  } catch {
    // telemetry not available — silently ignore
  }
}

/**
 * Wrap an async Ollama method to capture telemetry.
 */
function wrapMethod(methodName: string, original: (...args: any[]) => Promise<any>) {
  return async function (this: any, ...args: any[]) {
    const model = args[0]?.model || 'unknown';
    const startTime = Date.now();

    try {
      const result = await original.apply(this, args);
      const latency = Date.now() - startTime;

      const promptTokens = result.prompt_eval_count ?? 0;
      const completionTokens = result.eval_count ?? 0;

      sendTelemetry({
        provider: 'ollama',
        model,
        timestamp: new Date(startTime).toISOString(),
        tokens: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
        cost: 0,
        latency,
        status: 'success',
      });

      return result;
    } catch (error) {
      const latency = Date.now() - startTime;

      sendTelemetry({
        provider: 'ollama',
        model,
        timestamp: new Date(startTime).toISOString(),
        tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        cost: 0,
        latency,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  };
}

const WRAPPED_METHODS = new Set(['chat', 'generate']);

/**
 * Pre-configured Ollama client with automatic Aethermind telemetry.
 *
 * Wraps `ollama.chat()` and `ollama.generate()` to capture telemetry.
 * No API key needed — Ollama runs locally. Cost is always 0.
 *
 * Reads `AETHERMIND_API_KEY` from environment for telemetry.
 *
 * @example
 * ```ts
 * import { ollama } from '@aethermind/providers';
 *
 * const response = await ollama.chat({
 *   model: 'llama3',
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * ```
 */
export const ollama: any = new Proxy({} as any, {
  get(_, prop) {
    const target = getOllamaDefault();
    const value = target[prop];

    if (typeof prop === 'string' && WRAPPED_METHODS.has(prop) && typeof value === 'function') {
      return wrapMethod(prop, value.bind(target));
    }

    if (typeof value === 'function') {
      return value.bind(target);
    }

    return value;
  },
  set(_, prop, value) {
    const target = getOllamaDefault();
    target[prop] = value;
    return true;
  },
});
