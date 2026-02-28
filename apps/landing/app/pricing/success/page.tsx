'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { buildDashboardUrl } from '@/lib/auth-utils';

export default function PaymentSuccessPage() {
  const [countdown, setCountdown] = useState(5);
  const dashUrl = typeof window !== 'undefined' ? buildDashboardUrl() : '#';

  useEffect(() => {
    const target = buildDashboardUrl();
    // Countdown to auto-redirect
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = target;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="mb-8 inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 border-2 border-green-500">
          <CheckCircle className="w-12 h-12 text-green-500" />
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold mb-4">
          Payment Successful!
        </h1>

        {/* Message */}
        <p className="text-xl text-zinc-400 mb-8">
          Welcome to Aethermind Pro! Your subscription is now active.
        </p>

        {/* Features unlocked */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 mb-8 text-left">
          <p className="font-medium mb-4">You now have access to:</p>
          <ul className="space-y-2 text-sm text-zinc-300">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              Unlimited AI Agents
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              All AI Models (GPT-4, Claude, etc.)
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              Advanced FinOps & Analytics
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              Priority Support
            </li>
          </ul>
        </div>

        {/* Redirect info */}
        <p className="text-zinc-400 mb-6">
          Redirecting to dashboard in <span className="text-white font-mono">{countdown}</span> seconds...
        </p>

        {/* Manual redirect button */}
        <Link
          href={dashUrl}
          className="inline-flex items-center gap-2 bg-white text-black px-8 py-3 rounded-lg font-medium hover:bg-zinc-200 transition"
        >
          Go to Dashboard Now
          <ArrowRight className="w-5 h-5" />
        </Link>

        {/* Receipt info */}
        <p className="mt-8 text-sm text-zinc-500">
          A receipt has been sent to your email address.
        </p>
      </div>
    </div>
  );
}
