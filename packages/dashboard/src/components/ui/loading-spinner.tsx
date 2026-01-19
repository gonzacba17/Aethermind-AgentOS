'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Optional label to display below spinner */
  label?: string;
  /** Additional CSS classes */
  className?: string;
  /** Center the spinner in its container */
  centered?: boolean;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

/**
 * Loading Spinner Component
 * 
 * A simple, reusable loading spinner with optional label.
 */
export function LoadingSpinner({
  size = 'md',
  label,
  className,
  centered = false,
}: LoadingSpinnerProps) {
  const content = (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <Loader2 
        className={cn(
          sizeClasses[size],
          'animate-spin text-primary'
        )} 
      />
      {label && (
        <p className="text-sm text-muted-foreground">{label}</p>
      )}
    </div>
  );

  if (centered) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[200px]">
        {content}
      </div>
    );
  }

  return content;
}

/**
 * Full-page loading overlay
 */
export function LoadingOverlay({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <LoadingSpinner size="xl" label={label} />
    </div>
  );
}

/**
 * Inline loading indicator
 */
export function LoadingInline({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} />;
}
