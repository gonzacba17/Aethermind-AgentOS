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
  organizations,
} from '../db/schema.js';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { clientAuth, type ClientAuthenticatedRequest } from '../middleware/clientAuth.js';
import { evaluateBudgetByOrg } from '../services/ClientBudgetService.js';
import * as SemanticCacheService from '../services/SemanticCacheService.js';
import { analyze as analyzePrompt } from '../services/PromptAnalyzer.js';

const router = Router();

// ─── Trial constants ────────────────────────────────────────
const TRIAL_DURATION_DAYS = 14;
const TRIAL_WARNING_DAYS = 3;

/** Check trial status for an organization. Returns null if no restriction. */
async function checkTrialStatus(organizationId: string): Promise<{
  expired: boolean;
  daysRemaining: number | null;
} | null> {
  try {
    const [org] = await db
      .select({ plan: organizations.plan, createdAt: organizations.createdAt })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    if (!org) return null;

    const plan = (org.plan || 'FREE').toLowerCase();
    if (plan !== 'free' && plan !== 'trial') return null;

    const createdAt = new Date(org.createdAt);
    const now = new Date();
    const elapsedMs = now.getTime() - createdAt.getTime();
    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
    const daysRemaining = Math.max(0, Math.ceil(TRIAL_DURATION_DAYS - elapsedDays));

    return {
      expired: elapsedDays > TRIAL_DURATION_DAYS,
      daysRemaining,
    };
  } catch {
    return null; // Non-blocking on error
  }
}

// ─── Provider URLs ──────────────────────────────────────────
const PROVIDER_URLS: Record<string, string> = {
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com',
  groq: 'https://api.groq.com/openai',
  lmstudio: process.env.LMSTUDIO_BASE_URL || 'https://conscientious-bertram-gangliate.ngrok-free.dev',
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
  const m = model.toLowerCase();
  let provider: string;
  if (m.startsWith('gpt-') || m.startsWith('o1-') || m.startsWith('o3-')) provider = 'openai';
  else if (m.startsWith('claude-')) provider = 'anthropic';
  else if (m.startsWith('gemini-')) provider = 'gemini';
  else if (m.startsWith('llama-') || m.startsWith('llama3') || m.startsWith('mixtral-')) provider = 'groq';
  else if (m.includes('qwen') || m.includes('lmstudio')) provider = 'lmstudio';
  // Default to openai for unknown models (OpenAI-compatible endpoint)
  else provider = 'openai';
  console.log(`[Gateway] detectProvider: ${model} → ${provider}`);
  return provider;
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
  // Groq
  'llama-3.3-70b-versatile': { input: 0.00059, output: 0.00079 },
  'llama-3.1-8b-instant': { input: 0.00005, output: 0.00008 },
  'mixtral-8x7b-32768': { input: 0.00024, output: 0.00024 },
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
  // LM Studio doesn't require authentication — return a fake key
  if (provider === 'lmstudio') return 'lm-studio';

  // Normalize: keys may be stored as 'google' or 'gemini' depending on the source
  const providerAliases: Record<string, string[]> = {
    gemini: ['gemini', 'google'],
    google: ['gemini', 'google'],
  };
  const providers = providerAliases[provider] ?? [provider];

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
        inArray(userApiKeys.provider, providers),
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
    groq: 'GROQ_API_KEY',
    lmstudio: '', // LM Studio doesn't need an API key
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
    environment?: string;
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
      environment: data.environment,
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
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (provider === 'groq') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (provider === 'lmstudio') {
    headers['Authorization'] = 'Bearer lm-studio';
  }
  console.log(`[Gateway] buildProviderHeaders provider=${provider} keys=${Object.keys(headers).join(',')}`);
  return headers;
}

/** Build the upstream URL for a provider */
function buildProviderUrl(provider: string, apiKey: string): string {
  let url: string;
  if (provider === 'openai') {
    url = `${PROVIDER_URLS.openai}/v1/chat/completions`;
  } else if (provider === 'anthropic') {
    url = `${PROVIDER_URLS.anthropic}/v1/messages`;
  } else if (provider === 'gemini') {
    url = `${PROVIDER_URLS.gemini}/v1beta/openai/chat/completions`;
  } else if (provider === 'groq') {
    url = `${PROVIDER_URLS.groq}/v1/chat/completions`;
  } else if (provider === 'lmstudio') {
    url = `${PROVIDER_URLS.lmstudio}/v1/chat/completions`;
  } else {
    url = `${PROVIDER_URLS.openai}/v1/chat/completions`;
  }
  console.log(`[Gateway] buildProviderUrl provider=${provider} url=${url}`);
  return url;
}

// ─── OpenAI ↔ Anthropic format translation ─────────────────

/**
 * Translate an OpenAI /chat/completions request body to Anthropic /v1/messages format.
 * - Extracts system messages into top-level `system` field
 * - Ensures `max_tokens` is set (required by Anthropic)
 * - Strips fields Anthropic doesn't accept
 */
function translateOpenAIToAnthropic(body: any): any {
  const messages: any[] = body.messages || [];
  const systemMessages = messages.filter((m: any) => m.role === 'system');
  const nonSystemMessages = messages.filter((m: any) => m.role !== 'system');
  const systemText = systemMessages.map((m: any) =>
    typeof m.content === 'string' ? m.content : ''
  ).join('\n\n');

  const anthropicBody: any = {
    model: body.model,
    messages: nonSystemMessages,
    max_tokens: body.max_tokens || 4096,
    stream: body.stream ?? false,
  };

  if (systemText) {
    anthropicBody.system = systemText;
  }

  // Pass through supported optional params
  if (body.temperature != null) anthropicBody.temperature = body.temperature;
  if (body.top_p != null) anthropicBody.top_p = body.top_p;
  if (body.stop) anthropicBody.stop_sequences = Array.isArray(body.stop) ? body.stop : [body.stop];
  if (body.metadata) anthropicBody.metadata = body.metadata;

  return anthropicBody;
}

/**
 * Translate an Anthropic /v1/messages response to OpenAI /chat/completions format.
 */
function translateAnthropicResponseToOpenAI(anthropicRes: any): any {
  const content = (anthropicRes.content || [])
    .filter((c: any) => c.type === 'text')
    .map((c: any) => c.text)
    .join('');

  const inputTokens = anthropicRes.usage?.input_tokens || 0;
  const outputTokens = anthropicRes.usage?.output_tokens || 0;

  return {
    id: anthropicRes.id || `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: anthropicRes.model,
    choices: [{
      index: 0,
      message: { role: 'assistant', content },
      finish_reason: anthropicRes.stop_reason === 'end_turn' ? 'stop'
        : anthropicRes.stop_reason === 'max_tokens' ? 'length'
        : anthropicRes.stop_reason || 'stop',
    }],
    usage: {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    },
  };
}

/**
 * Translate Anthropic SSE stream to OpenAI-compatible SSE stream.
 * Anthropic events: message_start, content_block_delta, message_delta, message_stop
 * OpenAI events: data: {choices: [{delta: {content, role}}]}
 */
function translateAnthropicStreamChunk(line: string): { openAIChunk: string | null; inputTokens: number; outputTokens: number } {
  let inputTokens = 0;
  let outputTokens = 0;

  if (!line.startsWith('data: ')) return { openAIChunk: null, inputTokens, outputTokens };

  const raw = line.slice(6).trim();
  if (!raw || raw === '[DONE]') return { openAIChunk: null, inputTokens, outputTokens };

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return { openAIChunk: null, inputTokens, outputTokens };
  }

  const type = data.type;

  if (type === 'message_start') {
    // Extract usage from message_start if present
    inputTokens = data.message?.usage?.input_tokens || 0;
    const openAI = {
      id: data.message?.id || `chatcmpl-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: data.message?.model || '',
      choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
    };
    return { openAIChunk: `data: ${JSON.stringify(openAI)}\n\n`, inputTokens, outputTokens };
  }

  if (type === 'content_block_delta' && data.delta?.type === 'text_delta') {
    const openAI = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: '',
      choices: [{ index: 0, delta: { content: data.delta.text }, finish_reason: null }],
    };
    return { openAIChunk: `data: ${JSON.stringify(openAI)}\n\n`, inputTokens, outputTokens };
  }

  if (type === 'message_delta') {
    outputTokens = data.usage?.output_tokens || 0;
    const finishReason = data.delta?.stop_reason === 'end_turn' ? 'stop'
      : data.delta?.stop_reason === 'max_tokens' ? 'length'
      : data.delta?.stop_reason || null;
    const openAI = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: '',
      choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
    };
    return { openAIChunk: `data: ${JSON.stringify(openAI)}\n\n`, inputTokens, outputTokens };
  }

  if (type === 'message_stop') {
    return { openAIChunk: 'data: [DONE]\n\n', inputTokens, outputTokens };
  }

  return { openAIChunk: null, inputTokens, outputTokens };
}

// ─── Provider fallback map ──────────────────────────────────
const PROVIDER_FALLBACKS: Record<string, string | null> = {
  openai: 'anthropic',
  anthropic: 'openai',
  gemini: 'openai',
  groq: 'openai',
  lmstudio: 'openai',
};

// Map a model to the fallback provider's default model
const FALLBACK_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  gemini: 'gemini-2.0-flash',
  groq: 'llama-3.3-70b-versatile',
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

    // ── 0. Trial enforcement ────────────────────────────
    const trial = await checkTrialStatus(organizationId);
    if (trial?.expired) {
      return res.status(402).json({
        error: {
          message: 'Trial expired. Upgrade your plan to continue.',
          type: 'trial_expired',
          upgradeUrl: '/settings/billing',
        },
      });
    }
    if (trial && trial.daysRemaining !== null && trial.daysRemaining <= TRIAL_WARNING_DAYS) {
      res.setHeader('X-Trial-Days-Remaining', String(trial.daysRemaining));
    }

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
      environment: (req.headers['x-environment'] as string) || 'production',
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
    const isAnthropic = provider === 'anthropic';
    const proxyBody = isAnthropic
      ? translateOpenAIToAnthropic({ ...body, model: finalModel, stream: isStream })
      : { ...body, model: finalModel, stream: isStream };
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

            if (isAnthropic) {
              // Translate Anthropic SSE → OpenAI SSE before sending to client
              const lines = chunk.split('\n');
              for (const line of lines) {
                const { openAIChunk, inputTokens, outputTokens } = translateAnthropicStreamChunk(line);
                if (openAIChunk) res.write(openAIChunk);
                if (inputTokens) {
                  usageData = { prompt_tokens: inputTokens, completion_tokens: 0, total_tokens: 0 };
                }
                if (outputTokens) {
                  usageData = {
                    ...usageData,
                    prompt_tokens: usageData?.prompt_tokens || 0,
                    completion_tokens: outputTokens,
                    total_tokens: (usageData?.prompt_tokens || 0) + outputTokens,
                  };
                }
                // Accumulate content for cache/telemetry
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.type === 'content_block_delta' && data.delta?.text) {
                      fullContent += data.delta.text;
                    }
                  } catch { /* skip */ }
                }
              }
            } else {
              // Non-Anthropic: passthrough SSE as-is
              res.write(chunk);
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
          environment: agentContext.environment,
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
            environment: agentContext.environment,
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
      const errMsg = `${upstream!.status}: ${errText.slice(0, 500)}`;
      recordTelemetry(organizationId, {
        provider,
        model: routingMeta.model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
        latency,
        status: 'error',
        error: errMsg,
        originalModel: routingMeta.wasRouted ? originalModel : undefined,
        routedModel: routingMeta.wasRouted ? routingMeta.model : undefined,
        traceId: agentContext.traceId,
        agentName: agentContext.agentName,
        workflowId: agentContext.workflowId,
        workflowStep: agentContext.workflowStep,
        parentAgentId: agentContext.parentAgentId,
      });

      // Also record in agent_traces for error visibility
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
          inputTokens: 0,
          outputTokens: 0,
          costUsd: '0',
          latencyMs: latency,
          status: 'error',
          error: errMsg,
          environment: agentContext.environment,
          startedAt: new Date(startTime),
          completedAt: new Date(),
        }).catch((err: Error) => console.error('[Gateway] Failed to write error agent trace:', err.message));
      }

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

    // ── 8. Translate Anthropic response → OpenAI format ──
    if (isAnthropic) {
      const translated = translateAnthropicResponseToOpenAI(responseBody);
      // Preserve original Anthropic usage for accurate telemetry
      const anthropicUsage = responseBody.usage || {};
      responseBody = translated;
      // Carry original usage through for cost calc
      responseBody._anthropicUsage = anthropicUsage;
    }

    const usage = responseBody._anthropicUsage || responseBody.usage || {};
    const promptTokens = usage.input_tokens || usage.prompt_tokens || 0;
    const completionTokens = usage.output_tokens || usage.completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;
    const cost = calculateCost(routingMeta.model, promptTokens, completionTokens);
    // Clean up internal field before sending to client
    delete responseBody._anthropicUsage;

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

    // Trial enforcement
    const trial = await checkTrialStatus(organizationId);
    if (trial?.expired) {
      return res.status(402).json({
        error: {
          message: 'Trial expired. Upgrade your plan to continue.',
          type: 'trial_expired',
          upgradeUrl: '/settings/billing',
        },
      });
    }
    if (trial && trial.daysRemaining !== null && trial.daysRemaining <= TRIAL_WARNING_DAYS) {
      res.setHeader('X-Trial-Days-Remaining', String(trial.daysRemaining));
    }

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
      // Groq
      { id: 'llama-3.3-70b-versatile', provider: 'groq' },
      { id: 'llama-3.1-8b-instant', provider: 'groq' },
      { id: 'mixtral-8x7b-32768', provider: 'groq' },
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
