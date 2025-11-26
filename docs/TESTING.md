# Testing Guide - Aethermind AgentOS

> Testing strategy and guidelines for Aethermind AgentOS v0.1.0

## Test Structure

```
tests/
├── unit/              # Unit tests (isolated functions/classes)
├── integration/       # Integration tests (component interactions)
├── e2e/               # End-to-end tests (full workflows)
├── api/               # API endpoint tests
└── websocket/         # WebSocket tests
```

## Running Tests

```bash
# All tests
pnpm test:all

# Unit tests only
pnpm test

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# API tests
pnpm test:api

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

## Writing Tests

### Unit Test Example

```typescript
// packages/core/src/__tests__/Agent.test.ts
import { Agent } from '../agent/Agent';

describe('Agent', () => {
  let agent: Agent;

  beforeEach(() => {
    agent = new Agent({
      id: 'test-agent',
      name: 'test',
      model: 'gpt-4',
      logic: async (ctx) => ({ result: 'success' })
    });
  });

  it('should execute successfully', async () => {
    const result = await agent.execute({ input: 'test' });
    expect(result.status).toBe('completed');
    expect(result.output).toEqual({ result: 'success' });
  });

  it('should retry on failure', async () => {
    let attempts = 0;
    agent = new Agent({
      id: 'test-agent',
      name: 'test',
      model: 'gpt-4',
      config: { maxRetries: 3 },
      logic: async () => {
        attempts++;
        if (attempts < 3) throw new Error('Temporary failure');
        return { result: 'success' };
      }
    });

    const result = await agent.execute({});
    expect(attempts).toBe(3);
    expect(result.status).toBe('completed');
  });
});
```

### Integration Test Example

```typescript
// tests/integration/workflow.test.ts
import { AgentRuntime, Orchestrator } from '@aethermind/core';

describe('Workflow Integration', () => {
  let runtime: AgentRuntime;
  let orchestrator: Orchestrator;

  beforeAll(async () => {
    runtime = new AgentRuntime();
    orchestrator = new Orchestrator(runtime);
    
    // Create test agents
    runtime.createAgent({
      name: 'researcher',
      model: 'gpt-4',
      logic: async (ctx) => ({ findings: ['Finding 1'] })
    });
  });

  it('should execute workflow end-to-end', async () => {
    const workflow = {
      name: 'test-workflow',
      steps: [
        { id: 'research', agent: 'researcher' }
      ]
    };

    const result = await orchestrator.executeWorkflow(workflow, {});
    expect(result.status).toBe('completed');
  });
});
```

### API Test Example

```typescript
// tests/api/agents.test.ts
import request from 'supertest';
import app from '../../apps/api/src/index';

describe('Agents API', () => {
  const apiKey = process.env.TEST_API_KEY;

  it('should list agents', async () => {
    const response = await request(app)
      .get('/api/agents')
      .set('X-API-Key', apiKey);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('agents');
  });

  it('should create agent', async () => {
    const response = await request(app)
      .post('/api/agents')
      .set('X-API-Key', apiKey)
      .send({
        name: 'test-agent',
        model: 'gpt-4',
        systemPrompt: 'You are a test agent.'
      });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('test-agent');
  });
});
```

## Mocking LLM Providers

```typescript
// tests/mocks/MockLLMProvider.ts
import { LLMProvider, ChatMessage, ChatResponse } from '@aethermind/core';

export class MockLLMProvider implements LLMProvider {
  async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    return {
      content: 'Mocked response',
      role: 'assistant',
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15
      }
    };
  }

  async estimateCost(): Promise<number> {
    return 0.001;
  }
}

// Usage in tests
runtime.registerProvider('mock', new MockLLMProvider());
```

## Coverage Goals

- **Unit Tests**: 60%+ coverage
- **Integration Tests**: Critical paths covered
- **E2E Tests**: Main workflows covered

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Pre-release builds

---

**Last Updated**: 2025-11-26  
**Version**: 0.1.0
