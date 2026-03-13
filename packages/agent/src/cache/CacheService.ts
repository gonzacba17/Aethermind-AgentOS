// DEPRECATED v0.2.0 — Client-side caching removed. Caching is now server-side only (gateway).
import { getConfig, isInitialized } from '../config/index.js';

/**
 * Cache hit returned by the API.
 */
export interface CacheHit {
  response: string;
  cachedAt: string;
  model: string;
  tokensUsed: number;
  costUsd: number;
  similarity: number;
}

const FETCH_TIMEOUT_MS = 2_000; // 2 seconds

/**
 * CacheService — checks the Aethermind API for cached responses.
 *
 * Design principles:
 * - Fail-open: on any error, returns null (allows LLM call to proceed).
 * - No local caching (each lookup needs a fresh check).
 * - Store is fire-and-forget (caller doesn't wait).
 */
class CacheServiceImpl {
  /**
   * Look up a cached response for the given prompt and model.
   * Returns CacheHit on match, null on miss or error.
   */
  async lookup(prompt: string, model: string): Promise<CacheHit | null> {
    if (!isInitialized()) return null;

    try {
      const config = getConfig();
      const url = `${config.endpoint}/v1/cache/lookup`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'X-API-Key': config.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt, model }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          return null;
        }

        const data = await response.json() as any;

        if (data.hit) {
          return {
            response: data.response,
            cachedAt: data.cachedAt,
            model: data.model,
            tokensUsed: data.tokensUsed,
            costUsd: data.costUsd,
            similarity: data.similarity ?? 1.0,
          };
        }

        return null;
      } catch (fetchError) {
        clearTimeout(timeout);
        throw fetchError;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('[Aethermind] Cache lookup timed out (2s), proceeding without cache');
      }
      return null;
    }
  }

  /**
   * Store a prompt/response pair in the cache.
   * Fire-and-forget: returns immediately, doesn't block.
   */
  store(
    prompt: string,
    response: string,
    model: string,
    tokensUsed: number,
    costUsd: number
  ): void {
    if (!isInitialized()) return;

    try {
      const config = getConfig();
      const url = `${config.endpoint}/v1/cache/store`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      fetch(url, {
        method: 'POST',
        headers: {
          'X-API-Key': config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, response, model, tokensUsed, costUsd }),
        signal: controller.signal,
      })
        .then(() => clearTimeout(timeout))
        .catch(() => clearTimeout(timeout));
    } catch {
      // Silently ignore — fire-and-forget
    }
  }
}

// Singleton
export const cacheService = new CacheServiceImpl();
