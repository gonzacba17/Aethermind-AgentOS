import "dotenv/config";

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
import { createServer } from "http";
import https from "https";
import fs from "fs";
import { PrismaClient } from "@prisma/client";
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

// Auto-apply database migrations on startup
async function ensureDatabaseSchema() {
  // Run in any environment if DATABASE_URL is configured
  if (process.env.DATABASE_URL) {
    console.log("🔄 Checking database schema...");
    const prisma = new PrismaClient();

    try {
      await prisma.$connect();
      console.log("✅ Connected to database");

      // Try to query organizations table
      try {
        await prisma.organization.findFirst();
        console.log("✅ Database schema verified - tables exist");
      } catch (error: any) {
        // If table doesn't exist, apply schema automatically
        if (
          error.code === "P2021" ||
          error.message.includes("does not exist")
        ) {
          console.log(
            "⚠️  Tables not found - applying schema automatically..."
          );

          try {
            const { execSync } = require("child_process");
            const path = require("path");

            // Determine schema path (Railway runs from apps/api)
            const schemaPath = path.join(
              process.cwd(),
              "../../prisma/schema.prisma"
            );

            // Apply schema using db push
            console.log(
              `🔧 Running: prisma db push with schema at ${schemaPath}...`
            );
            const output = execSync(
              `npx prisma db push --schema=${schemaPath} --accept-data-loss --skip-generate`,
              {
                encoding: "utf-8",
                cwd: process.cwd(),
                env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
              }
            );

            console.log("✅ Schema applied successfully!");
            console.log(output);

            // Verify tables were created
            await prisma.organization.findFirst();
            console.log("✅ Database schema verified after creation");
          } catch (applyError: any) {
            console.error("❌ Failed to apply schema:", applyError.message);
            console.log(
              "💡 Manual fix: railway run npx prisma db push --schema=./prisma/schema.prisma"
            );
            // Don't crash the app, let it try to start anyway
          }
        } else {
          // Other database error
          throw error;
        }
      }
    } catch (error: any) {
      console.error("❌ Database connection failed:", error.message);
      console.log("⚠️  API will start but database operations may fail");
      // Don't crash the app
    } finally {
      await prisma.$disconnect();
    }
  }
}

import { agentRoutes } from "./routes/agents";
import { executionRoutes } from "./routes/executions";
import { logRoutes } from "./routes/logs";
import { traceRoutes } from "./routes/traces";
import { costRoutes } from "./routes/costs";
import { workflowRoutes } from "./routes/workflows";
import { budgetRoutes } from "./routes/budgets";
import ingestionRoutes from "./routes/ingestion";
import authRoutes from "./routes/auth";
import oauthRoutes from "./routes/oauth";
import onboardingRoutes from "./routes/onboarding";
import stripeRoutes from "./routes/stripe";
import session from "express-session";
import passportConfig from "./config/passport";
import { WebSocketManager } from "./websocket/WebSocketManager";
import { InMemoryStore } from "./services/InMemoryStore";
import { DatabaseStore } from "./services/DatabaseStore";
import redisCache, { RedisCache } from "./services/RedisCache";
import { BudgetService } from "./services/BudgetService";
import { AlertService } from "./services/AlertService";
import type { StoreInterface } from "./services/PostgresStore";
import { authMiddleware, configureAuth, verifyApiKey } from "./middleware/auth";
import { sanitizeLog, sanitizeObject } from "./utils/sanitizer";
import logger, { stream } from "./utils/logger";
import {
  register,
  httpRequestDuration,
  httpRequestTotal,
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

// DEBUG: Show auth configuration
console.log("\n🔍 AUTH CONFIGURATION DEBUG:");
console.log(`   DISABLE_AUTH env var: "${process.env["DISABLE_AUTH"]}"`);
console.log(`   API_KEY_HASH exists: ${!!process.env["API_KEY_HASH"]}`);
console.log(`   NODE_ENV: ${process.env["NODE_ENV"]}`);
const shouldDisableAuth = process.env["DISABLE_AUTH"] === "true";
const hasApiKey = !!process.env["API_KEY_HASH"];
const isProduction = process.env["NODE_ENV"] === "production";
console.log(`   Should disable auth: ${shouldDisableAuth}`);
console.log(
  `   Calculated auth enabled: ${
    !shouldDisableAuth && (isProduction || hasApiKey)
  }\n`
);

configureAuth({
  apiKeyHash: process.env["API_KEY_HASH"],
  enabled:
    process.env["DISABLE_AUTH"] === "true"
      ? false
      : process.env["NODE_ENV"] === "production" ||
        !!process.env["API_KEY_HASH"],
  cache: authCache,
});

const corsOptions: cors.CorsOptions = {
  origin: CORS_ORIGINS,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
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
    } catch (error) {
      logger.warn(
        "Failed to connect via DatabaseStore, falling back to InMemoryStore:",
        error
      );
    }
  }
  logger.info("Using InMemoryStore (data will not persist across restarts)");
  return new InMemoryStore();
}

async function startServer(): Promise<void> {
  await initializeCache();
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

  runtime.getEmitter().on("agent:event", (event: any) => {
    wsManager.broadcast("agent:event", event);
  });

  runtime.getEmitter().on("log", (entry: any) => {
    const sanitizedEntry = {
      ...entry,
      message: sanitizeLog(entry.message),
      metadata: entry.metadata ? sanitizeObject(entry.metadata) : undefined,
    };
    void store.addLog(sanitizedEntry);
    wsManager.broadcast("log", sanitizedEntry);
  });

  runtime.getEmitter().on("workflow:started", (event: any) => {
    wsManager.broadcast("workflow:started", event);
  });

  runtime.getEmitter().on("workflow:completed", (event: any) => {
    wsManager.broadcast("workflow:completed", event);
  });

  runtime.getEmitter().on("workflow:failed", (event: any) => {
    wsManager.broadcast("workflow:failed", event);
  });

  console.log("[Hot Reload] Feature deprecated - use API to update agents");

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

  app.use(
    session({
      secret: process.env.JWT_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 10 * 60 * 1000, // 10 minutes for OAuth flow
      },
    })
  );

  // Initialize Passport
  app.use(passportConfig.initialize());

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

  // HTTP request logging
  app.use(
    morgan(":method :url :status :res[content-length] - :response-time ms", {
      stream,
    })
  );

  app.use(cors(corsOptions));
  app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
  app.use(limiter);

  // Stripe webhook endpoint - MUST use raw body for signature verification
  // Mount BEFORE express.json() middleware to get raw buffer
  app.use(
    "/stripe/webhook",
    express.raw({ type: "application/json" }),
    stripeRoutes
  );

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
  logger.warn(
    "⚠️  Prometheus metrics middleware disabled - fix metrics module before re-enabling"
  );

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

    const details: any = {
      storage: databaseStore?.isConnected() ? "prisma" : "memory",
      queue: queueService ? "enabled" : "disabled",
    };

    // Check database connectivity
    try {
      if (databaseStore) {
        await databaseStore.getPrisma().$queryRaw`SELECT 1`;
        checks.database = true;
        details.database = "connected";
      } else {
        checks.database = false;
        details.database = "in-memory mode";
      }
    } catch (error) {
      checks.database = false;
      details.database = "disconnected";
      details.databaseError = (error as Error).message;
    }

    // Check Redis cache
    checks.redis = authCache.isConnected();
    details.redis = checks.redis ? "connected" : "disconnected";

    // Check Stripe service
    try {
      const { StripeService } = await import("./services/StripeService");
      const stripeService = new StripeService();
      checks.stripe = stripeService.isConfigured();
      details.stripe = checks.stripe ? "configured" : "not configured";
    } catch (error) {
      checks.stripe = false;
      details.stripe = "error";
      details.stripeError = (error as Error).message;
    }

    // Check Email service
    try {
      const { emailService } = await import("./services/EmailService");
      checks.email = emailService.isConfigured();
      details.email = emailService.isConfigured()
        ? `configured (${emailService.getProvider()})`
        : "not configured";
    } catch (error) {
      checks.email = false;
      details.email = "error";
      details.emailError = (error as Error).message;
    }

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
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
      details,
    });
  });

  // Public routes - OAuth and auth (MUST be before authMiddleware!)
  // Mount at BOTH /auth and /api/auth for maximum compatibility
  app.use("/auth", oauthRoutes); // Direct /auth/google, /auth/github
  app.use("/auth", authRoutes); // Direct /auth/login, /auth/signup
  app.use("/api/auth", oauthRoutes); // Also at /api/auth/google
  app.use("/api/auth", authRoutes); // Also at /api/auth/login

  // Public ingestion endpoint - uses its own auth middleware
  // Must be before general authMiddleware
  app.use("/v1", ingestionRoutes);

  // Apply auth middleware to all OTHER /api routes
  // This will NOT affect routes already defined above
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
      req.prisma = databaseStore.getPrisma();
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
  app.use("/api/onboarding", onboardingRoutes);
  app.use("/api/stripe", stripeRoutes); // Protected Stripe endpoints (checkout, portal)

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const isProduction = process.env["NODE_ENV"] === "production";

      if (!isProduction) {
        console.error("Error:", err);
      } else {
        console.error("Error:", err.message);
      }

      const isAethermindError = "code" in err && "suggestion" in err;

      if (isAethermindError) {
        const aethermindErr = err as {
          code: string;
          suggestion: string;
          message: string;
        };
        res.status(500).json({
          error: err.name || "AethermindError",
          code: aethermindErr.code,
          message: aethermindErr.message,
          suggestion: aethermindErr.suggestion,
        });
      } else {
        const errorMessage = isProduction
          ? "An internal error occurred"
          : err.message;
        res.status(500).json({
          error: "Internal Server Error",
          message: errorMessage,
        });
      }
    }
  );

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
    httpsServer.listen(PORT, async () => {
      // Ensure database schema before accepting requests
      await ensureDatabaseSchema();
      console.log(`✅ HTTPS Server running on port ${PORT}`);
      console.log(`WebSocket server: ws://localhost:${PORT}/ws`);
      console.log(`Health check: http://localhost:${PORT}/health (public)`);
      console.log(
        `Storage: ${databaseStore?.isConnected() ? "Prisma" : "InMemory"}`
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
    // === HTTP Server (for development) ===
    server.listen(PORT, async () => {
      // Ensure database schema before accepting requests
      await ensureDatabaseSchema();
      console.log(`\n✅ Aethermind API server running on port ${PORT}`);
      console.log(`WebSocket server: ws://localhost:${PORT}/ws`);
      console.log(`Health check: http://localhost:${PORT}/health (public)`);
      console.log(
        `Storage: ${databaseStore?.isConnected() ? "Prisma" : "InMemory"}`
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

process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  try {
    await orchestrator.shutdown();
  } catch (error) {
    console.warn(
      "⚠️ Error during orchestrator shutdown:",
      (error as Error).message
    );
  }
  if (databaseStore) {
    await databaseStore.close();
  }
  try {
    await authCache.close();
  } catch (error) {
    console.warn("⚠️ Error closing auth cache:", (error as Error).message);
  }
  server.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down...");
  try {
    await orchestrator.shutdown();
  } catch (error) {
    console.warn(
      "⚠️ Error during orchestrator shutdown:",
      (error as Error).message
    );
  }
  if (databaseStore) {
    await databaseStore.close();
  }
  try {
    await authCache.close();
  } catch (error) {
    console.warn("⚠️ Error closing auth cache:", (error as Error).message);
  }
  server.close();
  process.exit(0);
});

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
      cache: RedisCache;
      budgetService: BudgetService;
      alertService: AlertService;
      prisma: any;
      // user is defined by @types/passport, use (req.user as any)?.id where needed
    }
  }
}
