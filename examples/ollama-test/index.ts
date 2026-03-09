
/**
 * Aethermind SDK — Ollama Local Test
 *
 * This script demonstrates using the Aethermind SDK with a local Ollama instance.
 * It makes 3 calls using different Ollama APIs and confirms telemetry is captured.
 *
 * Usage:
 *   AETHERMIND_API_KEY=ct_xxx npx tsx index.ts
 *
 * Prerequisites:
 *   - Ollama installed and running: ollama serve
 *   - A model pulled: ollama pull llama3
 */

import { initAethermind, OllamaInterceptor, getTransport, type TelemetryEvent } from '@aethermind/agent';

// ── Configuration ─────────────────────────────────
const API_KEY = process.env.AETHERMIND_API_KEY;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const AETHERMIND_ENDPOINT = process.env.AETHERMIND_ENDPOINT || 'https://aethermind-agentos-production.up.railway.app';
const MODEL = process.env.OLLAMA_MODEL || 'llama3';

if (!API_KEY) {
  console.error('❌ AETHERMIND_API_KEY is required');
  console.error('   Usage: AETHERMIND_API_KEY=ct_xxx npx tsx index.ts');
  process.exit(1);
}

// ── Initialize SDK ────────────────────────────────
initAethermind({
  apiKey: API_KEY,
  endpoint: AETHERMIND_ENDPOINT,
  enabled: true,
});

// Give the SDK a moment to initialize interceptors
await new Promise((r) => setTimeout(r, 500));

// ── Create Ollama interceptor ─────────────────────
const transport = getTransport();
const ollama = new OllamaInterceptor(
  (event: TelemetryEvent) => transport.send(event),
  { host: OLLAMA_HOST }
);
ollama.instrument();

// ── Check Ollama is running ───────────────────────
console.log(`\n🔍 Checking Ollama at ${OLLAMA_HOST}...`);
const isRunning = await ollama.ping();
if (!isRunning) {
  console.error(`❌ Ollama is not running at ${OLLAMA_HOST}`);
  console.error('   Start it with: ollama serve');
  console.error('   Then pull a model: ollama pull llama3');
  process.exit(1);
}
console.log('✅ Ollama is running\n');

// ── Test 1: Native Chat API (/api/chat) ───────────
console.log(`━━━ Test 1: Native Chat API (/api/chat) with ${MODEL} ━━━`);
try {
  const chat = await ollama.chatCompletion({
    model: MODEL,
    messages: [
      { role: 'user', content: 'What is 2+2? Answer in one word.' },
    ],
  });
  console.log(`  Model: ${chat.model}`);
  console.log(`  Response: ${chat.message.content.trim()}`);
  console.log(`  Prompt tokens: ${chat.prompt_eval_count ?? 'N/A'}`);
  console.log(`  Completion tokens: ${chat.eval_count ?? 'N/A'}`);
  console.log('  ✅ Telemetry event sent\n');
} catch (error) {
  console.error('  ❌ Error:', (error as Error).message, '\n');
}

// ── Test 2: Native Generate API (/api/generate) ──
console.log(`━━━ Test 2: Native Generate API (/api/generate) with ${MODEL} ━━━`);
try {
  const gen = await ollama.generate({
    model: MODEL,
    prompt: 'Write a haiku about coding.',
  });
  console.log(`  Model: ${gen.model}`);
  console.log(`  Response: ${gen.response.trim()}`);
  console.log(`  Prompt tokens: ${gen.prompt_eval_count ?? 'N/A'}`);
  console.log(`  Completion tokens: ${gen.eval_count ?? 'N/A'}`);
  console.log('  ✅ Telemetry event sent\n');
} catch (error) {
  console.error('  ❌ Error:', (error as Error).message, '\n');
}

// ── Test 3: OpenAI-Compatible API (/v1/chat/completions) ──
console.log(`━━━ Test 3: OpenAI-Compatible API (/v1/chat/completions) with ${MODEL} ━━━`);
try {
  const oai = await ollama.openaiChat({
    model: MODEL,
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Name 3 programming languages in one line.' },
    ],
  });
  const choice = oai.choices?.[0];
  console.log(`  Model: ${oai.model}`);
  console.log(`  Response: ${choice?.message?.content?.trim() ?? 'N/A'}`);
  console.log(`  Usage: prompt=${oai.usage?.prompt_tokens ?? 'N/A'}, completion=${oai.usage?.completion_tokens ?? 'N/A'}`);
  console.log('  ✅ Telemetry event sent\n');
} catch (error) {
  console.error('  ❌ Error:', (error as Error).message, '\n');
}

// ── Flush telemetry ───────────────────────────────
console.log('📤 Flushing telemetry to Aethermind...');
await new Promise((r) => setTimeout(r, 2000));
await transport.stop();
console.log('✅ Done! Check your dashboard for the telemetry events.');
console.log(`   Dashboard: https://aethermind-agent-os-dashboard.vercel.app\n`);

process.exit(0);
