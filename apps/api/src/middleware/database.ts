import { pool } from '../db';
import logger from '../utils/logger';

/**
 * Database connection status
 */
interface DatabaseStatus {
  isConnected: boolean;
  lastError: Error | null;
  lastCheckAt: Date | null;
  latencyMs: number | null;
}

let dbStatus: DatabaseStatus = {
  isConnected: false,
  lastError: null,
  lastCheckAt: null,
  latencyMs: null,
};

/**
 * Check database connection health
 * @returns Promise<boolean> - true if connected, false otherwise
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  const startTime = Date.now();
  
  try {
    await pool.query('SELECT 1');
    
    dbStatus = {
      isConnected: true,
      lastError: null,
      lastCheckAt: new Date(),
      latencyMs: Date.now() - startTime,
    };
    
    return true;
  } catch (error) {
    dbStatus = {
      isConnected: false,
      lastError: error as Error,
      lastCheckAt: new Date(),
      latencyMs: null,
    };
    
    logger.error('❌ Database health check failed', {
      error: (error as Error).message,
      code: (error as any).code,
    });
    
    return false;
  }
}

/**
 * Get current database connection status
 */
export function getDatabaseStatus(): DatabaseStatus {
  return { ...dbStatus };
}

/**
 * Measure database latency
 * @returns Promise<number | null> - latency in ms, or null if connection failed
 */
export async function measureDatabaseLatency(): Promise<number | null> {
  const startTime = Date.now();
  
  try {
    await pool.query('SELECT 1');
    return Date.now() - startTime;
  } catch {
    return null;
  }
}

/**
 * Retry options for database operations
 */
interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a database operation with exponential backoff
 * @param operation - The async function to retry
 * @param options - Retry configuration
 * @returns Promise<T> - Result of the operation
 * @throws Error if all retries fail
 */
export async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | null = null;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`🔄 Database operation attempt ${attempt}/${maxRetries}`);
      const result = await operation();
      
      if (attempt > 1) {
        logger.info(`✅ Database operation succeeded on attempt ${attempt}`);
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      logger.warn(`⚠️ Database operation failed (attempt ${attempt}/${maxRetries})`, {
        error: (error as Error).message,
        code: (error as any).code,
        nextRetryIn: attempt < maxRetries ? `${delay}ms` : 'no more retries',
      });

      if (attempt < maxRetries) {
        await sleep(delay);
        delay = Math.min(delay * backoffMultiplier, maxDelayMs);
      }
    }
  }

  throw lastError || new Error('All database operation retries failed');
}

/**
 * Verify database connection on server startup
 * Shows clear warning if database is not available
 */
export async function verifyDatabaseOnStartup(): Promise<boolean> {
  console.log('\n🔍 Verifying database connection...');
  
  // Check if DATABASE_URL is configured
  if (!process.env.DATABASE_URL) {
    console.error('╔══════════════════════════════════════════════════════════════╗');
    console.error('║  ❌ DATABASE_URL NOT CONFIGURED                              ║');
    console.error('╠══════════════════════════════════════════════════════════════╣');
    console.error('║  OAuth users will be created as TEMPORARY (in-memory) users  ║');
    console.error('║  These users CANNOT update their plan or persist data        ║');
    console.error('║                                                              ║');
    console.error('║  To fix: Set DATABASE_URL in Railway environment variables   ║');
    console.error('║  Format: postgresql://user:password@host:5432/database       ║');
    console.error('╚══════════════════════════════════════════════════════════════╝');
    return false;
  }

  // Try to connect with retries
  try {
    const connected = await retryDatabaseOperation(
      async () => {
        const result = await pool.query('SELECT NOW() as time');
        return result.rows[0];
      },
      { maxRetries: 3, initialDelayMs: 2000 }
    );

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ DATABASE CONNECTION ESTABLISHED                          ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Server time: ${connected.time}                      ║`);
    console.log('║  OAuth users will be persisted correctly                     ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    dbStatus.isConnected = true;
    return true;
  } catch (error) {
    console.error('╔══════════════════════════════════════════════════════════════╗');
    console.error('║  ⚠️  DATABASE CONNECTION FAILED                              ║');
    console.error('╠══════════════════════════════════════════════════════════════╣');
    console.error(`║  Error: ${(error as Error).message.substring(0, 50).padEnd(50)} ║`);
    console.error('║                                                              ║');
    console.error('║  OAuth users will be created as TEMPORARY (in-memory) users  ║');
    console.error('║  The server will continue but with degraded functionality    ║');
    console.error('╚══════════════════════════════════════════════════════════════╝\n');
    
    dbStatus.isConnected = false;
    dbStatus.lastError = error as Error;
    return false;
  }
}

export default {
  checkDatabaseConnection,
  getDatabaseStatus,
  measureDatabaseLatency,
  retryDatabaseOperation,
  verifyDatabaseOnStartup,
};
