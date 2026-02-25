/**
 * Redis Service for Caching and Session Exchange
 * 
 * Real Redis implementation using ioredis.
 * Falls back gracefully to in-memory Map if Redis is not available.
 * 
 * This is the single cache service for the entire API — replaces the old
 * no-op RedisCache stub that was previously used as `authCache`.
 */
import Redis from 'ioredis';

// In-memory fallback for development/when Redis is unavailable
const memoryStore = new Map<string, { value: string; expiresAt: number }>();

// Cleanup expired entries from memory store periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of memoryStore.entries()) {
    if (data.expiresAt && data.expiresAt < now) {
      memoryStore.delete(key);
    }
  }
}, 60 * 1000); // Every minute

class RedisService {
  private client: Redis | null = null;
  private _isConnected: boolean = false;
  private useMemoryFallback: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      console.log('⚠️ REDIS_URL not configured - using in-memory fallback for session exchange');
      this.useMemoryFallback = true;
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        connectTimeout: 10000,
        lazyConnect: false,
        retryStrategy: (times) => {
          if (times > 3) return null; // Stop retrying
          return Math.min(times * 100, 3000); // Retry delay
        },
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected successfully');
        this._isConnected = true;
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis connection error:', err.message);
        this._isConnected = false;
        
        // Fallback to memory if Redis fails after initial connection
        if (!this.useMemoryFallback) {
          console.log('⚠️ Falling back to in-memory session store');
          this.useMemoryFallback = true;
        }
      });

      this.client.on('close', () => {
        console.log('🔌 Redis connection closed');
        this._isConnected = false;
      });

      this.client.on('reconnecting', () => {
        console.log('🔄 Redis reconnecting...');
      });

    } catch (error) {
      console.error('❌ Failed to initialize Redis:', error);
      this.useMemoryFallback = true;
    }
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this._isConnected && !this.useMemoryFallback;
  }

  /**
   * Alias for isAvailable() — used by health check and Express.Request augmentation
   */
  isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Set a key with expiration (seconds)
   */
  async setex(key: string, seconds: number, value: string): Promise<void> {
    if (this.client && this._isConnected && !this.useMemoryFallback) {
      try {
        await this.client.setex(key, seconds, value);
        return;
      } catch (error) {
        console.error(`Redis SETEX error for key ${key}:`, error);
        // Fall through to memory fallback
      }
    }

    // Memory fallback
    memoryStore.set(key, {
      value,
      expiresAt: Date.now() + (seconds * 1000),
    });
  }

  /**
   * Get a key's value
   */
  async get(key: string): Promise<string | null> {
    if (this.client && this._isConnected && !this.useMemoryFallback) {
      try {
        return await this.client.get(key);
      } catch (error) {
        console.error(`Redis GET error for key ${key}:`, error);
        // Fall through to memory fallback
      }
    }

    // Memory fallback
    const data = memoryStore.get(key);
    if (!data) return null;
    
    // Check expiration
    if (data.expiresAt && data.expiresAt < Date.now()) {
      memoryStore.delete(key);
      return null;
    }
    
    return data.value;
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<void> {
    if (this.client && this._isConnected && !this.useMemoryFallback) {
      try {
        await this.client.del(key);
        return;
      } catch (error) {
        console.error(`Redis DEL error for key ${key}:`, error);
        // Fall through to memory fallback
      }
    }

    // Memory fallback
    memoryStore.delete(key);
  }

  /**
   * Set a key (without expiration)
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      return this.setex(key, ttlSeconds, value);
    }
    if (this.client && this._isConnected && !this.useMemoryFallback) {
      try {
        await this.client.set(key, value);
        return;
      } catch (error) {
        console.error(`Redis SET error for key ${key}:`, error);
      }
    }

    // Memory fallback (no expiration)
    memoryStore.set(key, {
      value,
      expiresAt: Infinity,
    });
  }

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    return this.exists(key);
  }

  /**
   * Invalidate keys matching a pattern (e.g. "workflow:*")
   */
  async invalidatePattern(pattern: string): Promise<number> {
    if (this.client && this._isConnected && !this.useMemoryFallback) {
      try {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
        return keys.length;
      } catch (error) {
        console.error(`Redis INVALIDATE error for pattern ${pattern}:`, error);
      }
    }

    // Memory fallback
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    let count = 0;
    for (const key of memoryStore.keys()) {
      if (regex.test(key)) {
        memoryStore.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all cached data
   */
  async clear(): Promise<void> {
    if (this.client && this._isConnected && !this.useMemoryFallback) {
      try {
        await this.client.flushdb();
        return;
      } catch (error) {
        console.error('Redis FLUSHDB error:', error);
      }
    }
    memoryStore.clear();
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    if (this.client && this._isConnected && !this.useMemoryFallback) {
      try {
        const result = await this.client.exists(key);
        return result === 1;
      } catch (error) {
        console.error(`Redis EXISTS error for key ${key}:`, error);
        // Fall through to memory fallback
      }
    }

    // Memory fallback
    const data = memoryStore.get(key);
    if (!data) return false;
    
    if (data.expiresAt && data.expiresAt < Date.now()) {
      memoryStore.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this._isConnected = false;
    }
  }
}

// Export singleton instance
const redisService = new RedisService();

export default redisService;
export { RedisService };
