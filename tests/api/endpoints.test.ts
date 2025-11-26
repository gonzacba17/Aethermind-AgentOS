import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_URL = process.env.API_URL || 'http://localhost:3001';

describe('API Endpoints', () => {
    let agentId: string;
    let executionId: string;

    // Skip tests if API is not running
    beforeAll(async () => {
        try {
            await request(API_URL).get('/health').timeout(2000);
        } catch (error) {
            console.warn('⚠️  API not running. Skipping API tests.');
            console.warn('   Start API with: cd apps/api && pnpm dev');
        }
    });

    it('GET /health - should return healthy status', async () => {
        const response = await request(API_URL)
            .get('/health')
            .expect(200);

        expect(response.body).toHaveProperty('status');
        expect(response.body.status).toBe('healthy');
    });

    it('POST /api/agents - should create agent', async () => {
        const response = await request(API_URL)
            .post('/api/agents')
            .send({
                name: 'test-agent',
                model: 'gpt-4',
                systemPrompt: 'You are helpful',
            })
            .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe('test-agent');
        expect(response.body.model).toBe('gpt-4');
        agentId = response.body.id;
    });

    it('GET /api/agents/:id - should get agent info', async () => {
        if (!agentId) {
            console.warn('Skipping: No agent ID from previous test');
            return;
        }

        const response = await request(API_URL)
            .get(`/api/agents/${agentId}`)
            .expect(200);

        expect(response.body.id).toBe(agentId);
        expect(response.body.name).toBe('test-agent');
    });

    it('GET /api/agents - should list all agents', async () => {
        const response = await request(API_URL)
            .get('/api/agents')
            .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
    });

    it('POST /api/agents/:id/execute - should execute task', async () => {
        if (!agentId) {
            console.warn('Skipping: No agent ID from previous test');
            return;
        }

        const response = await request(API_URL)
            .post(`/api/agents/${agentId}/execute`)
            .send({ input: 'Hello, test!' })
            .timeout(30000) // 30 second timeout for LLM calls
            .expect(200);

        expect(response.body).toHaveProperty('executionId');
        expect(response.body.status).toBeDefined();
        executionId = response.body.executionId;
    });

    it('GET /api/logs - should retrieve logs', async () => {
        const response = await request(API_URL)
            .get('/api/logs')
            .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
    });

    it('GET /api/logs?executionId=:id - should filter logs by execution', async () => {
        if (!executionId) {
            console.warn('Skipping: No execution ID from previous test');
            return;
        }

        const response = await request(API_URL)
            .get('/api/logs')
            .query({ executionId })
            .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
    });

    it('GET /api/traces/:id - should get execution trace', async () => {
        if (!executionId) {
            console.warn('Skipping: No execution ID from previous test');
            return;
        }

        const response = await request(API_URL)
            .get(`/api/traces/${executionId}`)
            .expect(200);

        expect(response.body).toHaveProperty('executionId');
        expect(response.body.executionId).toBe(executionId);
    });

    it('GET /api/costs - should retrieve cost data', async () => {
        const response = await request(API_URL)
            .get('/api/costs')
            .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
    });

    it('POST /api/workflows - should create workflow', async () => {
        if (!agentId) {
            console.warn('Skipping: No agent ID from previous test');
            return;
        }

        const response = await request(API_URL)
            .post('/api/workflows')
            .send({
                name: 'test-workflow',
                steps: [
                    { id: 'step1', agent: agentId },
                ],
            })
            .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe('test-workflow');
    });

    it('GET /api/workflows - should list workflows', async () => {
        const response = await request(API_URL)
            .get('/api/workflows')
            .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
    });

    it('GET /api/workflows/:id - should get workflow', async () => {
        if (!agentId) {
            console.warn('Skipping: No agent ID from previous test');
            return;
        }

        const createRes = await request(API_URL)
            .post('/api/workflows')
            .send({
                name: 'get-test-workflow',
                steps: [{ id: 'step1', agent: agentId }],
            });

        const workflowId = createRes.body.id;

        const response = await request(API_URL)
            .get(`/api/workflows/${workflowId}`)
            .expect(200);

        expect(response.body.id).toBe(workflowId);
        expect(response.body.name).toBe('get-test-workflow');
    });

    it('DELETE /api/agents/:id - should delete agent', async () => {
        if (!agentId) {
            console.warn('Skipping: No agent ID from previous test');
            return;
        }

        await request(API_URL)
            .delete(`/api/agents/${agentId}`)
            .expect(204);

        // Verify deletion
        await request(API_URL)
            .get(`/api/agents/${agentId}`)
            .expect(404);
    });

    it('should handle invalid agent ID gracefully', async () => {
        await request(API_URL)
            .get('/api/agents/invalid-id-12345')
            .expect(404);
    });

    it('should validate agent creation payload', async () => {
        await request(API_URL)
            .post('/api/agents')
            .send({
                // Missing required fields
                name: 'incomplete-agent',
            })
            .expect(400);
    });
});
