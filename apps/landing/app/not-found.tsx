import Link from "next/link";

/**
 * Custom 404 error page
 * Displayed when a route is not found
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-zinc-800 border border-zinc-700 rounded-full mb-4">
            <span className="text-4xl font-bold text-white">404</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Page not found
          </h1>
          <p className="text-zinc-400">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/"
            className="flex-1 bg-white text-black px-6 py-3 rounded-lg font-medium hover:bg-zinc-200 transition text-center"
          >
            Go Home
          </Link>
          <Link
            href="/docs"
            className="flex-1 bg-zinc-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-zinc-700 transition text-center"
          >
            Documentation
          </Link>
        </div>
      </div>
    </div>
  );
}
