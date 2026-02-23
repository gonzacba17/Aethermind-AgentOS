import { drizzle } from 'drizzle-orm/node-postgres';
import { sql as drizzleSql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from './schema';

// ─────────────────────────────────────────────────────────
// Connection state
// ─────────────────────────────────────────────────────────
let isConnected = false;
let lastConnectionError: Error | null = null;
let connectionAttempts = 0;

// ─────────────────────────────────────────────────────────
// Connection string normalizer for Railway
// Railway exposes two hostnames:
//   • Internal: postgres.railway.internal  (private network, no SSL needed)
//   • Proxy:    <project>.proxy.rlwy.net   (public, SSL required)
// We normalize the URL so the pool config is always correct.
// ─────────────────────────────────────────────────────────
interface ParsedConnection {
  url: string;
  isInternal: boolean;
  isProxy: boolean;
  host: string;
}

function normalizeConnectionString(raw: string): ParsedConnection {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { url: raw, isInternal: false, isProxy: false, host: 'unknown' };
  }

  const host = url.hostname;
  const isInternal = host.endsWith('.railway.internal');
  const isProxy = host.endsWith('.proxy.rlwy.net');

  // Railway internal network doesn't require (and sometimes chokes on) sslmode
  // Strip sslmode from the URL — we control SSL via the pool config below.
  url.searchParams.delete('sslmode');

  return { url: url.toString(), isInternal, isProxy, host };
}

const rawUrl = process.env.DATABASE_URL ?? '';
const conn = normalizeConnectionString(rawUrl);

// ─────────────────────────────────────────────────────────
// SSL config
//   • Internal Railway network → SSL off (connections never leave the VPC)
//   • Proxy / other hosts      → SSL on, rejectUnauthorized: false
//     (Railway uses self-signed certs)
//   • Local dev                → no SSL
// ─────────────────────────────────────────────────────────
function buildSslConfig(): false | { rejectUnauthorized: boolean } {
  if (process.env.NODE_ENV !== 'production') return false;
  if (conn.isInternal) return false;
  return { rejectUnauthorized: false };
}

const sslConfig = buildSslConfig();

console.log('[DB] Initializing PostgreSQL pool', {
  host: conn.host,
  isInternal: conn.isInternal,
  isProxy: conn.isProxy,
  ssl: sslConfig === false ? 'disabled' : JSON.stringify(sslConfig),
  nodeEnv: process.env.NODE_ENV,
});

// ─────────────────────────────────────────────────────────
// Pool — tuned for Railway
// ─────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: conn.url,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: sslConfig,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// ─────────────────────────────────────────────────────────
// Pool events
// ─────────────────────────────────────────────────────────
pool.on('connect', () => {
  isConnected = true;
  lastConnectionError = null;
});

pool.on('error', (err) => {
  isConnected = false;
  lastConnectionError = err;
  console.error('[DB] Pool error:', err.message, '| code:', (err as any).code);
});

// ─────────────────────────────────────────────────────────
// Drizzle — uses the pool we created, never its own.
// ─────────────────────────────────────────────────────────
export const db = drizzle({ client: pool, schema });

// ─────────────────────────────────────────────────────────
// Retry helper — exponential backoff for transient failures
// ─────────────────────────────────────────────────────────
const RETRYABLE_CODES = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE',
  'EAI_AGAIN',                   // DNS resolution failure (transient)
  '57P01',                       // admin_shutdown
  '57P03',                       // cannot_connect_now
  '08006',                       // connection_failure
  '08001',                       // sqlclient_unable_to_establish_sqlconnection
  '08004',                       // sqlserver_rejected_establishment_of_sqlconnection
]);

function isRetryable(err: unknown): boolean {
  const code = (err as any)?.code;
  if (code && RETRYABLE_CODES.has(code)) return true;
  const msg = (err as Error)?.message ?? '';
  return /connection terminated|Connection terminated|socket hang up|ENOTFOUND/.test(msg);
}

export async function queryWithRetry<T>(
  operation: () => Promise<T>,
  label = 'db-op',
): Promise<T> {
  const MAX_RETRIES = 3;
  let delay = 500; // ms

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (err) {
      if (attempt === MAX_RETRIES || !isRetryable(err)) throw err;
      console.warn(
        `[DB] ${label} failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms`,
        (err as Error).message,
      );
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
  throw new Error('unreachable');
}

// ─────────────────────────────────────────────────────────
// Error logger
// ─────────────────────────────────────────────────────────
function logDbError(label: string, err: unknown) {
  const e = err as Error & { code?: string; cause?: unknown; detail?: string; severity?: string };
  console.error(`[DB] ${label}`, {
    message: e.message,
    code: e.code,
    name: e.name,
    detail: e.detail,
    severity: e.severity,
  });
  if (e.cause) {
    const c = e.cause as Error & { code?: string };
    console.error(`[DB] ${label} — cause`, {
      message: c.message,
      code: c.code,
      name: c.name,
      stack: c.stack?.split('\n').slice(0, 5).join('\n'),
    });
  }
  console.error(`[DB] ${label} — stack`, e.stack?.split('\n').slice(0, 8).join('\n'));
}

// ─────────────────────────────────────────────────────────
// Startup verification
// ─────────────────────────────────────────────────────────
export async function verifyDrizzleConnection(): Promise<boolean> {
  // Step 1 — raw pool
  try {
    const r = await pool.query('SELECT 1 AS ok');
    console.log('  ✅ Pool connected          ', r.rows[0]);
  } catch (err) {
    logDbError('Pool SELECT 1 FAILED', err);
    return false;
  }

  // Step 2 — Drizzle through the same pool
  try {
    const r = await db.execute(drizzleSql`SELECT 1 AS test`);
    console.log('  ✅ Drizzle SELECT 1 passed ', JSON.stringify(r.rows?.[0] ?? r));
  } catch (err) {
    logDbError('Drizzle SELECT 1 FAILED', err);
    console.error('[Drizzle] Pool works but Drizzle cannot query.');
    console.error('[Drizzle] Likely cause: pg.types ESM resolution or SSL renegotiation.');
    return false;
  }

  // Step 3 — schema check
  try {
    const r = await db.execute(
      drizzleSql`SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      ) AS ok`
    );
    const exists = (r.rows?.[0] as any)?.ok;
    if (exists) {
      console.log('  ✅ Schema verified          users table found');
    } else {
      console.error('  ❌ Schema missing — users table not found. Run migrations.');
      return false;
    }
  } catch (err) {
    logDbError('Schema check FAILED', err);
    return false;
  }

  return true;
}

// ─────────────────────────────────────────────────────────
// Status helpers (used by health-check endpoints)
// ─────────────────────────────────────────────────────────
export function isDatabaseConnected(): boolean {
  return isConnected;
}

export function getLastConnectionError(): Error | null {
  return lastConnectionError;
}

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
    return false;
  }
}

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

// ─────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────
export { schema };
export { pool };

export async function closeDb() {
  await pool.end();
  isConnected = false;
  console.log('[DB] Pool closed');
}
