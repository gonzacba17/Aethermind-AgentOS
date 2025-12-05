import { Redis } from 'ioredis';

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

export class RedisCache {
  private redis: Redis | null = null;
  private prefix: string;
  private enabled: boolean;
  private isAvailable: boolean = false;

  constructor(redisUrl?: string, prefix: string = 'cache') {
    this.prefix = prefix;
    this.enabled = !!redisUrl;

    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          enableOfflineQueue: false,
          lazyConnect: true,
          retryStrategy(times) {
            if (times > 3) {
              console.warn(`⚠️ Redis connection failed after 3 retries (${prefix})`);
              return null;
            }
            return Math.min(times * 100, 2000);
          },
          reconnectOnError(err) {
            console.warn(`⚠️ Redis reconnect error (${prefix}):`, err.message);
            return false;
          }
        });

        this.redis.on('connect', () => {
          console.log(`✅ Redis connected successfully (${prefix})`);
          this.isAvailable = true;
        });

        this.redis.on('error', (err) => {
          console.warn(`⚠️ Redis error (${prefix}):`, err.message);
          this.isAvailable = false;
        });

        this.redis.on('close', () => {
          console.warn(`⚠️ Redis connection closed (${prefix})`);
          this.isAvailable = false;
        });
      } catch (error) {
        console.warn(`⚠️ Redis initialization failed (${prefix}), running without cache`);
        this.enabled = false;
        this.redis = null;
      }
    } else {
      console.log(`ℹ️ REDIS_URL not configured for ${prefix}, running without Redis (cache disabled)`);
    }
  }

  async connect(): Promise<boolean> {
    if (!this.redis) return false;

    try {
      await this.redis.connect();
      this.isAvailable = true;
      return true;
    } catch (error) {
      console.warn(`⚠️ Redis cache connection failed (${this.prefix}):`, error);
      this.enabled = false;
      this.isAvailable = false;
      return false;
    }
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async get<T = string>(key: string): Promise<T | null> {
    if (!this.enabled || !this.redis || !this.isAvailable) return null;

    try {
      const value = await this.redis.get(this.getKey(key));
      if (!value) return null;

      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      console.warn(`⚠️ Redis get error (${this.prefix}), continuing without cache:`, (error as Error).message);
      this.isAvailable = false;
      return null;
    }
  }

  async set(key: string, value: unknown, ttl?: number): Promise<boolean> {
    if (!this.enabled || !this.redis || !this.isAvailable) return false;

    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (ttl) {
        await this.redis.setex(this.getKey(key), ttl, serialized);
      } else {
        await this.redis.set(this.getKey(key), serialized);
      }
      
      return true;
    } catch (error) {
      console.warn(`⚠️ Redis set error (${this.prefix}), continuing without cache:`, (error as Error).message);
      this.isAvailable = false;
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.enabled || !this.redis || !this.isAvailable) return false;

    try {
      await this.redis.del(this.getKey(key));
      return true;
    } catch (error) {
      console.warn(`⚠️ Redis del error (${this.prefix}), continuing without cache:`, (error as Error).message);
      this.isAvailable = false;
      return false;
    }
  }

  async has(key: string): Promise<boolean> {
    if (!this.enabled || !this.redis || !this.isAvailable) return false;

    try {
      const exists = await this.redis.exists(this.getKey(key));
      return exists === 1;
    } catch (error) {
      console.warn(`⚠️ Redis exists error (${this.prefix}), continuing without cache:`, (error as Error).message);
      this.isAvailable = false;
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    if (!this.enabled || !this.redis || !this.isAvailable) return 0;

    try {
      const keys = await this.redis.keys(this.getKey(pattern));
      if (keys.length === 0) return 0;

      await this.redis.del(...keys);
      return keys.length;
    } catch (error) {
      console.warn(`⚠️ Redis invalidatePattern error (${this.prefix}), continuing without cache:`, (error as Error).message);
      this.isAvailable = false;
      return 0;
    }
  }

  async close(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch (error) {
        console.warn(`⚠️ Error closing Redis connection (${this.prefix}):`, (error as Error).message);
      }
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isConnected(): boolean {
    return this.isAvailable;
  }
}
