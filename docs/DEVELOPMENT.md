# Development Guide - Aethermind AgentOS

> Developer guide for contributing to Aethermind AgentOS v0.1.0

## Quick Start

```bash
# Setup
git clone <repo-url> && cd aethermind-agentos
pnpm install
cp .env.example .env  # Configure your .env
pnpm docker:up
pnpm generate-api-key  # Add hash to .env
pnpm dev
```

## Project Structure

```
aethermind-agentos/
├── apps/api/              # Express API server (Port 3001)
├── packages/
│   ├── core/              # Agent framework
│   ├── sdk/               # Developer SDK
│   ├── dashboard/         # Next.js UI (Port 3000)
│   └── create-aethermind-app/  # CLI tool
├── examples/              # Usage examples
├── tests/                 # Test suites
└── docs/                  # Documentation
```

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

Edit files in the appropriate package:
- **API changes**: `apps/api/src/`
- **Core logic**: `packages/core/src/`
- **UI changes**: `packages/dashboard/src/`
- **SDK changes**: `packages/sdk/src/`

### 3. Run Tests

```bash
pnpm test              # Unit tests
pnpm test:integration  # Integration tests
pnpm test:e2e          # End-to-end tests
```

### 4. Lint and Type Check

```bash
pnpm lint              # ESLint
pnpm typecheck         # TypeScript
```

### 5. Commit Changes

```bash
git add .
git commit -m "feat(core): add new feature"
```

Use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Tests
- `chore:` Maintenance

### 6. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Adding a New LLM Provider

### 1. Create Provider Class

Create `packages/core/src/providers/YourProvider.ts`:

```typescript
import { LLMProvider, ChatMessage, ChatResponse, LLMConfig } from '../types';

export class YourProvider implements LLMProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(messages: ChatMessage[], config: LLMConfig): Promise<ChatResponse> {
    // Implement API call
    const response = await fetch('https://api.yourprovider.com/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ messages, ...config })
    });

    const data = await response.json();
    
    return {
      content: data.content,
      role: 'assistant',
      finishReason: 'stop',
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      }
    };
  }

  async estimateCost(messages: ChatMessage[], model: string): Promise<number> {
    // Implement cost estimation
    const tokens = this.estimateTokens(messages);
    const costPerToken = this.getCostPerToken(model);
    return tokens * costPerToken;
  }

  private estimateTokens(messages: ChatMessage[]): number {
    // Simple estimation: ~4 chars per token
    return messages.reduce((sum, msg) => sum + msg.content.length / 4, 0);
  }

  private getCostPerToken(model: string): number {
    const costs = {
      'your-model-1': 0.00001,
      'your-model-2': 0.00002,
    };
    return costs[model] || 0.00001;
  }
}
```

### 2. Export Provider

Add to `packages/core/src/providers/index.ts`:

```typescript
export { YourProvider } from './YourProvider';
```

### 3. Register in Runtime

```typescript
import { YourProvider } from '@aethermind/core';

runtime.registerProvider('yourprovider', new YourProvider(apiKey));
```

### 4. Add Tests

Create `packages/core/src/providers/__tests__/YourProvider.test.ts`:

```typescript
import { YourProvider } from '../YourProvider';

describe('YourProvider', () => {
  it('should send chat request', async () => {
    const provider = new YourProvider('test-key');
    const response = await provider.chat([
      { role: 'user', content: 'Hello' }
    ], {});
    
    expect(response.content).toBeDefined();
  });
});
```

## Adding a New API Endpoint

### 1. Create Route Handler

Add to `apps/api/src/routes/your-resource.ts`:

```typescript
import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// Schema validation
const CreateResourceSchema = z.object({
  name: z.string().min(1).max(255),
  config: z.record(z.unknown()).optional()
});

// GET /api/resources
router.get('/', async (req, res) => {
  try {
    const resources = await getResources();
    res.json({ resources });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/resources
router.post('/', async (req, res) => {
  try {
    const validated = CreateResourceSchema.parse(req.body);
    const resource = await createResource(validated);
    res.status(201).json(resource);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

export default router;
```

### 2. Register Route

Add to `apps/api/src/index.ts`:

```typescript
import yourResourceRoutes from './routes/your-resource';

app.use('/api/resources', authMiddleware, yourResourceRoutes);
```

### 3. Add Tests

Create `tests/api/your-resource.test.ts`:

```typescript
import request from 'supertest';
import app from '../../apps/api/src/index';

describe('Resources API', () => {
  it('should create resource', async () => {
    const response = await request(app)
      .post('/api/resources')
      .set('X-API-Key', process.env.TEST_API_KEY)
      .send({ name: 'Test Resource' });
    
    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Test Resource');
  });
});
```

## Debugging

### VSCode Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "@aethermind/api", "dev"],
      "skipFiles": ["<node_internals>/**"],
      "sourceMaps": true
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Logging

```typescript
import { StructuredLogger } from '@aethermind/core';

const logger = new StructuredLogger({
  level: 'debug',
  context: { component: 'MyComponent' }
});

logger.debug('Debug message', { data: 'value' });
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message', { error });
```

## Hot Reload

Agent configurations are automatically reloaded in development:

```bash
# Enable hot reload (default in development)
ENABLE_HOT_RELOAD=true pnpm dev

# Edit agent config
# Changes are detected and applied automatically
```

## Database Migrations

### Create Migration

```bash
# Create new migration
pnpm db:migrate:dev --name add_new_field

# Apply migrations
pnpm db:migrate

# Reset database (development only)
pnpm db:reset
```

### Prisma Studio

```bash
# Open Prisma Studio (database GUI)
pnpm db:studio
```

## Testing Guidelines

### Unit Tests

Test individual functions and classes:

```typescript
// packages/core/src/__tests__/Agent.test.ts
import { Agent } from '../agent/Agent';

describe('Agent', () => {
  it('should execute successfully', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'test',
      model: 'gpt-4',
      logic: async () => ({ result: 'success' })
    });

    const result = await agent.execute({});
    expect(result.status).toBe('completed');
  });
});
```

### Integration Tests

Test component interactions:

```typescript
// tests/integration/workflow.test.ts
import { Orchestrator, WorkflowEngine } from '@aethermind/core';

describe('Workflow Integration', () => {
  it('should execute workflow end-to-end', async () => {
    const orchestrator = new Orchestrator(runtime);
    const result = await orchestrator.executeWorkflow('test-workflow', {});
    
    expect(result.status).toBe('completed');
  });
});
```

### E2E Tests

Test complete user flows:

```typescript
// tests/e2e/full-workflow.test.ts
import request from 'supertest';

describe('Full Workflow E2E', () => {
  it('should complete research workflow', async () => {
    // Create agents
    // Execute workflow
    // Verify results
  });
});
```

## Code Style

### TypeScript

```typescript
// ✅ Good
interface AgentConfig {
  name: string;
  model: string;
  systemPrompt?: string;
}

async function executeAgent(config: AgentConfig): Promise<ExecutionResult> {
  const agent = createAgent(config);
  return await agent.execute();
}

// ❌ Bad
function ExecuteAgent(config: any) {
  return createAgent(config).execute();
}
```

### Naming Conventions

- **Classes**: `PascalCase` (e.g., `AgentRuntime`)
- **Functions**: `camelCase` (e.g., `executeAgent`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`)
- **Files**: `kebab-case.ts` or `PascalCase.ts` for classes

## Performance Tips

1. **Use connection pooling** for database
2. **Cache frequently accessed data** in Redis
3. **Implement pagination** for large result sets
4. **Use async/await** properly
5. **Avoid N+1 queries**

## Security Best Practices

1. **Never commit secrets** to Git
2. **Validate all inputs** with Zod
3. **Sanitize logs** before persisting
4. **Use prepared statements** for SQL
5. **Implement rate limiting**

## Useful Commands

```bash
# Development
pnpm dev                    # Start all services
pnpm dev:api                # Start API only
pnpm dev:dashboard          # Start dashboard only

# Building
pnpm build                  # Build all packages
pnpm clean                  # Clean build artifacts

# Testing
pnpm test                   # Unit tests
pnpm test:watch             # Watch mode
pnpm test:coverage          # With coverage

# Database
pnpm db:migrate             # Run migrations
pnpm db:studio              # Open Prisma Studio
pnpm db:seed                # Seed database

# Docker
pnpm docker:up              # Start services
pnpm docker:down            # Stop services
pnpm docker:logs            # View logs

# Validation
pnpm validate               # Validate setup
pnpm lint                   # Run linter
pnpm typecheck              # Type check
```

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Jest Documentation](https://jestjs.io/docs/getting-started)

---

**Last Updated**: 2025-11-26  
**Version**: 0.1.0  
**Maintainer**: Aethermind Team
