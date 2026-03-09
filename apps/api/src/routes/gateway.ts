/**
 * AI Gateway — OpenAI-compatible proxy with automatic cache, routing,
 * compression, budget enforcement, and telemetry.
 *
 * Usage:
 *   baseURL: "https://aethermind-agentos-production.up.railway.app/gateway/v1"
 *   headers: { "X-Client-Token": "ct_..." }
 *
 * Pipeline per request:
 *   1. Auth  2. Budget  3. Cache lookup  4. Compression  5. Routing
 *   6. Proxy to provider  7. Telemetry  8. Cache store  9. Response
 */

import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import {
  telemetryEvents,
  agentTraces,
  clients,
  users,
  userApiKeys,
  routingRules,
  providerHealth,
  optimizationSettings,
} from '../db/schema.js';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { clientAuth, type ClientAuthenticatedRequest } from '../middleware/clientAuth.js';
import { evaluateBudgetByOrg } from '../services/ClientBudgetService.js';
import * as SemanticCacheService from '../services/SemanticCacheService.js';
import { analyze as analyzePrompt } from '../services/PromptAnalyzer.js';

const router = Router();

// ─── Provider URLs ──────────────────────────────────────────
const PROVIDER_URLS: Record<string, string> = {
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com',
};

// ─── Encryption (mirrors user-api-keys.ts) ──────────────────
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY;

function getEncryptionKey(): string {
  if (ENCRYPTION_KEY && ENCRYPTION_KEY.length >= 32) return ENCRYPTION_KEY;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('API_KEY_ENCRYPTION_KEY not configured');
  }
  return 'dev-only-insecure-key-32-chars!!';
}

function decrypt(encryptedText: string): string {
  const encKey = getEncryptionKey();
  const parts = encryptedText.split(':');
  let salt: Buffer, iv: Buffer, encrypted: string;
  if (parts.length === 2) {
    salt = Buffer.from('salt');
    iv = Buffer.from(parts[0]!, 'hex');
    encrypted = parts[1]!;
  } else if (parts.length === 3) {
    salt = Buffer.from(parts[0]!, 'hex');
    iv = Buffer.from(parts[1]!, 'hex');
    encrypted = parts[2]!;
  } else {
    throw new Error('Invalid encrypted key format');
  }
  const key = crypto.scryptSync(encKey, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ─── Helpers ────────────────────────────────────────────────

/** Detect provider from model name */
function detectProvider(model: string): string {
  if (model.startsWith('gpt-') || model.startsWith('o1-') || model.startsWith('o3-')) return 'openai';
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('gemini-')) return 'gemini';
  // Default to openai for unknown models (OpenAI-compatible endpoint)
  return 'openai';
}

/** Extract prompt text from messages array */
function extractPromptText(messages: any[]): string {
  if (!Array.isArray(messages)) return '';
  return messages
    .filter((m: any) => m.role === 'user' || m.role === 'system')
    .map((m: any) => (typeof m.content === 'string' ? m.content : ''))
    .join(' ');
}

/** Simple cost calculation (vendored pricing) */
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'o1-preview': { input: 0.015, output: 0.06 },
  'o1-mini': { input: 0.003, output: 0.012 },
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
  'gemini-2.0-flash': { input: 0.0001, output: 0.0004 },
  'gemini-2.0-flash-lite': { input: 0.000075, output: 0.0003 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
  'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
};

function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const costs = PRICING[model] || { input: 0, output: 0 };
  return (promptTokens / 1000) * costs.input + (completionTokens / 1000) * costs.output;
}

/** Get user's decrypted API key for a provider */
async function getUserApiKey(
  organizationId: string,
  provider: string,
): Promise<string | null> {
  // Get ALL users in this organization (not just the first one)
  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.organizationId, organizationId),
        isNull(users.deletedAt),
      ),
    );

  if (!userRows.length) return null;

  const userIds = userRows.map((u) => u.id);

  // Search for a valid key across all users in the org
  const keyRows = await db
    .select({ encryptedKey: userApiKeys.encryptedKey })
    .from(userApiKeys)
    .where(
      and(
        inArray(userApiKeys.userId, userIds),
        eq(userApiKeys.provider, provider),
        eq(userApiKeys.isValid, true),
      ),
    )
    .limit(1);

  if (!keyRows[0]) return null;

  try {
    return decrypt(keyRows[0].encryptedKey);
  } catch {
    return null;
  }
}

/** Fallback: check env vars for API keys (testing/dev) */
function getEnvApiKey(provider: string): string | null {
  const map: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    gemini: 'GEMINI_API_KEY',
  };
  const envVar = map[provider];
  return envVar ? process.env[envVar] || null : null;
}

/** Get routing rules for a client */
async function getRoutingRules(clientId: string) {
  const rows = await db
    .select()
    .from(routingRules)
    .where(eq(routingRules.clientId, clientId))
    .limit(1);
  return rows[0] || null;
}

/** Classify prompt complexity (same heuristics as PromptClassifier in SDK) */
function classifyPrompt(text: string): 'simple' | 'medium' | 'complex' {
  const words = text.split(/\s+/);
  const tokenEstimate = words.length * 1.3;
  const reasoningKeywords = [
    'analyze', 'compare', 'explain', 'evaluate', 'contrast',
    'synthesize', 'critique', 'assess', 'differentiate', 'elaborate',
    'justify', 'hypothesize', 'infer', 'deduce', 'summarize',
    'interpret', 'classify', 'predict', 'recommend', 'prioritize',
    'debug', 'refactor', 'optimize', 'architect', 'design',
  ];
  const lower = text.toLowerCase();
  const reasoningCount = reasoningKeywords.filter((k) => lower.includes(k)).length;
  const instructionPatterns = /(?:^|\n)\s*(?:\d+[\.\)]\s|[-*•]\s|first[,:]|then[,:]|next[,:]|finally[,:])/gi;
  const instructionCount = (text.match(instructionPatterns) || []).length;

  if (tokenEstimate > 800 || reasoningCount >= 3 || instructionCount >= 3) return 'complex';
  if (tokenEstimate < 200 && reasoningCount === 0) return 'simple';
  return 'medium';
}

/** Apply routing: select model based on complexity */
function routeModel(
  originalModel: string,
  promptText: string,
  rules: any,
): { model: string; wasRouted: boolean; complexity: string } {
  if (!rules || !rules.enabled) {
    return { model: originalModel, wasRouted: false, complexity: 'none' };
  }
  const complexity = classifyPrompt(promptText);
  const modelMap: Record<string, string> = {
    simple: rules.simpleModel,
    medium: rules.mediumModel,
    complex: rules.complexModel,
  };
  const routedModel = modelMap[complexity] || originalModel;
  return {
    model: routedModel,
    wasRouted: routedModel !== originalModel,
    complexity,
  };
}

/** Record telemetry event */
async function recordTelemetry(
  organizationId: string,
  data: {
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
    latency: number;
    status: string;
    error?: string;
    originalModel?: string;
    routedModel?: string;
    fallbackUsed?: boolean;
    cacheHit?: boolean;
    cacheSavedUsd?: number;
    compressionApplied?: boolean;
    originalTokens?: number;
    compressedTokens?: number;
    tokensSaved?: number;
    traceId?: string;
    agentName?: string;
    workflowId?: string;
    workflowStep?: number;
    parentAgentId?: string;
  },
): Promise<void> {
  try {
    await db.insert(telemetryEvents).values({
      organizationId,
      timestamp: new Date(),
      provider: data.provider,
      model: data.model,
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      totalTokens: data.totalTokens,
      cost: String(data.cost),
      latency: data.latency,
      status: data.status,
      error: data.error,
      originalModel: data.originalModel,
      routedModel: data.routedModel,
      fallbackUsed: data.fallbackUsed,
      cacheHit: data.cacheHit ?? false,
      cacheSavedUsd: data.cacheSavedUsd != null ? String(data.cacheSavedUsd) : undefined,
      compressionApplied: data.compressionApplied,
      originalTokens: data.originalTokens,
      compressedTokens: data.compressedTokens,
      tokensSaved: data.tokensSaved,
      traceId: data.traceId,
      agentName: data.agentName,
      workflowId: data.workflowId,
      workflowStep: data.workflowStep,
      parentAgentId: data.parentAgentId,
    });
  } catch (err) {
    console.error('[Gateway] Failed to record telemetry:', (err as Error).message);
  }
}

/** Build provider request headers */
function buildProviderHeaders(provider: string, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider === 'openai') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else if (provider === 'gemini') {
    headers['x-goog-api-key'] = apiKey;
  }
  return headers;
}

/** Build the upstream URL for a provider */
function buildProviderUrl(provider: string, apiKey: string): string {
  if (provider === 'openai') {
    return `${PROVIDER_URLS.openai}/v1/chat/completions`;
  }
  if (provider === 'anthropic') {
    return `${PROVIDER_URLS.anthropic}/v1/messages`;
  }
  if (provider === 'gemini') {
    // Gemini uses a different URL pattern
    return `${PROVIDER_URLS.gemini}/v1beta/openai/chat/completions`;
  }
  return `${PROVIDER_URLS.openai}/v1/chat/completions`;
}

// ─── Provider fallback map ──────────────────────────────────
const PROVIDER_FALLBACKS: Record<string, string | null> = {
  openai: 'anthropic',
  anthropic: 'openai',
  gemini: 'openai',
};

// Map a model to the fallback provider's default model
const FALLBACK_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  gemini: 'gemini-2.0-flash',
};

// ═══════════════════════════════════════════════════════════
// POST /gateway/v1/chat/completions — OpenAI-compatible proxy
// ═══════════════════════════════════════════════════════════
router.post(
  '/v1/chat/completions',
  clientAuth,
  async (req: Request, res: Response) => {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;
    if (!client || !client.organizationId) {
      return res.status(401).json({ error: { message: 'Unauthorized', type: 'auth_error' } });
    }
    const organizationId = client.organizationId;

    // Agent context — extracted from optional headers
    const agentContext = {
      agentId: req.headers['x-agent-id'] as string | undefined,
      agentName: req.headers['x-agent-name'] as string | undefined,
      workflowId: req.headers['x-workflow-id'] as string | undefined,
      workflowStep: req.headers['x-workflow-step']
        ? parseInt(req.headers['x-workflow-step'] as string, 10)
        : undefined,
      parentAgentId: req.headers['x-parent-agent-id'] as string | undefined,
      traceId: (req.headers['x-trace-id'] as string) || crypto.randomUUID(),
    };

    const body = req.body;
    if (!body || !body.model || !body.messages) {
      return res.status(400).json({
        error: { message: 'model and messages are required', type: 'invalid_request_error' },
      });
    }

    const isStream = body.stream === true;
    const originalModel: string = body.model;
    const messages: any[] = body.messages;
    const promptText = extractPromptText(messages);
    const startTime = Date.now();

    // ── 1. Budget check ─────────────────────────────────
    try {
      const budget = await evaluateBudgetByOrg(organizationId);
      if (budget && budget.status === 'exceeded') {
        return res.status(429).json({
          error: {
            message: `Budget exceeded: $${budget.spentUsd.toFixed(2)} / $${budget.limitUsd.toFixed(2)} (${budget.budgetType})`,
            type: 'budget_exceeded',
          },
        });
      }
    } catch {
      // Non-blocking — continue if budget check fails
    }

    // ── 2. Cache lookup ────────────────────────────────
    if (!isStream) {
      try {
        const cacheHit = await SemanticCacheService.lookup(client.id, promptText, originalModel);
        if (cacheHit) {
          const latency = Date.now() - startTime;

          // Record cache hit telemetry (fire-and-forget)
          recordTelemetry(organizationId, {
            provider: detectProvider(originalModel),
            model: originalModel,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            cost: 0,
            latency,
            status: 'success',
            cacheHit: true,
            cacheSavedUsd: cacheHit.costUsd,
          });

          // Return OpenAI-compatible cached response
          return res.json({
            id: `chatcmpl-cache-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: cacheHit.model,
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: cacheHit.response },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            _aethermind: { cacheHit: true, latency },
          });
        }
      } catch {
        // Non-blocking — continue on cache error
      }
    }

    // ── 3. Prompt compression ──────────────────────────
    // DEPRECATED v0.2.0 — Prompt compression disabled. Kept for reference.
    let compressionMeta: {
      applied: boolean;
      originalTokens: number;
      compressedTokens: number;
      tokensSaved: number;
    } = { applied: false, originalTokens: 0, compressedTokens: 0, tokensSaved: 0 };

    /*
    try {
      // Check if compression is enabled for this client
      const settingsRows = await db
        .select()
        .from(optimizationSettings)
        .where(eq(optimizationSettings.clientId, client.id))
        .limit(1);
      const settings = settingsRows[0];

      if (settings && settings.compressionEnabled) {
        const analysis = analyzePrompt(promptText);
        if (analysis.compressionRatio < 1.0 && analysis.issues.length > 0) {
          // Apply compressed prompt to the last user message
          const userMessages = messages.filter((m: any) => m.role === 'user');
          if (userMessages.length > 0) {
            const lastUserMsg = userMessages[userMessages.length - 1];
            if (typeof lastUserMsg.content === 'string') {
              lastUserMsg.content = analysis.compressedPrompt;
            }
          }
          compressionMeta = {
            applied: true,
            originalTokens: analysis.originalTokens,
            compressedTokens: analysis.estimatedCompressedTokens,
            tokensSaved: analysis.originalTokens - analysis.estimatedCompressedTokens,
          };
        }
      }
    } catch {
      // Non-blocking
    }
    */

    // ── 4. Smart routing ───────────────────────────────
    let routingMeta: { model: string; wasRouted: boolean; complexity: string } = {
      model: originalModel,
      wasRouted: false,
      complexity: 'none',
    };

    try {
      const rules = await getRoutingRules(client.id);
      routingMeta = routeModel(originalModel, promptText, rules);
    } catch {
      // Non-blocking — use original model
    }

    const finalModel = routingMeta.model;
    const provider = detectProvider(finalModel);

    // ── 5. Resolve API key ─────────────────────────────
    let apiKey = await getUserApiKey(organizationId, provider);
    if (!apiKey) {
      apiKey = getEnvApiKey(provider);
    }
    if (!apiKey) {
      return res.status(422).json({
        error: {
          message: `No API key configured for ${provider}. Add it in your dashboard → Settings → API Keys`,
          type: 'api_key_missing',
        },
      });
    }

    // ── 6. Proxy to provider ───────────────────────────
    const proxyBody = { ...body, model: finalModel, stream: isStream };
    const providerUrl = buildProviderUrl(provider, apiKey);
    const providerHeaders = buildProviderHeaders(provider, apiKey);

    // Helper to execute the actual proxy call
    const proxyRequest = async (
      url: string,
      headers: Record<string, string>,
      reqBody: any,
    ): Promise<globalThis.Response> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);
      try {
        return await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(reqBody),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
    };

    // ── 6a. Streaming ──────────────────────────────────
    if (isStream) {
      try {
        const upstream = await proxyRequest(providerUrl, providerHeaders, proxyBody);

        if (!upstream.ok) {
          const errText = await upstream.text();
          return res.status(upstream.status).json({
            error: { message: errText, type: 'upstream_error' },
          });
        }

        // SSE passthrough
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        const reader = upstream.body?.getReader();
        if (!reader) {
          return res.status(502).json({ error: { message: 'No response body from provider', type: 'upstream_error' } });
        }

        const decoder = new TextDecoder();
        let fullContent = '';
        let usageData: any = null;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            res.write(chunk);

            // Parse SSE chunks to accumulate content and usage
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                try {
                  const data = JSON.parse(line.slice(6));
                  const delta = data.choices?.[0]?.delta?.content;
                  if (delta) fullContent += delta;
                  if (data.usage) usageData = data.usage;
                } catch {
                  // Not all lines are valid JSON
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        res.end();

        // Record telemetry after stream ends
        const latency = Date.now() - startTime;
        const promptTokens = usageData?.prompt_tokens || 0;
        const completionTokens = usageData?.completion_tokens || 0;
        const totalTokens = usageData?.total_tokens || promptTokens + completionTokens;
        const cost = calculateCost(finalModel, promptTokens, completionTokens);

        recordTelemetry(organizationId, {
          provider,
          model: finalModel,
          promptTokens,
          completionTokens,
          totalTokens,
          cost,
          latency,
          status: 'success',
          originalModel: routingMeta.wasRouted ? originalModel : undefined,
          routedModel: routingMeta.wasRouted ? finalModel : undefined,
          compressionApplied: compressionMeta.applied || undefined,
          originalTokens: compressionMeta.applied ? compressionMeta.originalTokens : undefined,
          compressedTokens: compressionMeta.applied ? compressionMeta.compressedTokens : undefined,
          tokensSaved: compressionMeta.applied ? compressionMeta.tokensSaved : undefined,
          traceId: agentContext.traceId,
          agentName: agentContext.agentName,
          workflowId: agentContext.workflowId,
          workflowStep: agentContext.workflowStep,
          parentAgentId: agentContext.parentAgentId,
        });

        if (agentContext.agentId) {
          db.insert(agentTraces).values({
            organizationId,
            clientId: client.id,
            traceId: agentContext.traceId,
            agentId: agentContext.agentId,
            agentName: agentContext.agentName,
            parentAgentId: agentContext.parentAgentId,
            workflowId: agentContext.workflowId,
            workflowStep: agentContext.workflowStep,
            model: finalModel,
            provider,
            inputTokens: promptTokens,
            outputTokens: completionTokens,
            costUsd: String(cost),
            latencyMs: latency,
            status: 'success',
            startedAt: new Date(startTime),
            completedAt: new Date(),
          }).catch((err: Error) => console.error('[Gateway] Failed to write agent trace:', err.message));
        }

        // Cache store for streaming (fire-and-forget)
        if (fullContent) {
          SemanticCacheService.store(client.id, promptText, fullContent, finalModel, totalTokens, cost).catch(() => {});
        }

        return;
      } catch (err) {
        const latency = Date.now() - startTime;
        recordTelemetry(organizationId, {
          provider,
          model: finalModel,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
          latency,
          status: 'error',
          error: (err as Error).message,
        });

        if (!res.headersSent) {
          return res.status(502).json({
            error: { message: (err as Error).message, type: 'upstream_error' },
          });
        }
        return;
      }
    }

    // ── 6b. Non-streaming ──────────────────────────────
    let upstream: globalThis.Response;
    try {
      upstream = await proxyRequest(providerUrl, providerHeaders, proxyBody);
    } catch (err) {
      // Try fallback provider
      const fallbackProvider = PROVIDER_FALLBACKS[provider];
      if (fallbackProvider) {
        let fallbackKey = await getUserApiKey(organizationId, fallbackProvider);
        if (!fallbackKey) fallbackKey = getEnvApiKey(fallbackProvider);

        if (fallbackKey) {
          const fbModel = FALLBACK_MODELS[fallbackProvider]!;
          const fbUrl = buildProviderUrl(fallbackProvider, fallbackKey);
          const fbHeaders = buildProviderHeaders(fallbackProvider, fallbackKey);
          const fbBody = { ...body, model: fbModel, stream: false };

          try {
            upstream = await proxyRequest(fbUrl, fbHeaders, fbBody);
            // Mark as fallback for telemetry below
            routingMeta = {
              model: fbModel,
              wasRouted: true,
              complexity: routingMeta.complexity,
            };
          } catch (fbErr) {
            const latency = Date.now() - startTime;
            recordTelemetry(organizationId, {
              provider,
              model: finalModel,
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              cost: 0,
              latency,
              status: 'error',
              error: (err as Error).message,
              fallbackUsed: true,
            });
            return res.status(502).json({
              error: { message: `Provider ${provider} failed and fallback ${fallbackProvider} also failed`, type: 'upstream_error' },
            });
          }
        } else {
          const latency = Date.now() - startTime;
          recordTelemetry(organizationId, {
            provider,
            model: finalModel,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            cost: 0,
            latency,
            status: 'error',
            error: (err as Error).message,
          });
          return res.status(502).json({
            error: { message: (err as Error).message, type: 'upstream_error' },
          });
        }
      } else {
        const latency = Date.now() - startTime;
        recordTelemetry(organizationId, {
          provider,
          model: finalModel,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
          latency,
          status: 'error',
          error: (err as Error).message,
        });
        return res.status(502).json({
          error: { message: (err as Error).message, type: 'upstream_error' },
        });
      }
    }

    // ── 7. Parse upstream response ─────────────────────
    const latency = Date.now() - startTime;

    if (!upstream!.ok) {
      const errText = await upstream!.text();
      recordTelemetry(organizationId, {
        provider,
        model: routingMeta.model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
        latency,
        status: 'error',
        error: `${upstream!.status}: ${errText.slice(0, 500)}`,
        originalModel: routingMeta.wasRouted ? originalModel : undefined,
        routedModel: routingMeta.wasRouted ? routingMeta.model : undefined,
      });
      // Pass through the provider's error exactly
      return res.status(upstream!.status).type('json').send(errText);
    }

    let responseBody: any;
    try {
      responseBody = await upstream!.json();
    } catch {
      return res.status(502).json({
        error: { message: 'Invalid JSON from upstream provider', type: 'upstream_error' },
      });
    }

    // ── 8. Extract usage & record telemetry ────────────
    const usage = responseBody.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || promptTokens + completionTokens;
    const cost = calculateCost(routingMeta.model, promptTokens, completionTokens);

    // Fire-and-forget telemetry
    recordTelemetry(organizationId, {
      provider,
      model: routingMeta.model,
      promptTokens,
      completionTokens,
      totalTokens,
      cost,
      latency,
      status: 'success',
      originalModel: routingMeta.wasRouted ? originalModel : undefined,
      routedModel: routingMeta.wasRouted ? routingMeta.model : undefined,
      fallbackUsed: routingMeta.wasRouted && provider !== detectProvider(originalModel) ? true : undefined,
      compressionApplied: compressionMeta.applied || undefined,
      originalTokens: compressionMeta.applied ? compressionMeta.originalTokens : undefined,
      compressedTokens: compressionMeta.applied ? compressionMeta.compressedTokens : undefined,
      tokensSaved: compressionMeta.applied ? compressionMeta.tokensSaved : undefined,
      traceId: agentContext.traceId,
      agentName: agentContext.agentName,
      workflowId: agentContext.workflowId,
      workflowStep: agentContext.workflowStep,
      parentAgentId: agentContext.parentAgentId,
    });

    if (agentContext.agentId) {
      db.insert(agentTraces).values({
        organizationId,
        clientId: client.id,
        traceId: agentContext.traceId,
        agentId: agentContext.agentId,
        agentName: agentContext.agentName,
        parentAgentId: agentContext.parentAgentId,
        workflowId: agentContext.workflowId,
        workflowStep: agentContext.workflowStep,
        model: routingMeta.model,
        provider,
        inputTokens: promptTokens,
        outputTokens: completionTokens,
        costUsd: String(cost),
        latencyMs: latency,
        status: 'success',
        startedAt: new Date(startTime),
        completedAt: new Date(),
      }).catch((err: Error) => console.error('[Gateway] Failed to write agent trace:', err.message));
    }

    // ── 9. Cache store (fire-and-forget) ───────────────
    const responseText = responseBody.choices?.[0]?.message?.content;
    if (responseText) {
      SemanticCacheService.store(client.id, promptText, responseText, routingMeta.model, totalTokens, cost).catch(() => {});
    }

    // ── 10. Respond ────────────────────────────────────
    // Inject gateway metadata
    responseBody._aethermind = {
      latency,
      cached: false,
      routed: routingMeta.wasRouted,
      routedModel: routingMeta.wasRouted ? routingMeta.model : undefined,
      compressed: compressionMeta.applied,
    };

    return res.json(responseBody);
  },
);

// ═══════════════════════════════════════════════════════════
// POST /gateway/v1/messages — Anthropic-compatible proxy
// ═══════════════════════════════════════════════════════════
router.post(
  '/v1/messages',
  clientAuth,
  async (req: Request, res: Response) => {
    const clientReq = req as ClientAuthenticatedRequest;
    const client = clientReq.client;
    if (!client || !client.organizationId) {
      return res.status(401).json({ error: { message: 'Unauthorized', type: 'auth_error' } });
    }
    const organizationId = client.organizationId;

    const body = req.body;
    if (!body || !body.model || !body.messages) {
      return res.status(400).json({
        error: { message: 'model and messages are required', type: 'invalid_request_error' },
      });
    }

    const startTime = Date.now();

    // Resolve API key for Anthropic
    let apiKey = await getUserApiKey(organizationId, 'anthropic');
    if (!apiKey) apiKey = getEnvApiKey('anthropic');
    if (!apiKey) {
      return res.status(422).json({
        error: {
          message: 'No API key configured for anthropic. Add it in your dashboard → Settings → API Keys',
          type: 'api_key_missing',
        },
      });
    }

    // Budget check
    try {
      const budget = await evaluateBudgetByOrg(organizationId);
      if (budget && budget.status === 'exceeded') {
        return res.status(429).json({
          error: {
            message: `Budget exceeded: $${budget.spentUsd.toFixed(2)} / $${budget.limitUsd.toFixed(2)}`,
            type: 'budget_exceeded',
          },
        });
      }
    } catch {
      // Non-blocking
    }

    // Proxy to Anthropic
    const isStream = body.stream === true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const upstream = await fetch(`${PROVIDER_URLS.anthropic}/v1/messages`, {
        method: 'POST',
        headers: buildProviderHeaders('anthropic', apiKey),
        body: JSON.stringify({ ...body, stream: isStream }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (isStream) {
        if (!upstream.ok) {
          const errText = await upstream.text();
          return res.status(upstream.status).type('json').send(errText);
        }
        // SSE passthrough
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = upstream.body?.getReader();
        if (!reader) {
          return res.status(502).json({ error: { message: 'No response body', type: 'upstream_error' } });
        }

        const decoder = new TextDecoder();
        let totalInput = 0;
        let totalOutput = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            res.write(chunk);

            // Parse Anthropic SSE for usage
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.usage) {
                    totalInput = data.usage.input_tokens || totalInput;
                    totalOutput = data.usage.output_tokens || totalOutput;
                  }
                } catch { /* skip */ }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        res.end();

        const latency = Date.now() - startTime;
        const cost = calculateCost(body.model, totalInput, totalOutput);
        recordTelemetry(organizationId, {
          provider: 'anthropic',
          model: body.model,
          promptTokens: totalInput,
          completionTokens: totalOutput,
          totalTokens: totalInput + totalOutput,
          cost,
          latency,
          status: 'success',
        });
        return;
      }

      // Non-streaming
      if (!upstream.ok) {
        const errText = await upstream.text();
        const latency = Date.now() - startTime;
        recordTelemetry(organizationId, {
          provider: 'anthropic',
          model: body.model,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
          latency,
          status: 'error',
          error: `${upstream.status}: ${errText.slice(0, 500)}`,
        });
        return res.status(upstream.status).type('json').send(errText);
      }

      const responseBody = await upstream.json() as any;
      const latency = Date.now() - startTime;
      const inputTokens = responseBody.usage?.input_tokens || 0;
      const outputTokens = responseBody.usage?.output_tokens || 0;
      const cost = calculateCost(body.model, inputTokens, outputTokens);

      recordTelemetry(organizationId, {
        provider: 'anthropic',
        model: body.model,
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
        cost,
        latency,
        status: 'success',
      });

      return res.json(responseBody);
    } catch (err) {
      clearTimeout(timeout);
      const latency = Date.now() - startTime;
      recordTelemetry(organizationId, {
        provider: 'anthropic',
        model: body.model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
        latency,
        status: 'error',
        error: (err as Error).message,
      });
      return res.status(502).json({
        error: { message: (err as Error).message, type: 'upstream_error' },
      });
    }
  },
);

// ═══════════════════════════════════════════════════════════
// POST /gateway/v1/models — List available models
// ═══════════════════════════════════════════════════════════
router.get(
  '/v1/models',
  clientAuth,
  async (_req: Request, res: Response) => {
    const models = [
      // OpenAI
      { id: 'gpt-4o', provider: 'openai' },
      { id: 'gpt-4o-mini', provider: 'openai' },
      { id: 'gpt-4-turbo', provider: 'openai' },
      { id: 'gpt-3.5-turbo', provider: 'openai' },
      { id: 'o1-preview', provider: 'openai' },
      { id: 'o1-mini', provider: 'openai' },
      // Anthropic
      { id: 'claude-3-5-sonnet-20241022', provider: 'anthropic' },
      { id: 'claude-3-opus-20240229', provider: 'anthropic' },
      { id: 'claude-3-haiku-20240307', provider: 'anthropic' },
      // Gemini
      { id: 'gemini-2.0-flash', provider: 'gemini' },
      { id: 'gemini-1.5-pro', provider: 'gemini' },
      { id: 'gemini-1.5-flash', provider: 'gemini' },
    ];

    return res.json({
      object: 'list',
      data: models.map((m) => ({
        id: m.id,
        object: 'model',
        created: 1700000000,
        owned_by: m.provider,
      })),
    });
  },
);

// ═══════════════════════════════════════════════════════════
// GET /gateway/v1/health — Provider health status
// ═══════════════════════════════════════════════════════════
router.get(
  '/v1/health',
  clientAuth,
  async (_req: Request, res: Response) => {
    try {
      const rows = await db.select().from(providerHealth);
      return res.json({
        status: 'ok',
        providers: rows.map((r) => ({
          provider: r.provider,
          status: r.status,
          latencyMs: r.latencyMs,
          lastCheckedAt: r.lastCheckedAt,
        })),
      });
    } catch (err) {
      return res.status(500).json({
        status: 'error',
        error: (err as Error).message,
      });
    }
  },
);

export default router;
