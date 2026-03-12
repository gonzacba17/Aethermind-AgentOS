'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiKeyDisplay } from '@/components/ApiKeyDisplay';
import { CodeSnippet } from '@/components/CodeSnippet';
import { authAPI } from '@/lib/api/auth';

export default function SetupPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchApiKey() {
      try {
        const user = await authAPI.getCurrentUser();
        if (user.apiKey) {
          setApiKey(user.apiKey);
        } else {
          setError('Your client token is being generated. Please refresh in a moment.');
        }
      } catch (err) {
        setError('Failed to load your client token. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchApiKey();
  }, []);

  const gatewayUrl = 'https://aethermind-agentos-production.up.railway.app/gateway/v1';

  const openaiCode = `import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: '${gatewayUrl}',
  defaultHeaders: {
    'X-Client-Token': '${apiKey || 'YOUR_CLIENT_TOKEN'}',
  },
});

const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello!' }],
});`;

  const agentCode = `const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: '${gatewayUrl}',
  defaultHeaders: {
    'X-Client-Token': '${apiKey || 'YOUR_CLIENT_TOKEN'}',
    'X-Agent-Id': 'my-agent-1',
    'X-Agent-Name': 'ResearchAgent',
    'X-Workflow-Id': 'workflow-123',
  },
});`;

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="font-mono text-xs text-white/40 animate-pulse">loading client token...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="fixed top-0 left-0 right-0 h-px bg-white/[0.06] z-50">
        <div className="h-full bg-white" style={{ width: '90%' }} />
      </div>
      <div className="fixed top-3 left-6 font-mono text-xs text-white/20 z-50">
        // step_05 — setup
      </div>

      <div className="flex-1 py-20 px-6">
        <div className="max-w-3xl mx-auto space-y-12">
          <div>
            <h1
              className="font-light tracking-[-0.04em] text-white mb-4"
              style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
            >
              Connect to the gateway.
            </h1>
            <p className="text-[1.1rem] font-light text-white/40 max-w-2xl">
              Add your Client Token to your AI client. No SDK needed —
              just change one line in your existing code.
            </p>
          </div>

          {error && (
            <div className="border border-[#ff4444]/30 text-[#ff4444] px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <p className="font-mono text-xs text-white/20 mb-3">// your_client_token</p>
            <ApiKeyDisplay apiKey={apiKey} />
          </div>

          <div className="space-y-10">
            <div>
              <p className="font-mono text-xs text-white/40 mb-4">// 01 — point to gateway</p>
              <CodeSnippet code={openaiCode} language="typescript" showLineNumbers title="integration.ts" />
            </div>

            <div>
              <p className="font-mono text-xs text-white/40 mb-4">// 02 — add agent context</p>
              <CodeSnippet code={agentCode} language="typescript" showLineNumbers title="agent-tracing.ts" />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 border border-white/[0.06]">
            <div className="p-6 hover:bg-white/[0.02] transition-colors">
              <h3 className="font-mono text-xs text-white/60 mb-2">:: one_line_change</h3>
              <p className="text-sm text-white/40">Change baseURL. Your existing code works unchanged.</p>
            </div>
            <div className="p-6 border-t sm:border-t-0 sm:border-l border-white/[0.06] hover:bg-white/[0.02] transition-colors">
              <h3 className="font-mono text-xs text-white/60 mb-2">:: byok</h3>
              <p className="text-sm text-white/40">Bring your own API keys. We never store your provider credentials.</p>
            </div>
            <div className="p-6 border-t sm:border-t-0 sm:border-l border-white/[0.06] hover:bg-white/[0.02] transition-colors">
              <h3 className="font-mono text-xs text-white/60 mb-2">:: agent_tracing</h3>
              <p className="text-sm text-white/40">Track every agent call, cost, and failure in real-time.</p>
            </div>
          </div>

          <div className="border border-white/[0.06] p-4">
            <p className="font-mono text-xs text-white/40">
              // keep your client token secure — use environment variables like AETHERMIND_CLIENT_TOKEN
            </p>
          </div>

          <div className="flex justify-between items-center pt-6 border-t border-white/[0.06]">
            <button
              onClick={() => router.push('/onboarding/pricing')}
              className="font-mono text-xs px-6 py-2.5 border border-white/[0.15] text-white/40 hover:text-white hover:border-white/30 transition-colors"
            >
              back()
            </button>
            <button
              onClick={() => router.push('/onboarding/complete')}
              className="font-mono text-sm px-8 py-3 bg-white text-black hover:bg-white/90 transition-colors"
            >
              ive_set_this_up()
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
