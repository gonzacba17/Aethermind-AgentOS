import request from 'supertest';
import express from 'express';
import { workflowRoutes } from '../../src/routes/workflows';

const app = express();
app.use(express.json());

app.use((req, _res, next) => {
  req.workflowEngine = {
    createWorkflow: jest.fn().mockResolvedValue({ id: 'wf-1', name: 'Test Workflow' }),
    getWorkflow: jest.fn().mockResolvedValue({ id: 'wf-1', name: 'Test Workflow', status: 'idle' }),
    listWorkflows: jest.fn().mockResolvedValue([{ id: 'wf-1', name: 'Test Workflow' }]),
    executeWorkflow: jest.fn().mockResolvedValue({ executionId: 'exec-1', status: 'completed' }),
    deleteWorkflow: jest.fn().mockResolvedValue(true),
  } as any;
  next();
});

app.use('/workflows', workflowRoutes);

describe('Workflow Routes', () => {
  describe('POST /workflows', () => {
    it('creates a new workflow', async () => {
      const response = await request(app)
        .post('/workflows')
        .send({
          name: 'Test Workflow',
          steps: [{ type: 'agent', agentId: 'agent-1' }],
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });

    it('validates workflow structure', async () => {
      const response = await request(app)
        .post('/workflows')
        .send({ name: 'Invalid' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /workflows', () => {
    it('lists all workflows', async () => {
      const response = await request(app).get('/workflows');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /workflows/:id', () => {
    it('retrieves workflow by ID', async () => {
      const response = await request(app).get('/workflows/wf-1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 'wf-1');
    });
  });

  describe('POST /workflows/:id/execute', () => {
    it('executes workflow', async () => {
      const response = await request(app)
        .post('/workflows/wf-1/execute')
        .send({ input: { data: 'test' } });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('executionId');
    });
  });

  describe('DELETE /workflows/:id', () => {
    it('deletes workflow', async () => {
      const response = await request(app).delete('/workflows/wf-1');

      expect(response.status).toBe(204);
    });
  });
});
