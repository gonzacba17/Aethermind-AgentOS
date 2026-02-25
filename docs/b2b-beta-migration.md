# B2B Beta Migration Reference

> **Status**: Migration complete. The B2B client-token auth system (`clientAuth` middleware with `X-Client-Token`) is the active auth mechanism. The previous JWT + OAuth + Passport + session + CSRF + Stripe system has been fully replaced.

This document preserves the commented-out code blocks that were removed from `apps/api/src/index.ts` during the Phase 3 cleanup for historical reference.

---

## Previous Auth Routes

```typescript
// These routes were replaced by clientAuth + clientRoutes
import authRoutes from "./routes/auth";
import oauthRoutes from "./routes/oauth";
import onboardingRoutes from "./routes/onboarding";
import stripeRoutes from "./routes/stripe";

// Route mounting:
app.use("/auth", authRateLimiter, oauthRoutes);
app.use("/auth", authRateLimiter, authRoutes);
app.use("/api/auth", authRateLimiter, oauthRoutes);
app.use("/api/auth", authRateLimiter, authRoutes);
```

## Session & Passport

```typescript
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passportConfig from "./config/passport";

// Session secret validation
if (!process.env.SESSION_SECRET && !process.env.JWT_SECRET) {
  logger.error("❌ FATAL: SESSION_SECRET or JWT_SECRET must be configured");
  process.exit(1);
}
if (!process.env.SESSION_SECRET) {
  logger.warn(
    "⚠️ SESSION_SECRET not set, using JWT_SECRET as fallback for sessions",
  );
}

// PostgreSQL session store
const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({
      conObject: {
        connectionString: process.env.DATABASE_URL,
        ssl:
          process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : false,
      },
      tableName: "user_sessions",
      createTableIfMissing: true,
      errorLog: (err: Error) =>
        logger.error("Session store error:", { error: err.message }),
    }),
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
    },
  }),
);

// Passport initialization
app.use(passportConfig.initialize());
```

## CSRF Protection

```typescript
import { csrfProtection, csrfTokenHandler } from "./middleware/csrf.middleware";
import { authRateLimiter } from "./middleware/rateLimiter";

// CSRF token endpoint
app.get("/csrf-token", csrfTokenHandler);
app.get("/api/csrf-token", csrfTokenHandler);

// CSRF protection on API routes
app.use("/api", csrfProtection);
```

## Old JWT Auth Middleware

```typescript
import { authMiddleware, configureAuth } from "./middleware/auth";

// Replaced by: app.use("/api", clientAuth);
app.use("/api", authMiddleware);
```

## Stripe Integration

```typescript
// Stripe webhook endpoint
app.use(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeRoutes,
);

// Stripe routes
app.use("/api/stripe", stripeRoutes);

// Onboarding routes
app.use("/api/onboarding", onboardingRoutes);
```

## Health Check Integrations

```typescript
import { getTemporaryUsersCount } from "./services/OAuthService";

// Stripe health check
try {
  const { StripeService } = await import("./services/StripeService");
  const stripeService = new StripeService();
  checks.stripe = stripeService.isConfigured();
  details.stripe = checks.stripe ? "configured" : "not configured";
} catch (error) {
  checks.stripe = false;
  details.stripe = "error";
}

// Email health check
try {
  const { emailService } = await import("./services/EmailService");
  checks.email = emailService.isConfigured();
  details.email = emailService.isConfigured()
    ? `configured (${emailService.getProvider()})`
    : "not configured";
} catch (error) {
  checks.email = false;
  details.email = "error";
}
```

## Prometheus Metrics Middleware

```typescript
// Disabled due to: httpRequestDuration.labels is not a function in production
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);
    httpRequestTotal.labels(req.method, route, res.statusCode.toString()).inc();
  });
  next();
});
```

---

_Extracted from `apps/api/src/index.ts` during Phase 3 optimization (2026-02-24)_
