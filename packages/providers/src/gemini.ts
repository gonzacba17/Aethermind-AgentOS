import { ensureInit } from './_init.js';
import { _require } from './_require.js';

let _client: any = null;

function getClient(): any {
  if (_client) return _client;

  ensureInit();

  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set. Add it to your environment variables.');
  }

  let GoogleGenerativeAI: any;
  try {
    const mod = _require('@google/generative-ai');
    GoogleGenerativeAI = mod.GoogleGenerativeAI || mod.default;
  } catch {
    throw new Error('@google/generative-ai not installed. Run: npm install @google/generative-ai');
  }

  _client = new GoogleGenerativeAI(apiKey);
  return _client;
}

/**
 * Pre-configured Google Generative AI client with automatic Aethermind telemetry.
 *
 * Reads `GEMINI_API_KEY` and `AETHERMIND_API_KEY` from environment.
 *
 * @example
 * ```ts
 * import { gemini } from '@aethermind/providers';
 *
 * const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
 * const result = await model.generateContent('Hello');
 * console.log(result.response.text());
 * ```
 */
export const gemini: any = new Proxy({} as any, {
  get(_, prop) {
    return getClient()[prop];
  },
});
