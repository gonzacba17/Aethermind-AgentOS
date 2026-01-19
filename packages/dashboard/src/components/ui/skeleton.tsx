import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from './card'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-accent animate-pulse rounded-md', className)}
      {...props}
    />
  )
}

/**
 * Card skeleton for stat cards
 */
function CardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('', className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Stats cards row skeleton (4 cards)
 */
function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Chart skeleton
 */
function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <div className="h-[200px] flex items-end gap-2">
          {[40, 65, 45, 80, 55, 70, 60, 75, 50, 85, 65, 70].map((h, i) => (
            <div 
              key={i} 
              className="flex-1 rounded-t bg-accent animate-pulse" 
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * List item skeleton
 */
function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-8 w-8" />
    </div>
  );
}

/**
 * List skeleton (for agents, traces, etc.)
 */
function ListSkeleton({ items = 4 }: { items?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: items }).map((_, i) => (
          <ListItemSkeleton key={i} />
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Log entry skeleton
 */
function LogEntrySkeleton() {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border">
      <Skeleton className="h-6 w-6 rounded" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-12 rounded-full" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}

/**
 * Logs panel skeleton
 */
function LogsPanelSkeleton({ items = 5 }: { items?: number }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: items }).map((_, i) => (
          <LogEntrySkeleton key={i} />
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Table skeleton
 */
function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-4 pb-3 border-b">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 py-2">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton 
              key={colIdx} 
              className={cn(
                'h-4',
                colIdx === 0 ? 'flex-[2]' : 'flex-1'
              )} 
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export { 
  Skeleton, 
  CardSkeleton,
  StatsCardsSkeleton,
  ChartSkeleton,
  ListItemSkeleton,
  ListSkeleton,
  LogEntrySkeleton,
  LogsPanelSkeleton,
  TableSkeleton
}
