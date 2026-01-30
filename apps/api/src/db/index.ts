import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Connection status tracking
let isConnected = false;
let lastConnectionError: Error | null = null;
let connectionAttempts = 0;

// Create PostgreSQL connection pool (optimized for Railway)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Reduced for Railway tier compatibility
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Faster failure detection
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Enhanced logging for connection diagnostics
pool.on('connect', () => {
  isConnected = true;
  lastConnectionError = null;
  console.log('✅ Database pool connection established');
});

pool.on('error', (err) => {
  isConnected = false;
  lastConnectionError = err;
  console.error('❌ Unexpected database pool error:', err.message);
  console.error('   Error code:', (err as any).code);
});

pool.on('remove', () => {
  console.log('🔌 Database connection removed from pool');
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

// Create and export Drizzle instance
export const db = drizzle(pool, { schema });

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
