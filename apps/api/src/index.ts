import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { createRuntime, createOrchestrator, createWorkflowEngine, createOpenAIProvider, createAnthropicProvider, createConfigWatcher, TaskQueueService } from '@aethermind/core';
import { agentRoutes } from './routes/agents.js';
import { executionRoutes } from './routes/executions.js';
import { logRoutes } from './routes/logs.js';
import { traceRoutes } from './routes/traces.js';
import { costRoutes } from './routes/costs.js';
import { workflowRoutes } from './routes/workflows.js';
import { WebSocketManager } from './websocket/WebSocketManager.js';
import { InMemoryStore } from './services/InMemoryStore.js';
import { PrismaStore } from './services/PrismaStore.js';
import { RedisCache } from './services/RedisCache.js';
import type { StoreInterface } from './services/PostgresStore.js';
import { authMiddleware, configureAuth, verifyApiKey } from './middleware/auth.js';
import { sanitizeLog, sanitizeObject } from './utils/sanitizer.js';
import {
  CORS_ORIGINS,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  REQUEST_BODY_LIMIT,
  DEFAULT_PORT,
  REDIS_URL,
  QUEUE_CONCURRENCY,
  CONFIG_WATCHER_DEBOUNCE_MS,
} from './config/constants.js';



if (process.env['NODE_ENV'] === 'production' && !process.env['API_KEY_HASH']) {
  console.error('FATAL: API_KEY_HASH must be configured in production');
  console.error('Generate one with: pnpm generate-api-key');
  process.exit(1);
}

const authCache = new RedisCache(REDIS_URL, 'auth');

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
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const runtime = createRuntime();

// Initialize TaskQueueService with Redis
const queueService = new TaskQueueService({ redisUrl: REDIS_URL, concurrency: QUEUE_CONCURRENCY });

const orchestrator = createOrchestrator(runtime, queueService);
const workflowEngine = createWorkflowEngine(orchestrator);
const wsManager = new WebSocketManager(wss, verifyApiKey);

let store: StoreInterface;
let prismaStore: PrismaStore | null = null;

async function initializeCache(): Promise<void> {
  if (authCache.isEnabled()) {
    const connected = await authCache.connect();
    if (connected) {
      console.log('Redis cache connected for auth optimization');
    } else {
      console.warn('Redis cache disabled - auth will use bcrypt on every request');
    }
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

  // Hot reload setup
  const enableHotReload = process.env['ENABLE_HOT_RELOAD'] !== 'false' && process.env['NODE_ENV'] !== 'production';

  if (enableHotReload) {
    const configWatcher = createConfigWatcher({
      watchPath: process.cwd() + '/config/agents',
      patterns: ['**/*.json'],
      debounceMs: CONFIG_WATCHER_DEBOUNCE_MS,
    });

    configWatcher.on('config:change', async (event) => {
      console.log(`[Hot Reload] Config changed: ${event.path}`);
      wsManager.broadcast('config:change', event);

      // TODO: Implement actual agent reload logic
      // This would require parsing the config file and calling runtime.reloadAgent()
    });

    configWatcher.on('error', (error) => {
      console.error('[Hot Reload] Error:', error);
    });

    configWatcher.start();
    console.log('[Hot Reload] Enabled - watching for config changes');

    // Broadcast reload events
    runtime.getEmitter().on('agent:reloaded', (event) => {
      wsManager.broadcast('agent:reloaded', event);
    });

    runtime.getEmitter().on('agent:reload-failed', (event) => {
      wsManager.broadcast('agent:reload-failed', event);
    });
  } else {
    console.log('[Hot Reload] Disabled');
  }

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", "ws:", "wss:"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cors(corsOptions));
  app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
  app.use(limiter);

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      storage: prismaStore?.isConnected() ? 'prisma' : 'memory',
    });
  });

  app.use('/api', authMiddleware);

  app.use((req, _res, next) => {
    req.runtime = runtime;
    req.orchestrator = orchestrator;
    req.workflowEngine = workflowEngine;
    req.store = store;
    req.wsManager = wsManager;
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      storage: prismaStore?.isConnected() ? 'prisma' : 'memory',
      authenticated: true,
    });
  });

  app.use('/api/agents', agentRoutes);
  app.use('/api/executions', executionRoutes);
  app.use('/api/logs', logRoutes);
  app.use('/api/traces', traceRoutes);
  app.use('/api/costs', costRoutes);
  app.use('/api/workflows', workflowRoutes);

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Error:', err);

    const isProduction = process.env['NODE_ENV'] === 'production';

    // Check if it's an AethermindError with code and suggestion
    const isAethermindError = 'code' in err && 'suggestion' in err;

    if (isAethermindError) {
      const aethermindErr = err as { code: string; suggestion: string; message: string };
      res.status(500).json({
        error: err.name || 'AethermindError',
        code: aethermindErr.code,
        message: aethermindErr.message,
        suggestion: aethermindErr.suggestion,
        ...(isProduction ? {} : { stack: err.stack }),
      });
    } else {
      const errorMessage = isProduction ? 'An internal error occurred' : err.message;
      res.status(500).json({
        error: 'Internal Server Error',
        message: errorMessage,
        ...(isProduction ? {} : { stack: err.stack }),
      });
    }
  });

  const PORT = DEFAULT_PORT;

  server.listen(PORT, () => {
    console.log(`\nAethermind API server running on port ${PORT}`);
    console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Storage: ${prismaStore?.isConnected() ? 'Prisma' : 'InMemory'}`);
    console.log(`Auth: ${process.env['API_KEY_HASH'] ? 'Enabled' : 'Disabled (set API_KEY_HASH to enable)'}\n`);
  });
}

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await orchestrator.shutdown();
  if (prismaStore) {
    await prismaStore.close();
  }
  await authCache.close();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down...');
  await orchestrator.shutdown();
  if (prismaStore) {
    await prismaStore.close();
  }
  await authCache.close();
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
    }
  }
}
