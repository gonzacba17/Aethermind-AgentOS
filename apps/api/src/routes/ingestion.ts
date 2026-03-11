import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { telemetryEvents, routingRules, providerHealth, clients } from '../db/schema.js';
import { ingestionAuth } from '../middleware/sdkApiKeyAuth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { evaluateBudgetByOrg } from '../services/ClientBudgetService.js';
import * as SemanticCacheService from '../services/SemanticCacheService.js';
import { eq, and, asc, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { analyze as analyzePrompt } from '../services/PromptAnalyzer.js';
import { db as dbInstance } from '../db/index.js';
import { optimizationSettings, clients as clientsTable } from '../db/schema.js';

const router: Router = Router();

/**
 * Telemetry event schema (matches SDK)
 */
const TelemetryEventSchema = z.object({
  timestamp: z.string().datetime(),
  provider: z.enum(['openai', 'anthropic', 'gemini', 'groq', 'ollama', 'lmstudio']),
  model: z.string(),
  tokens: z.object({
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  }),
  cost: z.number().nonnegative(),
  latency: z.number().int().nonnegative(),
  status: z.enum(['success', 'error']),
  error: z.string().optional(),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  // Phase 2 — routing metadata
  originalModel: z.string().optional(),
  routedModel: z.string().optional(),
  fallbackUsed: z.boolean().optional(),
  providerFallback: z.boolean().optional(),
  fallbackProvider: z.string().optional(),
  // Phase 3 — cache metadata
  cacheHit: z.boolean().optional(),
  cacheSavedUsd: z.number().optional(),
  // Phase 4 — compression metadata
  compressionApplied: z.boolean().optional(),
  originalTokens: z.number().int().nonnegative().optional(),
  compressedTokens: z.number().int().nonnegative().optional(),
  tokensSaved: z.number().int().nonnegative().optional(),
});

/**
 * Batch request schema
 */
const IngestRequestSchema = z.object({
  events: z.array(TelemetryEventSchema).min(1).max(1000),
});

/**
 * Extended request with organization context
 */
interface AuthenticatedRequest extends Request {
  organizationId?: string;
  organization?: {
    id: string;
    plan: string;
    rateLimitPerMin: number;
  };
}

/**
 * POST /v1/ingest
 * 
 * Ingests telemetry events from Aethermind Agent SDK
 * 
 * Authentication: X-API-Key header
 * Rate limiting: Based on organization plan
 * 
 * @returns 202 Accepted (async processing)
 */
router.post(
  '/ingest',
  ingestionAuth,
  rateLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validate request body
    const validation = IngestRequestSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        message: validation.error.issues.map(i => i.message).join(', '),
      });
    }

    const { events } = validation.data;

    // Organization context should be injected by auth middleware
    if (!req.organizationId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing organization context',
      });
    }

    // Store events in database (async - don't wait)
    // Using setImmediate to process in next tick
    setImmediate(async () => {
      try {
        await storeEvents(req.organizationId!, events);
      } catch (error) {
        console.error('[Ingestion] Failed to store events:', error);
        // Write to dead-letter queue for retry
        writeToDeadLetterQueue(req.organizationId!, events, error as Error);
      }
    });

    // Return immediately (202 Accepted)
    res.status(202).json({
      accepted: events.length,
      message: 'Events queued for processing',
    });
  } catch (error) {
    console.error('[Ingestion] Unexpected error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process ingestion request',
    });
  }
});

/**
 * Store events in database
 */
async function storeEvents(
  organizationId: string,
  events: z.infer<typeof TelemetryEventSchema>[]
): Promise<void> {
  // Map SDK events to Prisma schema
  const data = events.map(event => ({
    organizationId,
    timestamp: new Date(event.timestamp),
    provider: event.provider,
    model: event.model,
    promptTokens: event.tokens.promptTokens,
    completionTokens: event.tokens.completionTokens,
    totalTokens: event.tokens.totalTokens,
    cost: event.cost.toString(),
    latency: event.latency,
    status: event.status,
    error: event.error || null,
    agentId: event.agentId || null,
    sessionId: event.sessionId || null,
    // Phase 2 — routing metadata
    originalModel: event.originalModel || null,
    routedModel: event.routedModel || null,
    fallbackUsed: event.fallbackUsed ?? false,
    providerFallback: event.providerFallback ?? false,
    fallbackProvider: event.fallbackProvider || null,
    // Phase 3 — cache metadata
    cacheHit: event.cacheHit ?? false,
    cacheSavedUsd: event.cacheSavedUsd != null ? event.cacheSavedUsd.toString() : null,
    // Phase 4 — compression metadata (all nullable)
    compressionApplied: event.compressionApplied ?? null,
    originalTokens: event.originalTokens ?? null,
    compressedTokens: event.compressedTokens ?? null,
    tokensSaved: event.tokensSaved ?? null,
  }));

  // Bulk insert
  await db.insert(telemetryEvents).values(data).onConflictDoNothing();

  console.log(`[Ingestion] Stored ${data.length} events for org ${organizationId}`);
}

/**
 * GET /v1/ingest/status
 *
 * Returns telemetry connection status for onboarding wizard
 *
 * Authentication: X-API-Key header
 *
 * @returns { connected: boolean, firstEventAt: string | null, totalEvents: number }
 */
router.get(
  '/ingest/status',
  ingestionAuth,
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { organizationId } = req;

    if (!organizationId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing organization context',
      });
    }

    // Get the first event timestamp
    const firstEventResult = await db
      .select({
        timestamp: telemetryEvents.timestamp,
      })
      .from(telemetryEvents)
      .where(eq(telemetryEvents.organizationId, organizationId))
      .orderBy(asc(telemetryEvents.timestamp))
      .limit(1);

    const firstEvent = firstEventResult[0] || null;

    // Count total events
    const countResult = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(telemetryEvents)
      .where(eq(telemetryEvents.organizationId, organizationId));

    const totalEvents = Number(countResult[0]?.count) || 0;

    res.json({
      connected: !!firstEvent,
      firstEventAt: firstEvent?.timestamp?.toISOString() || null,
      totalEvents,
    });
  } catch (error) {
    console.error('[Ingestion] Failed to fetch telemetry status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch telemetry status',
    });
  }
});

/**
 * GET /v1/budget-status
 *
 * Returns budget evaluation for the SDK.
 * Uses the same SDK API key auth as ingestion.
 * The SDK caches this for 60 seconds to minimize latency.
 */
router.get(
  '/budget-status',
  ingestionAuth,
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { organizationId } = req;

    if (!organizationId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing organization context',
      });
    }

    const evaluation = await evaluateBudgetByOrg(organizationId);

    if (!evaluation) {
      // No budget defined — always OK
      return res.json({ status: 'ok', percentUsed: 0, remaining: null, noBudget: true });
    }

    res.json(evaluation);
  } catch (error) {
    console.error('[Budget Status] Error:', error);
    res.status(500).json({ error: 'Failed to evaluate budget' });
  }
});

// ============================================
// SDK-facing routing endpoints (Phase 2)
// ============================================

/**
 * GET /v1/routing/rules
 *
 * Returns routing rules for the SDK.
 * Uses the same SDK API key auth as ingestion.
 * The SDK caches this for 60 seconds.
 */
router.get(
  '/routing/rules',
  ingestionAuth,
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { organizationId } = req;

    if (!organizationId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing organization context',
      });
    }

    // Find the client for this organization
    const clientRows = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.organizationId, organizationId), eq(clients.isActive, true)));

    const client = clientRows[0];
    if (!client) {
      return res.json({ enabled: false, simpleModel: 'gpt-4o-mini', mediumModel: 'gpt-4o-mini', complexModel: 'gpt-4o' });
    }

    const rules = await db
      .select()
      .from(routingRules)
      .where(eq(routingRules.clientId, client.id));

    const rule = rules[0];
    if (!rule) {
      return res.json({ enabled: false, simpleModel: 'gpt-4o-mini', mediumModel: 'gpt-4o-mini', complexModel: 'gpt-4o' });
    }

    res.json({
      enabled: rule.enabled,
      simpleModel: rule.simpleModel,
      mediumModel: rule.mediumModel,
      complexModel: rule.complexModel,
    });
  } catch (error) {
    console.error('[Routing Rules SDK] Error:', error);
    res.status(500).json({ error: 'Failed to fetch routing rules' });
  }
});

/**
 * GET /v1/routing/provider-health
 *
 * Returns provider health status for the SDK.
 * Uses the same SDK API key auth as ingestion.
 */
router.get(
  '/routing/provider-health',
  ingestionAuth,
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { organizationId } = req;

    if (!organizationId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing organization context',
      });
    }

    const healthRows = await db
      .select({
        provider: providerHealth.provider,
        status: providerHealth.status,
        latencyMs: providerHealth.latencyMs,
        lastCheckedAt: providerHealth.lastCheckedAt,
      })
      .from(providerHealth);

    res.json({ providers: healthRows });
  } catch (error) {
    console.error('[Provider Health SDK] Error:', error);
    res.status(500).json({ error: 'Failed to fetch provider health' });
  }
});

// ============================================
// SDK-facing cache endpoints (Phase 3)
// ============================================

/**
 * POST /v1/cache/lookup
 *
 * Look up a cached response for a prompt.
 * Uses the same SDK API key auth as ingestion.
 */
router.post(
  '/cache/lookup',
  ingestionAuth,
  rateLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { organizationId } = req;

    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Missing organization context' });
    }

    const { prompt, model } = req.body;
    if (!prompt || !model) {
      return res.status(400).json({ error: 'prompt and model are required' });
    }

    // Resolve clientId from organization
    const clientRows = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.organizationId, organizationId), eq(clients.isActive, true)));

    const client = clientRows[0];
    if (!client) {
      return res.json({ hit: false });
    }

    const cacheHit = await SemanticCacheService.lookup(client.id, prompt, model);

    if (cacheHit) {
      res.json({
        hit: true,
        response: cacheHit.response,
        cachedAt: cacheHit.cachedAt,
        model: cacheHit.model,
        tokensUsed: cacheHit.tokensUsed,
        costUsd: cacheHit.costUsd,
        similarity: cacheHit.similarity,
      });
    } else {
      res.json({ hit: false });
    }
  } catch (error) {
    console.error('[Cache Lookup] Error:', error);
    res.json({ hit: false });
  }
});

/**
 * POST /v1/cache/store
 *
 * Store a prompt/response pair in the cache.
 * Returns 202 immediately, stores async.
 */
router.post(
  '/cache/store',
  ingestionAuth,
  rateLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { organizationId } = req;

    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Missing organization context' });
    }

    const { prompt, response, model, tokensUsed, costUsd } = req.body;
    if (!prompt || !response || !model) {
      return res.status(400).json({ error: 'prompt, response, and model are required' });
    }

    // Resolve clientId from organization
    const clientRows = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.organizationId, organizationId), eq(clients.isActive, true)));

    const client = clientRows[0];
    if (!client) {
      return res.status(202).json({ stored: false, message: 'No active client found' });
    }

    // Fire-and-forget: return immediately, store async
    res.status(202).json({ stored: true, message: 'Cache entry queued for storage' });

    setImmediate(async () => {
      try {
        await SemanticCacheService.store(
          client.id,
          prompt,
          response,
          model,
          tokensUsed ?? 0,
          costUsd ?? 0
        );
      } catch (error) {
        console.error('[Cache Store] Async store error:', error);
      }
    });
  } catch (error) {
    console.error('[Cache Store] Error:', error);
    res.status(202).json({ stored: false });
  }
});

/**
 * Dead Letter Queue — write failed telemetry events to disk for retry
 */
const DLQ_DIR = path.resolve(process.cwd(), 'failed-events');

function writeToDeadLetterQueue(
  organizationId: string,
  events: z.infer<typeof TelemetryEventSchema>[],
  error: Error
): void {
  try {
    if (!fs.existsSync(DLQ_DIR)) {
      fs.mkdirSync(DLQ_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}_${organizationId.slice(0, 8)}.json`;
    const filepath = path.join(DLQ_DIR, filename);

    const payload = {
      organizationId,
      events,
      error: error.message,
      failedAt: new Date().toISOString(),
      retryCount: 0,
    };

    fs.writeFileSync(filepath, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`[DLQ] Saved ${events.length} failed events to ${filename}`);
  } catch (dlqError) {
    console.error('[DLQ] CRITICAL: Failed to write to dead-letter queue:', dlqError);
    console.error('[DLQ] Lost events:', JSON.stringify(events).slice(0, 200));
  }
}

// ============================================
// SDK-facing optimization endpoints (Phase 4)
// ============================================

/**
 * POST /v1/optimization/analyze
 *
 * Analyze a prompt for compression opportunities.
 * Uses the same SDK API key auth as ingestion.
 * SDK calls this with a 2s timeout — fail-open.
 */
router.post(
  '/optimization/analyze',
  ingestionAuth,
  rateLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { organizationId } = req;

    if (!organizationId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing organization context',
      });
    }

    const { prompt, model } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt is required' });
    }

    // Get optimization settings for this client
    const clientRows = await dbInstance
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(and(eq(clientsTable.organizationId, organizationId), eq(clientsTable.isActive, true)));

    const client = clientRows[0];
    if (!client) {
      return res.json({
        prompt,
        wasCompressed: false,
        originalTokens: 0,
        finalTokens: 0,
        compressionEnabled: false,
        minCompressionRatio: 0.15,
      });
    }

    // Get settings
    const settingsRows = await dbInstance
      .select()
      .from(optimizationSettings)
      .where(eq(optimizationSettings.clientId, client.id))
      .limit(1);

    const settings = settingsRows[0];
    const compressionEnabled = settings?.compressionEnabled ?? false;
    const minCompressionRatio = settings ? parseFloat(settings.minCompressionRatio) : 0.15;

    // Analyze
    const analysis = analyzePrompt(prompt);

    res.json({
      prompt: analysis.compressedPrompt,
      wasCompressed: analysis.compressionRatio < (1 - minCompressionRatio),
      originalTokens: analysis.originalTokens,
      finalTokens: analysis.estimatedCompressedTokens,
      compressionRatio: Math.round(analysis.compressionRatio * 1000) / 1000,
      issues: analysis.issues.length,
      compressionEnabled,
      minCompressionRatio,
    });
  } catch (error) {
    console.error('[Optimization Analyze SDK] Error:', error);
    // Fail-open: return as-is
    res.json({
      prompt: req.body?.prompt || '',
      wasCompressed: false,
      originalTokens: 0,
      finalTokens: 0,
    });
  }
});

// ============================================
// SDK key validation endpoint (used by @aethermind/setup)
// ============================================

/**
 * GET /v1/validate
 *
 * Validates an SDK API key without side effects.
 * Returns the linked organization name so the CLI can greet the user.
 *
 * Authentication: X-API-Key header (aether_sdk_* or aether_*)
 *
 * @returns { valid: true, organization: "..." }
 */
router.get(
  '/validate',
  ingestionAuth,
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { organizationId, organization } = req;

    if (!organizationId) {
      return res.status(401).json({
        valid: false,
        error: 'Missing organization context',
      });
    }

    res.json({
      valid: true,
      organizationId,
      organization: (organization as any)?.name || organizationId,
    });
  } catch (error) {
    console.error('[Validate] Error:', error);
    res.status(500).json({
      valid: false,
      error: 'Validation failed',
    });
  }
});

export default router;
