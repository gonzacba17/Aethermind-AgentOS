import { Request, Response, NextFunction } from 'express';
import { bodyValidationMiddleware, securityMiddleware } from '../../src/middleware/security';

// Helper to create mock request
function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    headers: { 'user-agent': 'test-agent' },
    url: '/api/agents',
    path: '/api/agents',
    method: 'POST',
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
  };
  return res as Response;
}

describe('WAF Security Middleware - Free Text Fields', () => {
  let bodyValidator: ReturnType<typeof bodyValidationMiddleware>;
  let next: NextFunction;

  beforeEach(() => {
    bodyValidator = bodyValidationMiddleware();
    next = jest.fn();
    // Reset env
    delete process.env.WAF_DRY_RUN;
  });

  describe('Free text fields should NOT be blocked by SQL injection patterns', () => {
    it('allows agent named "SELECT-bot" in name field', () => {
      const req = mockReq({
        body: { name: 'SELECT-bot', model: 'gpt-4' },
      });
      const res = mockRes();

      bodyValidator(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows "CREATE a new pipeline" in description field', () => {
      const req = mockReq({
        body: { name: 'My Agent', description: 'CREATE a new pipeline for data processing' },
      });
      const res = mockRes();

      bodyValidator(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows "SELECT a plan" in prompt field', () => {
      const req = mockReq({
        body: { prompt: 'Help me SELECT a plan that works for my team' },
      });
      const res = mockRes();

      bodyValidator(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows SQL-like words in systemPrompt field', () => {
      const req = mockReq({
        body: { systemPrompt: 'You can UPDATE the database and INSERT new records' },
      });
      const res = mockRes();

      bodyValidator(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows "DROP everything and start fresh" in message field', () => {
      const req = mockReq({
        body: { message: 'DROP everything and start fresh with a new approach' },
      });
      const res = mockRes();

      bodyValidator(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows SQL keywords in content field', () => {
      const req = mockReq({
        body: { content: 'UNION of two teams to DELETE old processes' },
      });
      const res = mockRes();

      bodyValidator(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Non-free-text fields SHOULD be blocked by SQL injection patterns', () => {
    it('blocks SQL injection in non-free-text field like "status"', () => {
      const req = mockReq({
        body: { status: "active'; DROP TABLE users; --" },
      });
      const res = mockRes();

      bodyValidator(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('blocks SQL injection in field like "apiKey"', () => {
      const req = mockReq({
        body: { apiKey: "SELECT * FROM users WHERE 1=1" },
      });
      const res = mockRes();

      bodyValidator(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Dry-run mode', () => {
    it('logs but does not block when WAF_DRY_RUN=true', () => {
      process.env.WAF_DRY_RUN = 'true';
      // Re-import to pick up env change — since the module reads env at import time,
      // we test the logic through the exported constant behavior
      const dryRunValidator = bodyValidationMiddleware();

      const req = mockReq({
        body: { status: "'; DROP TABLE users; --" },
      });
      const res = mockRes();

      dryRunValidator(req, res, next);

      // In dry-run mode, next() should be called even with SQL injection
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Mixed free-text and non-free-text fields', () => {
    it('allows free-text SQL patterns while blocking non-free-text ones', () => {
      // This body has SQL in name (free text, allowed) and in id (not free text, blocked)
      const req = mockReq({
        body: { name: 'SELECT-bot', id: "'; DROP TABLE agents; --" },
      });
      const res = mockRes();

      bodyValidator(req, res, next);

      // id contains SQL injection and is not a free-text field -> blocked
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('passes when all SQL patterns are only in free-text fields', () => {
      const req = mockReq({
        body: {
          name: 'DROP-bot',
          description: 'SELECT all data and UPDATE records',
          prompt: 'DELETE old entries',
          model: 'gpt-4',
        },
      });
      const res = mockRes();

      bodyValidator(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
