# Aethermind SDK — Ollama Local Test

Test the Aethermind SDK with a local Ollama instance. All LLM calls run locally at zero cost while telemetry is captured and sent to the Aethermind dashboard.

## Prerequisites

1. **Install Ollama** — https://ollama.com/download
2. **Pull a model:**
   ```bash
   ollama pull llama3
   ```
3. **Verify Ollama is running:**
   ```bash
   ollama serve
   # In another terminal:
   curl http://localhost:11434
   # Should return "Ollama is running"
   ```

## Setup

```bash
cd examples/ollama-test
pnpm install
```

## Run

```bash
# Set your Aethermind API key (the client access token from the dashboard)
AETHERMIND_API_KEY=ct_your_token_here npx tsx index.ts
```

### Environment Variables

| Variable              | Default                                                | Description                             |
| --------------------- | ------------------------------------------------------ | --------------------------------------- |
| `AETHERMIND_API_KEY`  | _(required)_                                           | Your Aethermind client token (`ct_...`) |
| `OLLAMA_HOST`         | `http://localhost:11434`                               | Ollama server URL                       |
| `OLLAMA_MODEL`        | `llama3`                                               | Model to use for tests                  |
| `AETHERMIND_ENDPOINT` | `https://aethermind-agentos-production.up.railway.app` | Aethermind API                          |

## What it does

The script runs 3 tests:

1. **Native Chat API** (`POST /api/chat`) — Simple Q&A using Ollama's native format
2. **Native Generate API** (`POST /api/generate`) — Text generation using Ollama's native format
3. **OpenAI-Compatible API** (`POST /v1/chat/completions`) — Same as OpenAI's API format, useful for compatibility

Each call:

- Sends the request to your local Ollama
- Captures telemetry (model, tokens, latency, cost=0)
- Sends the telemetry event to the Aethermind API
- Displays the response and token counts

## Expected Output

```
🔍 Checking Ollama at http://localhost:11434...
✅ Ollama is running

━━━ Test 1: Native Chat API (/api/chat) with llama3 ━━━
  Model: llama3
  Response: Four.
  Prompt tokens: 18
  Completion tokens: 3
  ✅ Telemetry event sent

━━━ Test 2: Native Generate API (/api/generate) with llama3 ━━━
  Model: llama3
  Response: Lines of code unfold...
  Prompt tokens: 12
  Completion tokens: 25
  ✅ Telemetry event sent

━━━ Test 3: OpenAI-Compatible API (/v1/chat/completions) with llama3 ━━━
  Model: llama3
  Response: Python, JavaScript, Rust
  Usage: prompt=22, completion=8
  ✅ Telemetry event sent

📤 Flushing telemetry to Aethermind...
✅ Done! Check your dashboard for the telemetry events.
```

## Verify Telemetry

After running, check the [Aethermind Dashboard](https://aethermind-agent-os-dashboard.vercel.app) to see:

- 3 new events with `provider: ollama`
- Token counts from Ollama's response
- `cost: $0.00` (local inference)
- Latency measurements

## Troubleshooting

| Error                                   | Solution                                  |
| --------------------------------------- | ----------------------------------------- |
| `Ollama not running at localhost:11434` | Run `ollama serve` in a separate terminal |
| `model "llama3" not found`              | Run `ollama pull llama3`                  |
| `AETHERMIND_API_KEY is required`        | Set the env var with your client token    |
| `Ingestion API error: 401`              | Check that your API key is valid          |

## Windows — Fix PowerShell Execution Policy

If you see a `PSSecurityException` error when installing pnpm or running scripts, open PowerShell **as Administrator** and run:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then retry `npm install -g pnpm`.
