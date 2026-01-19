import { LucideIcon, Package, FileText, Bot, GitBranch } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  /** Icon to display */
  icon?: LucideIcon;
  /** Main title - optional when using preset */
  title?: string;
  /** Description text */
  description?: string;
  /** Action button text */
  actionLabel?: string;
  /** Action button handler */
  onAction?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Preset for common empty states */
  preset?: 'agents' | 'traces' | 'logs' | 'generic';
}

const presets = {
  agents: {
    icon: Bot,
    title: 'No agents found',
    description: 'Create your first AI agent to get started',
  },
  traces: {
    icon: GitBranch,
    title: 'No traces yet',
    description: 'Traces will appear here when agents execute tasks',
  },
  logs: {
    icon: FileText,
    title: 'No logs found',
    description: 'Logs will appear here as your agents run',
  },
  generic: {
    icon: Package,
    title: 'No data available',
    description: 'There is nothing to display at the moment',
  },
};

/**
 * Empty State Component
 * 
 * Displays a friendly message when there's no data to show.
 */
export function EmptyState({
  icon: IconProp,
  title,
  description,
  actionLabel,
  onAction,
  className,
  preset,
}: EmptyStateProps) {
  const presetConfig = preset ? presets[preset] : null;
  const Icon = IconProp || presetConfig?.icon || Package;
  const displayTitle = title || presetConfig?.title || 'No data';
  const displayDescription = description || presetConfig?.description;

  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-12 px-4 text-center',
      className
    )}>
      <div className="p-4 rounded-full bg-muted mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      
      <h3 className="text-lg font-medium text-foreground mb-1">
        {displayTitle}
      </h3>
      
      {displayDescription && (
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
          {displayDescription}
        </p>
      )}
      
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
