import Redis from 'ioredis';

let redis: Redis | null = null;
let isAvailable = false;

const REDIS_URL = process.env.REDIS_URL;

if (REDIS_URL) {
  try {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy(times) {
        if (times > 3) {
          console.warn('⚠️ Redis connection failed after 3 retries');
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
      console.warn('⚠️ Redis error:', err.message);
      isAvailable = false;
    });

    redis.on('close', () => {
      console.warn('⚠️ Redis connection closed');
      isAvailable = false;
    });

  } catch (error) {
    console.error('❌ Redis initialization failed:', error);
    redis = null;
  }
} else {
  console.log('ℹ️ REDIS_URL not configured, running without Redis cache');
}

class RedisCache {
  async get(key: string): Promise<string | null> {
    if (!redis || !isAvailable) return null;
    try {
      return await redis.get(key);
    } catch (error) {
      console.warn('Redis get error:', error);
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
      console.warn('Redis set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    if (!redis || !isAvailable) return;
    try {
      await redis.del(key);
    } catch (error) {
      console.warn('Redis del error:', error);
    }
  }

  async has(key: string): Promise<boolean> {
    if (!redis || !isAvailable) return false;
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.warn('Redis exists error:', error);
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
      console.warn('Redis invalidatePattern error:', error);
      return 0;
    }
  }

  isConnected(): boolean {
    return isAvailable;
  }

  async close(): Promise<void> {
    if (redis) {
      try {
        await redis.quit();
        console.log('✅ Redis connection closed gracefully');
      } catch (error) {
        console.warn('⚠️ Error closing Redis connection:', error);
      }
    }
  }
}

const cache = new RedisCache();

export default cache;
export { RedisCache, redis, isAvailable };
