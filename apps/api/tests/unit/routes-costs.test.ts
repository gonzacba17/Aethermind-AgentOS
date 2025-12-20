import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { costRoutes } from '../../src/routes/costs';
import '../types/express';

describe('Cost Routes', () => {
  let app: express.Application;
  let mockStore: any;
  let mockOrchestrator: any;
  let mockCache: any;

  beforeEach(() => {
    // Setup mock store
    mockStore = {
      getCosts: jest.fn<() => Promise<any>>().mockResolvedValue({
        data: [],
        total: 0,
        offset: 0,
        limit: 10,
        hasMore: false,
      }),
      getTotalCost: jest.fn<() => Promise<number>>().mockResolvedValue(0),
      getCostByModel: jest.fn<() => Promise<Record<string, any>>>().mockResolvedValue({}),
    };

    // Setup mock orchestrator
    mockOrchestrator = {
      getCosts: jest.fn<() => any[]>().mockReturnValue([]),
    };

    // Setup mock cache
    mockCache = {
      get: jest.fn<() => Promise<any>>().mockResolvedValue(null),
      set: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };

    // Create Express app
    app = express();
    app.use(express.json());

    // Mock middleware to inject dependencies
    app.use((req, _res, next) => {
      req.store = mockStore;
      req.orchestrator = mockOrchestrator;
      req.cache = mockCache;
      next();
    });

    app.use('/costs', costRoutes);
  });

  describe('GET /costs', () => {
    it('should return costs with summary', async () => {
      const mockCosts = {
        data: [
          {
            id: 'cost-1',
            model: 'gpt-4',
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
            cost: 0.01,
          },
        ],
        total: 1,
        offset: 0,
        limit: 10,
        hasMore: false,
      };

      const mockTotal = 0.01;
      const mockByModel = {
        'gpt-4': { count: 1, tokens: 150, cost: 0.01 },
      };

      mockStore.getCosts.mockResolvedValue(mockCosts);
      mockStore.getTotalCost.mockResolvedValue(mockTotal);
      mockStore.getCostByModel.mockResolvedValue(mockByModel);

      const response = await request(app)
        .get('/costs')
        .expect(200);

      expect(response.body).toMatchObject({
        data: mockCosts.data,
        summary: {
          total: mockTotal,
          byModel: mockByModel,
        },
      });
    });

    it('should handle query parameters', async () => {
      await request(app)
        .get('/costs?executionId=exec-123&model=gpt-4&limit=20&offset=10')
        .expect(200);

      expect(mockStore.getCosts).toHaveBeenCalledWith({
        executionId: 'exec-123',
        model: 'gpt-4',
        limit: '20',
        offset: '10',
      });
    });

    it('should return empty costs when none exist', async () => {
      mockStore.getCosts.mockResolvedValue({
        data: [],
        total: 0,
        offset: 0,
        limit: 10,
        hasMore: false,
      });
      mockStore.getTotalCost.mockResolvedValue(0);
      mockStore.getCostByModel.mockResolvedValue({});

      const response = await request(app)
        .get('/costs')
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.summary.total).toBe(0);
    });

    it('should handle store errors', async () => {
      mockStore.getCosts.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/costs')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Database error');
    });
  });

  describe('GET /costs/summary', () => {
    it('should return cost summary', async () => {
      const orchestratorCosts = [
        {
          model: 'gpt-4',
          tokens: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          cost: 0.01,
        },
      ];

      const storeCosts = {
        data: [
          {
            model: 'claude-3',
            tokens: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
            cost: 0.02,
          },
        ],
      };

      mockOrchestrator.getCosts.mockReturnValue(orchestratorCosts);
      mockStore.getCosts.mockResolvedValue(storeCosts);

      const response = await request(app)
        .get('/costs/summary')
        .expect(200);

      expect(response.body).toMatchObject({
        total: 0.03,
        totalTokens: 450,
        executionCount: 2,
      });

      expect(response.body.byModel).toHaveProperty('gpt-4');
      expect(response.body.byModel).toHaveProperty('claude-3');
    });

    it('should use cache when available', async () => {
      const cachedSummary = {
        total: 1.5,
        totalTokens: 10000,
        executionCount: 50,
        byModel: {},
      };

      mockCache.get.mockResolvedValue(cachedSummary);

      const response = await request(app)
        .get('/costs/summary')
        .expect(200);

      expect(response.body).toEqual(cachedSummary);
      expect(mockOrchestrator.getCosts).not.toHaveBeenCalled();
      expect(mockStore.getCosts).not.toHaveBeenCalled();
    });

    it('should cache summary after calculation', async () => {
      mockOrchestrator.getCosts.mockReturnValue([]);
      mockStore.getCosts.mockResolvedValue({ data: [] });

      await request(app)
        .get('/costs/summary')
        .expect(200);

      expect(mockCache.set).toHaveBeenCalledWith(
        'costs:summary',
        expect.any(String),
        60
      );
    });

    it('should aggregate costs by model correctly', async () => {
      const costs = [
        {
          model: 'gpt-4',
          tokens: { totalTokens: 100 },
          cost: 0.01,
        },
        {
          model: 'gpt-4',
          tokens: { totalTokens: 200 },
          cost: 0.02,
        },
        {
          model: 'claude-3',
          tokens: { totalTokens: 150 },
          cost: 0.015,
        },
      ];

      mockOrchestrator.getCosts.mockReturnValue(costs);
      mockStore.getCosts.mockResolvedValue({ data: [] });

      const response = await request(app)
        .get('/costs/summary')
        .expect(200);

      expect(response.body.byModel['gpt-4']).toEqual({
        count: 2,
        tokens: 300,
        cost: 0.03,
      });

      expect(response.body.byModel['claude-3']).toEqual({
        count: 1,
        tokens: 150,
        cost: 0.015,
      });
    });

    it('should handle empty costs', async () => {
      mockOrchestrator.getCosts.mockReturnValue([]);
      mockStore.getCosts.mockResolvedValue({ data: [] });

      const response = await request(app)
        .get('/costs/summary')
        .expect(200);

      expect(response.body).toEqual({
        total: 0,
        totalTokens: 0,
        executionCount: 0,
        byModel: {},
      });
    });

    it('should handle errors gracefully', async () => {
      mockOrchestrator.getCosts.mockImplementation(() => {
        throw new Error('Orchestrator error');
      });

      const response = await request(app)
        .get('/costs/summary')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Orchestrator error');
    });
  });

  describe('POST /costs', () => {
    beforeEach(() => {
      mockStore.addCost = jest.fn<() => Promise<any>>().mockResolvedValue({
        id: 'cost-1',
        executionId: 'exec-123',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        cost: 0.01,
        createdAt: new Date(),
      });
    });

    it('should create cost record for OpenAI', async () => {
      const costData = {
        executionId: 'exec-123',
        provider: 'openai',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        cost: 0.01,
      };

      const response = await request(app)
        .post('/costs')
        .send(costData)
        .expect(201);

      expect(response.body).toMatchObject({
        executionId: 'exec-123',
        model: 'gpt-4',
        cost: 0.01,
      });
      expect(mockStore.addCost).toHaveBeenCalledWith(expect.objectContaining(costData));
    });

    it('should create cost record for Anthropic', async () => {
      const costData = {
        executionId: 'exec-456',
        provider: 'anthropic',
        model: 'claude-3-opus',
        promptTokens: 200,
        completionTokens: 100,
        totalTokens: 300,
        cost: 0.02,
      };

      const response = await request(app)
        .post('/costs')
        .send(costData)
        .expect(201);

      expect(response.body).toMatchObject({
        model: 'claude-3-opus',
        cost: 0.02,
      });
    });

    it('should create cost record for Google', async () => {
      const costData = {
        executionId: 'exec-789',
        provider: 'google',
        model: 'gemini-pro',
        promptTokens: 150,
        completionTokens: 75,
        totalTokens: 225,
        cost: 0.015,
      };

      const response = await request(app)
        .post('/costs')
        .send(costData)
        .expect(201);

      expect(response.body).toMatchObject({
        model: 'gemini-pro',
        cost: 0.015,
      });
    });

    it('should validate provider names', async () => {
      const invalidCostData = {
        executionId: 'exec-123',
        provider: 'invalid-provider',
        model: 'test-model',
        cost: 0.01,
      };

      const response = await request(app)
        .post('/costs')
        .send(invalidCostData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('provider');
    });

    it('should reject negative costs', async () => {
      const negativeCostData = {
        executionId: 'exec-123',
        provider: 'openai',
        model: 'gpt-4',
        cost: -0.01,
      };

      const response = await request(app)
        .post('/costs')
        .send(negativeCostData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('cost');
    });

    it('should track token counts accurately', async () => {
      const costData = {
        executionId: 'exec-123',
        provider: 'openai',
        model: 'gpt-4',
        promptTokens: 500,
        completionTokens: 250,
        totalTokens: 750,
        cost: 0.05,
      };

      await request(app)
        .post('/costs')
        .send(costData)
        .expect(201);

      expect(mockStore.addCost).toHaveBeenCalledWith(
        expect.objectContaining({
          promptTokens: 500,
          completionTokens: 250,
          totalTokens: 750,
        })
      );
    });

    it('should require executionId', async () => {
      const costData = {
        provider: 'openai',
        model: 'gpt-4',
        cost: 0.01,
      };

      const response = await request(app)
        .post('/costs')
        .send(costData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('executionId');
    });
  });

  describe('Budget Enforcement', () => {
    beforeEach(() => {
      mockStore.getBudget = jest.fn<() => Promise<any>>().mockResolvedValue({
        userId: 'user-123',
        limit: 100,
        spent: 0,
        period: 'monthly',
      });
      mockStore.updateBudget = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    });

    it('should allow cost within budget', async () => {
      mockStore.getBudget.mockResolvedValue({
        userId: 'user-123',
        limit: 100,
        spent: 50,
        period: 'monthly',
      });

      const costData = {
        executionId: 'exec-123',
        provider: 'openai',
        model: 'gpt-4',
        cost: 10,
      };

      const response = await request(app)
        .post('/costs')
        .send(costData)
        .expect(201);

      expect(response.body.cost).toBe(10);
    });

    it('should trigger alert when approaching budget limit', async () => {
      mockStore.getBudget.mockResolvedValue({
        userId: 'user-123',
        limit: 100,
        spent: 85,
        period: 'monthly',
      });

      const costData = {
        executionId: 'exec-123',
        provider: 'openai',
        model: 'gpt-4',
        cost: 10,
      };

      const response = await request(app)
        .post('/costs')
        .send(costData)
        .expect(201);

      expect(response.body).toHaveProperty('warning');
      expect(response.body.warning).toContain('budget');
    });

    it('should block execution when budget exceeded', async () => {
      mockStore.getBudget.mockResolvedValue({
        userId: 'user-123',
        limit: 100,
        spent: 95,
        period: 'monthly',
      });

      const costData = {
        executionId: 'exec-123',
        provider: 'openai',
        model: 'gpt-4',
        cost: 10,
      };

      const response = await request(app)
        .post('/costs')
        .send(costData)
        .expect(402);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('budget exceeded');
    });

    it('should calculate remaining budget correctly', async () => {
      mockStore.getBudget.mockResolvedValue({
        userId: 'user-123',
        limit: 100,
        spent: 60,
        period: 'monthly',
      });

      const response = await request(app)
        .get('/costs/budget')
        .expect(200);

      expect(response.body).toMatchObject({
        limit: 100,
        spent: 60,
        remaining: 40,
        percentUsed: 60,
      });
    });
  });
});
