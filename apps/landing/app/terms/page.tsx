import Link from 'next/link'

export default function TermsPage() {
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

        <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
        <p className="text-zinc-400 mb-12">Last updated: December 18, 2025</p>

        <div className="prose prose-invert prose-lg max-w-none">
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">1. Agreement to Terms</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              By accessing and using Aethermind ("Service"), you agree to be bound by these Terms of Service. 
              If you disagree with any part of these terms, you may not access the Service.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">2. Use License</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              Permission is granted to temporarily access and use Aethermind for personal and commercial purposes. 
              This is the grant of a license, not a transfer of title.
            </p>
            <p className="text-zinc-300 leading-relaxed">
              Under this license, you may not:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mt-4 ml-4">
              <li>Modify or copy the materials</li>
              <li>Use the materials for any commercial purpose without proper attribution</li>
              <li>Attempt to reverse engineer any software contained on Aethermind</li>
              <li>Remove any copyright or other proprietary notations</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">3. Account Responsibilities</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              You are responsible for maintaining the confidentiality of your account credentials and for all 
              activities that occur under your account. You agree to immediately notify us of any unauthorized 
              use of your account.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">4. Usage Limits and Billing</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              Your use of the Service is subject to the plan limits you have selected. We reserve the right 
              to suspend or terminate your account if you exceed these limits or fail to pay applicable fees.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">5. Intellectual Property</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              The Service and its original content, features, and functionality are and will remain the exclusive 
              property of Aethermind and its licensors. The Service is protected by copyright, trademark, and 
              other laws.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">6. Disclaimer</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              The Service is provided on an "AS IS" and "AS AVAILABLE" basis. Aethermind makes no warranties, 
              expressed or implied, and hereby disclaims all warranties including implied warranties of 
              merchantability and fitness for a particular purpose.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">7. Limitation of Liability</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              In no event shall Aethermind be liable for any indirect, incidental, special, consequential, or 
              punitive damages, including loss of profits, data, or other intangible losses.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">8. Changes to Terms</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We reserve the right to modify or replace these Terms at any time. We will provide notice of any 
              significant changes by posting the new Terms on this page and updating the "Last updated" date.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">9. Contact Us</h2>
            <p className="text-zinc-300 leading-relaxed">
              If you have any questions about these Terms, please contact us at{' '}
              <a href="mailto:legal@aethermind.com" className="text-white hover:underline">
                legal@aethermind.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
