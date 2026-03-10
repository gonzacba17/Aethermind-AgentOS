'use client';

/**
 * WebSocket stub — no WebSocket server exists on the backend.
 * All real-time updates use React Query polling instead.
 * This file is kept as a no-op to avoid breaking any remaining imports.
 */

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WebSocketEvent {
  type: string;
  data: unknown;
  timestamp?: string;
}

interface UseWebSocketReturn {
  status: ConnectionStatus;
  isConnected: boolean;
  lastEvent: WebSocketEvent | null;
  eventCount: number;
  reconnect: () => void;
  disconnect: () => void;
  send: (message: unknown) => void;
}

/**
 * No-op WebSocket hook — returns a permanently disconnected state.
 * No connection is attempted.
 */
export function useWebSocket(): UseWebSocketReturn {
  return {
    status: 'disconnected',
    isConnected: false,
    lastEvent: null,
    eventCount: 0,
    reconnect: () => {},
    disconnect: () => {},
    send: () => {},
  };
}

/**
 * No-op WebSocket event hook.
 */
export function useWebSocketEvent<T = unknown>(
  _eventType: string,
  _callback: (data: T) => void,
  _deps: React.DependencyList = []
) {
  // No-op
}
