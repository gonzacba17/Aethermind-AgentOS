import 'dotenv/config';
import { initSentry, Sentry } from './lib/sentry';

initSentry();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
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
import { budgetRoutes } from './routes/budgets';
import ingestionRoutes from './routes/ingestion';
import authRoutes from './routes/auth';
import oauthRoutes from './routes/oauth';
import session from 'express-session';
import passportConfig from './config/passport';
import { WebSocketManager } from './websocket/WebSocketManager';
import { InMemoryStore } from './services/InMemoryStore';
import { PrismaStore } from './services/PrismaStore';
import redisCache, { RedisCache } from './services/RedisCache';
import { BudgetService } from './services/BudgetService';
import { AlertService } from './services/AlertService';
import type { StoreInterface } from './services/PostgresStore';
import { authMiddleware, configureAuth, verifyApiKey } from './middleware/auth';
import { sanitizeLog, sanitizeObject } from './utils/sanitizer';
import logger, { stream } from './utils/logger';
import { register, httpRequestDuration, httpRequestTotal } from './utils/metrics';
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
  logger.error('FATAL: API_KEY_HASH must be configured in production');
  logger.error('Generate one with: pnpm generate-api-key');
  process.exit(1);
}

const authCache = redisCache;

logger.info('🔧 Initializing Aethermind API...');
logger.info(`Cache status: ${authCache.isAvailable() ? '✅ Redis connected' : '⚠️  Redis unavailable (using fallback)'}`);

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
logger.info('ℹ️ Redis/Queue functionality is disabled - using in-memory processing');
queueService = null;

const orchestrator = createOrchestrator(runtime, queueService ?? null);
const workflowEngine = createWorkflowEngine(orchestrator);
const wsManager = new WebSocketManager(wss, verifyApiKey);

let store: StoreInterface;
let prismaStore: PrismaStore | null = null;
let budgetService: BudgetService | null = null;
let alertService: AlertService | null = null;

async function initializeCache(): Promise<void> {
  if (authCache.isConnected()) {
    logger.info('✅ Redis cache connected for auth optimization');
  } else {
    logger.info('ℹ️ Redis cache not configured - auth will use bcrypt on every request');
  }
}

async function initializeStore(): Promise<StoreInterface> {
  if (process.env['DATABASE_URL']) {
    try {
      logger.info('Attempting to connect to PostgreSQL via Prisma...');
      prismaStore = new PrismaStore();
      const connected = await prismaStore.connect();
      if (connected) {
        logger.info('Using Prisma for data persistence');
        return prismaStore;
      }
    } catch (error) {
      logger.warn('Failed to connect via Prisma, falling back to InMemoryStore:', error);
    }
  }
  logger.info('Using InMemoryStore (data will not persist across restarts)');
  return new InMemoryStore();
}

async function startServer(): Promise<void> {
  await initializeCache();
  store = await initializeStore();

  // Initialize Budget and Alert services
  if (prismaStore) {
    budgetService = new BudgetService(prismaStore.getPrisma());
    alertService = new AlertService(
      prismaStore.getPrisma(),
      process.env['SENDGRID_API_KEY'],
      process.env['SLACK_WEBHOOK_URL']
    );
    logger.info('✅ Budget and Alert services initialized');
    
    // Connect BudgetService to Orchestrator for enforcement
    orchestrator.setBudgetService(budgetService);
    logger.info('✅ Budget enforcement enabled in Orchestrator');
    
    // Start periodic alert checking (every 5 minutes)
    let isCheckingAlerts = false;
    setInterval(async () => {
      if (isCheckingAlerts) {
        logger.warn('Alert check already in progress, skipping');
        return;
      }
      
      isCheckingAlerts = true;
      try {
        await alertService?.checkAndSendAlerts();
      } catch (error) {
        logger.error('Error checking alerts', { error });
      } finally {
        isCheckingAlerts = false;
      }
    }, 5 * 60 * 1000);
    
    // Start periodic budget reset (every hour)
    let isResettingBudget = false;
    setInterval(async () => {
      if (isResettingBudget) {
        logger.warn('Budget reset already in progress, skipping');
        return;
      }
      
      isResettingBudget = true;
      try {
        await budgetService?.resetPeriodic();
      } catch (error) {
        logger.error('Error resetting budgets', { error });
      } finally {
        isResettingBudget = false;
      }
    }, 60 * 60 * 1000);
  }

  if (process.env['OPENAI_API_KEY']) {
    const openaiProvider = createOpenAIProvider(process.env['OPENAI_API_KEY']);
    runtime.setDefaultProvider(openaiProvider);
    logger.info('OpenAI provider configured');
  }

  if (process.env['ANTHROPIC_API_KEY']) {
    const anthropicProvider = createAnthropicProvider(process.env['ANTHROPIC_API_KEY']);
    runtime.registerProvider('anthropic', anthropicProvider);
    logger.info('Anthropic provider configured');
  }

  runtime.getEmitter().on('agent:event', (event: any) => {
    wsManager.broadcast('agent:event', event);
  });

  runtime.getEmitter().on('log', (entry: any) => {
    const sanitizedEntry = {
      ...entry,
      message: sanitizeLog(entry.message),
      metadata: entry.metadata ? sanitizeObject(entry.metadata) : undefined
    };
    void store.addLog(sanitizedEntry);
    wsManager.broadcast('log', sanitizedEntry);
  });

  runtime.getEmitter().on('workflow:started', (event: any) => {
    wsManager.broadcast('workflow:started', event);
  });

  runtime.getEmitter().on('workflow:completed', (event: any) => {
    wsManager.broadcast('workflow:completed', event);
  });

  runtime.getEmitter().on('workflow:failed', (event: any) => {
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

  app.use(session({
    secret: process.env.JWT_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 10 * 60 * 1000, // 10 minutes for OAuth flow
    },
  }));
  
  // Initialize Passport
  app.use(passportConfig.initialize());
  
  // Compression middleware - reduces payload size by 20-40%
  app.use(compression({
    level: 6, // Balance between speed and compression
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));
  
  // HTTP request logging
  app.use(morgan(':method :url :status :res[content-length] - :response-time ms', { stream }));
  
  app.use(cors(corsOptions));
  app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
  app.use(limiter);

  // HTTP request metrics middleware - DISABLED TEMPORARILY
  // TODO: Fix metrics module initialization before re-enabling
  // Issue: httpRequestDuration.labels is not a function in production
  /*
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route = req.route?.path || req.path;
      httpRequestDuration.labels(req.method, route, res.statusCode.toString()).observe(duration);
      httpRequestTotal.labels(req.method, route, res.statusCode.toString()).inc();
    });
    next();
  });
  */
  logger.warn('⚠️  Prometheus metrics middleware disabled - fix metrics module before re-enabling');

  app.get('/api/openapi', (_req, res) => {
    res.sendFile('/docs/openapi.yaml', { root: process.cwd() });
  });

  // Prometheus metrics endpoint
  app.get('/metrics', async (_req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      res.status(500).end((error as Error).message);
    }
  });


  // Public health check endpoint (no authentication required)
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      storage: prismaStore?.isConnected() ? 'prisma' : 'memory',
      redis: authCache.isConnected() ? 'connected' : 'disconnected',
      queue: queueService ? 'enabled' : 'disabled',
    });
  });

  // Public routes - OAuth and auth (MUST be before authMiddleware!)
  // Mount at BOTH /auth and /api/auth for maximum compatibility
  app.use('/auth', oauthRoutes);     // Direct /auth/google, /auth/github
  app.use('/auth', authRoutes);      // Direct /auth/login, /auth/signup  
  app.use('/api/auth', oauthRoutes); // Also at /api/auth/google
  app.use('/api/auth', authRoutes);  // Also at /api/auth/login

  // Public ingestion endpoint - uses its own auth middleware
  // Must be before general authMiddleware
  app.use('/v1', ingestionRoutes);

  // Apply auth middleware to all OTHER /api routes
  // This will NOT affect routes already defined above
  app.use('/api', authMiddleware);

  app.use((req, _res, next) => {
    req.runtime = runtime;
    req.orchestrator = orchestrator;
    req.workflowEngine = workflowEngine;
    req.store = store;
    req.wsManager = wsManager;
    req.cache = authCache;
    req.budgetService = budgetService!;
    req.alertService = alertService!;
    if (prismaStore) {
      req.prisma = prismaStore.getPrisma();
    }
    next();
  });

  app.use('/api/agents', agentRoutes);
  app.use('/api/executions', executionRoutes);
  app.use('/api/logs', logRoutes);
  app.use('/api/traces', traceRoutes);
  app.use('/api/costs', costRoutes);
  app.use('/api/workflows', workflowRoutes);
  app.use('/api/budgets', budgetRoutes);

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
    console.log(`Health check: http://localhost:${PORT}/health (public)`);
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
      budgetService: BudgetService;
      alertService: AlertService;
      prisma: any;
      // user is defined by @types/passport, use (req.user as any)?.id where needed
    }
  }
}
