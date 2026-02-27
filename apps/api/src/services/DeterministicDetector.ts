import { db } from '../db/index.js';
import { semanticCache } from '../db/schema.js';
import { eq, and, gte } from 'drizzle-orm';
import { cosineSimilarity } from './SemanticCacheService.js';

/**
 * DeterministicDetector — hourly cron that finds prompts receiving
 * identical responses and marks them as deterministic (no TTL expiry).
 *
 * Criteria: hitCount >= 5 AND isDeterministic = false
 * Verification: all stored responses for the same prompt have
 * cosine similarity > 0.98 with each other.
 */

const DETERMINISTIC_HIT_THRESHOLD = 5;
const RESPONSE_SIMILARITY_THRESHOLD = 0.98;
const CRON_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Run a single detection cycle.
 */
async function detectDeterministicEntries(): Promise<void> {
  console.log('[DeterministicDetector] Running detection cycle...');

  try {
    // Find entries with high hit counts that aren't yet marked deterministic
    const candidates = await db
      .select({
        id: semanticCache.id,
        clientId: semanticCache.clientId,
        promptHash: semanticCache.promptHash,
        model: semanticCache.model,
        response: semanticCache.response,
        hitCount: semanticCache.hitCount,
        promptEmbedding: semanticCache.promptEmbedding,
      })
      .from(semanticCache)
      .where(
        and(
          eq(semanticCache.isDeterministic, false),
          gte(semanticCache.hitCount, DETERMINISTIC_HIT_THRESHOLD)
        )
      );

    if (candidates.length === 0) {
      console.log('[DeterministicDetector] No candidates found');
      return;
    }

    // Group by (clientId, promptHash, model)
    type CandidateRow = (typeof candidates)[number];
    const groups = new Map<string, CandidateRow[]>();
    for (const entry of candidates) {
      const key = `${entry.clientId}:${entry.promptHash}:${entry.model}`;
      const group = groups.get(key);
      if (group) {
        group.push(entry);
      } else {
        groups.set(key, [entry]);
      }
    }

    let markedCount = 0;

    for (const [, entries] of groups) {
      // For single entries with high hit count, mark as deterministic
      // (same prompt always gets the same response)
      if (entries.length === 1) {
        const entry = entries[0]!;
        if (entry.hitCount >= DETERMINISTIC_HIT_THRESHOLD) {
          await db
            .update(semanticCache)
            .set({
              isDeterministic: true,
              ttlExpiresAt: null,
              updatedAt: new Date(),
            })
            .where(eq(semanticCache.id, entry.id));

          markedCount++;
          console.log(`[DeterministicDetector] Marked prompt ${entry.promptHash.slice(0, 8)} as deterministic after ${entry.hitCount} hits`);
        }
        continue;
      }

      // For multiple entries: check if responses are similar
      let allSimilar = true;

      for (let i = 0; i < entries.length && allSimilar; i++) {
        for (let j = i + 1; j < entries.length && allSimilar; j++) {
          const a = entries[i]!;
          const b = entries[j]!;

          // Simple string equality check
          if (a.response === b.response) continue;

          // If embeddings available, check similarity
          const embA = a.promptEmbedding as number[] | null;
          const embB = b.promptEmbedding as number[] | null;

          if (embA && embB && Array.isArray(embA) && Array.isArray(embB)) {
            const sim = cosineSimilarity(embA, embB);
            if (sim < RESPONSE_SIMILARITY_THRESHOLD) {
              allSimilar = false;
            }
          } else {
            // Without embeddings, require exact string match
            allSimilar = false;
          }
        }
      }

      if (allSimilar) {
        const ids = entries.map(e => e.id);
        for (const id of ids) {
          await db
            .update(semanticCache)
            .set({
              isDeterministic: true,
              ttlExpiresAt: null,
              updatedAt: new Date(),
            })
            .where(eq(semanticCache.id, id));
        }
        markedCount += ids.length;
        const hash = entries[0]!.promptHash.slice(0, 8);
        console.log(`[DeterministicDetector] Marked prompt ${hash} as deterministic after ${entries.length} identical responses`);
      }
    }

    console.log(`[DeterministicDetector] Cycle complete. Marked ${markedCount} entries as deterministic.`);
  } catch (error) {
    console.error('[DeterministicDetector] Detection error:', error);
  }
}

/**
 * Start the deterministic detector cron (every 1 hour).
 */
let isRunning = false;

export function startDeterministicDetectorCron(): void {
  console.log('[DeterministicDetector] Starting cron (every 1 hour)');

  // Run initial check after 30 seconds
  setTimeout(async () => {
    try {
      await detectDeterministicEntries();
    } catch (error) {
      console.error('[DeterministicDetector] Initial check error:', error);
    }
  }, 30_000);

  // Then run every hour
  setInterval(async () => {
    if (isRunning) {
      console.warn('[DeterministicDetector] Previous cycle still running, skipping');
      return;
    }

    isRunning = true;
    try {
      await detectDeterministicEntries();
    } catch (error) {
      console.error('[DeterministicDetector] Cycle error:', error);
    } finally {
      isRunning = false;
    }
  }, CRON_INTERVAL_MS);
}
