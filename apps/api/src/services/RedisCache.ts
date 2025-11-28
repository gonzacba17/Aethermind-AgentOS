import { Redis } from 'ioredis';

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

export class RedisCache {
  private redis: Redis | null = null;
  private prefix: string;
  private enabled: boolean;

  constructor(redisUrl?: string, prefix: string = 'cache') {
    this.prefix = prefix;
    this.enabled = !!redisUrl;

    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          enableOfflineQueue: false,
          lazyConnect: true,
        });

        this.redis.on('error', (err) => {
          console.error('Redis cache error:', err);
        });

        this.redis.on('connect', () => {
          console.log('Redis cache connected');
        });
      } catch (error) {
        console.warn('Failed to initialize Redis cache:', error);
        this.enabled = false;
      }
    }
  }

  async connect(): Promise<boolean> {
    if (!this.redis) return false;

    try {
      await this.redis.connect();
      return true;
    } catch (error) {
      console.warn('Redis cache connection failed:', error);
      this.enabled = false;
      return false;
    }
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async get<T = string>(key: string): Promise<T | null> {
    if (!this.enabled || !this.redis) return null;

    try {
      const value = await this.redis.get(this.getKey(key));
      if (!value) return null;

      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, value: unknown, ttl?: number): Promise<boolean> {
    if (!this.enabled || !this.redis) return false;

    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (ttl) {
        await this.redis.setex(this.getKey(key), ttl, serialized);
      } else {
        await this.redis.set(this.getKey(key), serialized);
      }
      
      return true;
    } catch (error) {
      console.error('Redis set error:', error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.enabled || !this.redis) return false;

    try {
      await this.redis.del(this.getKey(key));
      return true;
    } catch (error) {
      console.error('Redis del error:', error);
      return false;
    }
  }

  async has(key: string): Promise<boolean> {
    if (!this.enabled || !this.redis) return false;

    try {
      const exists = await this.redis.exists(this.getKey(key));
      return exists === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    if (!this.enabled || !this.redis) return 0;

    try {
      const keys = await this.redis.keys(this.getKey(pattern));
      if (keys.length === 0) return 0;

      await this.redis.del(...keys);
      return keys.length;
    } catch (error) {
      console.error('Redis invalidatePattern error:', error);
      return 0;
    }
  }

  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
