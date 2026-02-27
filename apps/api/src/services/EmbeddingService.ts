import { createHash } from 'crypto';

/**
 * EmbeddingService — generates embeddings via OpenAI text-embedding-3-small.
 *
 * - LRU cache: max 500 entries, keyed by SHA-256 of input text
 * - 3s timeout via AbortController
 * - On failure: returns null (caller treats as cache miss)
 */

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMS = 1536;
const EMBED_TIMEOUT_MS = 3_000;
const LRU_MAX_SIZE = 500;

// Simple LRU cache using Map (Map preserves insertion order)
const lruCache = new Map<string, number[]>();

function lruGet(key: string): number[] | undefined {
  const val = lruCache.get(key);
  if (val !== undefined) {
    // Move to end (most recently used)
    lruCache.delete(key);
    lruCache.set(key, val);
  }
  return val;
}

function lruSet(key: string, value: number[]): void {
  if (lruCache.has(key)) {
    lruCache.delete(key);
  } else if (lruCache.size >= LRU_MAX_SIZE) {
    // Evict oldest (first key)
    const firstKey = lruCache.keys().next().value;
    if (firstKey !== undefined) {
      lruCache.delete(firstKey);
    }
  }
  lruCache.set(key, value);
}

/**
 * SHA-256 hash of text (used as cache key)
 */
export function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Generate embedding for text using OpenAI API.
 * Returns null on any failure (timeout, network error, missing API key).
 */
export async function embed(text: string): Promise<number[] | null> {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    return null;
  }

  const cacheKey = hashText(text);
  const cached = lruGet(cacheKey);
  if (cached) {
    return cached;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[EmbeddingService] OpenAI returned ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[] }>;
    };

    const embedding = data.data?.[0]?.embedding;
    if (!embedding || embedding.length !== EMBEDDING_DIMS) {
      console.warn('[EmbeddingService] Unexpected embedding shape');
      return null;
    }

    lruSet(cacheKey, embedding);
    return embedding;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[EmbeddingService] Embedding request timed out (3s)');
    } else {
      console.warn('[EmbeddingService] Embedding failed:', error instanceof Error ? error.message : String(error));
    }
    return null;
  }
}

/**
 * Clear the LRU cache (used in tests).
 */
export function clearEmbeddingCache(): void {
  lruCache.clear();
}

/**
 * Get current LRU cache size (used in tests).
 */
export function getEmbeddingCacheSize(): number {
  return lruCache.size;
}
