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
import userApiKeysRoutes from "./routes/user-api-keys";
import optimizationRoutes from "./routes/optimization.routes";
import forecastingRoutes from "./routes/forecasting.routes";
import organizationRoutes from "./routes/organizations";
import { WebSocketManager } from "./websocket/WebSocketManager";
import { InMemoryStore } from "./services/InMemoryStore";
import { DatabaseStore } from "./services/DatabaseStore";
import redisCache, { RedisService } from "./services/RedisService";
import { BudgetService } from "./services/BudgetService";
import { AlertService } from "./services/AlertService";
import type { StoreInterface } from "./services/PostgresStore";
import { verifyApiKey } from "./middleware/auth";
import { verifyDatabaseOnStartup, measureDatabaseLatency, getDatabaseStatus } from "./middleware/database";
import { requestIdMiddleware, withRequestId } from "./middleware/request-id.middleware";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { sanitizeLog, sanitizeObject } from "./utils/sanitizer";
import logger, { stream } from "./utils/logger";
import {
  register,
} from "./utils/metrics";
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




const corsOptions: cors.CorsOptions = {
  origin: CORS_ORIGINS,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Client-Token"],
};

const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: { error: "Too many requests", message: "Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const app = express();

// Trust Railway proxy for X-Forwarded-For header (required for rate limiting)
// Railway sits behind a proxy, so we need to trust the first proxy in the chain
app.set('trust proxy', 1);

// Request ID middleware - MUST be first middleware for consistent tracing
// Assigns unique ID to each request for distributed tracing and log correlation
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
    logger.warn("   OAuth users may be created as temporary (in-memory) users");
  }

  // Verify Drizzle ORM can execute queries (not just raw pool)
  if (dbConnected) {
    const { verifyDrizzleConnection } = await import("./db");
    const drizzleOk = await verifyDrizzleConnection();
    if (!drizzleOk) {
      logger.error("⚠️ Drizzle ORM cannot query the database — OAuth will use temp users");
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

  app.use(cors(corsOptions));
  app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
  app.use(limiter);



  app.get("/api/openapi", (_req, res) => {
    res.sendFile("/docs/openapi.yaml", { root: process.cwd() });
  });

  // Prometheus metrics endpoint
  app.get("/metrics", async (_req, res) => {
    try {
      res.set("Content-Type", register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      res.status(500).end((error as Error).message);
    }
  });

  // Enhanced health check endpoint with service status monitoring
  app.get("/health", async (_req, res) => {
    const checks = {
      database: false,
      redis: false,
      stripe: false,
      email: false,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const details: any = {
      storage: databaseStore?.isConnected() ? "drizzle" : "memory",
      queue: queueService ? "enabled" : "disabled",
    };

    // Check database connectivity with latency measurement
    const dbLatency = await measureDatabaseLatency();
    const dbStatus = getDatabaseStatus();
    
    if (dbLatency !== null) {
      checks.database = true;
      details.database = "connected";
      details.databaseLatencyMs = dbLatency;
    } else {
      checks.database = false;
      details.database = dbStatus.isConnected ? "connected" : "disconnected";
      if (dbStatus.lastError) {
        details.databaseError = dbStatus.lastError.message;
      }
    }

    // Check Redis cache
    checks.redis = authCache.isConnected();
    details.redis = checks.redis ? "connected" : "disconnected";

    const temporaryUsersCount = 0;

    // Determine overall health status
    // NOTE: Always return 200 for Railway healthcheck compatibility
    // The app can run in degraded mode (InMemoryStore) without database
    const allHealthy = Object.values(checks).every((v) => v);
    const criticalHealthy = checks.database; // Database is only critical service

    const status = allHealthy
      ? "healthy"
      : criticalHealthy
      ? "degraded"
      : "degraded";
    // Always return 200 - Railway healthcheck needs this even in degraded mode
    const httpStatus = 200;

    res.status(httpStatus).json({
      status,
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
      details,
      temporaryUsersCount,
    });
  });



  // Detailed database diagnostics endpoint
  app.get("/health/db", async (req, res) => {
    const diagnostics: {
      connection: { status: string; latencyMs?: number; error?: string };
      tables: { name: string; exists: boolean; rowCount?: number; error?: string }[];
      schema: { column: string; type: string; nullable: boolean }[];
      testQuery: { success: boolean; error?: string; userCount?: number };
      userLookup?: { found: boolean; userId?: string; email?: string; error?: string };
    } = {
      connection: { status: 'unknown' },
      tables: [],
      schema: [],
      testQuery: { success: false },
    };

    try {
      // 1. Test basic connection
      const startTime = Date.now();
      const { pool } = await import('./db');
      await pool.query('SELECT 1');
      diagnostics.connection = {
        status: 'connected',
        latencyMs: Date.now() - startTime,
      };

      // 2. Check if users table exists and get row count
      try {
        const tableCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'users'
          ) as exists
        `);
        const usersTableExists = tableCheck.rows[0]?.exists;

        if (usersTableExists) {
          const countResult = await pool.query('SELECT COUNT(*) as count FROM users');
          diagnostics.tables.push({
            name: 'users',
            exists: true,
            rowCount: parseInt(countResult.rows[0]?.count || '0', 10),
          });
        } else {
          diagnostics.tables.push({
            name: 'users',
            exists: false,
            error: 'Table does not exist',
          });
        }
      } catch (tableError: any) {
        diagnostics.tables.push({
          name: 'users',
          exists: false,
          error: tableError.message,
        });
      }

      // 3. Get users table schema
      try {
        const schemaResult = await pool.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users'
          ORDER BY ordinal_position
        `);
        diagnostics.schema = schemaResult.rows.map((row: any) => ({
          column: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable === 'YES',
        }));
      } catch (schemaError: any) {
        diagnostics.schema = [];
      }

      // 4. Test user query
      try {
        const userResult = await pool.query('SELECT COUNT(*) as count FROM users');
        diagnostics.testQuery = {
          success: true,
          userCount: parseInt(userResult.rows[0]?.count || '0', 10),
        };
      } catch (queryError: any) {
        diagnostics.testQuery = {
          success: false,
          error: queryError.message,
        };
      }

      // 5. Optional: Look up specific email if provided (for debugging)
      const emailToCheck = req.query.email as string;
      if (emailToCheck) {
        try {
          const userLookup = await pool.query(
            'SELECT id, email FROM users WHERE email = $1 LIMIT 1',
            [emailToCheck]
          );
          if (userLookup.rows.length > 0) {
            diagnostics.userLookup = {
              found: true,
              userId: userLookup.rows[0].id,
              email: userLookup.rows[0].email,
            };
          } else {
            diagnostics.userLookup = {
              found: false,
            };
          }
        } catch (lookupError: any) {
          diagnostics.userLookup = {
            found: false,
            error: lookupError.message,
          };
        }
      }

      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        diagnostics,
      });
    } catch (error: any) {
      diagnostics.connection = {
        status: 'error',
        error: error.message,
      };

      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        diagnostics,
        error: {
          message: error.message,
          code: error.code,
        },
      });
    }
  });


  // Public ingestion endpoint - uses its own auth middleware (unchanged)
  app.use("/v1", ingestionRoutes);

  // Client routes — protected by clientAuth
  app.use("/api/client", clientAuth, clientRoutes);

  app.use("/api", clientAuth);

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

  // === HTTPS Server (for production with SSL) ===
  if (
    process.env.NODE_ENV === "production" &&
    fs.existsSync("/etc/ssl/private.key")
  ) {
    const privateKey = fs.readFileSync("/etc/ssl/private.key", "utf8");
    const certificate = fs.readFileSync("/etc/ssl/certificate.crt", "utf8");
    const credentials = { key: privateKey, cert: certificate };

    const httpsServer = https.createServer(credentials, app);
    httpsServer.listen(PORT, () => {
      console.log(`✅ HTTPS Server running on port ${PORT}`);
      console.log(`WebSocket server: ws://localhost:${PORT}/ws`);
      console.log(`Health check: http://localhost:${PORT}/health (public)`);
      console.log(
        `Storage: ${databaseStore?.isConnected() ? "Drizzle" : "InMemory"}`
      );
      console.log(
        `Redis: ${authCache.isConnected() ? "Connected" : "Disconnected"}`
      );
      console.log(`Queue: ${queueService ? "Enabled" : "Disabled"}`);
      console.log(
        `Auth: ${
          process.env["API_KEY_HASH"]
            ? "Enabled"
            : "Disabled (set API_KEY_HASH to enable)"
        }\n`
      );
    });
  } else {
    // === HTTP Server (for development and production) ===
    const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
    server.listen(PORT, HOST, () => {
      console.log(`\n✅ Aethermind API server running on ${HOST}:${PORT}`);
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
        `Auth: ${authEnabled ? "Enabled" : "Disabled (DISABLE_AUTH=true)"}\n`
      );
    });
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
      // user is defined by @types/passport, use (req.user as any)?.id where needed
    }
  }
}
