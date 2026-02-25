import { jest } from '@jest/globals';
import { authMiddleware, configureAuth, verifyApiKey } from '../../src/middleware/auth';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Admin route so that authMiddleware routes to validateApiKey (not JWT)
    mockReq = {
      header: jest.fn() as any,
      headers: {} as any,
      cookies: {} as any,
      query: {} as any,
      originalUrl: '/api/admin/test',
      url: '/api/admin/test',
      path: '/admin/test',
      baseUrl: '/api',
      method: 'GET',
      ip: '127.0.0.1',
    };
    mockRes = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn() as any,
    };
    mockNext = jest.fn() as any;
  });

  describe('authMiddleware', () => {
    it('allows request with valid API key (admin route)', async () => {
      const testKey = 'test-key-12345';
      const hash = await bcrypt.hash(testKey, 10);
      
      configureAuth({ apiKeyHash: hash, enabled: true });
      (mockReq.header as jest.Mock).mockReturnValue(testKey);

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('rejects request with invalid API key (admin route)', async () => {
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

    it('rejects request with missing API key (admin route)', async () => {
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

    it('allows public auth routes without authentication', async () => {
      mockReq.originalUrl = '/api/auth/login';
      mockReq.url = '/api/auth/login';
      Object.defineProperty(mockReq, 'path', { value: '/auth/login', writable: true });

      configureAuth({ enabled: true });

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('returns 503 for admin routes when apiKeyHash not configured', async () => {
      configureAuth({ apiKeyHash: undefined, enabled: true });

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('requires JWT for non-admin API routes', async () => {
      mockReq.originalUrl = '/api/agents';
      mockReq.url = '/api/agents';
      Object.defineProperty(mockReq, 'path', { value: '/agents', writable: true });

      configureAuth({ enabled: true });

      await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Should return 401 (no JWT token)
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
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

    it('returns false when no hash configured (deny by default)', async () => {
      configureAuth({ apiKeyHash: undefined, enabled: true });

      const result = await verifyApiKey('any-key');
      expect(result).toBe(false);
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
