import "dotenv/config";

// Validate secrets early (before other imports that might use them)
import { validateSecrets } from "./config/secrets";

try {
  validateSecrets();
} catch (error) {
  console.error("❌ FATAL: Secrets validation failed");
  console.error((error as Error).message);
  console.error("💡 Run: pnpm generate-secrets to create new secrets");
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
}

// Validate critical environment variables early
if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
  console.error("❌ FATAL: DATABASE_URL is not configured");
  console.error("💡 Set it in Railway variables or .env file");
  process.exit(1);
}

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import https from "https";
import fs from "fs";
import { WebSocketServer } from "ws";
import {
  createRuntime,
  createOrchestrator,
  createWorkflowEngine,
  createOpenAIProvider,
  createAnthropicProvider,
  createConfigWatcher,
  TaskQueueService,
} from "@aethermind/core";

import { agentRoutes } from "./routes/agents";
import { executionRoutes } from "./routes/executions";
import { logRoutes } from "./routes/logs";
import { traceRoutes } from "./routes/traces";
import { costRoutes } from "./routes/costs";
import { workflowRoutes } from "./routes/workflows";
import { budgetRoutes } from "./routes/budgets";
import ingestionRoutes from "./routes/ingestion";
import clientRoutes from "./routes/client";
import { clientAuth } from "./middleware/clientAuth";
import authRoutes from "./routes/auth/index";
import { authMiddleware } from "./middleware/auth";
import userApiKeysRoutes from "./routes/user-api-keys";
import optimizationRoutes from "./routes/optimization.routes";
import forecastingRoutes from "./routes/forecasting.routes";
import organizationRoutes from "./routes/organizations";
import gatewayRouter from "./routes/gateway";
import adminRouter from "./routes/admin";
import { WebSocketManager } from "./websocket/WebSocketManager";
import { InMemoryStore } from "./services/InMemoryStore";
import { DatabaseStore } from "./services/DatabaseStore";
import redisCache, { RedisService } from "./services/RedisService";
import { BudgetService } from "./services/BudgetService";
import { AlertService } from "./services/AlertService";
import { startBudgetAlertCron } from "./services/BudgetAlertCron";
import { startProviderHealthCron } from "./services/ProviderHealthService";
import { startDeterministicDetectorCron } from "./services/DeterministicDetector";
import { startPatternDetectionCron } from "./services/PatternDetectionJob";
import { startBenchmarkCron } from "./services/BenchmarkJob";
import type { StoreInterface } from "./services/PostgresStore";
import { verifyApiKey } from "./middleware/auth";
import { verifyDatabaseOnStartup } from "./middleware/database";
import { createHealthRouter } from "./server/health";
import { requestIdMiddleware, withRequestId } from "./middleware/request-id.middleware";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { sanitizeLog, sanitizeObject } from "./utils/sanitizer";
import logger, { stream } from "./utils/logger";

import {
  CORS_ORIGINS,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  REQUEST_BODY_LIMIT,
  DEFAULT_PORT,
  REDIS_URL,
  QUEUE_CONCURRENCY,
  CONFIG_WATCHER_DEBOUNCE_MS,
} from "./config/constants";

if (process.env["NODE_ENV"] === "production" && !process.env["API_KEY_HASH"]) {
  logger.error("FATAL: API_KEY_HASH must be configured in production");
  logger.error("Generate one with: pnpm generate-api-key");
  process.exit(1);
}


const authCache = redisCache;

logger.info("🔧 Initializing Aethermind API...");
logger.info(
  `Cache status: ${
    authCache.isAvailable()
      ? "✅ Redis connected"
      : "⚠️  Redis unavailable (using fallback)"
  }`
);

// Auth state (used at startup log below)
const shouldDisableAuth = process.env["DISABLE_AUTH"] === "true";
const hasApiKey = !!process.env["API_KEY_HASH"];
const isProduction = process.env["NODE_ENV"] === "production";
logger.info(`Auth enabled: ${!shouldDisableAuth && (isProduction || hasApiKey)}`);




const ALLOWED_ORIGINS = [
  'https://aethermind-page.vercel.app',
  'https://aethermind-agent-os-dashboard.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  ...CORS_ORIGINS,
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Client-Token", "X-API-Key", "X-SDK-Key", "X-Agent-Id", "X-Agent-Name", "X-Workflow-Id", "X-Workflow-Step", "X-Parent-Agent-Id", "X-Trace-Id", "X-Admin-Secret"],
};

const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: { error: "Too many requests", message: "Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/api/client'),
});

const clientLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  message: { error: "Too many requests", message: "Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const app = express();

// Trust Railway proxy for X-Forwarded-For header (required for rate limiting)
// Railway sits behind a proxy, so we need to trust the first proxy in the chain
app.set('trust proxy', 1);

// CORS must be the very first middleware so OPTIONS preflight is handled
// before helmet, rate-limiter, or any other middleware can reject the request
app.use(cors(corsOptions));

// Request ID middleware for distributed tracing and log correlation
app.use(requestIdMiddleware);

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

const runtime = createRuntime();

let queueService: TaskQueueService | null = null;

// Redis/Queue is completely disabled for now
logger.info(
  "ℹ️ Redis/Queue functionality is disabled - using in-memory processing"
);
queueService = null;

const orchestrator = createOrchestrator(runtime, queueService ?? null);
const workflowEngine = createWorkflowEngine(orchestrator);
const wsManager = new WebSocketManager(wss, verifyApiKey);

let store: StoreInterface;
let databaseStore: DatabaseStore | null = null;
let budgetService: BudgetService | null = null;
let alertService: AlertService | null = null;

async function initializeCache(): Promise<void> {
  if (authCache.isConnected()) {
    logger.info("✅ Redis cache connected for auth optimization");
  } else {
    logger.info(
      "ℹ️ Redis cache not configured - auth will use bcrypt on every request"
    );
  }
}

async function initializeStore(): Promise<StoreInterface> {
  if (process.env["DATABASE_URL"]) {
    try {
      logger.info("Attempting to connect to PostgreSQL via DatabaseStore...");
      databaseStore = new DatabaseStore();
      const connected = await databaseStore.connect();
      if (connected) {
        logger.info("Using DatabaseStore (Drizzle) for data persistence");
        return databaseStore;
      }
      // connect() returned false — detailed error already logged inside DatabaseStore
      logger.warn("DatabaseStore.connect() returned false, falling back to InMemoryStore");
    } catch (error) {
      const err = error as Error & { code?: string };
      logger.warn("Unexpected error initializing DatabaseStore, falling back to InMemoryStore", {
        error: err.message,
        code: err.code,
        stack: err.stack,
      });
    }
  } else {
    logger.warn("DATABASE_URL not set — skipping DatabaseStore");
  }
  logger.info("Using InMemoryStore (data will not persist across restarts)");
  return new InMemoryStore();
}

async function startServer(): Promise<void> {
  await initializeCache();
  
  // Verify database connection with retries on startup
  const dbConnected = await verifyDatabaseOnStartup();
  if (!dbConnected) {
    logger.warn("⚠️ Server starting with degraded database connectivity");
  }

  // Verify Drizzle ORM can execute queries (not just raw pool)
  if (dbConnected) {
    const { verifyDrizzleConnection } = await import("./db");
    const drizzleOk = await verifyDrizzleConnection();
    if (!drizzleOk) {
      logger.error("⚠️ Drizzle ORM cannot query the database");
    }
  }

  store = await initializeStore();

  // Initialize Budget and Alert services
  if (databaseStore) {
    budgetService = new BudgetService();
    alertService = new AlertService(
      process.env["SENDGRID_API_KEY"],
      process.env["SLACK_WEBHOOK_URL"]
    );
    logger.info("✅ Budget and Alert services initialized");

    // Connect BudgetService to Orchestrator for enforcement
    orchestrator.setBudgetService(budgetService);
    logger.info("✅ Budget enforcement enabled in Orchestrator");

    // Start periodic alert checking (every 5 minutes)
    let isCheckingAlerts = false;
    setInterval(async () => {
      if (isCheckingAlerts) {
        logger.warn("Alert check already in progress, skipping");
        return;
      }

      isCheckingAlerts = true;
      try {
        await alertService?.checkAndSendAlerts();
      } catch (error) {
        logger.error("Error checking alerts", { error });
      } finally {
        isCheckingAlerts = false;
      }
    }, 5 * 60 * 1000);

    // Start periodic budget reset (every hour)
    let isResettingBudget = false;
    setInterval(async () => {
      if (isResettingBudget) {
        logger.warn("Budget reset already in progress, skipping");
        return;
      }

      isResettingBudget = true;
      try {
        await budgetService?.resetPeriodic();
      } catch (error) {
        logger.error("Error resetting budgets", { error });
      } finally {
        isResettingBudget = false;
      }
    }, 60 * 60 * 1000);

    // Start Phase 1 budget alert cron (client_budgets → alert_events)
    startBudgetAlertCron();

    // Start Phase 2 provider health cron (every 2 minutes)
    startProviderHealthCron();

    // Start Phase 3 deterministic detector cron (every 1 hour)
    startDeterministicDetectorCron();

    // DEPRECATED v0.2.0 — Pattern detection includes RoutingAutoTuner which is deprecated.
    // Start Phase 5 pattern detection cron (every Sunday 00:00 UTC)
    startPatternDetectionCron();

    // Start Phase 5 benchmark cron (every Monday 02:00 UTC)
    startBenchmarkCron();
  }

  if (process.env["OPENAI_API_KEY"]) {
    const openaiProvider = createOpenAIProvider(process.env["OPENAI_API_KEY"]);
    runtime.setDefaultProvider(openaiProvider);
    logger.info("OpenAI provider configured");
  }

  if (process.env["ANTHROPIC_API_KEY"]) {
    const anthropicProvider = createAnthropicProvider(
      process.env["ANTHROPIC_API_KEY"]
    );
    runtime.registerProvider("anthropic", anthropicProvider);
    logger.info("Anthropic provider configured");
  }

  // Event handlers - using 'any' due to dynamic event types from @aethermind/core
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runtime.getEmitter().on("agent:event", (event: any) => {
    wsManager.broadcast("agent:event", event);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runtime.getEmitter().on("log", (entry: any) => {
    const sanitizedEntry = {
      ...entry,
      message: sanitizeLog(entry.message),
      metadata: entry.metadata ? sanitizeObject(entry.metadata) : undefined,
    };
    void store.addLog(sanitizedEntry);
    wsManager.broadcast("log", sanitizedEntry);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runtime.getEmitter().on("workflow:started", (event: any) => {
    wsManager.broadcast("workflow:started", event);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runtime.getEmitter().on("workflow:completed", (event: any) => {
    wsManager.broadcast("workflow:completed", event);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runtime.getEmitter().on("workflow:failed", (event: any) => {
    wsManager.broadcast("workflow:failed", event);
  });

  // TEMP: Admin migration endpoint — must be before ALL other middleware
  app.use("/api", adminRouter);

  app.use(
    helmet({
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
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      noSniff: true,
      xssFilter: true,
      hidePoweredBy: true,
    })
  );



  // Cookie parser middleware - required for httpOnly auth cookies
  app.use(cookieParser());

  // Compression middleware - reduces payload size by 20-40%
  app.use(
    compression({
      level: 6, // Balance between speed and compression
      threshold: 1024, // Only compress responses > 1KB
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) {
          return false;
        }
        return compression.filter(req, res);
      },
    })
  );

  // HTTP request logging with request ID for tracing
  morgan.token('request-id', (req: express.Request) => req.requestId || '-');
  app.use(
    morgan(":method :url :status :res[content-length] - :response-time ms [:request-id]", {
      stream,
    })
  );

  app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
  app.use(limiter);



  app.get("/api/openapi", (_req, res) => {
    res.sendFile("/docs/openapi.yaml", { root: process.cwd() });
  });

  // Health check, /health/db, and /metrics endpoints
  const healthRouter = createHealthRouter({
    authCache,
    databaseStore,
    queueService,
  });
  app.use(healthRouter);


  // Public ingestion endpoint - uses its own auth middleware (unchanged)
  app.use("/v1", ingestionRoutes);

  // AI Gateway — OpenAI/Anthropic-compatible proxy (uses clientAuth internally)
  app.use("/gateway", gatewayRouter);

  // Auth routes — public (signup, login, etc.) — must be mounted BEFORE global auth
  app.use("/api/auth", authRoutes);

  // (admin router moved above helmet)

  // Client routes — protected by clientAuth (B2B token), own rate limit (100/min)
  app.use("/api/client", clientLimiter, clientAuth, clientRoutes);

  // Global auth middleware — JWT-based for all other /api/* routes
  app.use("/api", authMiddleware);

  app.use((req, _res, next) => {
    req.runtime = runtime;
    req.orchestrator = orchestrator;
    req.workflowEngine = workflowEngine;
    req.store = store;
    req.wsManager = wsManager;
    req.cache = authCache;
    req.budgetService = budgetService!;
    req.alertService = alertService!;
    if (databaseStore) {
      req.drizzle = databaseStore.getDrizzle();
    }
    next();
  });

  app.use("/api/agents", agentRoutes);
  app.use("/api/executions", executionRoutes);
  app.use("/api/logs", logRoutes);
  app.use("/api/traces", traceRoutes);
  app.use("/api/costs", costRoutes);
  app.use("/api/workflows", workflowRoutes);
  app.use("/api/budgets", budgetRoutes);

  app.use("/api/user/api-keys", userApiKeysRoutes); // User API keys management
  app.use("/api/organizations", organizationRoutes); // Organization management
  app.use("/api/optimization", optimizationRoutes); // Auto-optimization engine
  app.use("/api/forecasting", forecastingRoutes); // Predictive cost forecasting

  // Centralized error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  const PORT = DEFAULT_PORT;

  function logStartupBanner(host: string, protocol: string = "HTTP") {
    console.log(`\n✅ Aethermind ${protocol} server running on ${host}:${PORT}`);
    console.log(`WebSocket server: ws://localhost:${PORT}/ws`);
    console.log(`Health check: http://localhost:${PORT}/health (public)`);
    console.log(
      `Storage: ${databaseStore?.isConnected() ? "Drizzle" : "InMemory"}`
    );
    console.log(
      `Redis: ${authCache.isConnected() ? "Connected" : "Disconnected"}`
    );
    console.log(`Queue: ${queueService ? "Enabled" : "Disabled"}`);
    const authEnabled =
      process.env["DISABLE_AUTH"] === "true"
        ? false
        : !!process.env["API_KEY_HASH"];
    console.log(
      `Auth: ${authEnabled ? "Enabled" : "Disabled (set API_KEY_HASH or DISABLE_AUTH)"}\n`
    );
  }

  // === HTTPS Server (for production with SSL) ===
  if (
    process.env.NODE_ENV === "production" &&
    fs.existsSync("/etc/ssl/private.key")
  ) {
    const privateKey = fs.readFileSync("/etc/ssl/private.key", "utf8");
    const certificate = fs.readFileSync("/etc/ssl/certificate.crt", "utf8");
    const credentials = { key: privateKey, cert: certificate };

    const httpsServer = https.createServer(credentials, app);
    httpsServer.listen(PORT, () => logStartupBanner("0.0.0.0", "HTTPS"));
  } else {
    // === HTTP Server (for development and production) ===
    const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
    server.listen(PORT, HOST, () => logStartupBanner(HOST));
  }
}

async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down...`);
  try {
    await orchestrator.shutdown();
  } catch (error) {
    logger.warn(`Error during orchestrator shutdown: ${(error as Error).message}`);
  }
  if (databaseStore) {
    await databaseStore.close();
  }
  try {
    await authCache.close();
  } catch (error) {
    logger.warn(`Error closing auth cache: ${(error as Error).message}`);
  }
  server.close();
  process.exit(0);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

startServer().catch((error) => {
  console.error("Failed to start server:", error);
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
      cache: RedisService;
      budgetService: BudgetService;
      alertService: AlertService;
      drizzle: any;
      client?: import("./middleware/clientAuth").ClientData;
      user?: { id: string; email: string; plan: string; usageCount: number; usageLimit: number };
    }
  }
}
