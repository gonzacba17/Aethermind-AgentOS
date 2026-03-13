import { getConfig, isInitialized } from '../config/index.js';
import { AethermindBudgetExceededError } from '../errors/AethermindBudgetExceededError.js';

interface BudgetStatus {
  status: 'ok' | 'warning' | 'exceeded';
  percentUsed: number;
  remaining: number | null;
  spentUsd?: number;
  limitUsd?: number;
  budgetType?: string;
  noBudget?: boolean;
}

const CACHE_TTL_MS = 60_000; // 60 seconds
const FETCH_TIMEOUT_MS = 2_000; // 2 seconds

/**
 * BudgetChecker — proactively checks budget status before LLM calls.
 *
 * Design principles:
 * - Caches result for 60s to avoid per-call latency.
 * - Non-blocking on timeout/error: if API is unreachable, allows execution.
 * - Only active when apiKey is configured.
 */
class BudgetCheckerImpl {
  private cachedStatus: BudgetStatus | null = null;
  private cacheTimestamp = 0;
  private fetchPromise: Promise<BudgetStatus | null> | null = null;

  /**
   * Check budget status before an LLM call.
   *
   * - If exceeded → throws AethermindBudgetExceededError
   * - If warning → logs warning, allows execution
   * - If ok/no-budget/error → allows execution silently
   */
  async check(): Promise<void> {
    if (!isInitialized()) return;

    const status = await this.getStatus();
    if (!status) return;

    if (status.status === 'exceeded') {
      throw new AethermindBudgetExceededError({
        limitUsd: status.limitUsd ?? 0,
        spentUsd: status.spentUsd ?? 0,
        percentUsed: status.percentUsed,
        budgetType: status.budgetType ?? 'monthly',
      });
    }

    if (status.status === 'warning') {
      console.warn(
        `[Aethermind] Budget warning: ${status.percentUsed}% used ` +
        `($${status.spentUsd ?? 0} of $${status.limitUsd ?? 0}). ` +
        `Execution allowed.`
      );
    }
  }

  /**
   * Get cached budget status, refreshing if stale.
   * Returns null on failure (fail-open).
   */
  private async getStatus(): Promise<BudgetStatus | null> {
    const now = Date.now();

    // Return cached if fresh
    if (this.cachedStatus && (now - this.cacheTimestamp) < CACHE_TTL_MS) {
      return this.cachedStatus;
    }

    // Deduplicate concurrent fetches
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = this.fetchBudgetStatus();

    try {
      const result = await this.fetchPromise;
      if (result) {
        this.cachedStatus = result;
        this.cacheTimestamp = Date.now();
      }
      return result ?? this.cachedStatus;
    } finally {
      this.fetchPromise = null;
    }
  }

  /**
   * Fetch budget status from the API with timeout.
   * Returns null on any failure (network, timeout, parse error).
   */
  private async fetchBudgetStatus(): Promise<BudgetStatus | null> {
    try {
      const config = getConfig();
      const url = `${config.endpoint}/v1/budget-status`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-API-Key': config.apiKey,
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          // Server error — fail open
          console.warn(`[Aethermind] Budget check returned ${response.status}, allowing execution`);
          return null;
        }

        return await response.json() as BudgetStatus;
      } catch (fetchError) {
        clearTimeout(timeout);
        throw fetchError;
      }
    } catch (error) {
      // Network error, timeout, or parse error — fail open silently
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('[Aethermind] Budget check timed out (2s), allowing execution');
      } else {
        console.warn('[Aethermind] Budget check failed, allowing execution:',
          error instanceof Error ? error.message : String(error));
      }
      return null;
    }
  }

  /**
   * Clear the cached status (used in tests).
   */
  clearCache(): void {
    this.cachedStatus = null;
    this.cacheTimestamp = 0;
    this.fetchPromise = null;
  }
}

// Singleton instance
export const budgetChecker = new BudgetCheckerImpl();
