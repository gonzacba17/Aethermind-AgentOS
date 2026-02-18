/**
 * Dashboard loading skeleton
 * Mirrors the real dashboard layout to prevent layout shift.
 * Uses pulse animations instead of generic spinners.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page title skeleton */}
      <div className="space-y-1">
        <div className="h-8 w-48 bg-muted rounded-md animate-pulse" />
        <div className="h-4 w-72 bg-muted/60 rounded-md animate-pulse" />
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-6 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="h-8 w-8 bg-muted rounded-lg animate-pulse" />
            </div>
            <div className="h-7 w-20 bg-muted rounded animate-pulse" />
            <div className="h-3 w-32 bg-muted/60 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart area (2 cols) */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-36 bg-muted rounded animate-pulse" />
            <div className="flex gap-2">
              <div className="h-8 w-16 bg-muted rounded-md animate-pulse" />
              <div className="h-8 w-16 bg-muted rounded-md animate-pulse" />
              <div className="h-8 w-16 bg-muted rounded-md animate-pulse" />
            </div>
          </div>
          {/* Chart skeleton */}
          <div className="h-64 bg-muted/30 rounded-lg animate-pulse flex items-end justify-around px-4 pb-4 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="bg-muted/50 rounded-t-sm animate-pulse"
                style={{
                  width: '100%',
                  height: `${20 + Math.random() * 70}%`,
                  animationDelay: `${i * 100}ms`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Activity list (1 col) */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="h-5 w-32 bg-muted rounded animate-pulse" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-muted animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-full bg-muted rounded animate-pulse" />
                  <div className="h-3 w-2/3 bg-muted/60 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-28 bg-muted rounded animate-pulse" />
          <div className="h-8 w-32 bg-muted rounded-md animate-pulse" />
        </div>
        {/* Table rows */}
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-5 gap-4 pb-2 border-b border-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-3 bg-muted/60 rounded animate-pulse" />
            ))}
          </div>
          {/* Rows */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-5 gap-4 py-3"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {Array.from({ length: 5 }).map((_, j) => (
                <div
                  key={j}
                  className="h-4 bg-muted/40 rounded animate-pulse"
                  style={{ width: `${50 + Math.random() * 50}%` }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
