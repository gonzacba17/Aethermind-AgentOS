// DEPRECATED v0.2.0 — Client-side compression removed. Compression is now server-side only (gateway).
/**
 * CompressionService — SDK-side prompt compression client.
 *
 * Phase 4 — Prompt Optimization
 *
 * Design principles:
 * - Fail-open: any error → use original prompt, never block the caller
 * - 2s timeout on API calls
 * - Settings cached with 5min TTL (same pattern as CacheService)
 * - Only active if compressionEnabled: true in client settings
 * - Only compresses prompts > 500 tokens to avoid overhead on short prompts
 * - Singleton pattern
 */

import { getConfig, isInitialized } from '../config/index.js';

// ============================================
// Types
// ============================================

export interface CompressionResult {
  prompt: string;          // Final prompt (compressed or original)
  wasCompressed: boolean;
  originalTokens: number;
  finalTokens: number;
}

interface CompressionSettings {
  compressionEnabled: boolean;
  minCompressionRatio: number;
  fetchedAt: number;
}

interface AnalyzeResponse {
  prompt: string;
  wasCompressed: boolean;
  originalTokens: number;
  finalTokens: number;
  compressionRatio: number;
  compressionEnabled: boolean;
  minCompressionRatio: number;
}

// ============================================
// Constants
// ============================================

const FETCH_TIMEOUT_MS = 2_000;       // 2 second timeout
const SETTINGS_TTL_MS = 5 * 60_000;  // 5 minutes
const MIN_TOKENS_FOR_COMPRESSION = 500; // Don't compress short prompts

// ============================================
// Token Estimation (duplicated from PromptClassifier for SDK independence)
// ============================================

function estimateTokens(text: string): number {
  if (!text) return 0;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.ceil(wordCount * 1.3);
}

// ============================================
// CompressionService
// ============================================

class CompressionServiceImpl {
  private settingsCache: CompressionSettings | null = null;

  /**
   * Compress a prompt if settings allow.
   *
   * Fail-open: on any error, returns original prompt unchanged.
   */
  async compress(prompt: string, model: string): Promise<CompressionResult> {
    const noOp: CompressionResult = {
      prompt,
      wasCompressed: false,
      originalTokens: estimateTokens(prompt),
      finalTokens: estimateTokens(prompt),
    };

    if (!isInitialized()) return noOp;

    try {
      // Skip short prompts — overhead isn't worth it
      const estimatedTokens = estimateTokens(prompt);
      if (estimatedTokens < MIN_TOKENS_FOR_COMPRESSION) {
        return noOp;
      }

      // Check settings (cached)
      const settings = await this.getSettings();
      if (!settings || !settings.compressionEnabled) {
        return noOp;
      }

      // Call API
      const config = getConfig();
      const url = `${config.endpoint}/v1/optimization/analyze`;

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
          return noOp;
        }

        const data = (await response.json()) as AnalyzeResponse;

        // Respect minCompressionRatio — only compress if savings meet threshold
        if (!data.wasCompressed) {
          return noOp;
        }

        // Verify the compressed prompt is meaningful
        if (!data.prompt || data.prompt.trim().length === 0) {
          return noOp;
        }

        return {
          prompt: data.prompt,
          wasCompressed: true,
          originalTokens: data.originalTokens,
          finalTokens: data.finalTokens,
        };
      } catch (fetchError) {
        clearTimeout(timeout);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.warn('[Aethermind] Compression request timed out (2s), using original prompt');
        }
        return noOp;
      }
    } catch {
      // Fail-open
      return noOp;
    }
  }

  /**
   * Get compression settings (cached with 5min TTL).
   */
  private async getSettings(): Promise<CompressionSettings | null> {
    // Return cached if still fresh
    if (
      this.settingsCache &&
      Date.now() - this.settingsCache.fetchedAt < SETTINGS_TTL_MS
    ) {
      return this.settingsCache;
    }

    try {
      const config = getConfig();
      const url = `${config.endpoint}/v1/optimization/analyze`;

      // We'll parse settings from the analyze response
      // to avoid a separate settings endpoint call.
      // The analyze response includes compressionEnabled and minCompressionRatio.
      // Use a minimal probe to get settings.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'X-API-Key': config.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt: 'ping', model: 'none' }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          return null;
        }

        const data = (await response.json()) as AnalyzeResponse;

        this.settingsCache = {
          compressionEnabled: data.compressionEnabled ?? false,
          minCompressionRatio: data.minCompressionRatio ?? 0.15,
          fetchedAt: Date.now(),
        };

        return this.settingsCache;
      } catch (fetchError) {
        clearTimeout(timeout);
        return null;
      }
    } catch {
      return null;
    }
  }

  /**
   * Clear the settings cache (used in tests).
   */
  clearCache(): void {
    this.settingsCache = null;
  }
}

// Singleton export
export const compressionService = new CompressionServiceImpl();
