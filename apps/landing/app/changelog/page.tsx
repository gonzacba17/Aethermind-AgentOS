import Link from 'next/link'

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-20 max-w-4xl">
        <Link 
          href="/" 
          className="inline-flex items-center text-zinc-400 hover:text-white mb-8 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>

        <h1 className="text-4xl md:text-5xl font-bold mb-4">Changelog</h1>
        <p className="text-xl text-zinc-400 mb-12">
          Latest updates and improvements to Aethermind
        </p>

        <div className="space-y-12">
          <div className="relative pl-8 border-l-2 border-zinc-800">
            <div className="absolute -left-[9px] top-0 w-4 h-4 bg-green-500 rounded-full"></div>
            
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold">v0.2.0</h2>
                <span className="px-3 py-1 bg-green-500/10 text-green-500 text-sm rounded-full">Latest</span>
              </div>
              <p className="text-zinc-400 text-sm mb-6">December 18, 2025</p>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">✨ New Features</h3>
                  <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-4">
                    <li>Added comprehensive legal pages (Terms, Privacy, Security, Cookies)</li>
                    <li>Implemented password reset functionality</li>
                    <li>Created documentation portal with API reference</li>
                    <li>Added changelog page to track updates</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">🐛 Bug Fixes</h3>
                  <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-4">
                    <li>Fixed dashboard redirect conflict</li>
                    <li>Resolved 404 errors on footer links</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">📝 Documentation</h3>
                  <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-4">
                    <li>Added comprehensive API documentation</li>
                    <li>Created getting started guide</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="relative pl-8 border-l-2 border-zinc-800">
            <div className="absolute -left-[9px] top-0 w-4 h-4 bg-zinc-700 rounded-full"></div>
            
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-2">v0.1.0</h2>
              <p className="text-zinc-400 text-sm mb-6">December 1, 2025</p>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">🎉 Initial Release</h3>
                  <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-4">
                    <li>Landing page with modern design</li>
                    <li>User authentication (signup/login)</li>
                    <li>Email verification system</li>
                    <li>Integration with Railway backend API</li>
                    <li>Responsive design for all devices</li>
                    <li>Dark theme with glassmorphism effects</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">🎨 Design</h3>
                  <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-4">
                    <li>Neural network animated background</li>
                    <li>Smooth page transitions with Framer Motion</li>
                    <li>Professional pricing section</li>
                    <li>Feature showcase with icons</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">⚙️ Infrastructure</h3>
                  <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-4">
                    <li>Next.js 16 with Turbopack</li>
                    <li>Deployment on Vercel</li>
                    <li>Backend API on Railway</li>
                    <li>PostgreSQL database</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-4">Follow Updates</h2>
          <p className="text-zinc-300 mb-6">
            Stay informed about new features and improvements
          </p>
          <div className="flex flex-wrap gap-4">
            <a 
              href="https://twitter.com/aethermind" 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-zinc-200 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Follow on X
            </a>
            <a 
              href="https://github.com/aethermind/agentos" 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 bg-zinc-800 border border-zinc-700 text-white rounded-lg font-medium hover:bg-zinc-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
              </svg>
              Star on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
