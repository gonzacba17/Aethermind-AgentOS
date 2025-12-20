import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { traceRoutes } from '../../src/routes/traces';
import '../types/express';

describe('Trace Routes', () => {
  let app: express.Application;
  let mockStore: any;
  let mockOrchestrator: any;

  beforeEach(() => {
    // Setup mock store
    mockStore = {
      getAllTraces: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
      getTrace: jest.fn<() => Promise<any>>().mockResolvedValue(null),
    };

    // Setup mock orchestrator
    mockOrchestrator = {
      getTrace: jest.fn<() => any>().mockReturnValue(null),
    };

    // Create Express app
    app = express();
    app.use(express.json());

    // Mock middleware to inject dependencies
    app.use((req, _res, next) => {
      req.store = mockStore;
      req.orchestrator = mockOrchestrator;
      next();
    });

    app.use('/traces', traceRoutes);
  });

  describe('GET /traces', () => {
    it('should return paginated traces', async () => {
      const mockTraces = [
        {
          id: 'trace-1',
          executionId: 'exec-1',
          treeData: { root: 'node1' },
          createdAt: new Date().toISOString(),
        },
        {
          id: 'trace-2',
          executionId: 'exec-2',
          treeData: { root: 'node2' },
          createdAt: new Date().toISOString(),
        },
      ];

      mockStore.getAllTraces.mockResolvedValue(mockTraces);

      const response = await request(app)
        .get('/traces?offset=0&limit=10')
        .expect(200);

      expect(response.body).toMatchObject({
        data: mockTraces,
        total: 2,
        offset: 0,
        limit: 10,
        hasMore: false,
      });
    });

    it('should handle pagination correctly', async () => {
      const mockTraces = Array.from({ length: 25 }, (_, i) => ({
        id: `trace-${i}`,
        executionId: `exec-${i}`,
        treeData: {},
      }));

      mockStore.getAllTraces.mockResolvedValue(mockTraces);

      const response = await request(app)
        .get('/traces?offset=10&limit=10')
        .expect(200);

      expect(response.body.data).toHaveLength(10);
      expect(response.body.offset).toBe(10);
      expect(response.body.limit).toBe(10);
      expect(response.body.hasMore).toBe(true);
      expect(response.body.total).toBe(25);
    });

    it('should return empty array when no traces exist', async () => {
      mockStore.getAllTraces.mockResolvedValue([]);

      const response = await request(app)
        .get('/traces?offset=0&limit=10')
        .expect(200);

      expect(response.body).toEqual({
        data: [],
        total: 0,
        offset: 0,
        limit: 10,
        hasMore: false,
      });
    });

    it('should handle default pagination values', async () => {
      mockStore.getAllTraces.mockResolvedValue([]);

      const response = await request(app)
        .get('/traces')
        .expect(200);

      expect(response.body).toHaveProperty('offset');
      expect(response.body).toHaveProperty('limit');
    });

    it('should handle store errors', async () => {
      mockStore.getAllTraces.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/traces')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Database error');
    });
  });

  describe('GET /traces/:id', () => {
    it('should return trace by id from store', async () => {
      const mockTrace = {
        id: 'trace-123',
        executionId: 'exec-123',
        treeData: {
          root: {
            id: 'node1',
            type: 'agent',
            children: [],
          },
        },
        metadata: {
          duration: 1500,
          totalSteps: 5,
        },
        createdAt: new Date().toISOString(),
      };

      mockStore.getTrace.mockResolvedValue(mockTrace);

      const response = await request(app)
        .get('/traces/trace-123')
        .expect(200);

      expect(response.body).toEqual(mockTrace);
      expect(mockStore.getTrace).toHaveBeenCalledWith('trace-123');
    });

    it('should fallback to orchestrator if not in store', async () => {
      const mockTrace = {
        id: 'trace-123',
        executionId: 'exec-123',
        treeData: {},
      };

      mockStore.getTrace.mockResolvedValue(null);
      mockOrchestrator.getTrace.mockReturnValue(mockTrace);

      const response = await request(app)
        .get('/traces/trace-123')
        .expect(200);

      expect(response.body).toEqual(mockTrace);
      expect(mockOrchestrator.getTrace).toHaveBeenCalledWith('trace-123');
    });

    it('should return 404 when trace not found', async () => {
      mockStore.getTrace.mockResolvedValue(null);
      mockOrchestrator.getTrace.mockReturnValue(null);

      const response = await request(app)
        .get('/traces/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Trace not found');
    });

    it('should handle complex tree data', async () => {
      const mockTrace = {
        id: 'trace-complex',
        executionId: 'exec-complex',
        treeData: {
          root: {
            id: 'root',
            type: 'workflow',
            children: [
              {
                id: 'step1',
                type: 'agent',
                children: [],
              },
              {
                id: 'step2',
                type: 'parallel',
                children: [
                  { id: 'step2a', type: 'agent', children: [] },
                  { id: 'step2b', type: 'agent', children: [] },
                ],
              },
            ],
          },
        },
      };

      mockStore.getTrace.mockResolvedValue(mockTrace);

      const response = await request(app)
        .get('/traces/trace-complex')
        .expect(200);

      expect(response.body.treeData.root.children).toHaveLength(2);
      expect(response.body.treeData.root.children[1].children).toHaveLength(2);
    });

    it('should handle store errors', async () => {
      mockStore.getTrace.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/traces/trace-123')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Database error');
    });

    it('should validate id parameter format', async () => {
      // This test assumes there's validation middleware
      // If not, the route should still handle it gracefully
      mockStore.getTrace.mockResolvedValue(null);
      mockOrchestrator.getTrace.mockReturnValue(null);

      const response = await request(app)
        .get('/traces/invalid-id')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});
