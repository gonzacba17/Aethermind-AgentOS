import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Log connection status in development
if (process.env.NODE_ENV === 'development') {
  pool.on('connect', () => {
    console.log('✅ Database pool connection established');
  });

  pool.on('error', (err) => {
    console.error('❌ Unexpected database pool error:', err);
  });
}

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
