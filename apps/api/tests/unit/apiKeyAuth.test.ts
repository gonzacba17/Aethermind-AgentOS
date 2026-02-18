/**
 * Unit tests for apiKeyAuth middleware
 * Tests: prefix lookup, cache hit, cache miss, invalid key
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import crypto from 'crypto';

// Mock the database module
jest.mock('../../src/db', () => ({
  db: {
    select: jest.fn(),
  },
}));

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

// Import after mocks
import { apiKeyAuth, apiKeyAuthCached, extractKeyPrefix, hashForCache, apiKeyCache } from '../../src/middleware/apiKeyAuth';
import { db } from '../../src/db';
import bcrypt from 'bcryptjs';

function createMockReqRes(apiKey?: string) {
  const req: any = {
    headers: apiKey ? { 'x-api-key': apiKey } : {},
    organizationId: undefined,
    organization: undefined,
  };
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('apiKeyAuth middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiKeyCache.clear();
  });

  describe('extractKeyPrefix', () => {
    test('extracts first 8 chars after aether_ prefix', () => {
      const key = 'aether_abcdefgh1234567890';
      expect(extractKeyPrefix(key)).toBe('abcdefgh');
    });

    test('extracts first 8 chars of non-prefixed key', () => {
      const key = 'no_prefix_key_here';
      expect(extractKeyPrefix(key)).toBe('no_prefi');
    });
  });

  describe('hashForCache', () => {
    test('returns SHA-256 hex hash', () => {
      const key = 'aether_testkey123';
      const expected = crypto.createHash('sha256').update(key).digest('hex');
      expect(hashForCache(key)).toBe(expected);
    });

    test('same key produces same hash', () => {
      const key = 'aether_consistent';
      expect(hashForCache(key)).toBe(hashForCache(key));
    });

    test('different keys produce different hashes', () => {
      expect(hashForCache('aether_key1')).not.toBe(hashForCache('aether_key2'));
    });
  });

  describe('apiKeyAuth', () => {
    test('returns 401 when no X-API-Key header', async () => {
      const { req, res, next } = createMockReqRes();

      await apiKeyAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Missing X-API-Key header' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 for key not starting with aether_', async () => {
      const { req, res, next } = createMockReqRes('invalid_key_format');

      await apiKeyAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid API key format' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 when no org matches prefix', async () => {
      const key = 'aether_abcdefgh1234567890';

      // Mock DB to return empty results
      (db.select as jest.Mock<any>).mockReturnValue({
        from: (jest.fn() as jest.Mock<any>).mockReturnValue({
          where: (jest.fn() as jest.Mock<any>).mockResolvedValue([]),
        }),
      });

      const { req, res, next } = createMockReqRes(key);
      await apiKeyAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid API key' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 when bcrypt comparison fails', async () => {
      const key = 'aether_abcdefgh1234567890';

      const mockOrg = {
        id: 'org-1',
        name: 'Test Org',
        apiKeyHash: '$2a$10$fakehash',
        plan: 'FREE',
        rateLimitPerMin: 100,
      };

      (db.select as jest.Mock<any>).mockReturnValue({
        from: (jest.fn() as jest.Mock<any>).mockReturnValue({
          where: (jest.fn() as jest.Mock<any>).mockResolvedValue([mockOrg]),
        }),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false as never);

      const { req, res, next } = createMockReqRes(key);
      await apiKeyAuth(req, res, next);

      expect(bcrypt.compare).toHaveBeenCalledWith(key, mockOrg.apiKeyHash);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('calls next and sets org context when key matches', async () => {
      const key = 'aether_abcdefgh1234567890';

      const mockOrg = {
        id: 'org-1',
        name: 'Test Org',
        apiKeyHash: '$2a$10$fakehash',
        plan: 'FREE',
        rateLimitPerMin: 100,
      };

      (db.select as jest.Mock<any>).mockReturnValue({
        from: (jest.fn() as jest.Mock<any>).mockReturnValue({
          where: (jest.fn() as jest.Mock<any>).mockResolvedValue([mockOrg]),
        }),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true as never);

      const { req, res, next } = createMockReqRes(key);
      await apiKeyAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.organizationId).toBe('org-1');
      expect(req.organization).toEqual({
        id: 'org-1',
        name: 'Test Org',
        plan: 'FREE',
        rateLimitPerMin: 100,
      });
    });
  });

  describe('apiKeyAuthCached', () => {
    test('uses cached result on second call', async () => {
      const key = 'aether_cachedkey12345';
      const cacheKey = hashForCache(key);

      // Pre-populate cache
      apiKeyCache.set(cacheKey, {
        organizationId: 'org-cached',
        organization: {
          id: 'org-cached',
          name: 'Cached Org',
          plan: 'PRO',
          rateLimitPerMin: 500,
        },
      });

      const { req, res, next } = createMockReqRes(key);
      await apiKeyAuthCached(req, res, next);

      // Should NOT have called the database
      expect(db.select).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
      expect(req.organizationId).toBe('org-cached');
    });

    test('cache key is SHA-256 hash, not plaintext', () => {
      const key = 'aether_sensitivekey123';
      const cacheKey = hashForCache(key);

      // Verify it's a 64-character hex string (SHA-256)
      expect(cacheKey).toHaveLength(64);
      expect(cacheKey).toMatch(/^[0-9a-f]{64}$/);

      // Verify plaintext is NOT the cache key
      expect(cacheKey).not.toBe(key);
    });

    test('returns 401 when no API key on cached path', async () => {
      const { req, res, next } = createMockReqRes();

      await apiKeyAuthCached(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
