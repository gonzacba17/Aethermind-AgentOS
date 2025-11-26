# Aethermind AgentOS MVP

> A powerful platform for building, orchestrating, and monitoring multi-agent AI systems

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start Docker services
pnpm docker:up

# Validate setup
pnpm validate

# Run demo
pnpm demo

# Start development
pnpm dev
```

Open http://localhost:3000 to see the dashboard.

## ✨ Features

- **🤖 Multi-Agent Orchestration** - Coordinate multiple AI agents working together
- **📊 Real-time Monitoring** - Live logs, traces, and execution visualization
- **💰 Cost Tracking** - Monitor LLM API costs in real-time
- **🔌 Multiple LLM Support** - OpenAI, Anthropic, Google, and local models
- **🎯 Developer-Friendly** - Simple SDK with full TypeScript support
- **📈 Observability** - Comprehensive logging, tracing, and metrics
- **🔄 Workflow Engine** - Define complex multi-step agent workflows
- **⚡ WebSocket Updates** - Real-time updates via WebSocket

## 📋 Prerequisites

- **Node.js** 20 or higher
- **pnpm** 9.0 or higher
- **Docker Desktop** (for PostgreSQL and Redis)
- **API Keys** for at least one LLM provider:
  - OpenAI API key
  - Anthropic API key
  - Google API key

## 🔐 Environment Setup

Before starting the application, you **MUST** configure environment variables:

### 1. Copy the environment template

```bash
# Windows
copy .env.example .env

# Linux/Mac
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
# Generate a secure API key and its hash
pnpm run generate-api-key

# Output example:
# API Key (save this securely): ak_abc123xyz789...
# API Key Hash (add to .env): $2b$10$...
```

Copy the hash to your `.env` file:
```env
API_KEY_HASH=$2b$10$your_generated_hash_here
```

**Important:** Save the API key securely - you'll need it to authenticate API requests.

### 4. Using the API key

Include the API key in all API requests:

```bash
curl -H "X-API-Key: ak_abc123xyz789..." http://localhost:3001/api/agents
```

## 🛠️ Installation

### 1. Clone and Install

```bash
git clone <repository-url>
cd aethermind-agentos
pnpm install
```

### 2. Configure Environment

Follow the [Environment Setup](#-environment-setup) section above.

### 3. Start Services

```bash
# Start PostgreSQL and Redis
pnpm docker:up

# Wait 30 seconds for services to initialize

# Validate everything is working
pnpm validate
```

### 4. Run the Demo

```bash
pnpm demo
```

You should see a multi-agent workflow execute successfully!

### 5. Start Development

Open two terminals:

**Terminal 1 - API Server:**
```bash
cd apps/api
pnpm dev
```

**Terminal 2 - Dashboard:**
```bash
cd packages/dashboard
pnpm dev
```

Open http://localhost:3000 in your browser.

## 📚 Documentation

### Available Documentation

- **[Project Structure](ESTRUCTURA.md)** - Complete architecture overview and codebase organization
- **[Changelog](CHANGELOG.md)** - Version history and release notes
- **[Development History](CHANGELOG_DEV_HISTORY.md)** - Detailed sprint-by-sprint development log
- **[Roadmap](roadmap.md)** - Strategic roadmap and future plans (2025+)
- **[Technical Audit](auditoria_tecnica.md)** - Comprehensive technical audit findings

### Additional Documentation (Coming Soon)

- **Testing Guide** - How to run and write tests
- **Validation Checklist** - Complete feature checklist for QA
- **Beta Testing Guide** - Guide for beta testers
- **Debugging Guide** - Debugging with source maps and VSCode
- **Error Codes Reference** - Complete error codes documentation
- **Quick Start Guide** - Fastest path to your first agent

## 🛠️ Developer Tools

### Hot Reload

Agent configurations are automatically reloaded when changed (enabled in development by default):

```bash
# Hot reload is enabled by default in development
cd apps/api
pnpm dev

# Modify any agent config in config/agents/
# Changes are automatically detected and applied
```

Disable hot reload:
```env
ENABLE_HOT_RELOAD=false
```

### Debugging with VSCode

Source maps are enabled for all TypeScript packages. For debugging information:
- VSCode launch configurations
- Setting breakpoints in TypeScript
- Debugging agents and workflows
- Common debugging scenarios

(Full debugging guide coming soon)

### VSCode Extension

Install the Aethermind VSCode extension for code snippets:

```bash
cd packages/vscode-extension
npm install -g vsce
vsce package
code --install-extension aethermind-agentos-0.1.0.vsix
```

Available snippets:
- `aether-agent` - Create a new agent
- `aether-workflow` - Create a workflow
- `aether-provider-openai` - Configure OpenAI
- `aether-provider-anthropic` - Configure Anthropic
- `aether-provider-ollama` - Configure Ollama
- `aether-execute` - Execute an agent
- `aether-chat` - Chat with an agent
- `aether-error` - Handle errors with error codes

### Error Codes

All errors include unique codes and helpful suggestions. Example error response:
```json
{
  "error": "ProviderError",
  "code": "E101",
  "message": "Invalid API key for openai",
  "suggestion": "Check your OPENAI_API_KEY in the .env file..."
}
```

## 🎯 Usage

### Creating an Agent

```typescript
import { createAgent, startOrchestrator } from '@aethermind/sdk';

const researcher = createAgent({
  name: 'researcher',
  model: 'gpt-4',
  systemPrompt: 'You are a research assistant.',
  logic: async (ctx) => {
    // Your agent logic here
    return { findings: ['Finding 1', 'Finding 2'] };
  },
});
```

### Starting the Orchestrator

```typescript
const orchestrator = startOrchestrator({
  agents: [researcher],
  config: {
    maxRetries: 3,
    timeout: 30000,
  },
});
```

### Executing a Task

```typescript
const result = await orchestrator.execute({
  agentId: researcher.id,
  input: { topic: 'AI market analysis' },
});

console.log(result);
```

### Multi-Agent Workflow

```typescript
const workflow = {
  steps: [
    { id: 'research', agent: researcher.id },
    { id: 'analyze', agent: analyst.id },
    { id: 'write', agent: writer.id },
  ],
};

const result = await orchestrator.executeWorkflow(workflow, {
  topic: 'Market analysis',
});
```

### WebSocket Connection (Real-time Updates)

Connect to the WebSocket endpoint for real-time updates on logs, executions, and events.

**Authentication is required** - provide your API key via header or query parameter:

#### Option 1: Using Header (Recommended)

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3001/ws', {
  headers: {
    'x-api-key': 'your-api-key-here'
  }
});

ws.on('open', () => {
  console.log('Connected to WebSocket');
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message.type, message.data);
});

ws.on('close', (code, reason) => {
  if (code === 1008) {
    console.error('Authentication failed:', reason.toString());
  }
});
```

#### Option 2: Using Query Parameter

```javascript
const ws = new WebSocket('ws://localhost:3001/ws?apiKey=your-api-key-here');

ws.on('open', () => {
  console.log('Connected to WebSocket');
});
```

#### Browser Example

```javascript
// Using query parameter (browsers don't support custom headers in WebSocket constructor)
const ws = new WebSocket(`ws://localhost:3001/ws?apiKey=${encodeURIComponent(apiKey)}`);

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message.type, message.data);
};

ws.onclose = (event) => {
  if (event.code === 1008) {
    console.error('Authentication failed:', event.reason);
  }
};
```

#### Available Message Types

- `connected` - Connection established
- `log` - New log entry
- `agent:event` - Agent lifecycle event
- `workflow:started` - Workflow execution started
- `workflow:completed` - Workflow execution completed
- `workflow:failed` - Workflow execution failed
- `config:change` - Agent configuration changed (hot reload)
- `agent:reloaded` - Agent successfully reloaded
- `agent:reload-failed` - Agent reload failed

#### Subscribing to Channels

```javascript
// Subscribe to specific channels
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: ['log', 'agent:event']
}));

// Unsubscribe from channels
ws.send(JSON.stringify({
  type: 'unsubscribe',
  channels: ['log']
}));

// Ping/pong for keepalive
ws.send(JSON.stringify({ type: 'ping' }));
// Server responds with { type: 'pong', data: { timestamp: ... } }
```



## 🧪 Testing

```bash
# Run all tests
pnpm test:all

# Run unit tests
pnpm test

# Run integration tests
pnpm test:integration

# Run E2E tests
pnpm test:e2e

# Run API tests
pnpm test:api
```

## 📦 Project Structure

```
aethermind-agentos/
├── apps/
│   └── api/              # REST API server
├── packages/
│   ├── core/             # Core agent logic
│   ├── sdk/              # Developer SDK
│   └── dashboard/        # Next.js dashboard
├── examples/
│   └── basic-agent/      # Example implementations
├── tests/
│   ├── e2e/              # End-to-end tests
│   ├── api/              # API tests
│   └── websocket/        # WebSocket tests
├── scripts/              # Utility scripts
└── docs/                 # Documentation
```

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start all services in development mode |
| `pnpm build` | Build all packages for production |
| `pnpm test` | Run unit tests |
| `pnpm test:all` | Run all test suites |
| `pnpm validate` | Validate system setup |
| `pnpm demo` | Run the full demo |
| `pnpm docker:up` | Start Docker services |
| `pnpm docker:down` | Stop Docker services |
| `pnpm docker:logs` | View Docker logs |

## 🐛 Troubleshooting

### Docker not starting

```bash
# Check Docker is running
docker ps

# Restart services
pnpm docker:down
pnpm docker:up
```

### API not responding

```bash
# Check API health
curl http://localhost:3001/health

# Restart API
cd apps/api
pnpm dev
```

### Tests failing

```bash
# Validate setup first
pnpm validate

# Check services are running
docker ps

# Restart services if needed
pnpm docker:down
pnpm docker:up
```

### Database connection errors

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test connection
docker exec -i postgres psql -U postgres -c "SELECT 1"
```

## 🗺️ Related Documentation

- **[Changelog](CHANGELOG.md)** - Release history and version notes
- **[Development History](CHANGELOG_DEV_HISTORY.md)** - Detailed sprint logs (v0.2.0-0.6.0)
- **[Roadmap](roadmap.md)** - Strategic roadmap and future features (2025+)
- **[Project Structure](ESTRUCTURA.md)** - Complete architecture and codebase overview
- **[Technical Audit](auditoria_tecnica.md)** - Security and quality assessment

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

Built with:
- [Next.js](https://nextjs.org/) - Dashboard framework
- [Express](https://expressjs.com/) - API server
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Redis](https://redis.io/) - Caching and pub/sub
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Turborepo](https://turbo.build/) - Monorepo management

## 📞 Support

- **Documentation:** [docs/](docs/)
- **Issues:** GitHub Issues
- **Discussions:** GitHub Discussions

---

Made with ❤️ by the Aethermind team
