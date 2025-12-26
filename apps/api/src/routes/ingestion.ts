import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { apiKeyAuthCached } from '../middleware/apiKeyAuth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = Router();
const prisma = new PrismaClient();

/**
 * Telemetry event schema (matches SDK)
 */
const TelemetryEventSchema = z.object({
  timestamp: z.string().datetime(),
  provider: z.enum(['openai', 'anthropic']),
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
  apiKeyAuthCached,
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
        // Events lost - could implement dead letter queue in future
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
    cost: event.cost,
    latency: event.latency,
    status: event.status,
    error: event.error,
  }));

  // Bulk insert
  await prisma.telemetryEvent.createMany({
    data,
    skipDuplicates: true,
  });

  console.log(`[Ingestion] Stored ${data.length} events for org ${organizationId}`);
}

export default router;
