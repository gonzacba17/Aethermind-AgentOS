# Aethermind AgentOS

> **FinOps Platform for AI Cost Control** - Track, predict, and optimize your OpenAI and Anthropic API costs in real-time.

## 🎉 NEW: SaaS Hybrid Model - Production Ready!

The platform is now available as a **zero-friction SaaS service**:

```bash
# Install SDK
npm install @aethermind/agent

# One line to start tracking
import { initAethermind } from '@aethermind/agent';
initAethermind({ apiKey: process.env.AETHERMIND_API_KEY });

# Use OpenAI/Anthropic normally - costs automatically tracked!
```

**📚 Quick Links:**

- [Quick Start Deployment](./docs/QUICK_START_DEPLOYMENT.md) - Deploy in 15 minutes
- [Deployment Guide](./docs/DEPLOYMENT-SAAS.md) - Complete guide
- [SDK Documentation](./packages/agent/README.md) - SDK usage
- [API Specification](./docs/api-spec-ingestion.yml) - API reference

---[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-orange)](https://github.com/aethermind/agentos/releases)

**Stop overspending on OpenAI, Anthropic, and other LLMs.**  
Aethermind gives enterprises real-time cost control, automatic budget enforcement, and predictive analytics for AI workloads.

## ✨ Key Features

- 💰 **Budget Enforcement** - Set hard limits per team, agent, or workflow - executions blocked automatically
- 🚨 **Smart Alerts** - Email and Slack notifications before you exceed budgets
- 📊 **Cost Forecasting** - Predict end-of-month spend with historical analysis
- 👥 **Team-Level Tracking** - Assign costs to departments and cost centers
- 🤖 **Multi-Agent Orchestration** - Coordinate AI agents with full cost visibility
- 📈 **Real-time Monitoring** - Live dashboard with logs, traces, and execution visualization
- 💸 **Cost Transparency** - Track and estimate LLM API costs before execution
- 🔌 **Multiple LLM Support** - OpenAI, Anthropic, Google, and local models (Ollama)

## 🚀 Quick Start

Get started in under 5 minutes:

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

## 📋 Prerequisites

- **Node.js** 20 or higher
- **pnpm** 9.0 or higher
- **Docker Desktop** (for PostgreSQL and Redis)
- **API Keys** for at least one LLM provider (OpenAI, Anthropic, or Google)

## 📦 Project Structure

```
aethermind-agentos/
├── apps/
│   └── api/              # REST API + WebSocket server
├── packages/
│   ├── core/             # Agent orchestration framework
│   ├── sdk/              # Developer SDK
│   ├── dashboard/        # Next.js monitoring dashboard
│   └── create-aethermind-app/  # CLI scaffolding tool
├── examples/
│   └── basic-agent/      # Example implementations
├── tests/                # Test suites (unit, integration, e2e)
└── docs/                 # Documentation
```

## 🎯 Usage Example

```typescript
import { createAgent, startOrchestrator } from "@aethermind/sdk";

// Create an agent
const researcher = createAgent({
  name: "researcher",
  model: "gpt-4",
  systemPrompt: "You are a research assistant.",
  logic: async (ctx) => {
    // Your agent logic here
    return { findings: ["Finding 1", "Finding 2"] };
  },
});

// Start the orchestrator
const orchestrator = startOrchestrator({
  agents: [researcher],
  config: { maxRetries: 3, timeout: 30000 },
});

// Execute a task
const result = await orchestrator.execute({
  agentId: researcher.id,
  input: { topic: "AI market analysis" },
});

console.log(result);
```

## 🛠️ Available Commands

| Command            | Description                                  |
| ------------------ | -------------------------------------------- |
| `pnpm dev`         | Start all services in development mode       |
| `pnpm build`       | Build all packages for production            |
| `pnpm test`        | Run unit tests                               |
| `pnpm test:all`    | Run all test suites (unit, integration, e2e) |
| `pnpm validate`    | Validate system setup                        |
| `pnpm demo`        | Run the full demo                            |
| `pnpm docker:up`   | Start Docker services                        |
| `pnpm docker:down` | Stop Docker services                         |

## 📚 Documentation

### Core Documentation

- **[User Guide](docs/README.md)** - Complete user documentation
- **[Installation Guide](docs/INSTALLATION.md)** - Detailed installation instructions
- **[API Documentation](docs/API.md)** - REST API reference
- **[Architecture](docs/ARCHITECTURE.md)** - Technical architecture overview
- **[Development Guide](docs/DEVELOPMENT.md)** - Contributing and development setup
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions

### Operational

- **[Technical Audit](docs/AUDITORIA_TECNICA.md)** - Security, performance, and code quality assessment
- **[Security Policy](docs/SECURITY.md)** - Security best practices and vulnerability reporting
- **[Testing Guide](docs/TESTING.md)** - Test suite documentation
- **[FAQ](docs/FAQ.md)** - Frequently asked questions

### Planning & History

- **[Roadmap](docs/roadmap.md)** - Future plans and features
- **[Changelog](docs/CHANGELOG.md)** - Version history and release notes
- **[Planned Features](docs/planned-features/)** - Features in development or planned
- **[Technical Changes Archive](docs/archive/technical-changes/)** - Historical technical decisions

## 🧪 Testing

**Test Coverage**: ~60% | **Test Suites**: 14 files | **Test Cases**: 254+

```bash
# Run unit tests
pnpm test

# Run integration tests
pnpm test:integration

# Run end-to-end tests
pnpm test:e2e

# Run all tests with coverage
pnpm test:coverage

# View coverage report
start coverage/lcov-report/index.html  # Windows
open coverage/lcov-report/index.html   # macOS
```

### Test Coverage by Component

| Component  | Coverage | Test Files                                        |
| ---------- | -------- | ------------------------------------------------- |
| Routes API | ~70%     | routes-workflows, routes-costs, routes-traces     |
| Providers  | ~75%     | AnthropicProvider, OllamaProvider, OpenAIProvider |
| Services   | ~50%     | CostEstimationService, stores, cache              |
| Validation | ~90%     | schemas                                           |
| Middleware | ~80%     | auth, validator, sanitizer                        |

See [Testing Guide](docs/TESTING.md) for detailed information.

## 🔐 Security

- API key authentication with bcrypt hashing
- Rate limiting on all endpoints
- CORS configuration
- Input sanitization and validation
- WebSocket authentication
- Secure credential management

For security issues, please see our [Security Policy](docs/SECURITY.md).

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- Code of conduct
- Development setup
- Submitting pull requests
- Coding standards

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Built With

- [TypeScript](https://www.typescriptlang.org/) - Type safety and developer experience
- [Node.js](https://nodejs.org/) - Runtime environment
- [Express](https://expressjs.com/) - API server framework
- [Next.js](https://nextjs.org/) - Dashboard framework
- [PostgreSQL](https://www.postgresql.org/) - Primary database
- [Prisma](https://www.prisma.io/) - ORM and migrations (v6.19.0)
- [Redis](https://redis.io/) - Caching and pub/sub (optional, with graceful fallback)
- [Turborepo](https://turbo.build/) - Monorepo build system
- [pnpm](https://pnpm.io/) - Fast, disk space efficient package manager

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/aethermind/agentos/issues)
- **Discussions**: [GitHub Discussions](https://github.com/aethermind/agentos/discussions)

## 🌟 Acknowledgments

Special thanks to all contributors and the open-source community for making this project possible.

---

Made with ❤️ by the Aethermind team
