/**
 * Unit tests for RedisService — the unified cache service.
 * Replaces the old RedisCache.test.ts (RedisCache was eliminated in Phase 3c).
 *
 * RedisService is a singleton that:
 *  - Connects to Redis via REDIS_URL env var
 *  - Falls back to an in-memory Map when Redis is unavailable
 *  - Exposes: get, set, setex, del, has, exists, invalidatePattern, clear, close
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// We need to mock ioredis AND process.env BEFORE importing RedisService.
// Since RedisService auto-initializes in its constructor, we must control the env.

// Mock ioredis
const mockRedisInstance = {
  setex: jest.fn<() => Promise<string>>().mockResolvedValue('OK'),
  get: jest.fn<() => Promise<string | null>>().mockResolvedValue(null),
  set: jest.fn<() => Promise<string>>().mockResolvedValue('OK'),
  del: jest.fn<() => Promise<number>>().mockResolvedValue(1),
  exists: jest.fn<() => Promise<number>>().mockResolvedValue(0),
  keys: jest.fn<() => Promise<string[]>>().mockResolvedValue([]),
  flushdb: jest.fn<() => Promise<string>>().mockResolvedValue('OK'),
  quit: jest.fn<() => Promise<string>>().mockResolvedValue('OK'),
  on: jest.fn(),
};

jest.mock('ioredis', () => {
  return {
    default: jest.fn().mockImplementation(() => mockRedisInstance),
    __esModule: true,
  };
});

// Import the CLASS (not the singleton) so we can control instantiation
import { RedisService } from '../../src/services/RedisService';

describe('RedisService', () => {
  let originalRedisUrl: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    originalRedisUrl = process.env.REDIS_URL;
  });

  afterEach(() => {
    // Restore env
    if (originalRedisUrl !== undefined) {
      process.env.REDIS_URL = originalRedisUrl;
    } else {
      delete process.env.REDIS_URL;
    }
  });

  describe('Initialization', () => {
    it('uses memory fallback when REDIS_URL is not set', () => {
      delete process.env.REDIS_URL;
      const service = new RedisService();

      expect(service.isAvailable()).toBe(false);
      expect(service.isConnected()).toBe(false);
    });

    it('attempts Redis connection when REDIS_URL is set', () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const service = new RedisService();

      // Client was created (ioredis constructor called)
      // isConnected depends on the 'connect' event, which we haven't fired
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('Memory Fallback Operations', () => {
    let service: RedisService;

    beforeEach(() => {
      delete process.env.REDIS_URL;
      service = new RedisService();
    });

    it('set and get a value (no TTL)', async () => {
      await service.set('key1', 'value1');
      const result = await service.get('key1');
      expect(result).toBe('value1');
    });

    it('set and get via setex (with TTL)', async () => {
      await service.setex('key2', 60, 'value2');
      const result = await service.get('key2');
      expect(result).toBe('value2');
    });

    it('set with optional TTL delegates to setex', async () => {
      await service.set('key3', 'value3', 120);
      const result = await service.get('key3');
      expect(result).toBe('value3');
    });

    it('returns null for non-existent key', async () => {
      const result = await service.get('nonexistent');
      expect(result).toBeNull();
    });

    it('del removes a key', async () => {
      await service.set('delme', 'gone');
      await service.del('delme');
      const result = await service.get('delme');
      expect(result).toBeNull();
    });

    it('has/exists returns true for existing key', async () => {
      await service.set('existskey', 'yes');
      expect(await service.has('existskey')).toBe(true);
      expect(await service.exists('existskey')).toBe(true);
    });

    it('has/exists returns false for missing key', async () => {
      expect(await service.has('nope')).toBe(false);
      expect(await service.exists('nope')).toBe(false);
    });

    it('invalidatePattern removes matching keys', async () => {
      await service.set('user:1', 'a');
      await service.set('user:2', 'b');
      await service.set('session:1', 'c');

      const count = await service.invalidatePattern('user:*');
      expect(count).toBe(2);

      expect(await service.get('user:1')).toBeNull();
      expect(await service.get('user:2')).toBeNull();
      expect(await service.get('session:1')).toBe('c');
    });

    it('invalidatePattern returns 0 when nothing matches', async () => {
      const count = await service.invalidatePattern('nothing:*');
      expect(count).toBe(0);
    });

    it('clear removes all keys', async () => {
      await service.set('a', '1');
      await service.set('b', '2');
      await service.clear();

      expect(await service.get('a')).toBeNull();
      expect(await service.get('b')).toBeNull();
    });

    it('close does not throw when no Redis client', async () => {
      await expect(service.close()).resolves.not.toThrow();
    });
  });

  describe('isConnected / isAvailable', () => {
    it('isConnected returns false when using memory fallback', () => {
      delete process.env.REDIS_URL;
      const service = new RedisService();
      expect(service.isConnected()).toBe(false);
    });

    it('isAvailable returns false when using memory fallback', () => {
      delete process.env.REDIS_URL;
      const service = new RedisService();
      expect(service.isAvailable()).toBe(false);
    });
  });
});
