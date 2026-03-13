'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { config } from '@/lib/config';
import { getToken, getClientToken } from '@/lib/auth-utils';

export default function CompletePage() {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoToDashboard = async () => {
    setRedirecting(true);
    setError(null);

    try {
      localStorage.setItem('onboarding_marketing_seen', 'true');
      localStorage.setItem('onboarding_technical_complete', 'true');

      const clientToken = getClientToken();
      if (clientToken) {
        window.location.href = `${config.dashboardUrl}?token=${encodeURIComponent(clientToken)}`;
        return;
      }

      const token = getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${config.apiUrl}/auth/create-temp-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.warn('Temp session endpoint not available, using direct redirect');
        window.location.href = `${config.dashboardUrl}`;
        return;
      }

      const { sessionId } = await response.json();
      window.location.href = `${config.dashboardUrl}?session=${sessionId}`;
    } catch (err) {
      console.error('Redirect failed:', err);
      setError('Something went wrong. Redirecting directly...');
      setTimeout(() => {
        window.location.href = `${config.dashboardUrl}`;
      }, 1000);
    }
  };

  const nextSteps = [
    { label: 'send_first_request()', description: 'Route a request through the gateway using your client token.' },
    { label: 'watch_traces()', description: 'See agent costs, latency, and traces appear in your dashboard.' },
    { label: 'set_budgets()', description: 'Configure spending limits per agent or workflow.' },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="fixed top-0 left-0 right-0 h-px bg-white/[0.06] z-50">
        <div className="h-full bg-white" style={{ width: '100%' }} />
      </div>
      <div className="fixed top-3 left-6 font-mono text-xs text-white/20 z-50">
        // step_06 — complete
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full text-center">
          <p className="font-mono text-xs text-white/20 mb-8">// setup_complete</p>

          <h1
            className="font-extralight tracking-[-0.04em] text-white mb-4"
            style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}
          >
            You&apos;re all set.
          </h1>

          <p className="text-[1.1rem] font-light text-white/50 max-w-lg mx-auto mb-12">
            Your gateway is connected. Start sending requests and watch your agent traces appear in real-time.
          </p>

          {/* Next steps */}
          <div className="border border-white/[0.06] text-left mb-12">
            <div className="px-6 py-3 border-b border-white/[0.06]">
              <span className="font-mono text-xs text-white/20">// what_happens_next</span>
            </div>
            {nextSteps.map((step, i) => (
              <div
                key={step.label}
                className={`px-6 py-5 ${i < nextSteps.length - 1 ? 'border-b border-white/[0.06]' : ''}`}
              >
                <h3 className="font-mono text-xs text-white/60 mb-1">{step.label}</h3>
                <p className="text-sm text-white/40">{step.description}</p>
              </div>
            ))}
          </div>

          {error && (
            <p className="font-mono text-xs text-[#ff4444] mb-4 animate-pulse">{error}</p>
          )}

          <button
            onClick={handleGoToDashboard}
            disabled={redirecting}
            className="text-sm px-10 py-3 bg-white text-black hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            {redirecting ? 'Redirecting...' : 'Open Dashboard'}
          </button>

          <div>
            <button
              onClick={() => router.push('/')}
              className="font-mono text-xs text-white/20 hover:text-white/40 transition-colors"
            >
              skip for now
            </button>
          </div>

          <div className="mt-12 font-mono text-xs text-white/20">
            Need help? Check our{' '}
            <a href="/docs" className="text-white/40 hover:text-white transition-colors">docs</a>
          </div>
        </div>
      </div>
    </div>
  );
}
