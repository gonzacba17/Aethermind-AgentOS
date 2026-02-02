'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Global error page
 * Displayed when an unrecoverable error occurs
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Global error:', error);
    }

    // TODO: Log to error tracking service
    // if (typeof window !== 'undefined') {
    //   Sentry.captureException(error);
    // }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 border border-red-500/50 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Something went wrong!
          </h2>
          <p className="text-zinc-400 text-sm">
            An unexpected error occurred. Please try again or contact support if the problem persists.
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 text-left bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto max-h-48">
            <p className="text-xs text-red-400 font-mono break-all">
              {error.message || error.toString()}
            </p>
            {error.digest && (
              <p className="text-xs text-zinc-500 font-mono mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Link
            href="/"
            className="flex-1 bg-zinc-800 text-white px-4 py-3 rounded-lg font-medium hover:bg-zinc-700 transition"
          >
            Go Home
          </Link>
          <button
            onClick={() => reset()}
            className="flex-1 bg-white text-black px-4 py-3 rounded-lg font-medium hover:bg-zinc-200 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
