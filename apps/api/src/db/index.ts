import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 25, // Maximum number of connections in the pool (increased for better concurrency)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased from 2s to 10s for Railway/network latency
});

// Enhanced logging for connection diagnostics
pool.on('connect', () => {
  console.log('✅ Database pool connection established');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err);
  console.error('   Error code:', (err as any).code);
  console.error('   Error details:', err.message);
});

pool.on('remove', () => {
  console.log('🔌 Database connection removed from pool');
});

// Create and export Drizzle instance
export const db = drizzle(pool, { schema });

// Export schema for use in queries
export { schema };

// Helper function to close database connections (useful for tests and graceful shutdown)
export async function closeDb() {
  await pool.end();
  console.log('Database pool closed');
}

// Export pool for advanced use cases
export { pool };
