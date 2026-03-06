import { ensureInit } from './_init.js';
import { _require } from './_require.js';

let _client: any = null;

function getClient(): any {
  if (_client) return _client;

  ensureInit();

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set. Add it to your environment variables.');
  }

  let Anthropic: any;
  try {
    const mod = _require('@anthropic-ai/sdk');
    Anthropic = mod.default || mod.Anthropic || mod;
  } catch {
    throw new Error('@anthropic-ai/sdk not installed. Run: npm install @anthropic-ai/sdk');
  }

  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * Pre-configured Anthropic client with automatic Aethermind telemetry.
 *
 * Reads `ANTHROPIC_API_KEY` and `AETHERMIND_API_KEY` from environment.
 *
 * @example
 * ```ts
 * import { anthropic } from '@aethermind/providers';
 *
 * const res = await anthropic.messages.create({
 *   model: 'claude-sonnet-4-20250514',
 *   max_tokens: 1024,
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * ```
 */
export const anthropic: any = new Proxy({} as any, {
  get(_, prop) {
    return getClient()[prop];
  },
});
