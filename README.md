# Aethermind AgentOS

> **FinOps Platform for AI Cost Control** - Track, predict, and optimize your OpenAI and Anthropic API costs in real-time.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-orange)](https://github.com/aethermind/agentos/releases)

**Stop overspending on OpenAI, Anthropic, and other LLMs.**
Aethermind gives enterprises real-time cost control, automatic budget enforcement, and predictive analytics for AI workloads.

## Key Features

- **Budget Enforcement** - Set hard limits per team, agent, or workflow - executions blocked automatically
- **Smart Alerts** - Email and Slack notifications before you exceed budgets
- **Cost Forecasting** - Predict end-of-month spend with historical analysis
- **Team-Level Tracking** - Assign costs to departments and cost centers
- **Multi-Agent Orchestration** - Coordinate AI agents with full cost visibility
- **Real-time Monitoring** - Live dashboard with logs, traces, and execution visualization
- **Cost Transparency** - Track and estimate LLM API costs before execution
- **Multiple LLM Support** - OpenAI, Anthropic, Google, and local models (Ollama)
- **WebSocket Updates** - Real-time updates via WebSocket
- **Developer-Friendly SDK** - One-line integration with `@aethermind/agent`

## Quick Start

### SaaS Mode (Recommended)

```bash
# Install SDK
npm install @aethermind/agent

# One line to start tracking
import { initAethermind } from '@aethermind/agent';
initAethermind({ apiKey: process.env.AETHERMIND_API_KEY });

# Use OpenAI/Anthropic normally - costs automatically tracked!
```

### Self-Hosted

```bash
# Clone the repository
git clone <repository-url>
cd aethermind-agentos

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys and database credentials

# Start Docker services (PostgreSQL + Redis)
pnpm docker:up

# Generate API key for authentication
pnpm generate-api-key

# Run the demo
pnpm demo

# Start development servers
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard.

## Prerequisites

- **Node.js** 20 or higher
- **pnpm** 9.0 or higher
- **Docker Desktop** (for PostgreSQL and Redis)
- **API Keys** for at least one LLM provider (OpenAI, Anthropic, or Google)

## Environment Setup

Before starting the application, you **MUST** configure environment variables:

### 1. Copy the environment template

```bash
cp .env.example .env
```

### 2. Configure required variables

Edit `.env` and set the following **REQUIRED** values:

```env
# Database (REQUIRED - no defaults in production)
POSTGRES_USER=aethermind
POSTGRES_PASSWORD=your_secure_password_here  # CHANGE THIS!
POSTGRES_DB=aethermind

# LLM API Keys (at least one required)
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# API Authentication
API_KEY_HASH=generate_with_script  # See "Generating API Keys" below
```

### 3. Generate an API key for authentication

```bash
pnpm run generate-api-key

# Output example:
# API Key (save this securely): ak_abc123xyz789...
# API Key Hash (add to .env): $2b$10$...
```

Copy the hash to your `.env` file and save the API key securely.

### 4. Using the API key

Include the API key in all API requests:

```bash
curl -H "X-API-Key: ak_abc123xyz789..." http://localhost:3001/api/agents
```

## Project Structure

```
aethermind-agentos/
├── apps/
│   └── api/              # REST API + WebSocket server
├── packages/
│   ├── core/             # Agent orchestration framework
│   ├── agent/            # Developer SDK (@aethermind/agent)
│   ├── dashboard/        # Next.js monitoring dashboard
│   └── create-aethermind-app/  # CLI scaffolding tool
├── tests/                # E2E and integration tests
│   ├── e2e/
│   └── integration/
├── scripts/              # Utility scripts
└── docs/                 # Documentation
```

## Usage

### Creating an Agent

```typescript
import { initAethermind } from "@aethermind/agent";

initAethermind({
  apiKey: process.env.AETHERMIND_API_KEY,
});

// Your existing AI code works as usual - Aethermind
// automatically tracks costs, tokens, and latency.
```

### Starting the Orchestrator

```typescript
const orchestrator = startOrchestrator({
  agents: [researcher],
  config: { maxRetries: 3, timeout: 30000 },
});
```

### Executing a Task

```typescript
const result = await orchestrator.execute({
  agentId: researcher.id,
  input: { topic: "AI market analysis" },
});

console.log(result);
```

### Multi-Agent Workflow

```typescript
const workflow = {
  steps: [
    { id: "research", agent: researcher.id },
    { id: "analyze", agent: analyst.id },
    { id: "write", agent: writer.id },
  ],
};

const result = await orchestrator.executeWorkflow(workflow, {
  topic: "Market analysis",
});
```

### WebSocket Connection (Real-time Updates)

```javascript
const WebSocket = require("ws");

const ws = new WebSocket("ws://localhost:3001/ws", {
  headers: { "x-api-key": "your-api-key-here" },
});

ws.on("open", () => console.log("Connected to WebSocket"));
ws.on("message", (data) => {
  const message = JSON.parse(data);
  console.log("Received:", message.type, message.data);
});

// Subscribe to specific channels
ws.send(
  JSON.stringify({
    type: "subscribe",
    channels: ["log", "agent:event"],
  }),
);
```

## Available Commands

| Command                 | Description                            |
| ----------------------- | -------------------------------------- |
| `pnpm dev`              | Start all services in development mode |
| `pnpm build`            | Build all packages for production      |
| `pnpm test`             | Run unit tests                         |
| `pnpm test:all`         | Run all test suites                    |
| `pnpm test:integration` | Run integration tests                  |
| `pnpm test:e2e`         | Run end-to-end tests                   |
| `pnpm test:coverage`    | Run with coverage report               |
| `pnpm validate`         | Validate system setup                  |
| `pnpm demo`             | Run the full demo                      |
| `pnpm docker:up`        | Start Docker services                  |
| `pnpm docker:down`      | Stop Docker services                   |
| `pnpm docker:logs`      | View Docker logs                       |

## Testing

```bash
# Run all tests
pnpm test:all

# Run unit tests
pnpm test

# Run with coverage
pnpm test:coverage
```

### Test Coverage by Component

| Component     | Coverage | Test Files                                      |
| ------------- | -------- | ----------------------------------------------- |
| StripeService | ~70%     | StripeService.test.ts                           |
| Auth Flow     | ~75%     | auth.test.ts, auth-flow.test.ts                 |
| Routes API    | ~70%     | routes-workflows, routes-costs, routes-traces   |
| Providers     | ~75%     | AnthropicProvider                               |
| Services      | ~60%     | CostEstimationService, stores, cache            |
| Validation    | ~90%     | schemas                                         |
| Middleware    | ~80%     | auth, validator, sanitizer                      |
| SDK           | ~65%     | BatchTransport, EventQueue, interceptors, retry |

## Troubleshooting

### Docker not starting

```bash
docker ps
pnpm docker:down
pnpm docker:up
```

### API not responding

```bash
curl http://localhost:3001/health
cd apps/api && pnpm dev
```

### Database connection errors

```bash
docker ps | grep postgres
docker exec -i postgres psql -U postgres -c "SELECT 1"
```

## Security

- API key authentication with bcrypt hashing
- Rate limiting on all endpoints
- CORS configuration
- Input sanitization and validation (Zod)
- WebSocket authentication
- Secure credential management
- CSP headers via Helmet
- Non-root Docker containers

## Documentation

- **[Documentation Index](docs/README.md)** - Full list of available documentation
- **[Changelog](docs/CHANGELOG.md)** - Version history and release notes
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute
- **[SDK Documentation](packages/agent/README.md)** - SDK usage guide

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- Definition of Done for PRs
- Development workflow
- Code review process
- Bug reports and feature requests

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Built With

- [TypeScript](https://www.typescriptlang.org/) - Type safety and developer experience
- [Node.js](https://nodejs.org/) - Runtime environment
- [Express](https://expressjs.com/) - API server framework
- [Next.js](https://nextjs.org/) - Dashboard framework
- [PostgreSQL](https://www.postgresql.org/) - Primary database
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM and query builder
- [Redis](https://redis.io/) - Caching and pub/sub (optional, with graceful fallback)
- [Turborepo](https://turbo.build/) - Monorepo build system
- [pnpm](https://pnpm.io/) - Fast, disk space efficient package manager
- [Jest](https://jestjs.io/) - Testing framework

## Support

- **Documentation**: [docs/](docs/README.md)
- **Issues**: [GitHub Issues](https://github.com/aethermind/agentos/issues)
- **Discussions**: [GitHub Discussions](https://github.com/aethermind/agentos/discussions)

---

Made with ❤️ by the Aethermind team
