// Redis is completely disabled in production
// This module exports safe no-op implementations for graceful fallback

console.log('ℹ️ Redis cache is disabled - using in-memory fallback');

class RedisCache {
  async get(key: string): Promise<string | null> {
    return null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    // No-op: cache writes are silently ignored
  }

  async del(key: string): Promise<void> {
    // No-op: cache deletes are silently ignored
  }

  async has(key: string): Promise<boolean> {
    return false;
  }

  async invalidatePattern(pattern: string): Promise<number> {
    return 0;
  }

  async clear(): Promise<void> {
    // No-op: cache clears are silently ignored
  }

  isConnected(): boolean {
    return false;
  }

  isAvailable(): boolean {
    return false;
  }

  async close(): Promise<void> {
    // No-op: nothing to close
  }
}

const cache = new RedisCache();

export default cache;
export { RedisCache };
export const redis = null;
export const isAvailable = false;
