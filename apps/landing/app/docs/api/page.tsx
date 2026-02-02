import Link from 'next/link'

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-20 max-w-5xl">
        <Link 
          href="/docs" 
          className="inline-flex items-center text-zinc-400 hover:text-white mb-8 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Docs
        </Link>

        <h1 className="text-4xl md:text-5xl font-bold mb-4">API Reference</h1>
        <p className="text-xl text-zinc-400 mb-12">
          Complete REST API documentation for Aethermind AgentOS
        </p>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">Base URL</h3>
              <code className="text-sm bg-zinc-800 px-3 py-1 rounded text-blue-400">
                https://aethermindapi-production.up.railway.app
              </code>
            </div>
          </div>
        </div>

        <div className="space-y-12">
          <section>
            <h2 className="text-2xl font-bold mb-6">Authentication</h2>
            
            <div className="space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-green-500/10 text-green-500 text-sm font-mono rounded">POST</span>
                  <code className="text-zinc-300">/api/auth/signup</code>
                </div>
                <p className="text-zinc-400 mb-4">Create a new user account</p>
                <div className="bg-zinc-950 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-zinc-300">
{`{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123"
}`}
                  </pre>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-green-500/10 text-green-500 text-sm font-mono rounded">POST</span>
                  <code className="text-zinc-300">/api/auth/login</code>
                </div>
                <p className="text-zinc-400 mb-4">Authenticate and receive a JWT token</p>
                <div className="bg-zinc-950 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-zinc-300">
{`{
  "email": "john@example.com",
  "password": "securepassword123"
}`}
                  </pre>
                </div>
                <p className="text-xs text-zinc-500 mt-4">
                  Returns: <code className="text-zinc-400">{"{ token: string, user: UserObject }"}</code>
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-6">Agents</h2>
            
            <div className="space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-blue-500/10 text-blue-500 text-sm font-mono rounded">GET</span>
                  <code className="text-zinc-300">/api/agents</code>
                </div>
                <p className="text-zinc-400">List all agents for the authenticated user</p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-green-500/10 text-green-500 text-sm font-mono rounded">POST</span>
                  <code className="text-zinc-300">/api/agents</code>
                </div>
                <p className="text-zinc-400 mb-4">Create a new agent</p>
                <div className="bg-zinc-950 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-zinc-300">
{`{
  "name": "Customer Support Bot",
  "model": "gpt-4",
  "config": {
    "temperature": 0.7,
    "maxTokens": 1000
  }
}`}
                  </pre>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-orange-500/10 text-orange-500 text-sm font-mono rounded">PUT</span>
                  <code className="text-zinc-300">/api/agents/:id</code>
                </div>
                <p className="text-zinc-400">Update an existing agent</p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-red-500/10 text-red-500 text-sm font-mono rounded">DELETE</span>
                  <code className="text-zinc-300">/api/agents/:id</code>
                </div>
                <p className="text-zinc-400">Delete an agent</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-6">Workflows</h2>
            
            <div className="space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-blue-500/10 text-blue-500 text-sm font-mono rounded">GET</span>
                  <code className="text-zinc-300">/api/workflows</code>
                </div>
                <p className="text-zinc-400">List all workflows with pagination</p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-green-500/10 text-green-500 text-sm font-mono rounded">POST</span>
                  <code className="text-zinc-300">/api/workflows</code>
                </div>
                <p className="text-zinc-400">Create a new multi-agent workflow</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-6">Cost Estimation</h2>
            
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-green-500/10 text-green-500 text-sm font-mono rounded">POST</span>
                <code className="text-zinc-300">/api/costs/estimate</code>
              </div>
              <p className="text-zinc-400 mb-4">Estimate costs before execution</p>
              <div className="bg-zinc-950 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-zinc-300">
{`{
  "model": "gpt-4",
  "estimatedTokens": 1500,
  "provider": "openai"
}`}
                </pre>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-16 bg-gradient-to-r from-zinc-900 to-zinc-800 border border-zinc-700 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-4">SDK Libraries</h2>
          <p className="text-zinc-300 mb-6">
            Official SDKs coming soon for TypeScript, Python, and Go
          </p>
          <div className="flex gap-3">
            <span className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-400">
              TypeScript (Coming Soon)
            </span>
            <span className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-400">
              Python (Coming Soon)
            </span>
            <span className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-400">
              Go (Coming Soon)
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
