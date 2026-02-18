import Link from 'next/link'

/**
 * 404 page within the dashboard layout.
 * The sidebar and header remain visible — only the content area shows the 404.
 */
export default function DashboardNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-md text-center space-y-6">
        {/* 404 indicator */}
        <div className="space-y-2">
          <p className="text-6xl font-bold text-muted-foreground/30 tracking-tighter">
            404
          </p>
          <h2 className="text-xl font-semibold text-foreground">
            Page not found
          </h2>
          <p className="text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been
            moved. Check the URL or navigate back to the dashboard.
          </p>
        </div>

        {/* Navigation */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/home"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
              />
            </svg>
            Back to Dashboard
          </Link>
          <Link
            href="/agents"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-accent transition-colors"
          >
            View Agents
          </Link>
        </div>
      </div>
    </div>
  )
}
