import Link from 'next/link'

export default function PrivacyPage() {
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

        <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-zinc-400 mb-12">Last updated: December 18, 2025</p>

        <div className="prose prose-invert prose-lg max-w-none">
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">1. Information We Collect</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We collect information that you provide directly to us, including:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-4">
              <li>Name and email address when you create an account</li>
              <li>Payment information for subscription plans</li>
              <li>Usage data and analytics about how you interact with our Service</li>
              <li>API usage logs and execution traces</li>
              <li>Communication preferences and support requests</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">2. How We Use Your Information</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-4">
              <li>Provide, maintain, and improve our Service</li>
              <li>Process your transactions and send you related information</li>
              <li>Send you technical notices, updates, and security alerts</li>
              <li>Respond to your comments and questions</li>
              <li>Monitor and analyze trends, usage, and activities</li>
              <li>Detect, prevent, and address technical issues and fraudulent activity</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">3. Data Storage and Security</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We implement appropriate technical and organizational measures to protect your personal data 
              against unauthorized access, alteration, disclosure, or destruction. Your data is encrypted 
              in transit and at rest.
            </p>
            <p className="text-zinc-300 leading-relaxed">
              We store your data on secure servers provided by industry-leading cloud infrastructure providers.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">4. Data Sharing and Disclosure</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We do not sell your personal information. We may share your information only in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-4">
              <li>With your consent or at your direction</li>
              <li>With service providers who perform services on our behalf</li>
              <li>To comply with legal obligations</li>
              <li>To protect the rights and safety of Aethermind and our users</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">5. Third-Party Services</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              Our Service integrates with third-party AI providers (OpenAI, Anthropic, Google). When you use 
              these integrations, your data may be processed by these providers according to their own privacy 
              policies.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">6. Your Rights and Choices</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-4">
              <li>Access and receive a copy of your personal data</li>
              <li>Correct or update your personal data</li>
              <li>Delete your account and associated data</li>
              <li>Object to processing of your personal data</li>
              <li>Export your data in a portable format</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">7. Data Retention</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We retain your personal information for as long as necessary to provide the Service and fulfill 
              the purposes outlined in this Privacy Policy. When you delete your account, we will delete your 
              personal data within 30 days, except where retention is required by law.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">8. Cookies and Tracking</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We use cookies and similar tracking technologies to track activity on our Service. You can 
              instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">9. Children's Privacy</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              Our Service is not intended for children under 13 years of age. We do not knowingly collect 
              personal information from children under 13.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">10. Changes to This Policy</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We may update this Privacy Policy from time to time. We will notify you of any changes by 
              posting the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">11. Contact Us</h2>
            <p className="text-zinc-300 leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at{' '}
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
