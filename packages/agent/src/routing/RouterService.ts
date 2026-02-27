import { getConfig, isInitialized } from '../config/index.js';
import { classifyPrompt } from './PromptClassifier.js';

/**
 * Routing rules fetched from the API
 */
interface RoutingRules {
  enabled: boolean;
  simpleModel: string;
  mediumModel: string;
  complexModel: string;
}

/**
 * Provider health status
 */
interface ProviderHealthEntry {
  provider: string;
  status: 'ok' | 'degraded' | 'down';
  latencyMs: number | null;
  lastCheckedAt: string | null;
}

interface ProviderHealthResponse {
  providers: ProviderHealthEntry[];
}

const CACHE_TTL_MS = 60_000; // 60 seconds (same as BudgetChecker)
const FETCH_TIMEOUT_MS = 2_000; // 2 seconds

/**
 * Provider equivalences for fallback routing
 */
const PROVIDER_FALLBACK_MAP: Record<string, string | null> = {
  openai: 'anthropic',
  anthropic: 'openai',
  ollama: null, // local — no fallback
};

/**
 * Model-to-provider mapping for determining provider from model name
 */
function getProviderForModel(model: string): 'openai' | 'anthropic' | 'ollama' {
  if (model.startsWith('gpt-') || model.startsWith('o1-')) return 'openai';
  if (model.startsWith('claude-')) return 'anthropic';
  return 'ollama';
}

/**
 * RouterService — resolves the optimal model for an LLM call based on prompt complexity.
 *
 * Design principles (mirrors BudgetChecker):
 * - Caches rules for 60s to avoid per-call latency.
 * - Non-blocking on timeout/error: if API is unreachable, uses original model.
 * - Only active when apiKey is configured and routing is enabled.
 * - Fail-open always: any error → original model.
 */
class RouterServiceImpl {
  // Routing rules cache
  private cachedRules: RoutingRules | null = null;
  private rulesCacheTimestamp = 0;
  private rulesFetchPromise: Promise<RoutingRules | null> | null = null;

  // Provider health cache
  private cachedHealth: ProviderHealthEntry[] | null = null;
  private healthCacheTimestamp = 0;
  private healthFetchPromise: Promise<ProviderHealthEntry[] | null> | null = null;

  /**
   * Resolve the model to use for an LLM call.
   *
   * @param originalModel - The model the client requested
   * @param prompt - The prompt text (for complexity classification)
   * @returns Object with resolvedModel and metadata
   */
  async resolveModel(
    originalModel: string,
    prompt: string
  ): Promise<{
    model: string;
    wasRouted: boolean;
    originalModel: string;
    complexity?: string;
  }> {
    if (!isInitialized()) {
      return { model: originalModel, wasRouted: false, originalModel };
    }

    try {
      const rules = await this.getRules();

      if (!rules || !rules.enabled) {
        return { model: originalModel, wasRouted: false, originalModel };
      }

      // Classify the prompt
      const complexity = classifyPrompt(prompt);

      // Resolve model based on complexity
      let targetModel: string;
      switch (complexity) {
        case 'simple':
          targetModel = rules.simpleModel;
          break;
        case 'medium':
          targetModel = rules.mediumModel;
          break;
        case 'complex':
          targetModel = rules.complexModel;
          break;
        default:
          targetModel = originalModel;
      }

      // If the target model is the same as original, or is unrecognized → no routing
      if (targetModel === originalModel) {
        return { model: originalModel, wasRouted: false, originalModel, complexity };
      }

      return {
        model: targetModel,
        wasRouted: true,
        originalModel,
        complexity,
      };
    } catch (error) {
      // Fail-open: any error → use original model
      console.warn('[Aethermind] Router error, using original model:',
        error instanceof Error ? error.message : String(error));
      return { model: originalModel, wasRouted: false, originalModel };
    }
  }

  /**
   * Check if a provider is available and get fallback if needed.
   *
   * @param provider - The provider to check
   * @returns The provider to use (may be fallback), or null if no fallback available
   */
  async resolveProvider(provider: string): Promise<{
    provider: string;
    isFallback: boolean;
    fallbackProvider: string | null;
  }> {
    if (!isInitialized()) {
      return { provider, isFallback: false, fallbackProvider: null };
    }

    try {
      const health = await this.getHealth();
      if (!health || health.length === 0) {
        return { provider, isFallback: false, fallbackProvider: null };
      }

      const providerStatus = health.find(h => h.provider === provider);
      if (!providerStatus || providerStatus.status !== 'down') {
        return { provider, isFallback: false, fallbackProvider: null };
      }

      // Provider is down → try fallback
      const fallbackProvider = PROVIDER_FALLBACK_MAP[provider];
      if (!fallbackProvider) {
        console.error(`[Aethermind] Provider ${provider} unavailable, no fallback available`);
        return { provider, isFallback: false, fallbackProvider: null };
      }

      // Check if fallback provider is healthy
      const fallbackStatus = health.find(h => h.provider === fallbackProvider);
      if (fallbackStatus && fallbackStatus.status === 'down') {
        console.error(`[Aethermind] Provider ${provider} unavailable, fallback ${fallbackProvider} is also down`);
        return { provider, isFallback: false, fallbackProvider: null };
      }

      console.log(`[Aethermind] Provider ${provider} unavailable, routing to ${fallbackProvider}`);
      return {
        provider: fallbackProvider,
        isFallback: true,
        fallbackProvider,
      };
    } catch (error) {
      // Fail-open
      console.warn('[Aethermind] Provider health check error, using original provider:',
        error instanceof Error ? error.message : String(error));
      return { provider, isFallback: false, fallbackProvider: null };
    }
  }

  /**
   * Get cached routing rules, refreshing if stale.
   */
  private async getRules(): Promise<RoutingRules | null> {
    const now = Date.now();

    if (this.cachedRules && (now - this.rulesCacheTimestamp) < CACHE_TTL_MS) {
      return this.cachedRules;
    }

    // Deduplicate concurrent fetches
    if (this.rulesFetchPromise) {
      return this.rulesFetchPromise;
    }

    this.rulesFetchPromise = this.fetchRules();

    try {
      const result = await this.rulesFetchPromise;
      if (result) {
        this.cachedRules = result;
        this.rulesCacheTimestamp = Date.now();
      }
      return result ?? this.cachedRules;
    } finally {
      this.rulesFetchPromise = null;
    }
  }

  /**
   * Get cached provider health, refreshing if stale.
   */
  private async getHealth(): Promise<ProviderHealthEntry[] | null> {
    const now = Date.now();

    if (this.cachedHealth && (now - this.healthCacheTimestamp) < CACHE_TTL_MS) {
      return this.cachedHealth;
    }

    if (this.healthFetchPromise) {
      return this.healthFetchPromise;
    }

    this.healthFetchPromise = this.fetchHealth();

    try {
      const result = await this.healthFetchPromise;
      if (result) {
        this.cachedHealth = result;
        this.healthCacheTimestamp = Date.now();
      }
      return result ?? this.cachedHealth;
    } finally {
      this.healthFetchPromise = null;
    }
  }

  /**
   * Fetch routing rules from the API with timeout.
   */
  private async fetchRules(): Promise<RoutingRules | null> {
    try {
      const config = getConfig();
      const url = `${config.endpoint}/v1/routing/rules`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'X-API-Key': config.apiKey },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          console.warn(`[Aethermind] Routing rules fetch returned ${response.status}, using defaults`);
          return null;
        }

        return await response.json() as RoutingRules;
      } catch (fetchError) {
        clearTimeout(timeout);
        throw fetchError;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('[Aethermind] Routing rules fetch timed out (2s), using defaults');
      } else {
        console.warn('[Aethermind] Routing rules fetch failed, using defaults:',
          error instanceof Error ? error.message : String(error));
      }
      return null;
    }
  }

  /**
   * Fetch provider health from the API with timeout.
   */
  private async fetchHealth(): Promise<ProviderHealthEntry[] | null> {
    try {
      const config = getConfig();
      const url = `${config.endpoint}/v1/routing/provider-health`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'X-API-Key': config.apiKey },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          console.warn(`[Aethermind] Provider health fetch returned ${response.status}`);
          return null;
        }

        const data = await response.json() as ProviderHealthResponse;
        return data.providers;
      } catch (fetchError) {
        clearTimeout(timeout);
        throw fetchError;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('[Aethermind] Provider health fetch timed out (2s)');
      } else {
        console.warn('[Aethermind] Provider health fetch failed:',
          error instanceof Error ? error.message : String(error));
      }
      return null;
    }
  }

  /**
   * Clear all caches (used in tests).
   */
  clearCache(): void {
    this.cachedRules = null;
    this.rulesCacheTimestamp = 0;
    this.rulesFetchPromise = null;
    this.cachedHealth = null;
    this.healthCacheTimestamp = 0;
    this.healthFetchPromise = null;
  }
}

// Singleton instance
export const routerService = new RouterServiceImpl();
