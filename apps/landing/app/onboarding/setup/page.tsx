'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiKeyDisplay } from '@/components/ApiKeyDisplay';
import { CodeSnippet } from '@/components/CodeSnippet';
import { Button } from '@/components/ui/button';
import { authAPI } from '@/lib/api/auth';
import { ArrowLeft, ArrowRight, AlertTriangle, Loader2, Rocket, Network, Shield } from 'lucide-react';

export default function SetupPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchApiKey() {
      try {
        const user = await authAPI.getCurrentUser();
        // Use the real API key from the backend
        if (user.apiKey) {
          setApiKey(user.apiKey);
        } else {
          // Fallback: generate a placeholder key format (backend should provide real key)
          console.warn('[Setup] No API key found in user object, using placeholder');
          const placeholderKey = `am_${user.id.slice(0, 8)}_xxxxxxxxxxxxxxxx`;
          setApiKey(placeholderKey);
          setError('Your API key is being generated. Please refresh in a moment.');
        }
      } catch (err) {
        console.error('Failed to fetch API key', err);
        setError('Failed to load your API key. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchApiKey();
  }, []);

  const gatewayUrl = `https://aethermind-agentos-production.up.railway.app/gateway/v1`;

  const openaiCode = `import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: '${gatewayUrl}', // Only change needed
  defaultHeaders: {
    'X-Client-Token': '${apiKey || 'YOUR_CLIENT_TOKEN'}',
  },
});

// Your existing code works unchanged
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello!' }],
});`;

  const agentCode = `import OpenAI from 'openai';

// For multi-agent systems — add agent context headers
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: '${gatewayUrl}',
  defaultHeaders: {
    'X-Client-Token': '${apiKey || 'YOUR_CLIENT_TOKEN'}',
    'X-Agent-Id': 'my-agent-1',        // Track per-agent costs
    'X-Agent-Name': 'ResearchAgent',   // Human-readable name
    'X-Workflow-Id': 'workflow-123',   // Group by workflow
  },
});`;

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
          <p className="text-gray-400">Loading your API key...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-900/20 via-black to-purple-900/20" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />

      <div className="relative container max-w-4xl mx-auto px-4 py-16">
        <div className="space-y-10">
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-3 text-sm">
            <span className="flex items-center gap-2 text-gray-500">
              <span className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs">1</span>
              Welcome
            </span>
            <div className="w-8 h-px bg-gray-700" />
            <span className="flex items-center gap-2 text-gray-500">
              <span className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs">2</span>
              Demo
            </span>
            <div className="w-8 h-px bg-gray-700" />
            <span className="flex items-center gap-2 text-gray-500">
              <span className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs">3</span>
              Pricing
            </span>
            <div className="w-8 h-px bg-gray-700" />
            <span className="flex items-center gap-2 text-blue-400">
              <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">4</span>
              Setup
            </span>
            <div className="w-8 h-px bg-gray-700" />
            <span className="flex items-center gap-2 text-gray-500">
              <span className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs">5</span>
              Complete
            </span>
          </div>

          {/* Header */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
              <Rocket className="w-4 h-4" />
              Almost there!
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              Connect to the Gateway
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Add your Client Token to your AI client. No SDK installation needed —
              just change one line in your existing code.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-400 font-medium">Error</p>
                <p className="text-red-300/80 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* API Key Display */}
          <p className="text-sm text-gray-400 mb-2">Your Client Token — add this to your request headers</p>
          <ApiKeyDisplay apiKey={apiKey} />

          {/* Instructions */}
          <div className="space-y-8">
            {/* Step 1 */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-bold">
                  1
                </span>
                <h2 className="text-xl font-semibold">
                  Point your client to the gateway
                </h2>
              </div>
              <p className="text-gray-400 text-sm">Works with OpenAI, Anthropic, and Gemini. No SDK to install.</p>
              <CodeSnippet code={openaiCode} language="typescript" showLineNumbers title="Your existing code" />
            </div>

            {/* Step 2 */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-bold">
                  2
                </span>
                <h2 className="text-xl font-semibold">
                  Add agent context (optional, for multi-agent systems)
                </h2>
              </div>
              <p className="text-gray-400 text-sm">Track costs, latency, and errors per agent. See the full trace in your dashboard.</p>
              <CodeSnippet code={agentCode} language="typescript" showLineNumbers title="Multi-agent tracing" />
            </div>
          </div>

          {/* Features Preview */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/30">
              <Network className="w-6 h-6 text-blue-400 mb-3" />
              <h3 className="font-medium mb-1">One line change</h3>
              <p className="text-sm text-gray-400">Change baseURL. Your existing code works unchanged.</p>
            </div>
            <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/30">
              <Shield className="w-6 h-6 text-green-400 mb-3" />
              <h3 className="font-medium mb-1">BYOK</h3>
              <p className="text-sm text-gray-400">Bring your own API keys. We never store your provider credentials.</p>
            </div>
            <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/30">
              <Rocket className="w-6 h-6 text-purple-400 mb-3" />
              <h3 className="font-medium mb-1">Agent tracing</h3>
              <p className="text-sm text-gray-400">Track every agent call, workflow cost, and failure in real-time.</p>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-yellow-200 font-medium text-sm">Keep your Client Token secure</p>
              <p className="text-yellow-200/70 text-sm mt-1">
                Don't commit it to version control. Use environment variables like{' '}
                <code className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-mono text-xs">
                  AETHERMIND_CLIENT_TOKEN
                </code>
              </p>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center pt-6 border-t border-gray-800">
            <Button
              variant="outline"
              onClick={() => router.push('/onboarding/pricing')}
              className="border-gray-700 hover:bg-gray-800 text-gray-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={() => router.push('/onboarding/complete')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-6"
            >
              I've set this up
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
