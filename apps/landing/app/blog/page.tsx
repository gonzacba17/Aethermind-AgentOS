import Link from 'next/link'

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-20 max-w-6xl">
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
          <h1 className="text-4xl md:text-6xl font-bold mb-4">Blog</h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Insights, updates, and best practices for AI orchestration
          </p>
        </div>

        <div className="min-h-[400px] flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-24 h-24 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-4">Coming Soon</h2>
            <p className="text-zinc-400 mb-8">
              We're working on exciting content about AI orchestration, cost optimization, and building with Aethermind. 
              Stay tuned!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="https://twitter.com/aethermind" 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-zinc-200 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                Follow for Updates
              </a>
              <Link 
                href="/changelog"
                className="inline-flex items-center justify-center px-6 py-3 bg-zinc-800 border border-zinc-700 text-white rounded-lg font-medium hover:bg-zinc-700 transition-colors"
              >
                View Changelog
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-2 text-white">📖 Upcoming Topics</h3>
            <ul className="text-zinc-400 text-sm space-y-2">
              <li>• Cost optimization strategies for AI workflows</li>
              <li>• Building multi-agent systems</li>
              <li>• Claude vs GPT-4: Performance comparison</li>
              <li>• Production deployment best practices</li>
            </ul>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-2 text-white">🚀 Case Studies</h3>
            <p className="text-zinc-400 text-sm mb-3">
              Learn how teams are using Aethermind to reduce AI costs by 40% while improving reliability.
            </p>
            <Link href="/docs" className="text-white text-sm hover:underline">
              Read documentation →
            </Link>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-2 text-white">💡 Tutorials</h3>
            <p className="text-zinc-400 text-sm mb-3">
              Step-by-step guides to get the most out of Aethermind's features and integrations.
            </p>
            <Link href="/docs" className="text-white text-sm hover:underline">
              Get started →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
