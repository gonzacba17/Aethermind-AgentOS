import 'dotenv/config';
import { initSentry, Sentry } from './lib/sentry';

initSentry();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { createRuntime, createOrchestrator, createWorkflowEngine, createOpenAIProvider, createAnthropicProvider, createConfigWatcher, TaskQueueService } from '@aethermind/core';
import { agentRoutes } from './routes/agents';
import { executionRoutes } from './routes/executions';
import { logRoutes } from './routes/logs';
import { traceRoutes } from './routes/traces';
import { costRoutes } from './routes/costs';
import { workflowRoutes } from './routes/workflows';
import authRoutes from './routes/auth';
import { WebSocketManager } from './websocket/WebSocketManager';
import { InMemoryStore } from './services/InMemoryStore';
import { PrismaStore } from './services/PrismaStore';
import redisCache, { RedisCache } from './services/RedisCache';
import type { StoreInterface } from './services/PostgresStore';
import { authMiddleware, configureAuth, verifyApiKey } from './middleware/auth';
import { sanitizeLog, sanitizeObject } from './utils/sanitizer';
import {
  CORS_ORIGINS,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  REQUEST_BODY_LIMIT,
  DEFAULT_PORT,
  REDIS_URL,
  QUEUE_CONCURRENCY,
  CONFIG_WATCHER_DEBOUNCE_MS,
} from './config/constants';



if (process.env['NODE_ENV'] === 'production' && !process.env['API_KEY_HASH']) {
  console.error('FATAL: API_KEY_HASH must be configured in production');
  console.error('Generate one with: pnpm generate-api-key');
  process.exit(1);
}

const authCache = redisCache;

console.log(`\n🔧 Initializing Aethermind API...`);
console.log(`Cache status: ${authCache.isAvailable() ? '✅ Redis connected' : '⚠️  Redis unavailable (using fallback)'}`);

configureAuth({
  apiKeyHash: process.env['API_KEY_HASH'],
  enabled: process.env['NODE_ENV'] === 'production' || !!process.env['API_KEY_HASH'],
  cache: authCache,
});

const corsOptions: cors.CorsOptions = {
  origin: CORS_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
};

const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: { error: 'Too many requests', message: 'Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const app = express();

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const runtime = createRuntime();

let queueService: TaskQueueService | null = null;

// Redis/Queue is completely disabled for now
console.log('ℹ️ Redis/Queue functionality is disabled - using in-memory processing');
queueService = null;

const orchestrator = createOrchestrator(runtime, queueService ?? null);
const workflowEngine = createWorkflowEngine(orchestrator);
const wsManager = new WebSocketManager(wss, verifyApiKey);

let store: StoreInterface;
let prismaStore: PrismaStore | null = null;

async function initializeCache(): Promise<void> {
  if (authCache.isConnected()) {
    console.log('✅ Redis cache connected for auth optimization');
  } else {
    console.log('ℹ️ Redis cache not configured - auth will use bcrypt on every request');
  }
}

async function initializeStore(): Promise<StoreInterface> {
  if (process.env['DATABASE_URL']) {
    try {
      console.log('Attempting to connect to PostgreSQL via Prisma...');
      prismaStore = new PrismaStore();
      const connected = await prismaStore.connect();
      if (connected) {
        console.log('Using Prisma for data persistence');
        return prismaStore;
      }
    } catch (error) {
      console.warn('Failed to connect via Prisma, falling back to InMemoryStore:', error);
    }
  }
  console.log('Using InMemoryStore (data will not persist across restarts)');
  return new InMemoryStore();
}

async function startServer(): Promise<void> {
  await initializeCache();
  store = await initializeStore();

  if (process.env['OPENAI_API_KEY']) {
    const openaiProvider = createOpenAIProvider(process.env['OPENAI_API_KEY']);
    runtime.setDefaultProvider(openaiProvider);
    console.log('OpenAI provider configured');
  }

  if (process.env['ANTHROPIC_API_KEY']) {
    const anthropicProvider = createAnthropicProvider(process.env['ANTHROPIC_API_KEY']);
    runtime.registerProvider('anthropic', anthropicProvider);
    console.log('Anthropic provider configured');
  }

  runtime.getEmitter().on('agent:event', (event) => {
    wsManager.broadcast('agent:event', event);
  });

  runtime.getEmitter().on('log', (entry) => {
    const sanitizedEntry = {
      ...entry,
      message: sanitizeLog(entry.message),
      metadata: entry.metadata ? sanitizeObject(entry.metadata) : undefined
    };
    void store.addLog(sanitizedEntry);
    wsManager.broadcast('log', sanitizedEntry);
  });

  runtime.getEmitter().on('workflow:started', (event) => {
    wsManager.broadcast('workflow:started', event);
  });

  runtime.getEmitter().on('workflow:completed', (event) => {
    wsManager.broadcast('workflow:completed', event);
  });

  runtime.getEmitter().on('workflow:failed', (event) => {
    wsManager.broadcast('workflow:failed', event);
  });

  console.log('[Hot Reload] Feature deprecated - use API to update agents');

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        connectSrc: ["'self'", "ws:", "wss:"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
      useDefaults: false,
    },
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    noSniff: true,
    xssFilter: true,
    hidePoweredBy: true,
  }));
  app.use(cors(corsOptions));
  app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
  app.use(limiter);

  app.get('/api/openapi', (_req, res) => {
    res.sendFile('/docs/openapi.yaml', { root: process.cwd() });
  });

  app.use('/api/auth', authRoutes);

  app.use('/api', authMiddleware);

  app.use((req, _res, next) => {
    req.runtime = runtime;
    req.orchestrator = orchestrator;
    req.workflowEngine = workflowEngine;
    req.store = store;
    req.wsManager = wsManager;
    req.cache = authCache;
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      storage: prismaStore?.isConnected() ? 'prisma' : 'memory',
      redis: authCache.isConnected() ? 'connected' : 'disconnected',
      queue: queueService ? 'enabled' : 'disabled',
      authenticated: true,
    });
  });

  app.use('/api/agents', agentRoutes);
  app.use('/api/executions', executionRoutes);
  app.use('/api/logs', logRoutes);
  app.use('/api/traces', traceRoutes);
  app.use('/api/costs', costRoutes);
  app.use('/api/workflows', workflowRoutes);

  app.use(Sentry.Handlers.errorHandler());

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const isProduction = process.env['NODE_ENV'] === 'production';

    if (!isProduction) {
      console.error('Error:', err);
    } else {
      console.error('Error:', err.message);
    }

    const isAethermindError = 'code' in err && 'suggestion' in err;

    if (isAethermindError) {
      const aethermindErr = err as { code: string; suggestion: string; message: string };
      res.status(500).json({
        error: err.name || 'AethermindError',
        code: aethermindErr.code,
        message: aethermindErr.message,
        suggestion: aethermindErr.suggestion,
      });
    } else {
      const errorMessage = isProduction ? 'An internal error occurred' : err.message;
      res.status(500).json({
        error: 'Internal Server Error',
        message: errorMessage,
      });
    }
  });

  const PORT = DEFAULT_PORT;

  server.listen(PORT, () => {
    console.log(`\n✅ Aethermind API server running on port ${PORT}`);
    console.log(`WebSocket server: ws://localhost:${PORT}/ws`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`Storage: ${prismaStore?.isConnected() ? 'Prisma' : 'InMemory'}`);
    console.log(`Redis: ${authCache.isConnected() ? 'Connected' : 'Disconnected'}`);
    console.log(`Queue: ${queueService ? 'Enabled' : 'Disabled'}`);
    console.log(`Auth: ${process.env['API_KEY_HASH'] ? 'Enabled' : 'Disabled (set API_KEY_HASH to enable)'}\n`);
  });
}

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  try {
    await orchestrator.shutdown();
  } catch (error) {
    console.warn('⚠️ Error during orchestrator shutdown:', (error as Error).message);
  }
  if (prismaStore) {
    await prismaStore.close();
  }
  try {
    await authCache.close();
  } catch (error) {
    console.warn('⚠️ Error closing auth cache:', (error as Error).message);
  }
  server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down...');
  try {
    await orchestrator.shutdown();
  } catch (error) {
    console.warn('⚠️ Error during orchestrator shutdown:', (error as Error).message);
  }
  if (prismaStore) {
    await prismaStore.close();
  }
  try {
    await authCache.close();
  } catch (error) {
    console.warn('⚠️ Error closing auth cache:', (error as Error).message);
  }
  server.close();
  process.exit(0);
});

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

declare global {
  namespace Express {
    interface Request {
      runtime: typeof runtime;
      orchestrator: typeof orchestrator;
      workflowEngine: typeof workflowEngine;
      store: StoreInterface;
      wsManager: WebSocketManager;
      cache: RedisCache;
    }
  }
}
