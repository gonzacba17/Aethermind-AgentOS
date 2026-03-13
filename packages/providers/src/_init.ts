import { initAethermind } from '@aethermind/agent';

let _done = false;

/**
 * Ensure Aethermind telemetry is initialized exactly once.
 * Reads AETHERMIND_API_KEY and optional AETHERMIND_ENDPOINT from env.
 * If the key is missing, telemetry is silently disabled.
 */
export function ensureInit(): void {
  if (_done) return;
  _done = true;

  const apiKey = process.env['AETHERMIND_API_KEY'];
  if (!apiKey) {
    console.warn('[Aethermind Providers] AETHERMIND_API_KEY not set — telemetry disabled');
    return;
  }

  const opts: Parameters<typeof initAethermind>[0] = { apiKey };
  const endpoint = process.env['AETHERMIND_ENDPOINT'];
  if (endpoint) {
    opts.endpoint = endpoint;
  }

  initAethermind(opts);
}
