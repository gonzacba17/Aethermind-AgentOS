import { jest } from '@jest/globals';
import { authMiddleware, configureAuth, verifyApiKey } from '../../src/middleware/auth';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      header: jest.fn() as any,
    };
    mockRes = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn() as any,
    };
    mockNext = jest.fn() as any;
  });

  describe('authMiddleware', () => {
    it('allows request with valid API key', async () => {
      const testKey = 'test-key-12345';
      const hash = await bcrypt.hash(testKey, 10);
      
      configureAuth({ apiKeyHash: hash, enabled: true });
      (mockReq.header as jest.Mock).mockReturnValue(testKey);

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('rejects request with invalid API key', async () => {
      const validKey = 'valid-key';
      const invalidKey = 'invalid-key';
      const hash = await bcrypt.hash(validKey, 10);

      configureAuth({ apiKeyHash: hash, enabled: true });
      (mockReq.header as jest.Mock).mockReturnValue(invalidKey);

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Invalid API key.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('rejects request with missing API key', async () => {
      const hash = await bcrypt.hash('test-key', 10);
      
      configureAuth({ apiKeyHash: hash, enabled: true });
      (mockReq.header as jest.Mock).mockReturnValue(undefined);

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Missing API key. Include X-API-Key header.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('bypasses auth when disabled', async () => {
      configureAuth({ enabled: false });
      (mockReq.header as jest.Mock).mockReturnValue(undefined);

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('bypasses auth when no hash configured', async () => {
      configureAuth({ apiKeyHash: undefined, enabled: true });
      (mockReq.header as jest.Mock).mockReturnValue(undefined);

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('verifyApiKey', () => {
    it('returns true for valid key', async () => {
      const testKey = 'test-key-12345';
      const hash = await bcrypt.hash(testKey, 10);
      
      configureAuth({ apiKeyHash: hash, enabled: true });

      const result = await verifyApiKey(testKey);
      expect(result).toBe(true);
    });

    it('returns false for invalid key', async () => {
      const validKey = 'valid-key';
      const invalidKey = 'invalid-key';
      const hash = await bcrypt.hash(validKey, 10);

      configureAuth({ apiKeyHash: hash, enabled: true });

      const result = await verifyApiKey(invalidKey);
      expect(result).toBe(false);
    });

    it('returns false for undefined key', async () => {
      const hash = await bcrypt.hash('test-key', 10);
      configureAuth({ apiKeyHash: hash, enabled: true });

      const result = await verifyApiKey(undefined);
      expect(result).toBe(false);
    });

    it('returns true when auth disabled', async () => {
      configureAuth({ enabled: false });

      const result = await verifyApiKey(undefined);
      expect(result).toBe(true);
    });

    it('returns true when no hash configured', async () => {
      configureAuth({ apiKeyHash: undefined, enabled: true });

      const result = await verifyApiKey('any-key');
      expect(result).toBe(true);
    });
  });

  describe('configureAuth', () => {
    it('updates auth configuration', () => {
      const config = {
        apiKeyHash: 'test-hash',
        enabled: false,
      };

      configureAuth(config);

      configureAuth({ enabled: true });
    });

    it('merges configuration incrementally', async () => {
      const testKey = 'test-key';
      const hash = await bcrypt.hash(testKey, 10);

      configureAuth({ apiKeyHash: hash });
      configureAuth({ enabled: true });

      const result = await verifyApiKey(testKey);
      expect(result).toBe(true);
    });
  });
});
