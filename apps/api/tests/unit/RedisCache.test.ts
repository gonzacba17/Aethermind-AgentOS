import { RedisCache } from '../../src/services/RedisCache';
import { Redis } from 'ioredis';

jest.mock('ioredis');

describe('RedisCache', () => {
  let cache: RedisCache;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRedis = {
      connect: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      keys: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
    } as any;

    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis);
  });

  describe('Initialization', () => {
    it('initializes with Redis URL', () => {
      cache = new RedisCache('redis://localhost:6379', 'test');
      expect(cache.isEnabled()).toBe(true);
    });

    it('disables when no Redis URL provided', () => {
      cache = new RedisCache(undefined, 'test');
      expect(cache.isEnabled()).toBe(false);
    });
  });

  describe('Connection', () => {
    it('connects successfully', async () => {
      cache = new RedisCache('redis://localhost:6379');
      const connected = await cache.connect();
      
      expect(connected).toBe(true);
      expect(mockRedis.connect).toHaveBeenCalled();
    });

    it('handles connection failure', async () => {
      mockRedis.connect.mockRejectedValue(new Error('Connection failed'));
      cache = new RedisCache('redis://localhost:6379');
      
      const connected = await cache.connect();
      expect(connected).toBe(false);
      expect(cache.isEnabled()).toBe(false);
    });

    it('returns false when Redis not initialized', async () => {
      cache = new RedisCache(undefined);
      const connected = await cache.connect();
      
      expect(connected).toBe(false);
    });
  });

  describe('Get/Set Operations', () => {
    beforeEach(async () => {
      cache = new RedisCache('redis://localhost:6379', 'test');
      await cache.connect();
    });

    it('sets and gets string value', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue('test-value');

      await cache.set('key1', 'test-value');
      const value = await cache.get('key1');

      expect(mockRedis.set).toHaveBeenCalledWith('test:key1', 'test-value');
      expect(value).toBe('test-value');
    });

    it('sets and gets JSON value', async () => {
      const obj = { foo: 'bar', num: 42 };
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(JSON.stringify(obj));

      await cache.set('key2', obj);
      const value = await cache.get('key2');

      expect(mockRedis.set).toHaveBeenCalledWith('test:key2', JSON.stringify(obj));
      expect(value).toEqual(obj);
    });

    it('sets value with TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cache.set('key3', 'value', 3600);

      expect(mockRedis.setex).toHaveBeenCalledWith('test:key3', 3600, 'value');
    });

    it('returns null for non-existent key', async () => {
      mockRedis.get.mockResolvedValue(null);

      const value = await cache.get('non-existent');
      expect(value).toBeNull();
    });

    it('returns null when disabled', async () => {
      cache = new RedisCache(undefined);
      const value = await cache.get('key');
      
      expect(value).toBeNull();
    });

    it('returns false for set when disabled', async () => {
      cache = new RedisCache(undefined);
      const result = await cache.set('key', 'value');
      
      expect(result).toBe(false);
    });
  });

  describe('Delete Operations', () => {
    beforeEach(async () => {
      cache = new RedisCache('redis://localhost:6379', 'test');
      await cache.connect();
    });

    it('deletes key', async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await cache.del('key1');

      expect(mockRedis.del).toHaveBeenCalledWith('test:key1');
      expect(result).toBe(true);
    });

    it('returns false when disabled', async () => {
      cache = new RedisCache(undefined);
      const result = await cache.del('key');
      
      expect(result).toBe(false);
    });
  });

  describe('Existence Check', () => {
    beforeEach(async () => {
      cache = new RedisCache('redis://localhost:6379', 'test');
      await cache.connect();
    });

    it('checks if key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const exists = await cache.has('key1');

      expect(mockRedis.exists).toHaveBeenCalledWith('test:key1');
      expect(exists).toBe(true);
    });

    it('returns false when key does not exist', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const exists = await cache.has('key1');
      expect(exists).toBe(false);
    });

    it('returns false when disabled', async () => {
      cache = new RedisCache(undefined);
      const exists = await cache.has('key');
      
      expect(exists).toBe(false);
    });
  });

  describe('Pattern Invalidation', () => {
    beforeEach(async () => {
      cache = new RedisCache('redis://localhost:6379', 'test');
      await cache.connect();
    });

    it('invalidates keys matching pattern', async () => {
      mockRedis.keys.mockResolvedValue(['test:user:1', 'test:user:2']);
      mockRedis.del.mockResolvedValue(2);

      const count = await cache.invalidatePattern('user:*');

      expect(mockRedis.keys).toHaveBeenCalledWith('test:user:*');
      expect(mockRedis.del).toHaveBeenCalledWith('test:user:1', 'test:user:2');
      expect(count).toBe(2);
    });

    it('returns 0 when no keys match', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const count = await cache.invalidatePattern('nonexistent:*');
      expect(count).toBe(0);
    });

    it('returns 0 when disabled', async () => {
      cache = new RedisCache(undefined);
      const count = await cache.invalidatePattern('pattern:*');
      
      expect(count).toBe(0);
    });
  });

  describe('Close', () => {
    it('closes Redis connection', async () => {
      cache = new RedisCache('redis://localhost:6379');
      await cache.connect();
      await cache.close();

      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('handles close when not connected', async () => {
      cache = new RedisCache(undefined);
      await expect(cache.close()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      cache = new RedisCache('redis://localhost:6379', 'test');
      await cache.connect();
    });

    it('handles get error gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const value = await cache.get('key');
      expect(value).toBeNull();
    });

    it('handles set error gracefully', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis error'));

      const result = await cache.set('key', 'value');
      expect(result).toBe(false);
    });

    it('handles del error gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      const result = await cache.del('key');
      expect(result).toBe(false);
    });

    it('handles exists error gracefully', async () => {
      mockRedis.exists.mockRejectedValue(new Error('Redis error'));

      const exists = await cache.has('key');
      expect(exists).toBe(false);
    });

    it('handles invalidatePattern error gracefully', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      const count = await cache.invalidatePattern('pattern:*');
      expect(count).toBe(0);
    });
  });
});
