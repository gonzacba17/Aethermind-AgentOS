/**
 * Redis Service for Session Exchange and Caching
 * 
 * This is the REAL Redis implementation using ioredis.
 * Falls back gracefully to in-memory Map if Redis is not available.
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
  private isConnected: boolean = false;
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
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis connection error:', err.message);
        this.isConnected = false;
        
        // Fallback to memory if Redis fails after initial connection
        if (!this.useMemoryFallback) {
          console.log('⚠️ Falling back to in-memory session store');
          this.useMemoryFallback = true;
        }
      });

      this.client.on('close', () => {
        console.log('🔌 Redis connection closed');
        this.isConnected = false;
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
    return this.isConnected && !this.useMemoryFallback;
  }

  /**
   * Set a key with expiration (seconds)
   */
  async setex(key: string, seconds: number, value: string): Promise<void> {
    if (this.client && this.isConnected && !this.useMemoryFallback) {
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
    if (this.client && this.isConnected && !this.useMemoryFallback) {
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
    if (this.client && this.isConnected && !this.useMemoryFallback) {
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
  async set(key: string, value: string): Promise<void> {
    if (this.client && this.isConnected && !this.useMemoryFallback) {
      try {
        await this.client.set(key, value);
        return;
      } catch (error) {
        console.error(`Redis SET error for key ${key}:`, error);
        // Fall through to memory fallback
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
  async exists(key: string): Promise<boolean> {
    if (this.client && this.isConnected && !this.useMemoryFallback) {
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
      this.isConnected = false;
    }
  }
}

// Export singleton instance
const redisService = new RedisService();

export default redisService;
export { RedisService };
