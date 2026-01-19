'use client';

import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useWebSocket } from '@/hooks';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';

interface ConnectionStatusProps {
  /** Show label next to icon */
  showLabel?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Connection Status Indicator
 * 
 * Shows the current WebSocket connection status with a tooltip.
 */
export function ConnectionStatus({
  showLabel = false,
  size = 'sm',
  className,
}: ConnectionStatusProps) {
  const { status, isConnected, reconnect, eventCount } = useWebSocket();

  const statusConfig = {
    connected: {
      icon: Wifi,
      label: 'Connected',
      color: 'text-emerald-500',
      dotColor: 'bg-emerald-500',
      tooltip: `Real-time updates active (${eventCount} events received)`,
    },
    connecting: {
      icon: RefreshCw,
      label: 'Connecting...',
      color: 'text-amber-500',
      dotColor: 'bg-amber-500',
      tooltip: 'Establishing connection...',
    },
    disconnected: {
      icon: WifiOff,
      label: 'Disconnected',
      color: 'text-muted-foreground',
      dotColor: 'bg-muted-foreground',
      tooltip: 'Click to reconnect',
    },
    error: {
      icon: WifiOff,
      label: 'Connection Error',
      color: 'text-destructive',
      dotColor: 'bg-destructive',
      tooltip: 'Connection failed. Click to retry.',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const dotSize = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';

  const handleClick = () => {
    if (!isConnected) {
      reconnect();
    }
  };

  const content = (
    <button
      onClick={handleClick}
      disabled={status === 'connecting'}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1',
        'hover:bg-muted/50 transition-colors',
        !isConnected && 'cursor-pointer',
        status === 'connecting' && 'cursor-wait',
        className
      )}
    >
      <div className="relative">
        <Icon 
          className={cn(
            iconSize, 
            config.color,
            status === 'connecting' && 'animate-spin'
          )} 
        />
        {/* Status dot */}
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 rounded-full',
            dotSize,
            config.dotColor,
            isConnected && 'animate-pulse'
          )}
        />
      </div>
      {showLabel && (
        <span className={cn('text-xs', config.color)}>
          {config.label}
        </span>
      )}
    </button>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
