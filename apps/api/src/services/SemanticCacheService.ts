import { db } from '../db/index.js';
import { semanticCache, cacheSettings } from '../db/schema.js';
import { eq, and, or, gt, isNull, sql, lt } from 'drizzle-orm';
import { hashText, embed } from './EmbeddingService.js';

/**
 * SemanticCacheService — handles cache lookup, storage, and similarity matching.
 *
 * Lookup flow:
 * 1. SHA-256 exact match (fast path)
 * 2. If enabled, embed prompt and cosine-similarity scan (slow path)
 *
 * Storage: upsert on (clientId, promptHash, model).
 */

export interface CacheHit {
  response: string;
  cachedAt: string;
  model: string;
  tokensUsed: number;
  costUsd: number;
  similarity: number; // 1.0 for exact match
}

/**
 * Cosine similarity between two equal-length vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dotProduct += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Look up a cached response for the given prompt and model.
 *
 * Returns CacheHit on match, null on miss.
 */
export async function lookup(
  clientId: string,
  prompt: string,
  model: string
): Promise<CacheHit | null> {
  try {
    const promptHash = hashText(prompt);
    const now = new Date();

    // 1. Exact match (fast path)
    const exactRows = await db
      .select()
      .from(semanticCache)
      .where(
        and(
          eq(semanticCache.clientId, clientId),
          eq(semanticCache.promptHash, promptHash),
          eq(semanticCache.model, model),
          or(
            isNull(semanticCache.ttlExpiresAt),
            gt(semanticCache.ttlExpiresAt, now)
          )
        )
      )
      .limit(1);

    const entry = exactRows[0];
    if (entry) {
      // Increment hit count (fire-and-forget)
      db.update(semanticCache)
        .set({
          hitCount: sql`${semanticCache.hitCount} + 1`,
          updatedAt: now,
        })
        .where(eq(semanticCache.id, entry.id))
        .then(() => {})
        .catch(() => {});

      return {
        response: entry.response,
        cachedAt: entry.createdAt.toISOString(),
        model: entry.model,
        tokensUsed: entry.tokensUsed,
        costUsd: parseFloat(entry.costUsd),
        similarity: 1.0,
      };
    }

    // 2. Check if semantic similarity is enabled for this client
    const settingsRows = await db
      .select()
      .from(cacheSettings)
      .where(eq(cacheSettings.clientId, clientId))
      .limit(1);

    const settings = settingsRows[0];
    if (!settings || !settings.enabled) {
      return null;
    }

    const threshold = parseFloat(settings.similarityThreshold);

    // 3. Embed the prompt
    const promptEmbedding = await embed(prompt);
    if (!promptEmbedding) {
      return null;
    }

    // 4. Fetch all non-expired entries for this client with embeddings
    const candidates = await db
      .select({
        id: semanticCache.id,
        promptEmbedding: semanticCache.promptEmbedding,
        response: semanticCache.response,
        model: semanticCache.model,
        tokensUsed: semanticCache.tokensUsed,
        costUsd: semanticCache.costUsd,
        createdAt: semanticCache.createdAt,
      })
      .from(semanticCache)
      .where(
        and(
          eq(semanticCache.clientId, clientId),
          or(
            isNull(semanticCache.ttlExpiresAt),
            gt(semanticCache.ttlExpiresAt, now)
          )
        )
      );

    // 5. Find best match via cosine similarity
    let bestMatch: (typeof candidates)[number] | null = null;
    let bestSimilarity = 0;

    for (const candidate of candidates) {
      if (!candidate.promptEmbedding) continue;

      const embedding = candidate.promptEmbedding as number[];
      if (!Array.isArray(embedding) || embedding.length === 0) continue;

      const sim = cosineSimilarity(promptEmbedding, embedding);
      if (sim >= threshold && sim > bestSimilarity) {
        bestSimilarity = sim;
        bestMatch = candidate;
      }
    }

    if (bestMatch) {
      // Increment hit count (fire-and-forget)
      db.update(semanticCache)
        .set({
          hitCount: sql`${semanticCache.hitCount} + 1`,
          updatedAt: now,
        })
        .where(eq(semanticCache.id, bestMatch.id))
        .then(() => {})
        .catch(() => {});

      return {
        response: bestMatch.response,
        cachedAt: bestMatch.createdAt.toISOString(),
        model: bestMatch.model,
        tokensUsed: bestMatch.tokensUsed,
        costUsd: parseFloat(bestMatch.costUsd),
        similarity: bestSimilarity,
      };
    }

    return null;
  } catch (error) {
    console.error('[SemanticCache] Lookup error:', error);
    return null;
  }
}

/**
 * Store a prompt/response pair in the cache.
 * Upserts on (clientId, promptHash, model).
 */
export async function store(
  clientId: string,
  prompt: string,
  response: string,
  model: string,
  tokensUsed: number,
  costUsd: number
): Promise<void> {
  try {
    const promptHash = hashText(prompt);

    // Get client's TTL settings
    const settingsRows = await db
      .select()
      .from(cacheSettings)
      .where(eq(cacheSettings.clientId, clientId))
      .limit(1);

    const settings = settingsRows[0];
    const ttlSeconds = settings?.ttlSeconds ?? 86400;

    const ttlExpiresAt = new Date(Date.now() + ttlSeconds * 1000);

    // Embed the prompt (best-effort, store even if embedding fails)
    const promptEmbedding = await embed(prompt);

    // Upsert: insert or update on conflict
    await db
      .insert(semanticCache)
      .values({
        clientId,
        promptHash,
        promptEmbedding: promptEmbedding ?? null,
        prompt,
        response,
        model,
        tokensUsed,
        costUsd: costUsd.toFixed(6),
        ttlExpiresAt,
      })
      .onConflictDoNothing();

    // If entry already exists with same hash+model, update it
    const existing = await db
      .select({ id: semanticCache.id })
      .from(semanticCache)
      .where(
        and(
          eq(semanticCache.clientId, clientId),
          eq(semanticCache.promptHash, promptHash),
          eq(semanticCache.model, model)
        )
      )
      .limit(1);

    const existingEntry = existing[0];
    if (existingEntry) {
      await db
        .update(semanticCache)
        .set({
          response,
          tokensUsed,
          costUsd: costUsd.toFixed(6),
          promptEmbedding: promptEmbedding ?? undefined,
          ttlExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(semanticCache.id, existingEntry.id));
    }
  } catch (error) {
    console.error('[SemanticCache] Store error:', error);
  }
}

/**
 * Mark a cache entry as deterministic (never expires).
 */
export async function markDeterministic(entryId: string): Promise<void> {
  await db
    .update(semanticCache)
    .set({
      isDeterministic: true,
      ttlExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(semanticCache.id, entryId));
}

/**
 * Purge expired cache entries. Optionally scoped to a client.
 * Returns the number of deleted entries.
 */
export async function purgeExpired(clientId?: string): Promise<number> {
  const conditions = [lt(semanticCache.ttlExpiresAt, new Date())];

  if (clientId) {
    conditions.push(eq(semanticCache.clientId, clientId));
  }

  const deleted = await db
    .delete(semanticCache)
    .where(and(...conditions))
    .returning({ id: semanticCache.id });

  return deleted.length;
}

/**
 * Purge all cache entries for a client (used by dashboard "clear cache" action).
 */
export async function purgeAll(clientId: string): Promise<number> {
  const deleted = await db
    .delete(semanticCache)
    .where(eq(semanticCache.clientId, clientId))
    .returning({ id: semanticCache.id });

  return deleted.length;
}
