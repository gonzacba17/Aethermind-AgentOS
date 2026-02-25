/**
 * Health check endpoints for the API server.
 *
 * - GET /health     → Service health overview (database, redis)
 * - GET /health/db  → Detailed database diagnostics (tables, schema, test queries)
 * - GET /metrics    → Prometheus metrics (currently stub)
 *
 * Extracted from index.ts to reduce startServer() size.
 */
import { Router, Request, Response } from "express";
import {
  measureDatabaseLatency,
  getDatabaseStatus,
} from "../middleware/database";
import { register } from "../utils/metrics";
import logger from "../utils/logger";

interface HealthDeps {
  authCache: { isConnected(): boolean };
  databaseStore: { isConnected(): boolean } | null;
  queueService: unknown;
}

export function createHealthRouter(deps: HealthDeps): Router {
  const router = Router();
  const { authCache, databaseStore, queueService } = deps;

  // ── Prometheus Metrics ──────────────────────────────────────────────
  router.get("/metrics", async (_req: Request, res: Response) => {
    try {
      res.set("Content-Type", register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      res.status(500).end((error as Error).message);
    }
  });

  // ── Service Health Overview ─────────────────────────────────────────
  router.get("/health", async (_req: Request, res: Response) => {
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
    const allHealthy = Object.values(checks).every((v) => v);
    const criticalHealthy = checks.database;

    const status = allHealthy
      ? "healthy"
      : criticalHealthy
      ? "degraded"
      : "degraded";

    res.status(200).json({
      status,
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
      details,
      temporaryUsersCount,
    });
  });

  // ── Detailed Database Diagnostics ───────────────────────────────────
  router.get("/health/db", async (req: Request, res: Response) => {
    const diagnostics: {
      connection: { status: string; latencyMs?: number; error?: string };
      tables: {
        name: string;
        exists: boolean;
        rowCount?: number;
        error?: string;
      }[];
      schema: { column: string; type: string; nullable: boolean }[];
      testQuery: { success: boolean; error?: string; userCount?: number };
      userLookup?: {
        found: boolean;
        userId?: string;
        email?: string;
        error?: string;
      };
    } = {
      connection: { status: "unknown" },
      tables: [],
      schema: [],
      testQuery: { success: false },
    };

    try {
      // 1. Test basic connection
      const startTime = Date.now();
      const { pool } = await import("../db");
      await pool.query("SELECT 1");
      diagnostics.connection = {
        status: "connected",
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
          const countResult = await pool.query(
            "SELECT COUNT(*) as count FROM users"
          );
          diagnostics.tables.push({
            name: "users",
            exists: true,
            rowCount: parseInt(countResult.rows[0]?.count || "0", 10),
          });
        } else {
          diagnostics.tables.push({
            name: "users",
            exists: false,
            error: "Table does not exist",
          });
        }
      } catch (tableError: any) {
        diagnostics.tables.push({
          name: "users",
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
          nullable: row.is_nullable === "YES",
        }));
      } catch (schemaError: any) {
        diagnostics.schema = [];
      }

      // 4. Test user query
      try {
        const userResult = await pool.query(
          "SELECT COUNT(*) as count FROM users"
        );
        diagnostics.testQuery = {
          success: true,
          userCount: parseInt(userResult.rows[0]?.count || "0", 10),
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
            "SELECT id, email FROM users WHERE email = $1 LIMIT 1",
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
        status: "ok",
        timestamp: new Date().toISOString(),
        diagnostics,
      });
    } catch (error: any) {
      diagnostics.connection = {
        status: "error",
        error: error.message,
      };

      res.status(500).json({
        status: "error",
        timestamp: new Date().toISOString(),
        diagnostics,
        error: {
          message: error.message,
          code: error.code,
        },
      });
    }
  });

  return router;
}
