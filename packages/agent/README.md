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
  apiKey: process.env.AETHERMIND_API_KEY!, // Get from dashboard.aethermind.io
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

### Basic Usage

```typescript
import { initAethermind } from "@aethermind/agent";

initAethermind({
  apiKey: "your-aethermind-api-key", // Required
  endpoint: "https://api.aethermind.io", // Optional
  flushInterval: 30000, // Optional: ms between flushes (default: 30000)
  batchSize: 50, // Optional: events per batch (default: 50)
  enabled: true, // Optional: enable/disable (default: true)
});
```

### CommonJS Usage

```javascript
const { initAethermind } = require("@aethermind/agent");

initAethermind({
  apiKey: process.env.AETHERMIND_API_KEY,
  endpoint: "https://aethermindapi-production.up.railway.app",
});
```

### Configuration Options

| Option          | Type      | Default                     | Description                        |
| --------------- | --------- | --------------------------- | ---------------------------------- |
| `apiKey`        | `string`  | _required_                  | Your Aethermind API key            |
| `endpoint`      | `string`  | `https://api.aethermind.io` | API endpoint URL                   |
| `flushInterval` | `number`  | `30000`                     | Milliseconds between batch flushes |
| `batchSize`     | `number`  | `50`                        | Maximum events per batch           |
| `enabled`       | `boolean` | `true`                      | Enable/disable monitoring          |

## 📚 Examples

### OpenAI Integration

```typescript
import OpenAI from "openai";
import { initAethermind } from "@aethermind/agent";

// Initialize once at startup
initAethermind({
  apiKey: process.env.AETHERMIND_API_KEY!,
});

// Use OpenAI normally
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// All calls are automatically tracked
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "What is TypeScript?" },
  ],
});
```

### Anthropic Integration

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { initAethermind } from "@aethermind/agent";

// Initialize Aethermind
initAethermind({
  apiKey: process.env.AETHERMIND_API_KEY!,
});

// Use Anthropic normally
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Automatically tracked
const message = await anthropic.messages.create({
  model: "claude-3-opus-20240229",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello, Claude!" }],
});
```

### Disable Monitoring in Development

```typescript
import { initAethermind } from "@aethermind/agent";

initAethermind({
  apiKey: process.env.AETHERMIND_API_KEY!,
  enabled: process.env.NODE_ENV === "production", // Only track in prod
});
```

## 🔧 Troubleshooting

### Events not appearing in dashboard?

1. Wait 30 seconds (default batch interval)
2. Verify API key is correct: `process.env.AETHERMIND_API_KEY`
3. Check endpoint URL is correct
4. Ensure `enabled: true` (default)

### TypeScript errors?

Make sure you have `@types/node` installed:

```bash
npm install -D @types/node
```

### Want to verify initialization?

The SDK logs to console when initialized:

```
[Aethermind] SDK initialized successfully
```

If disabled:

```
[Aethermind] SDK initialized but disabled
```

## 🎯 How It Works

1. **Instrumentation** - SDK patches OpenAI/Anthropic clients
2. **Event Capture** - Captures model, tokens, cost, latency on each call
3. **Batching** - Events batched locally (default: 50 events or 30s)
4. **Async Transmission** - Sent to Aethermind API in background
5. **Zero Impact** - No blocking, no errors thrown to your app

## 📚 Documentation

- [Full Documentation](https://docs.aethermind.io)
- [API Reference](https://docs.aethermind.io/api)
- [Dashboard](https://dashboard.aethermind.io)
- [Examples](https://github.com/gonzacba17/Aethermind-AgentOS/tree/main/examples)

## 🤝 Support

- 🐛 [Report Issues](https://github.com/gonzacba17/Aethermind-AgentOS/issues)
- 💬 [Discussions](https://github.com/gonzacba17/Aethermind-AgentOS/discussions)
- 📧 Email: support@aethermind.io

## 📄 License

MIT © Aethermind Team

---

**Built with ❤️ for developers who care about AI costs**
