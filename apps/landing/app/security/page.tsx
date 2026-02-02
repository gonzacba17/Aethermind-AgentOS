import Link from 'next/link'

export default function SecurityPage() {
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

        <h1 className="text-4xl md:text-5xl font-bold mb-4">Security</h1>
        <p className="text-zinc-400 mb-12">Last updated: December 18, 2025</p>

        <div className="prose prose-invert prose-lg max-w-none">
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">Our Commitment to Security</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              At Aethermind, we take the security of your data seriously. We implement industry-standard 
              security measures to protect your information and ensure the reliability of our Service.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">Infrastructure Security</h2>
            <ul className="list-disc list-inside text-zinc-300 space-y-3 ml-4">
              <li>
                <strong className="text-white">Cloud Infrastructure:</strong> Hosted on enterprise-grade cloud platforms 
                with 99.9% uptime SLA
              </li>
              <li>
                <strong className="text-white">Encryption:</strong> All data is encrypted in transit (TLS 1.3) and at rest (AES-256)
              </li>
              <li>
                <strong className="text-white">Database Security:</strong> Encrypted databases with automated backups and point-in-time recovery
              </li>
              <li>
                <strong className="text-white">DDoS Protection:</strong> Advanced DDoS mitigation and rate limiting
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">Application Security</h2>
            <ul className="list-disc list-inside text-zinc-300 space-y-3 ml-4">
              <li>
                <strong className="text-white">Authentication:</strong> JWT-based authentication with secure password hashing (bcrypt)
              </li>
              <li>
                <strong className="text-white">API Security:</strong> Rate limiting, request validation, and API key rotation
              </li>
              <li>
                <strong className="text-white">Input Validation:</strong> Comprehensive input sanitization to prevent injection attacks
              </li>
              <li>
                <strong className="text-white">Session Management:</strong> Secure session handling with automatic timeout
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">Monitoring and Response</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We maintain 24/7 monitoring of our systems to detect and respond to security incidents:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-3 ml-4">
              <li>Real-time security event monitoring and alerting</li>
              <li>Automated vulnerability scanning and patching</li>
              <li>Regular security audits and penetration testing</li>
              <li>Incident response team with defined escalation procedures</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">Data Protection</h2>
            <ul className="list-disc list-inside text-zinc-300 space-y-3 ml-4">
              <li>
                <strong className="text-white">Access Control:</strong> Role-based access control (RBAC) with principle of least privilege
              </li>
              <li>
                <strong className="text-white">Data Isolation:</strong> Customer data is logically isolated in multi-tenant architecture
              </li>
              <li>
                <strong className="text-white">Backup:</strong> Automated daily backups with encryption and off-site storage
              </li>
              <li>
                <strong className="text-white">Data Deletion:</strong> Secure data deletion procedures upon account termination
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">Compliance</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We adhere to industry best practices and compliance standards:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-3 ml-4">
              <li>GDPR compliance for European users</li>
              <li>SOC 2 Type II certification (in progress)</li>
              <li>Regular third-party security assessments</li>
              <li>Adherence to OWASP security guidelines</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">Employee Security</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              All employees with access to customer data:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-3 ml-4">
              <li>Undergo background checks</li>
              <li>Sign confidentiality agreements</li>
              <li>Receive regular security training</li>
              <li>Use multi-factor authentication (MFA) for all systems</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">Responsible Disclosure</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We welcome security researchers to report potential vulnerabilities. If you discover a security 
              issue, please report it responsibly:
            </p>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 my-6">
              <p className="text-zinc-300 mb-2">
                Email: <a href="mailto:security@aethermind.com" className="text-white hover:underline">security@aethermind.com</a>
              </p>
              <p className="text-zinc-400 text-sm">
                Please provide detailed information about the vulnerability, including steps to reproduce. 
                We aim to respond within 48 hours.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">Your Responsibility</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              Security is a shared responsibility. We recommend that you:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-3 ml-4">
              <li>Use strong, unique passwords for your account</li>
              <li>Enable multi-factor authentication when available</li>
              <li>Keep your API keys secure and rotate them regularly</li>
              <li>Monitor your account for suspicious activity</li>
              <li>Report any security concerns immediately</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">Questions?</h2>
            <p className="text-zinc-300 leading-relaxed">
              If you have questions about our security practices, please contact us at{' '}
              <a href="mailto:security@aethermind.com" className="text-white hover:underline">
                security@aethermind.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
