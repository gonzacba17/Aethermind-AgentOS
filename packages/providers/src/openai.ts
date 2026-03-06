import { ensureInit } from './_init.js';
import { _require } from './_require.js';

let _client: any = null;

function getClient(): any {
  if (_client) return _client;

  ensureInit();

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set. Add it to your environment variables.');
  }

  let OpenAI: any;
  try {
    const mod = _require('openai');
    OpenAI = mod.default || mod;
  } catch {
    throw new Error('openai not installed. Run: npm install openai');
  }

  _client = new OpenAI({ apiKey });
  return _client;
}

/**
 * Pre-configured OpenAI client with automatic Aethermind telemetry.
 *
 * Reads `OPENAI_API_KEY` and `AETHERMIND_API_KEY` from environment.
 *
 * @example
 * ```ts
 * import { openai } from '@aethermind/providers';
 *
 * const res = await openai.chat.completions.create({
 *   model: 'gpt-4o-mini',
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * ```
 */
export const openai: any = new Proxy({} as any, {
  get(_, prop) {
    return getClient()[prop];
  },
});
