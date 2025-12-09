import Redis from 'ioredis';

let redis: Redis | null = null;
let isAvailable = false;

const REDIS_URL = process.env.REDIS_URL;

if (REDIS_URL) {
  try {
    redis = new Redis(REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      connectTimeout: 5000,
      retryStrategy(times) {
        if (times > 3) {
          console.warn('⚠️ Redis connection failed after 3 retries - continuing without cache');
          return null;
        }
        const delay = Math.min(times * 100, 2000);
        return delay;
      },
    });

    redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
      isAvailable = true;
    });

    redis.on('ready', () => {
      console.log('✅ Redis is ready to accept commands');
      isAvailable = true;
    });

    redis.on('error', (err) => {
      console.warn('⚠️ Redis error (continuing without cache):', err.message);
      isAvailable = false;
    });

    redis.on('close', () => {
      console.warn('⚠️ Redis connection closed - cache unavailable');
      isAvailable = false;
    });

    redis.connect().catch((err) => {
      console.warn('⚠️ Redis connection failed (continuing without cache):', err.message);
      isAvailable = false;
    });

  } catch (error) {
    console.warn('⚠️ Redis initialization failed - continuing without cache:', error instanceof Error ? error.message : error);
    redis = null;
  }
} else {
  console.log('ℹ️ REDIS_URL not configured - running without Redis cache (using fallback)');
}

class RedisCache {
  async get(key: string): Promise<string | null> {
    if (!redis || !isAvailable) return null;
    try {
      return await redis.get(key);
    } catch (error) {
      console.warn('⚠️ Redis get error (returning null):', error instanceof Error ? error.message : error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!redis || !isAvailable) return;
    try {
      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, value);
      } else {
        await redis.set(key, value);
      }
    } catch (error) {
      console.warn('⚠️ Redis set error (cache miss):', error instanceof Error ? error.message : error);
    }
  }

  async del(key: string): Promise<void> {
    if (!redis || !isAvailable) return;
    try {
      await redis.del(key);
    } catch (error) {
      console.warn('⚠️ Redis del error (ignoring):', error instanceof Error ? error.message : error);
    }
  }

  async has(key: string): Promise<boolean> {
    if (!redis || !isAvailable) return false;
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.warn('⚠️ Redis exists error (returning false):', error instanceof Error ? error.message : error);
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    if (!redis || !isAvailable) return 0;
    try {
      const keys = await redis.keys(pattern);
      if (keys.length === 0) return 0;
      return await redis.del(...keys);
    } catch (error) {
      console.warn('⚠️ Redis invalidatePattern error (returning 0):', error instanceof Error ? error.message : error);
      return 0;
    }
  }

  async clear(): Promise<void> {
    if (!redis || !isAvailable) return;
    try {
      await redis.flushdb();
    } catch (error) {
      console.warn('⚠️ Redis clear error (ignoring):', error instanceof Error ? error.message : error);
    }
  }

  isConnected(): boolean {
    return isAvailable;
  }

  isAvailable(): boolean {
    return isAvailable;
  }

  async close(): Promise<void> {
    if (redis) {
      try {
        await redis.quit();
        console.log('✅ Redis connection closed gracefully');
        isAvailable = false;
      } catch (error) {
        console.warn('⚠️ Error closing Redis connection:', error instanceof Error ? error.message : error);
      }
    }
  }
}

const cache = new RedisCache();

export default cache;
export { RedisCache, redis, isAvailable };
