import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const API_URL = process.env.API_URL || 'http://localhost:3001';

describe('POST /api/agents', () => {
  let prisma: PrismaClient;
  let createdAgentIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    // Cleanup all created agents
    if (createdAgentIds.length > 0) {
      await prisma.agent.deleteMany({
        where: { id: { in: createdAgentIds } },
      });
    }
    await prisma.$disconnect();
  });

  beforeEach(() => {
    createdAgentIds = [];
  });

  describe('Validation', () => {
    it('should accept valid agent payload', async () => {
      const response = await request(API_URL)
        .post('/api/agents')
        .send({
          name: 'test-agent-valid',
          model: 'gpt-4',
          provider: 'openai',
          systemPrompt: 'You are a helpful assistant',
          temperature: 0.7,
          maxTokens: 1000,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('test-agent-valid');
      expect(response.body.model).toBe('gpt-4');
      createdAgentIds.push(response.body.id);
    });

    it('should reject missing required field: name', async () => {
      const response = await request(API_URL)
        .post('/api/agents')
        .send({
          model: 'gpt-4',
          provider: 'openai',
          systemPrompt: 'You are helpful',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });

    it('should reject missing required field: model', async () => {
      const response = await request(API_URL)
        .post('/api/agents')
        .send({
          name: 'test-agent',
          provider: 'openai',
          systemPrompt: 'You are helpful',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject missing required field: provider', async () => {
      const response = await request(API_URL)
        .post('/api/agents')
        .send({
          name: 'test-agent',
          model: 'gpt-4',
          systemPrompt: 'You are helpful',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject invalid provider enum', async () => {
      const response = await request(API_URL)
        .post('/api/agents')
        .send({
          name: 'test-agent',
          model: 'gpt-4',
          provider: 'invalid-provider',
          systemPrompt: 'You are helpful',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation failed');
      const providerError = response.body.details.find(
        (d: any) => d.path === 'provider'
      );
      expect(providerError).toBeDefined();
    });

    it('should reject invalid temperature range (too low)', async () => {
      const response = await request(API_URL)
        .post('/api/agents')
        .send({
          name: 'test-agent',
          model: 'gpt-4',
          provider: 'openai',
          temperature: -0.5,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject invalid temperature range (too high)', async () => {
      const response = await request(API_URL)
        .post('/api/agents')
        .send({
          name: 'test-agent',
          model: 'gpt-4',
          provider: 'openai',
          temperature: 2.5,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject invalid maxTokens type (negative)', async () => {
      const response = await request(API_URL)
        .post('/api/agents')
        .send({
          name: 'test-agent',
          model: 'gpt-4',
          provider: 'openai',
          maxTokens: -100,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject invalid maxTokens type (non-integer)', async () => {
      const response = await request(API_URL)
        .post('/api/agents')
        .send({
          name: 'test-agent',
          model: 'gpt-4',
          provider: 'openai',
          maxTokens: 100.5,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('CRUD Operations', () => {
    it('should create agent and return 201', async () => {
      const response = await request(API_URL)
        .post('/api/agents')
        .send({
          name: 'crud-test-agent',
          model: 'gpt-4',
          provider: 'openai',
          systemPrompt: 'You are a test assistant',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('model');
      expect(response.body).toHaveProperty('status');
      createdAgentIds.push(response.body.id);
    });

    it('should list agents with pagination', async () => {
      // Create multiple agents
      for (let i = 0; i < 3; i++) {
        const res = await request(API_URL)
          .post('/api/agents')
          .send({
            name: `pagination-agent-${i}`,
            model: 'gpt-4',
            provider: 'openai',
          });
        createdAgentIds.push(res.body.id);
      }

      const response = await request(API_URL)
        .get('/api/agents')
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('offset');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const response = await request(API_URL)
        .get('/api/agents')
        .query({ limit: 2, offset: 0 })
        .expect(200);

      expect(response.body.limit).toBe(2);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });

    it('should respect offset parameter', async () => {
      // Create agents
      for (let i = 0; i < 5; i++) {
        const res = await request(API_URL)
          .post('/api/agents')
          .send({
            name: `offset-agent-${i}`,
            model: 'gpt-4',
            provider: 'openai',
          });
        createdAgentIds.push(res.body.id);
      }

      const page1 = await request(API_URL)
        .get('/api/agents')
        .query({ limit: 2, offset: 0 })
        .expect(200);

      const page2 = await request(API_URL)
        .get('/api/agents')
        .query({ limit: 2, offset: 2 })
        .expect(200);

      expect(page1.body.offset).toBe(0);
      expect(page2.body.offset).toBe(2);
    });

    it('should get single agent by id', async () => {
      const createRes = await request(API_URL)
        .post('/api/agents')
        .send({
          name: 'single-agent',
          model: 'gpt-4',
          provider: 'openai',
        });
      const agentId = createRes.body.id;
      createdAgentIds.push(agentId);

      const response = await request(API_URL)
        .get(`/api/agents/${agentId}`)
        .expect(200);

      expect(response.body.id).toBe(agentId);
      expect(response.body.name).toBe('single-agent');
      expect(response.body).toHaveProperty('config');
      expect(response.body).toHaveProperty('state');
    });

    it('should return 404 for non-existent agent', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000';
      const response = await request(API_URL)
        .get(`/api/agents/${fakeUuid}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Agent not found');
    });

    it('should delete agent', async () => {
      const createRes = await request(API_URL)
        .post('/api/agents')
        .send({
          name: 'delete-agent',
          model: 'gpt-4',
          provider: 'openai',
        });
      const agentId = createRes.body.id;

      await request(API_URL)
        .delete(`/api/agents/${agentId}`)
        .expect(204);

      // Verify deletion
      await request(API_URL)
        .get(`/api/agents/${agentId}`)
        .expect(404);
    });

    it('should return 404 when deleting non-existent agent', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000';
      const response = await request(API_URL)
        .delete(`/api/agents/${fakeUuid}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Agent not found');
    });
  });

  describe('Edge Cases', () => {
    it('should use default pagination values when not provided', async () => {
      const response = await request(API_URL)
        .get('/api/agents')
        .expect(200);

      expect(response.body.limit).toBe(100); // Default limit
      expect(response.body.offset).toBe(0); // Default offset
    });

    it('should enforce max limit of 1000', async () => {
      const response = await request(API_URL)
        .get('/api/agents')
        .query({ limit: 5000 })
        .expect(200);

      expect(response.body.limit).toBeLessThanOrEqual(1000);
    });

    it('should validate agent execution endpoint', async () => {
      const createRes = await request(API_URL)
        .post('/api/agents')
        .send({
          name: 'execute-agent',
          model: 'gpt-4',
          provider: 'openai',
        });
      const agentId = createRes.body.id;
      createdAgentIds.push(agentId);

      // Test with missing input
      const response = await request(API_URL)
        .post(`/api/agents/${agentId}/execute`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle agent logs endpoint with pagination', async () => {
      const createRes = await request(API_URL)
        .post('/api/agents')
        .send({
          name: 'logs-agent',
          model: 'gpt-4',
          provider: 'openai',
        });
      const agentId = createRes.body.id;
      createdAgentIds.push(agentId);

      const response = await request(API_URL)
        .get(`/api/agents/${agentId}/logs`)
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should reject invalid UUID format', async () => {
      const response = await request(API_URL)
        .get('/api/agents/invalid-uuid-format')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle concurrent agent creation', async () => {
      const promises = Array.from({ length: 3 }, (_, i) =>
        request(API_URL)
          .post('/api/agents')
          .send({
            name: `concurrent-agent-${i}`,
            model: 'gpt-4',
            provider: 'openai',
          })
      );

      const responses = await Promise.all(promises);
      
      responses.forEach((res: any) => {
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        createdAgentIds.push(res.body.id);
      });

      // Verify all agents were created with unique IDs
      const uniqueIds = new Set(responses.map((r: any) => r.body.id));
      expect(uniqueIds.size).toBe(3);
    });

    it('should handle optional fields correctly', async () => {
      const response = await request(API_URL)
        .post('/api/agents')
        .send({
          name: 'minimal-agent',
          model: 'gpt-4',
          provider: 'openai',
          // No optional fields
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      createdAgentIds.push(response.body.id);
    });
  });
});
