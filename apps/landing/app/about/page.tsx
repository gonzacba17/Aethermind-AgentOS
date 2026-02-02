import Link from 'next/link'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-20 max-w-5xl">
        <Link 
          href="/" 
          className="inline-flex items-center text-zinc-400 hover:text-white mb-8 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>

        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">About Aethermind</h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Building the future of AI orchestration with predictable costs
          </p>
        </div>

        <div className="prose prose-invert prose-lg max-w-none">
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-6 text-white">Our Mission</h2>
            <p className="text-zinc-300 text-lg leading-relaxed">
              Aethermind was born from a simple frustration: AI costs are unpredictable. Teams discover their 
              OpenAI bills after running workflows, and by then, it's too late. We believe AI should be accessible 
              and transparent, which is why we built the only platform that shows AI costs before execution.
            </p>
          </section>

          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-6 text-white">What We Do</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <div className="w-12 h-12 bg-yellow-500/10 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">Cost Prediction</h3>
                <p className="text-zinc-400">
                  Know exactly what your AI workflows will cost before you run them. Set budgets and get alerts 
                  to avoid surprise bills.
                </p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">Multi-Agent Orchestration</h3>
                <p className="text-zinc-400">
                  Coordinate multiple AI models working together in complex pipelines. Build sophisticated 
                  workflows with ease.
                </p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">Real-Time Analytics</h3>
                <p className="text-zinc-400">
                  Track executions, costs, and performance metrics in real-time. Make data-driven decisions 
                  about your AI infrastructure.
                </p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">Multi-Provider Support</h3>
                <p className="text-zinc-400">
                  Works with OpenAI, Anthropic, Google, and Ollama. Choose the best model for each task 
                  without vendor lock-in.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-6 text-white">Why Aethermind?</h2>
            <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 border border-zinc-700 rounded-2xl p-8">
              <ul className="space-y-4 text-zinc-300">
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <strong className="text-white">Transparent Pricing:</strong> See costs before you commit. No surprises, 
                    no budget overruns.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <strong className="text-white">Developer-First:</strong> Built by developers, for developers. 
                    Clean APIs, comprehensive docs, and excellent DX.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <strong className="text-white">Production-Ready:</strong> Enterprise-grade security, 99.9% uptime, 
                    and 24/7 monitoring.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <strong className="text-white">Community-Driven:</strong> Open-source core, active community, 
                    and regular updates based on user feedback.
                  </div>
                </li>
              </ul>
            </div>
          </section>

          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-6 text-white">Our Values</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🎯</span>
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">Transparency</h3>
                <p className="text-zinc-400 text-sm">
                  No hidden fees. No surprises. Everything is clear and upfront.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🚀</span>
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">Innovation</h3>
                <p className="text-zinc-400 text-sm">
                  Pushing boundaries in AI orchestration and cost optimization.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🤝</span>
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">Community</h3>
                <p className="text-zinc-400 text-sm">
                  Built together with our users, for our users.
                </p>
              </div>
            </div>
          </section>

          <section className="text-center">
            <h2 className="text-3xl font-bold mb-6 text-white">Join Us</h2>
            <p className="text-zinc-300 text-lg mb-8 max-w-2xl mx-auto">
              We're building the future of AI orchestration. Join thousands of developers who trust Aethermind 
              to manage their AI workflows.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link 
                href="/signup"
                className="px-8 py-4 bg-white text-black rounded-lg font-semibold hover:bg-zinc-200 transition-colors"
              >
                Get Started Free
              </Link>
              <Link 
                href="/contact"
                className="px-8 py-4 bg-zinc-800 border border-zinc-700 text-white rounded-lg font-semibold hover:bg-zinc-700 transition-colors"
              >
                Contact Sales
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
