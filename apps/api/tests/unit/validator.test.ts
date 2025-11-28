import { validateBody, validateQuery, validateParams } from '../../src/middleware/validator';
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

describe('Validator Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  describe('validateBody', () => {
    const schema = z.object({
      name: z.string().min(3),
      age: z.number().positive(),
      email: z.string().email().optional(),
    });

    it('validates valid body', async () => {
      mockReq.body = {
        name: 'John Doe',
        age: 25,
        email: 'john@example.com',
      };

      const middleware = validateBody(schema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('rejects invalid body', async () => {
      mockReq.body = {
        name: 'Jo',
        age: -5,
      };

      const middleware = validateBody(schema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            path: 'name',
            message: expect.any(String),
          }),
          expect.objectContaining({
            path: 'age',
            message: expect.any(String),
          }),
        ]),
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('accepts body with optional fields omitted', async () => {
      mockReq.body = {
        name: 'John Doe',
        age: 25,
      };

      const middleware = validateBody(schema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('rejects missing required fields', async () => {
      mockReq.body = {
        name: 'John Doe',
      };

      const middleware = validateBody(schema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            path: 'age',
          }),
        ]),
      });
    });

    it('handles non-ZodError exceptions', async () => {
      const badSchema = {
        parseAsync: jest.fn().mockRejectedValue(new Error('Unexpected error')),
      } as any;

      mockReq.body = { test: 'data' };

      const middleware = validateBody(badSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('validateQuery', () => {
    const schema = z.object({
      page: z.string().regex(/^\d+$/).transform(Number).optional(),
      limit: z.string().regex(/^\d+$/).transform(Number).optional(),
      search: z.string().optional(),
    });

    it('validates valid query parameters', async () => {
      mockReq.query = {
        page: '1',
        limit: '10',
        search: 'test',
      };

      const middleware = validateQuery(schema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.query).toEqual({
        page: 1,
        limit: 10,
        search: 'test',
      });
    });

    it('rejects invalid query parameters', async () => {
      mockReq.query = {
        page: 'invalid',
      };

      const middleware = validateQuery(schema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            path: 'page',
          }),
        ]),
      });
    });

    it('accepts empty query', async () => {
      mockReq.query = {};

      const middleware = validateQuery(schema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validateParams', () => {
    const schema = z.object({
      id: z.string().uuid(),
      agentId: z.string().min(1).optional(),
    });

    it('validates valid route parameters', async () => {
      mockReq.params = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        agentId: 'agent-1',
      };

      const middleware = validateParams(schema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('rejects invalid route parameters', async () => {
      mockReq.params = {
        id: 'not-a-uuid',
      };

      const middleware = validateParams(schema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            path: 'id',
          }),
        ]),
      });
    });

    it('handles multiple validation errors', async () => {
      const strictSchema = z.object({
        id: z.string().uuid(),
        userId: z.string().uuid(),
      });

      mockReq.params = {
        id: 'invalid-1',
        userId: 'invalid-2',
      };

      const middleware = validateParams(strictSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({ path: 'id' }),
          expect.objectContaining({ path: 'userId' }),
        ]),
      });
    });
  });

  describe('Error Details Format', () => {
    it('formats nested path correctly', async () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string().min(3),
          }),
        }),
      });

      mockReq.body = {
        user: {
          profile: {
            name: 'AB',
          },
        },
      };

      const middleware = validateBody(schema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            path: 'user.profile.name',
          }),
        ]),
      });
    });
  });
});
