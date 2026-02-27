import { db } from '../db/index.js';
import { providerHealth } from '../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * ProviderHealthService — checks provider availability every 2 minutes.
 *
 * Makes minimal test calls to each provider to determine status:
 * - openai: gpt-4o-mini with a 10-token prompt
 * - anthropic: claude-3-haiku with a 10-token prompt
 * - ollama: checks local endpoint availability
 *
 * Cost: < $0.001 per check cycle for all providers combined.
 */

type ProviderStatus = 'ok' | 'degraded' | 'down';

const HEALTHCHECK_TIMEOUT_MS = 10_000; // 10 seconds
const HEALTHCHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

interface HealthCheckResult {
  status: ProviderStatus;
  latencyMs: number;
  errorMessage: string | null;
}

/**
 * Check OpenAI health with a minimal API call
 */
async function checkOpenAI(): Promise<HealthCheckResult> {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    return { status: 'down', latencyMs: 0, errorMessage: 'OPENAI_API_KEY not configured' };
  }

  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTHCHECK_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (response.ok) {
      // Consume response body
      await response.json();
      return {
        status: latencyMs > 5000 ? 'degraded' : 'ok',
        latencyMs,
        errorMessage: null,
      };
    }

    const errorBody = await response.text().catch(() => 'Unknown error');
    return {
      status: response.status >= 500 ? 'down' : 'degraded',
      latencyMs,
      errorMessage: `HTTP ${response.status}: ${errorBody.slice(0, 200)}`,
    };
  } catch (error) {
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    return {
      status: 'down',
      latencyMs,
      errorMessage: isTimeout ? 'Health check timed out' : (error instanceof Error ? error.message : String(error)),
    };
  }
}

/**
 * Check Anthropic health with a minimal API call
 */
async function checkAnthropic(): Promise<HealthCheckResult> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    return { status: 'down', latencyMs: 0, errorMessage: 'ANTHROPIC_API_KEY not configured' };
  }

  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTHCHECK_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (response.ok) {
      await response.json();
      return {
        status: latencyMs > 5000 ? 'degraded' : 'ok',
        latencyMs,
        errorMessage: null,
      };
    }

    const errorBody = await response.text().catch(() => 'Unknown error');
    return {
      status: response.status >= 500 ? 'down' : 'degraded',
      latencyMs,
      errorMessage: `HTTP ${response.status}: ${errorBody.slice(0, 200)}`,
    };
  } catch (error) {
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    return {
      status: 'down',
      latencyMs,
      errorMessage: isTimeout ? 'Health check timed out' : (error instanceof Error ? error.message : String(error)),
    };
  }
}

/**
 * Check Ollama health by pinging local endpoint
 */
async function checkOllama(): Promise<HealthCheckResult> {
  const ollamaUrl = process.env['OLLAMA_URL'] || 'http://localhost:11434';
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (response.ok) {
      return { status: 'ok', latencyMs, errorMessage: null };
    }

    return {
      status: 'degraded',
      latencyMs,
      errorMessage: `HTTP ${response.status}`,
    };
  } catch (error) {
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;
    return {
      status: 'down',
      latencyMs,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Update provider health in database
 */
async function updateProviderHealth(
  provider: string,
  result: HealthCheckResult
): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(providerHealth)
      .where(eq(providerHealth.provider, provider));

    if (existing.length > 0) {
      await db
        .update(providerHealth)
        .set({
          status: result.status,
          latencyMs: result.latencyMs,
          lastCheckedAt: new Date(),
          errorMessage: result.errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(providerHealth.provider, provider));
    } else {
      await db
        .insert(providerHealth)
        .values({
          provider,
          status: result.status,
          latencyMs: result.latencyMs,
          lastCheckedAt: new Date(),
          errorMessage: result.errorMessage,
        });
    }
  } catch (error) {
    console.error(`[ProviderHealth] Failed to update ${provider}:`, error);
  }
}

/**
 * Run a single health check cycle for all providers
 */
async function checkAllProviders(): Promise<void> {
  console.log('[ProviderHealth] Running health check cycle...');

  // Run checks in parallel
  const [openaiResult, anthropicResult, ollamaResult] = await Promise.allSettled([
    checkOpenAI(),
    checkAnthropic(),
    checkOllama(),
  ]);

  // Update database
  if (openaiResult.status === 'fulfilled') {
    await updateProviderHealth('openai', openaiResult.value);
    console.log(`[ProviderHealth] openai: ${openaiResult.value.status} (${openaiResult.value.latencyMs}ms)`);
  } else {
    await updateProviderHealth('openai', { status: 'down', latencyMs: 0, errorMessage: String(openaiResult.reason) });
  }

  if (anthropicResult.status === 'fulfilled') {
    await updateProviderHealth('anthropic', anthropicResult.value);
    console.log(`[ProviderHealth] anthropic: ${anthropicResult.value.status} (${anthropicResult.value.latencyMs}ms)`);
  } else {
    await updateProviderHealth('anthropic', { status: 'down', latencyMs: 0, errorMessage: String(anthropicResult.reason) });
  }

  if (ollamaResult.status === 'fulfilled') {
    await updateProviderHealth('ollama', ollamaResult.value);
    console.log(`[ProviderHealth] ollama: ${ollamaResult.value.status} (${ollamaResult.value.latencyMs}ms)`);
  } else {
    await updateProviderHealth('ollama', { status: 'down', latencyMs: 0, errorMessage: String(ollamaResult.reason) });
  }
}

/**
 * Start the provider health check cron.
 * Runs every 2 minutes.
 */
let isCheckingHealth = false;

export function startProviderHealthCron(): void {
  console.log('[ProviderHealth] Starting health check cron (every 2 minutes)');

  // Run initial check after 10 seconds (give server time to start)
  setTimeout(async () => {
    try {
      await checkAllProviders();
    } catch (error) {
      console.error('[ProviderHealth] Initial check error:', error);
    }
  }, 10_000);

  // Then run every 2 minutes
  setInterval(async () => {
    if (isCheckingHealth) {
      console.warn('[ProviderHealth] Previous check still running, skipping');
      return;
    }

    isCheckingHealth = true;
    try {
      await checkAllProviders();
    } catch (error) {
      console.error('[ProviderHealth] Check cycle error:', error);
    } finally {
      isCheckingHealth = false;
    }
  }, HEALTHCHECK_INTERVAL_MS);
}
