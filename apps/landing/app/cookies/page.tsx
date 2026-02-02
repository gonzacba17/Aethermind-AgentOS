import Link from 'next/link'

export default function CookiesPage() {
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

        <h1 className="text-4xl md:text-5xl font-bold mb-4">Cookie Policy</h1>
        <p className="text-zinc-400 mb-12">Last updated: December 18, 2025</p>

        <div className="prose prose-invert prose-lg max-w-none">
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">What Are Cookies?</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              Cookies are small text files that are placed on your device when you visit our website. They help 
              us provide you with a better experience by remembering your preferences and understanding how you 
              use our Service.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">How We Use Cookies</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We use cookies for the following purposes:
            </p>
            
            <div className="space-y-6 mt-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-white mb-3">Essential Cookies</h3>
                <p className="text-zinc-300 mb-2">
                  These cookies are necessary for the website to function properly. They enable core functionality 
                  such as security, authentication, and session management.
                </p>
                <p className="text-zinc-400 text-sm">
                  Examples: Session tokens, authentication cookies, security cookies
                </p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-white mb-3">Analytics Cookies</h3>
                <p className="text-zinc-300 mb-2">
                  These cookies help us understand how visitors interact with our website by collecting and 
                  reporting information anonymously.
                </p>
                <p className="text-zinc-400 text-sm">
                  Examples: Google Analytics, Vercel Analytics
                </p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-white mb-3">Functionality Cookies</h3>
                <p className="text-zinc-300 mb-2">
                  These cookies enable the website to remember choices you make (such as your user preferences) 
                  and provide enhanced, more personalized features.
                </p>
                <p className="text-zinc-400 text-sm">
                  Examples: Language preferences, theme settings, remembered login
                </p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-white mb-3">Performance Cookies</h3>
                <p className="text-zinc-300 mb-2">
                  These cookies collect information about how you use our website to help us improve its performance.
                </p>
                <p className="text-zinc-400 text-sm">
                  Examples: Page load times, error tracking, performance monitoring
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">Third-Party Cookies</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We may also use third-party cookies from trusted partners:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-3 ml-4">
              <li>
                <strong className="text-white">Vercel Analytics:</strong> To understand website performance and usage patterns
              </li>
              <li>
                <strong className="text-white">Authentication Providers:</strong> For secure login functionality (when using OAuth)
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">Managing Cookies</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              You have several options to manage or delete cookies:
            </p>
            
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 my-6">
              <h3 className="text-lg font-semibold text-white mb-4">Browser Settings</h3>
              <p className="text-zinc-300 mb-4">
                Most web browsers allow you to control cookies through their settings:
              </p>
              <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-4">
                <li>
                  <strong className="text-white">Chrome:</strong> Settings → Privacy and security → Cookies
                </li>
                <li>
                  <strong className="text-white">Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data
                </li>
                <li>
                  <strong className="text-white">Safari:</strong> Preferences → Privacy → Manage Website Data
                </li>
                <li>
                  <strong className="text-white">Edge:</strong> Settings → Privacy, search, and services → Cookies
                </li>
              </ul>
            </div>

            <p className="text-zinc-400 text-sm italic">
              Note: Blocking or deleting cookies may impact your experience on our website and prevent you from 
              using certain features.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">Cookie Duration</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              Cookies may be:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-3 ml-4">
              <li>
                <strong className="text-white">Session Cookies:</strong> Temporary cookies that expire when you close your browser
              </li>
              <li>
                <strong className="text-white">Persistent Cookies:</strong> Remain on your device for a set period or until you delete them
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">Your Consent</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              By using our website, you consent to the use of cookies as described in this Cookie Policy. 
              You can withdraw your consent at any time by adjusting your browser settings.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">Updates to This Policy</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We may update this Cookie Policy from time to time to reflect changes in technology, legislation, 
              or our business practices. Please review this page periodically for updates.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">More Information</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              For more information about how we process your personal data, please see our{' '}
              <Link href="/privacy" className="text-white hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
            <p className="text-zinc-300 leading-relaxed">
              If you have questions about our use of cookies, please contact us at{' '}
              <a href="mailto:privacy@aethermind.com" className="text-white hover:underline">
                privacy@aethermind.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
