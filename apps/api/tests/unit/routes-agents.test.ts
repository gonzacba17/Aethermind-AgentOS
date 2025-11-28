import request from 'supertest';
import express from 'express';
import { agentRoutes } from '../../src/routes/agents';

const app = express();
app.use(express.json());

app.use((req, _res, next) => {
  req.runtime = {
    createAgent: jest.fn().mockResolvedValue({ id: 'agent-1', name: 'Test Agent' }),
    getAgent: jest.fn().mockResolvedValue({ id: 'agent-1', name: 'Test Agent', status: 'idle' }),
    listAgents: jest.fn().mockResolvedValue([{ id: 'agent-1', name: 'Test Agent' }]),
    deleteAgent: jest.fn().mockResolvedValue(true),
    reloadAgent: jest.fn().mockResolvedValue(true),
  } as any;
  next();
});

app.use('/agents', agentRoutes);

describe('Agent Routes', () => {
  describe('POST /agents', () => {
    it('creates a new agent', async () => {
      const response = await request(app)
        .post('/agents')
        .send({
          name: 'Test Agent',
          provider: 'openai',
          config: { model: 'gpt-4' },
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });

    it('validates required fields', async () => {
      const response = await request(app)
        .post('/agents')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('GET /agents', () => {
    it('lists all agents', async () => {
      const response = await request(app).get('/agents');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /agents/:id', () => {
    it('retrieves agent by ID', async () => {
      const response = await request(app).get('/agents/agent-1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 'agent-1');
    });

    it('returns 404 for non-existent agent', async () => {
      const mockRuntime = {
        getAgent: jest.fn().mockResolvedValue(null),
      };

      const testApp = express();
      testApp.use((req, _res, next) => {
        req.runtime = mockRuntime as any;
        next();
      });
      testApp.use('/agents', agentRoutes);

      const response = await request(testApp).get('/agents/non-existent');
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /agents/:id', () => {
    it('deletes agent', async () => {
      const response = await request(app).delete('/agents/agent-1');

      expect(response.status).toBe(204);
    });
  });

  describe('POST /agents/:id/reload', () => {
    it('reloads agent configuration', async () => {
      const response = await request(app).post('/agents/agent-1/reload');

      expect(response.status).toBe(200);
    });
  });
});
