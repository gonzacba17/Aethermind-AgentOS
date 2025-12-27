# @aethermind/agent

Lightweight SDK for real-time AI API cost monitoring.

## 🚀 Installation

```bash
npm install @aethermind/agent openai
# or
pnpm add @aethermind/agent openai
# or
yarn add @aethermind/agent openai
```

## ⚡ Quick Start

```typescript
import OpenAI from "openai";
import { initAethermind } from "@aethermind/agent";

// 1. Initialize Aethermind (once at app startup)
initAethermind({
  apiKey: process.env.AETHERMIND_API_KEY, // Get from dashboard.aethermind.io
  endpoint: "https://aethermindapi-production.up.railway.app",
});

// 2. Use OpenAI normally - monitoring happens automatically!
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const completion = await openai.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [{ role: "user", content: "Hello!" }],
});

// 3. View costs in real-time at dashboard.aethermind.io
console.log(completion.choices[0].message.content);
```

That's it! Costs are tracked automatically.

## ✨ Features

- 🎯 **Zero Config** - Works out of the box with OpenAI SDK
- ⚡ **< 5ms Overhead** - Imperceptible latency impact
- 🔄 **Auto-Batching** - Efficient telemetry transmission every 30s
- 🛡️ **Resilient** - Never crashes your app, even if API is down
- 📊 **Real-time Dashboard** - See costs as they happen
- 🔌 **Multi-Provider** - OpenAI, Anthropic (more coming soon)

## 📖 Configuration

### Options

```typescript
initAethermind({
  apiKey: string;        // Required: Your Aethermind API key
  endpoint?: string;     // Optional: Custom API endpoint
  autoInstrument?: string[]; // Optional: ['openai', 'anthropic']
  batchSize?: number;    // Optional: Events per batch (default: 50)
  flushInterval?: number; // Optional: Flush interval in ms (default: 30000)
  debug?: boolean;       // Optional: Enable debug logs
});
```

### Advanced Usage

```typescript
// Manual event tracking
import { trackEvent } from "@aethermind/agent";

trackEvent({
  provider: "custom",
  model: "my-local-llm",
  tokensPrompt: 500,
  tokensCompletion: 200,
  cost: 0.01,
  latency: 1200,
  status: "success",
});
```

## 🔧 Troubleshooting

### Events not appearing in dashboard?

1. Wait 30 seconds (batch interval)
2. Check API key is correct
3. Enable debug mode: `initAethermind({ debug: true })`

### TypeScript errors?

Make sure you have `@types/node` installed:

```bash
npm install -D @types/node
```

## 📚 Documentation

- [Full Documentation](https://docs.aethermind.io)
- [API Reference](https://docs.aethermind.io/api)
- [Examples](https://github.com/gonzacba17/Aethermind-AgentOS/tree/main/examples)

## 🤝 Support

- 🐛 [Report Issues](https://github.com/gonzacba17/Aethermind-AgentOS/issues)
- 💬 [Discussions](https://github.com/gonzacba17/Aethermind-AgentOS/discussions)
- 📧 Email: support@aethermind.io

## 📄 License

MIT © Aethermind Team

---

**Built with ❤️ for developers who care about AI costs**
