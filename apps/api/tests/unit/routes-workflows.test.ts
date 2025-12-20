import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { workflowRoutes } from '../../src/routes/workflows';
import '../types/express';

describe('Workflow Routes', () => {
  let app: express.Application;
  let mockWorkflowEngine: any;
  let mockOrchestrator: any;
  let mockStore: any;
  let mockCache: any;
  let mockRuntime: any;

  beforeEach(() => {
    // Setup mock workflow engine
    mockWorkflowEngine = {
      listWorkflows: jest.fn<() => string[]>().mockReturnValue([]),
      getWorkflow: jest.fn<() => any>().mockReturnValue(null),
      registerWorkflow: jest.fn<() => void>(),
      execute: jest.fn<() => Promise<any>>(),
    };

    // Setup mock orchestrator
    mockOrchestrator = {
      getTrace: jest.fn<() => any>().mockReturnValue(null),
      getCosts: jest.fn<() => any[]>().mockReturnValue([]),
    };

    // Setup mock store
    mockStore = {
      addTrace: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      addCost: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };

    // Setup mock cache
    mockCache = {
      get: jest.fn<() => Promise<any>>().mockResolvedValue(null),
      set: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      del: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };

    // Setup mock runtime
    mockRuntime = {};

    // Create Express app
    app = express();
    app.use(express.json());

    // Mock middleware to inject dependencies
    app.use((req, _res, next) => {
      req.workflowEngine = mockWorkflowEngine;
      req.orchestrator = mockOrchestrator;
      req.store = mockStore;
      req.cache = mockCache;
      req.runtime = mockRuntime;
      next();
    });

    app.use('/workflows', workflowRoutes);
  });

  describe('GET /workflows', () => {
    it('should return empty array when no workflows exist', async () => {
      mockWorkflowEngine.listWorkflows.mockReturnValue([]);

      const response = await request(app)
        .get('/workflows')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return list of workflows', async () => {
      const mockDefinition = {
        name: 'workflow1',
        steps: [{ id: 'step1', agent: 'agent1' }],
        entryPoint: 'step1',
      };

      mockWorkflowEngine.listWorkflows.mockReturnValue(['workflow1']);
      mockWorkflowEngine.getWorkflow.mockReturnValue(mockDefinition);

      const response = await request(app)
        .get('/workflows')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toEqual({
        name: 'workflow1',
        definition: mockDefinition,
      });
    });
  });

  describe('GET /workflows/:name', () => {
    it('should return workflow by name', async () => {
      const mockWorkflow = {
        name: 'test-workflow',
        steps: [{ id: 'step1', agent: 'agent1' }],
        entryPoint: 'step1',
      };

      mockWorkflowEngine.getWorkflow.mockReturnValue(mockWorkflow);

      const response = await request(app)
        .get('/workflows/test-workflow')
        .expect(200);

      expect(response.body).toEqual(mockWorkflow);
    });

    it('should return 404 for non-existent workflow', async () => {
      mockWorkflowEngine.getWorkflow.mockReturnValue(null);

      const response = await request(app)
        .get('/workflows/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Workflow not found');
    });

    it('should use cache when available', async () => {
      const mockWorkflow = { name: 'cached', steps: [], entryPoint: 'step1' };
      mockCache.get.mockResolvedValue(JSON.stringify(mockWorkflow));

      await request(app)
        .get('/workflows/cached')
        .expect(200);

      expect(mockWorkflowEngine.getWorkflow).not.toHaveBeenCalled();
    });
  });

  describe('POST /workflows', () => {
    it('should create new workflow with valid data', async () => {
      const workflowData = {
        name: 'new-workflow',
        steps: [{ id: 'step1', agent: 'agent1' }],
        entryPoint: 'step1',
      };

      const response = await request(app)
        .post('/workflows')
        .send(workflowData)
        .expect(201);

      expect(response.body).toEqual({
        name: 'new-workflow',
        message: 'Workflow created',
      });
    });

    it('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/workflows')
        .send({ steps: [{ id: 'step1', agent: 'agent1' }], entryPoint: 'step1' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation error');
    });

    it('should return 400 for empty steps', async () => {
      const response = await request(app)
        .post('/workflows')
        .send({ name: 'test', steps: [], entryPoint: 'step1' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation error');
    });

    it('should invalidate cache after creation', async () => {
      await request(app)
        .post('/workflows')
        .send({ name: 'new', steps: [{ id: 'step1', agent: 'agent1' }], entryPoint: 'step1' })
        .expect(201);

      expect(mockCache.del).toHaveBeenCalledWith('workflow:new');
    });
  });

  describe('POST /workflows/:name/execute', () => {
    it('should execute workflow successfully', async () => {
      const mockWorkflow = { name: 'test', steps: [], entryPoint: 'step1' };
      const mockResult = {
        executionId: 'exec-123',
        workflowName: 'test',
        status: 'completed',
        output: {},
        duration: 1000,
        stepResults: new Map(),
      };

      mockWorkflowEngine.getWorkflow.mockReturnValue(mockWorkflow);
      mockWorkflowEngine.execute.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/workflows/test/execute')
        .send({ input: {} })
        .expect(200);

      expect(response.body.executionId).toBe('exec-123');
    });

    it('should return 404 for non-existent workflow', async () => {
      mockWorkflowEngine.getWorkflow.mockReturnValue(null);

      await request(app)
        .post('/workflows/non-existent/execute')
        .send({ input: {} })
        .expect(404);
    });

    it('should handle execution errors', async () => {
      mockWorkflowEngine.getWorkflow.mockReturnValue({ name: 'test', steps: [], entryPoint: 'step1' });
      mockWorkflowEngine.execute.mockRejectedValue(new Error('Execution failed'));

      const response = await request(app)
        .post('/workflows/test/execute')
        .send({ input: {} })
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Execution failed');
    });

    it('should pass input data to workflow execution', async () => {
      const mockWorkflow = { name: 'test', steps: [], entryPoint: 'step1' };
      const inputData = { userId: 'user-123', query: 'test query' };
      
      mockWorkflowEngine.getWorkflow.mockReturnValue(mockWorkflow);
      mockWorkflowEngine.execute.mockResolvedValue({
        executionId: 'exec-123',
        workflowName: 'test',
        status: 'completed',
        output: {},
        duration: 1000,
        stepResults: new Map(),
      });

      await request(app)
        .post('/workflows/test/execute')
        .send({ input: inputData })
        .expect(200);

      expect(mockWorkflowEngine.execute).toHaveBeenCalledWith(
        'test',
        expect.objectContaining(inputData)
      );
    });
  });

  describe('PUT /workflows/:name', () => {
    beforeEach(() => {
      mockWorkflowEngine.updateWorkflow = jest.fn<() => void>();
    });

    it('should update workflow successfully', async () => {
      const existingWorkflow = {
        name: 'test-workflow',
        steps: [{ id: 'step1', agent: 'agent1' }],
        entryPoint: 'step1',
      };

      const updatedData = {
        steps: [
          { id: 'step1', agent: 'agent1' },
          { id: 'step2', agent: 'agent2' },
        ],
        entryPoint: 'step1',
      };

      mockWorkflowEngine.getWorkflow.mockReturnValue(existingWorkflow);

      const response = await request(app)
        .put('/workflows/test-workflow')
        .send(updatedData)
        .expect(200);

      expect(response.body).toEqual({
        name: 'test-workflow',
        message: 'Workflow updated',
      });
      expect(mockWorkflowEngine.updateWorkflow).toHaveBeenCalledWith(
        'test-workflow',
        updatedData
      );
    });

    it('should return 404 for non-existent workflow', async () => {
      mockWorkflowEngine.getWorkflow.mockReturnValue(null);

      const response = await request(app)
        .put('/workflows/non-existent')
        .send({ steps: [{ id: 'step1', agent: 'agent1' }], entryPoint: 'step1' })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Workflow not found');
    });

    it('should validate updated workflow config', async () => {
      mockWorkflowEngine.getWorkflow.mockReturnValue({
        name: 'test',
        steps: [{ id: 'step1', agent: 'agent1' }],
        entryPoint: 'step1',
      });

      const response = await request(app)
        .put('/workflows/test')
        .send({ steps: [], entryPoint: 'step1' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation error');
    });

    it('should invalidate cache after update', async () => {
      mockWorkflowEngine.getWorkflow.mockReturnValue({
        name: 'test',
        steps: [{ id: 'step1', agent: 'agent1' }],
        entryPoint: 'step1',
      });

      await request(app)
        .put('/workflows/test')
        .send({ steps: [{ id: 'step1', agent: 'agent1' }], entryPoint: 'step1' })
        .expect(200);

      expect(mockCache.del).toHaveBeenCalledWith('workflow:test');
    });
  });

  describe('DELETE /workflows/:name', () => {
    beforeEach(() => {
      mockWorkflowEngine.deleteWorkflow = jest.fn<() => void>();
    });

    it('should delete workflow successfully', async () => {
      const mockWorkflow = {
        name: 'test-workflow',
        steps: [{ id: 'step1', agent: 'agent1' }],
        entryPoint: 'step1',
      };

      mockWorkflowEngine.getWorkflow.mockReturnValue(mockWorkflow);

      await request(app)
        .delete('/workflows/test-workflow')
        .expect(204);

      expect(mockWorkflowEngine.deleteWorkflow).toHaveBeenCalledWith('test-workflow');
    });

    it('should return 404 for non-existent workflow', async () => {
      mockWorkflowEngine.getWorkflow.mockReturnValue(null);

      const response = await request(app)
        .delete('/workflows/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Workflow not found');
    });

    it('should invalidate cache after deletion', async () => {
      mockWorkflowEngine.getWorkflow.mockReturnValue({
        name: 'test',
        steps: [{ id: 'step1', agent: 'agent1' }],
        entryPoint: 'step1',
      });

      await request(app)
        .delete('/workflows/test')
        .expect(204);

      expect(mockCache.del).toHaveBeenCalledWith('workflow:test');
    });
  });

  describe('Workflow Validation', () => {
    it('should reject workflow with invalid step reference', async () => {
      const invalidWorkflow = {
        name: 'invalid',
        steps: [{ id: 'step1', agent: 'agent1', next: 'non-existent-step' }],
        entryPoint: 'step1',
      };

      const response = await request(app)
        .post('/workflows')
        .send(invalidWorkflow)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation error');
    });

    it('should reject workflow with circular dependencies', async () => {
      const circularWorkflow = {
        name: 'circular',
        steps: [
          { id: 'step1', agent: 'agent1', next: 'step2' },
          { id: 'step2', agent: 'agent2', next: 'step1' },
        ],
        entryPoint: 'step1',
      };

      const response = await request(app)
        .post('/workflows')
        .send(circularWorkflow)
        .expect(400);

      expect(response.body.error).toContain('circular');
    });

    it('should reject workflow with invalid entry point', async () => {
      const invalidEntryPoint = {
        name: 'invalid-entry',
        steps: [{ id: 'step1', agent: 'agent1' }],
        entryPoint: 'non-existent',
      };

      const response = await request(app)
        .post('/workflows')
        .send(invalidEntryPoint)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation error');
    });

    it('should enforce unique workflow names', async () => {
      mockWorkflowEngine.listWorkflows.mockReturnValue(['existing-workflow']);

      const response = await request(app)
        .post('/workflows')
        .send({
          name: 'existing-workflow',
          steps: [{ id: 'step1', agent: 'agent1' }],
          entryPoint: 'step1',
        })
        .expect(409);

      expect(response.body).toHaveProperty('error', 'Workflow already exists');
    });
  });

  describe('Pagination', () => {
    it('should support limit parameter', async () => {
      const workflows = Array.from({ length: 20 }, (_, i) => `workflow-${i}`);
      mockWorkflowEngine.listWorkflows.mockReturnValue(workflows);

      const response = await request(app)
        .get('/workflows?limit=10')
        .expect(200);

      expect(response.body).toHaveLength(10);
    });

    it('should support offset parameter', async () => {
      const workflows = Array.from({ length: 20 }, (_, i) => `workflow-${i}`);
      mockWorkflowEngine.listWorkflows.mockReturnValue(workflows);

      const response = await request(app)
        .get('/workflows?limit=5&offset=10')
        .expect(200);

      expect(response.body).toHaveLength(5);
      expect(response.body[0].name).toBe('workflow-10');
    });

    it('should return pagination metadata', async () => {
      const workflows = Array.from({ length: 25 }, (_, i) => `workflow-${i}`);
      mockWorkflowEngine.listWorkflows.mockReturnValue(workflows);

      const response = await request(app)
        .get('/workflows?limit=10&offset=0')
        .expect(200);

      expect(response.body).toHaveProperty('total', 25);
      expect(response.body).toHaveProperty('limit', 10);
      expect(response.body).toHaveProperty('offset', 0);
      expect(response.body).toHaveProperty('hasMore', true);
    });
  });
});
