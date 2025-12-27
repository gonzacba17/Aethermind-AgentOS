# @aethermind/agent

Lightweight SDK for monitoring AI API costs in real-time.

## 🚀 Quick Start

```bash
npm install @aethermind/agent openai
```

```typescript
import OpenAI from 'openai';
import { initAethermind } from '@aethermind/agent';

// Initialize Aethermind (do this once at app startup)
initAethermind({
  apiKey: process.env.AETHERMIND_API_KEY, // Get from dashboard.aethermind.io
  endpoint: 'https://api.aethermind.io',
});

// Use OpenAI normally - monitoring happens automatically!
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const completion = await openai.chat.completions.create({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Hello!' }],
});

// Costs are tracked automatically! View at dashboard.aethermind.io
```

## ✨ Features

- 🎯 **Zero config** - Works out of the box
- ⚡ **Zero overhead** - < 5ms latency per request
- 🔄 **Auto-batching** - Efficient telemetry transmission (30s or 50 events)
- 🛡️ **Resilient** - Never crashes your app
- 📊 **Real-time** - See costs in dashboard immediately
- 🔁 **Retry logic** - Exponential backoff with 3 retries
- 🚪 **Graceful shutdown** - Flushes events on SIGINT/SIGTERM

## 📦 Supported Providers

- ✅ OpenAI (GPT-4, GPT-3.5, etc.)
- ✅ Anthropic (Claude 3, Claude 2, etc.)
- 🔜 Google AI (Gemini)
- 🔜 Cohere
- 🔜 Mistral

## 🔧 Configuration

```typescript
initAethermind({
  apiKey: string;          // Required: Your Aethermind API key
  endpoint?: string;       // Optional: Custom endpoint (defaults to production)
  flushInterval?: number;  // Optional: Flush interval in ms (default: 30000)
  batchSize?: number;      // Optional: Max events per batch (default: 50)
});
```

## 💡 How It Works

1. SDK intercepts calls to OpenAI/Anthropic
2. Captures: model, tokens, cost, latency, errors
3. Batches events locally
4. Sends to Aethermind API asynchronously
5. View metrics in real-time dashboard

**Zero impact on your application performance!**

## 📖 Documentation

- [Full Documentation](https://docs.aethermind.io)
- [API Reference](https://docs.aethermind.io/api)
- [Examples](https://github.com/gonzacba17/Aethermind-AgentOS/tree/main/packages/agent/examples)

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/gonzacba17/Aethermind-AgentOS/issues)
- **Email**: support@aethermind.io
- **Discord**: [Join our community](https://discord.gg/aethermind)

## 📄 License

MIT © Aethermind Team

---

Made with ❤️ for AI developers
