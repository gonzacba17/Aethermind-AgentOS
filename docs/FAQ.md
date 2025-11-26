# Frequently Asked Questions - Aethermind AgentOS

> Common questions about Aethermind AgentOS v0.1.0

## General

### What is Aethermind AgentOS?

Aethermind AgentOS is a platform for building, orchestrating, and monitoring multi-agent AI systems. It provides real-time monitoring, cost tracking, and a developer-friendly SDK for coordinating multiple AI agents working together.

### Who is it for?

- Developers building AI-powered applications
- Teams needing to orchestrate multiple LLMs
- Organizations requiring cost transparency for LLM usage
- Anyone building complex multi-step AI workflows

### What makes it different from LangChain/CrewAI/AutoGen?

| Feature | Aethermind | LangChain | CrewAI | AutoGen |
|---------|------------|-----------|---------|---------|
| Real-time Dashboard | ✅ | ❌ | ❌ | ❌ |
| Cost Tracking | ✅ | ❌ | ❌ | ❌ |
| Production-Ready | ✅ | ⚠️ | ⚠️ | ❌ |
| TypeScript-First | ✅ | ❌ | ❌ | ❌ |
| WebSocket Updates | ✅ | ❌ | ❌ | ❌ |

## Installation

### What are the minimum requirements?

- Node.js 20+
- pnpm 9+
- Docker Desktop
- At least one LLM API key (OpenAI, Anthropic, or Google)

### Can I use it without Docker?

Yes, but you'll need to install and configure PostgreSQL and Redis manually. Docker is recommended for easier setup.

### Which LLM providers are supported?

- **OpenAI** (GPT-3.5, GPT-4, GPT-4-turbo)
- **Anthropic** (Claude 3 Opus, Sonnet, Haiku)
- **Google** (Gemini models)
- **Ollama** (Local models: Llama 2, Mistral, etc.)

## Usage

### How do I create an agent?

```typescript
import { createAgent } from '@aethermind/sdk';

const agent = createAgent({
  name: 'researcher',
  model: 'gpt-4',
  systemPrompt: 'You are a research assistant.',
  logic: async (ctx) => {
    // Your agent logic
    return { result: 'data' };
  }
});
```

### How do I execute a workflow?

```typescript
const workflow = {
  name: 'research-workflow',
  steps: [
    { id: 'research', agent: 'researcher' },
    { id: 'analyze', agent: 'analyst', dependsOn: ['research'] }
  ]
};

const result = await orchestrator.executeWorkflow(workflow, { topic: 'AI' });
```

### How accurate is cost estimation?

Cost estimation uses:
1. **Historical data** (if available) - 90%+ accuracy
2. **Heuristic estimation** - 70-80% accuracy
3. **Default estimates** - 50-60% accuracy

Actual costs are tracked in real-time during execution.

## Troubleshooting

### API returns 401 Unauthorized

- Verify API key is correct
- Check `API_KEY_HASH` in `.env` matches generated hash
- Ensure `X-API-Key` header is included in request

### PostgreSQL connection failed

- Verify Docker is running: `docker ps`
- Check credentials in `.env` match `docker-compose.yml`
- Restart services: `pnpm docker:down && pnpm docker:up`

### LLM provider error

- Verify API key is valid and has credits
- Check API key format (OpenAI: `sk-...`, Anthropic: `sk-ant-...`)
- Test API key directly with provider's API

### Port already in use

- Find process: `lsof -i :3001` (macOS/Linux) or `netstat -ano | findstr :3001` (Windows)
- Kill process or change port in `.env`

## Development

### How do I add a new LLM provider?

See [Development Guide - Adding a New LLM Provider](DEVELOPMENT.md#adding-a-new-llm-provider)

### How do I add a new API endpoint?

See [Development Guide - Adding a New API Endpoint](DEVELOPMENT.md#adding-a-new-api-endpoint)

### How do I run tests?

```bash
pnpm test              # Unit tests
pnpm test:integration  # Integration tests
pnpm test:e2e          # End-to-end tests
pnpm test:all          # All tests
```

## Production

### Is it production-ready?

Version 0.1.0 is an MVP suitable for:
- ✅ Development and testing
- ✅ Small-scale production (< 100 users)
- ⚠️ Large-scale production (requires additional setup)

For large-scale production, see [Deployment Guide](DEPLOYMENT.md).

### How do I deploy to production?

See [Deployment Guide](DEPLOYMENT.md) for detailed instructions on deploying to:
- Railway
- Vercel (Dashboard)
- AWS/GCP/Azure

### What about horizontal scaling?

Horizontal scaling is planned for v0.3.0. Current version supports vertical scaling (increase resources).

## Pricing

### Is Aethermind AgentOS free?

Yes, Aethermind AgentOS is open-source and free to use under the MIT License.

### What about LLM costs?

You pay for LLM API usage directly to providers (OpenAI, Anthropic, etc.). Aethermind tracks these costs but doesn't charge for the platform itself.

## Support

### Where can I get help?

- **Documentation**: [docs/](.)
- **GitHub Issues**: [github.com/aethermind/agentos/issues](https://github.com/aethermind/agentos/issues)
- **GitHub Discussions**: [github.com/aethermind/agentos/discussions](https://github.com/aethermind/agentos/discussions)

### How do I report a bug?

Create a GitHub issue with:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node.js version, etc.)

### How do I request a feature?

Create a GitHub issue with:
- Use case description
- Proposed solution
- Alternatives considered

---

**Last Updated**: 2025-11-26  
**Version**: 0.1.0
