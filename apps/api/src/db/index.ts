import { drizzle } from 'drizzle-orm/node-postgres';
import { sql as drizzleSql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from './schema';

// Connection status tracking
let isConnected = false;
let lastConnectionError: Error | null = null;
let connectionAttempts = 0;

// SSL configuration for production
// Default: rejectUnauthorized: true (secure). Set DB_SSL_REJECT_UNAUTHORIZED=false
// only for managed databases with self-signed certs (e.g., Railway, Render).
const sslConfig = process.env.NODE_ENV === 'production'
  ? {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    }
  : false;

console.log('[DB] Initializing PostgreSQL pool', {
  hasConnectionString: !!process.env.DATABASE_URL,
  connectionStringPrefix: process.env.DATABASE_URL?.substring(0, 30) + '...',
  nodeEnv: process.env.NODE_ENV,
  sslConfig: JSON.stringify(sslConfig),
  dbSslEnvVar: process.env.DB_SSL_REJECT_UNAUTHORIZED ?? 'not set',
});

// Create PostgreSQL connection pool (optimized for Railway)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Reduced for Railway tier compatibility
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Faster failure detection
  ssl: sslConfig,
});

// Track connection state changes (no verbose logging — these fire on every pool checkout/release)
pool.on('connect', () => {
  isConnected = true;
  lastConnectionError = null;
});

pool.on('error', (err) => {
  isConnected = false;
  lastConnectionError = err;
  console.error('❌ Unexpected database pool error:', err.message);
  console.error('   Error code:', (err as any).code);
});

pool.on('remove', () => {
  // Normal pool lifecycle — connection returned after idle timeout.
  // No logging needed; this fires frequently in production.
});

/**
 * Check if database is currently connected
 */
export function isDatabaseConnected(): boolean {
  return isConnected;
}

/**
 * Get last connection error if any
 */
export function getLastConnectionError(): Error | null {
  return lastConnectionError;
}

/**
 * Test database connection with a simple query
 * @returns Promise<boolean> - true if connected
 */
export async function checkConnection(): Promise<boolean> {
  connectionAttempts++;
  try {
    await pool.query('SELECT 1');
    isConnected = true;
    lastConnectionError = null;
    return true;
  } catch (error) {
    isConnected = false;
    lastConnectionError = error as Error;
    console.error('❌ Database health check failed:', (error as Error).message);
    return false;
  }
}

/**
 * Get detailed connection status
 */
export function getConnectionStatus() {
  return {
    isConnected,
    lastError: lastConnectionError?.message || null,
    connectionAttempts,
    poolTotalCount: pool.totalCount,
    poolIdleCount: pool.idleCount,
    poolWaitingCount: pool.waitingCount,
  };
}

// Create and export Drizzle instance (wraps the same pool — no separate connection)
console.log('[Drizzle] Using pool:', !!pool);
export const db = drizzle(pool, { schema });

/**
 * Verify both raw pool and Drizzle ORM can execute queries.
 */
export async function verifyDrizzleConnection(): Promise<boolean> {
  // 1. Raw pool test (baseline)
  try {
    const poolResult = await pool.query('SELECT 1 AS ok');
    console.log('[DB] Raw pool query OK:', poolResult.rows[0]);
  } catch (err) {
    const e = err as Error & { code?: string; cause?: unknown };
    console.error('[DB] Raw pool query FAILED', {
      message: e.message,
      code: e.code,
      name: e.name,
      cause: e.cause,
    });
    return false;
  }

  // 2. Drizzle ORM test
  console.log('[Drizzle] Test query starting...');
  try {
    const result = await db.execute(drizzleSql`SELECT 1 AS ok`);
    console.log('[Drizzle] Test query SUCCESS:', JSON.stringify(result.rows?.[0] ?? result));
  } catch (err) {
    const e = err as Error & { code?: string; cause?: unknown };
    console.error('[Drizzle] Test query FAILED', {
      message: e.message,
      code: e.code,
      name: e.name,
      cause: e.cause ? String(e.cause) : undefined,
      causeMessage: (e.cause as any)?.message,
      causeCode: (e.cause as any)?.code,
      stack: e.stack?.split('\n').slice(0, 5).join('\n'),
    });
    return false;
  }

  // 3. Check users table exists
  try {
    const tableCheck = await db.execute(
      drizzleSql`SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      ) AS users_table_exists`
    );
    const exists = (tableCheck.rows?.[0] as any)?.users_table_exists;
    console.log('[DB] Users table exists:', exists);
    if (!exists) {
      console.error('[DB] WARNING: users table does not exist — run migrations');
    }
  } catch (err) {
    const e = err as Error & { code?: string };
    console.error('[DB] Schema check FAILED', { message: e.message, code: e.code });
  }

  return true;
}

// Export schema for use in queries
export { schema };

// Helper function to close database connections (useful for tests and graceful shutdown)
export async function closeDb() {
  await pool.end();
  isConnected = false;
  console.log('Database pool closed');
}

// Export pool for advanced use cases
export { pool };
