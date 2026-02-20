# @aethermind/agent

Lightweight SDK for real-time AI API cost monitoring. Works with any setup -- official SDKs, raw `fetch()`, or any HTTP client that calls OpenAI or Anthropic APIs.

## Installation

```bash
npm install @aethermind/agent
# or
pnpm add @aethermind/agent
# or
yarn add @aethermind/agent
```

No peer dependencies required. If you use the official OpenAI or Anthropic Node.js SDKs, the agent will patch those too for deeper telemetry -- but it is entirely optional.

## Quick Start

```typescript
import { initAethermind } from "@aethermind/agent";

// Initialize once at app startup
initAethermind({
  apiKey: process.env.AETHERMIND_API_KEY!,
});
```

That's it. Every call to `api.openai.com` or `api.anthropic.com` is now tracked automatically -- regardless of how you make the request.

### Using raw fetch()

```typescript
// No SDK needed -- fetch() calls are intercepted automatically
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  },
  body: JSON.stringify({
    model: "gpt-4o",
    messages: [{ role: "user", content: "Hello!" }],
  }),
});

// Costs are tracked in the background
const data = await response.json();
console.log(data.choices[0].message.content);
```

### Using the OpenAI SDK

```typescript
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Automatically tracked via SDK patching
const completion = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});
```

### Using the Anthropic SDK

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Automatically tracked via SDK patching
const message = await anthropic.messages.create({
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello, Claude!" }],
});
```

## How It Works

The SDK uses three layers to capture telemetry with zero code changes:

1. **Fetch interceptor** -- Patches `globalThis.fetch` to detect calls to OpenAI/Anthropic API hostnames. Extracts model, tokens, cost, and latency from the response. Works with any HTTP client that uses `fetch()` under the hood.

2. **SDK patching** -- Monkey-patches `OpenAI.chat.completions.create` and `Anthropic.messages.create` prototypes for SDK-specific telemetry (covers streaming and other SDK features). Only activates if the SDKs are installed.

3. **Batch transport** -- Captured events are queued locally and flushed to the Aethermind API in batches (default: every 30 seconds or 50 events). Failed events are stored in a dead-letter queue for retry.

Non-LLM fetch calls (e.g. your own API routes) pass through untouched with zero overhead. All telemetry extraction is wrapped in try/catch -- the SDK never throws errors into your application.

## Configuration

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

| Option          | Type      | Default                     | Description                        |
| --------------- | --------- | --------------------------- | ---------------------------------- |
| `apiKey`        | `string`  | _required_                  | Your Aethermind API key            |
| `endpoint`      | `string`  | `https://api.aethermind.io` | API endpoint URL                   |
| `flushInterval` | `number`  | `30000`                     | Milliseconds between batch flushes |
| `batchSize`     | `number`  | `50`                        | Maximum events per batch           |
| `enabled`       | `boolean` | `true`                      | Enable/disable monitoring          |

### Disable Monitoring in Development

```typescript
initAethermind({
  apiKey: process.env.AETHERMIND_API_KEY!,
  enabled: process.env.NODE_ENV === "production",
});
```

### CommonJS Usage

```javascript
const { initAethermind } = require("@aethermind/agent");

initAethermind({
  apiKey: process.env.AETHERMIND_API_KEY,
});
```

## Troubleshooting

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

## Documentation

- [Full Documentation](https://docs.aethermind.io)
- [API Reference](https://docs.aethermind.io/api)
- [Dashboard](https://dashboard.aethermind.io)

## Support

- [Report Issues](https://github.com/gonzacba17/Aethermind-AgentOS/issues)
- [Discussions](https://github.com/gonzacba17/Aethermind-AgentOS/discussions)
- Email: support@aethermind.io

## License

MIT - Aethermind Team
