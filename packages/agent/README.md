# @aethermind/agent

Lightweight SDK for monitoring AI API costs with Aethermind AgentOS.

## Installation

```bash
npm install @aethermind/agent
# or
pnpm add @aethermind/agent
# or
yarn add @aethermind/agent
```

## Quick Start

```typescript
import { initAethermind } from "@aethermind/agent";

// Initialize with your API key
initAethermind({
  apiKey: process.env.AETHERMIND_API_KEY,
  endpoint: "https://api.aethermind.io", // optional
});

// Use OpenAI as normal - events are automatically captured
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello!" }],
});
```

## Features

- 🎯 **Zero Code Changes**: Drop-in integration with OpenAI and Anthropic SDKs
- 📊 **Automatic Cost Tracking**: Captures tokens, costs, and latency for every API call
- 🚀 **High Performance**: Batched events with configurable flush intervals
- 🔒 **Reliable**: Exponential backoff retry with graceful degradation
- 🛡️ **Type Safe**: Full TypeScript support

## Configuration

```typescript
initAethermind({
  apiKey: string;           // Required: Your Aethermind API key
  endpoint?: string;        // Optional: Custom API endpoint
  flushInterval?: number;   // Optional: Batch flush interval in ms (default: 30000)
  batchSize?: number;       // Optional: Max events per batch (default: 50)
  enabled?: boolean;        // Optional: Enable/disable tracking (default: true)
});
```

## Supported Providers

- ✅ OpenAI (GPT-3.5, GPT-4, GPT-4-turbo, o1)
- ✅ Anthropic (Claude 3 Opus, Sonnet, Haiku)
- 🔜 Additional providers coming soon

## License

MIT

## Support

- Documentation: https://docs.aethermind.io
- Issues: https://github.com/aethermind/agentos/issues
- Email: support@aethermind.io
