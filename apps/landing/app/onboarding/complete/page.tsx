'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Sparkles, BarChart3, Bell, ArrowRight } from 'lucide-react';
import { config } from '@/lib/config';
import { getToken } from '@/lib/auth-utils';

export default function CompletePage() {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoToDashboard = async () => {
    setRedirecting(true);
    setError(null);
    
    try {
      // Get the current token
      const token = getToken();
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Create temporary session in the backend
      const response = await fetch(`${config.apiUrl}/auth/create-temp-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        // If endpoint doesn't exist yet, fallback to direct redirect
        console.warn('Temp session endpoint not available, using direct redirect');
        window.location.href = `${config.dashboardUrl}/dashboard`;
        return;
      }

      const { sessionId } = await response.json();

      // Mark onboarding as complete
      localStorage.setItem('onboarding_marketing_seen', 'true');
      localStorage.setItem('onboarding_technical_complete', 'true');

      // Redirect to dashboard with session ID
      window.location.href = `${config.dashboardUrl}?session=${sessionId}`;
    } catch (err) {
      console.error('Redirect failed:', err);
      setError('Something went wrong. Redirecting directly...');
      
      // Fallback: redirect without session (dashboard will handle auth)
      setTimeout(() => {
        window.location.href = `${config.dashboardUrl}/dashboard`;
      }, 1000);
    }
  };

  const nextSteps = [
    {
      icon: <BarChart3 className="w-5 h-5 text-blue-400" />,
      title: 'Run your AI application',
      description: 'With the SDK initialized, make some API calls to your AI provider'
    },
    {
      icon: <Sparkles className="w-5 h-5 text-purple-400" />,
      title: 'Watch the magic happen',
      description: 'Your costs and usage will appear in the dashboard automatically'
    },
    {
      icon: <Bell className="w-5 h-5 text-yellow-400" />,
      title: 'Set up budget alerts',
      description: 'Never overspend - get notified before you hit your limit'
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background effects */}
      <div className="fixed inset-0 bg-gradient-to-br from-green-900/20 via-black to-blue-900/20" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-500/10 via-transparent to-transparent" />
      
      {/* Confetti-like particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              backgroundColor: ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B'][i % 4],
              opacity: 0.3,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>

      <div className="relative container max-w-4xl mx-auto px-4 py-16">
        <div className="text-center space-y-10">
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-3 text-sm">
            <span className="flex items-center gap-2 text-gray-500">
              <span className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs">✓</span>
              Welcome
            </span>
            <div className="w-8 h-px bg-gray-700" />
            <span className="flex items-center gap-2 text-gray-500">
              <span className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs">✓</span>
              Demo
            </span>
            <div className="w-8 h-px bg-gray-700" />
            <span className="flex items-center gap-2 text-gray-500">
              <span className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs">✓</span>
              Pricing
            </span>
            <div className="w-8 h-px bg-gray-700" />
            <span className="flex items-center gap-2 text-gray-500">
              <span className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs">✓</span>
              Setup
            </span>
            <div className="w-8 h-px bg-gray-700" />
            <span className="flex items-center gap-2 text-green-400">
              <span className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-xs font-bold">✓</span>
              Complete
            </span>
          </div>

          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="relative">
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-full bg-green-500/30 blur-2xl animate-pulse" />
              <div className="relative rounded-full bg-gradient-to-br from-green-400 to-emerald-600 p-6 shadow-2xl shadow-green-500/30">
                <CheckCircle2 className="h-16 w-16 text-white" />
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold">
              You're All Set! <span className="inline-block animate-bounce">🎉</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Your Aethermind account is ready. Let's see your AI costs in action.
            </p>
          </div>

          {/* Next Steps */}
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/50 rounded-2xl p-8 text-left max-w-2xl mx-auto border border-gray-700/50 backdrop-blur-sm">
            <h2 className="text-xl font-semibold mb-6 text-center">What happens next?</h2>
            <div className="space-y-5">
              {nextSteps.map((step, index) => (
                <div key={index} className="flex items-start gap-4 group">
                  <div className="flex-shrink-0 p-2.5 rounded-xl bg-gray-800/80 border border-gray-700/50 group-hover:border-gray-600/50 transition-colors">
                    {step.icon}
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{step.title}</h3>
                    <p className="text-sm text-gray-400 mt-0.5">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="text-yellow-400 text-sm animate-pulse">
              {error}
            </div>
          )}

          {/* CTA Button */}
          <div className="space-y-4">
            <Button 
              size="lg"
              onClick={handleGoToDashboard}
              disabled={redirecting}
              className="h-14 px-10 text-lg font-medium bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-[length:200%_100%] hover:bg-[position:100%_0] transition-all duration-500 text-white shadow-2xl shadow-purple-500/20 hover:shadow-purple-500/40"
            >
              {redirecting ? (
                <>
                  <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                  Setting up your dashboard...
                </>
              ) : (
                <>
                  Go to Dashboard
                  <ArrowRight className="ml-3 h-5 w-5" />
                </>
              )}
            </Button>
          </div>

          {/* Skip option */}
          <div className="pt-4">
            <button
              onClick={() => router.push('/')}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors underline-offset-4 hover:underline"
            >
              Skip for now, I'll explore later
            </button>
          </div>

          {/* Support note */}
          <div className="pt-8 text-sm text-gray-500">
            Need help? Check our{' '}
            <a href="/docs" className="text-blue-400 hover:underline">documentation</a>
            {' '}or{' '}
            <a href="mailto:support@aethermind.ai" className="text-blue-400 hover:underline">contact support</a>
          </div>
        </div>
      </div>
    </div>
  );
}
