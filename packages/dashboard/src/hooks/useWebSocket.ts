'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotificationStore, createNotificationFromEvent } from '@/store';
import { getAuthToken } from '@/lib/auth-utils';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 
  (typeof window !== 'undefined' 
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:3001/ws`
    : 'ws://localhost:3001/ws');

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WebSocketEvent {
  type: string;
  data: unknown;
  timestamp?: string;
}

interface UseWebSocketOptions {
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Maximum reconnect attempts (default: 5) */
  maxReconnectAttempts?: number;
  /** Base delay between reconnects in ms (default: 1000) */
  reconnectDelay?: number;
  /** Enable event logging in console (default: false) */
  debug?: boolean;
}

interface UseWebSocketReturn {
  /** Current connection status */
  status: ConnectionStatus;
  /** Whether WebSocket is connected */
  isConnected: boolean;
  /** Last received event */
  lastEvent: WebSocketEvent | null;
  /** Number of events received */
  eventCount: number;
  /** Manually reconnect */
  reconnect: () => void;
  /** Manually disconnect */
  disconnect: () => void;
  /** Send a message */
  send: (message: unknown) => void;
}

/**
 * WebSocket Hook for Real-time Updates
 * 
 * Connects to the backend WebSocket and:
 * - Automatically authenticates with JWT
 * - Invalidates React Query caches on relevant events
 * - Creates notifications for important events
 * - Handles reconnection with exponential backoff
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 1000,
    debug = false,
  } = options;

  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);
  
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
  const [eventCount, setEventCount] = useState(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const isIntentionalClose = useRef(false);

  const log = useCallback((...args: unknown[]) => {
    if (debug) {
      console.log('[WebSocket]', ...args);
    }
  }, [debug]);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as WebSocketEvent;
      log('Received:', data.type, data);
      
      setLastEvent(data);
      setEventCount((c) => c + 1);
      
      // Invalidate relevant queries based on event type
      switch (data.type) {
        case 'agent:event':
        case 'agent:created':
        case 'agent:updated':
        case 'agent:deleted':
          queryClient.invalidateQueries({ queryKey: ['agents'] });
          queryClient.invalidateQueries({ queryKey: ['metrics'] });
          break;
          
        case 'trace:new':
        case 'trace:update':
        case 'trace:completed':
          queryClient.invalidateQueries({ queryKey: ['traces'] });
          queryClient.invalidateQueries({ queryKey: ['metrics'] });
          break;
          
        case 'log':
          queryClient.invalidateQueries({ queryKey: ['logs'] });
          break;
          
        case 'cost:update':
          queryClient.invalidateQueries({ queryKey: ['costs'] });
          queryClient.invalidateQueries({ queryKey: ['metrics'] });
          break;
          
        case 'metrics:update':
          queryClient.invalidateQueries({ queryKey: ['metrics'] });
          break;
          
        case 'alert:triggered':
        case 'agent:error':
        case 'cost:threshold':
          // Create notification for important events
          const notification = createNotificationFromEvent(data);
          if (notification) {
            addNotification(notification);
          }
          break;
      }
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
    }
  }, [queryClient, addNotification, log]);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      log('Already connected');
      return;
    }

    log('Connecting to', WS_URL);
    setStatus('connecting');
    isIntentionalClose.current = false;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        log('Connected');
        setStatus('connected');
        reconnectAttempts.current = 0;
        
        // Authenticate with JWT
        const token = getAuthToken();
        if (token) {
          ws.send(JSON.stringify({ type: 'auth', token }));
          log('Sent auth token');
        }
      };

      ws.onclose = (event) => {
        log('Closed', event.code, event.reason);
        setStatus('disconnected');
        wsRef.current = null;
        
        // Attempt reconnection if not intentionally closed
        if (autoReconnect && !isIntentionalClose.current) {
          if (reconnectAttempts.current < maxReconnectAttempts) {
            const delay = reconnectDelay * Math.pow(2, reconnectAttempts.current);
            log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
            
            reconnectTimeout.current = setTimeout(() => {
              reconnectAttempts.current++;
              connect();
            }, delay);
          } else {
            log('Max reconnect attempts reached');
            setStatus('error');
          }
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        setStatus('error');
      };

      ws.onmessage = handleMessage;

    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      setStatus('error');
    }
  }, [autoReconnect, maxReconnectAttempts, reconnectDelay, handleMessage, log]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    log('Disconnecting');
    isIntentionalClose.current = true;
    
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    
    setStatus('disconnected');
  }, [log]);

  /**
   * Manually trigger reconnection
   */
  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttempts.current = 0;
    setTimeout(connect, 100);
  }, [connect, disconnect]);

  /**
   * Send message through WebSocket
   */
  const send = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      log('Sent:', message);
    } else {
      console.warn('[WebSocket] Cannot send - not connected');
    }
  }, [log]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Reconnect when auth token changes
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'auth_token') {
        log('Auth token changed, reconnecting');
        reconnect();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [reconnect, log]);

  return {
    status,
    isConnected: status === 'connected',
    lastEvent,
    eventCount,
    reconnect,
    disconnect,
    send,
  };
}

/**
 * Hook to subscribe to specific WebSocket event types
 */
export function useWebSocketEvent<T = unknown>(
  eventType: string,
  callback: (data: T) => void,
  deps: React.DependencyList = []
) {
  const { lastEvent } = useWebSocket();
  
  useEffect(() => {
    if (lastEvent && lastEvent.type === eventType) {
      callback(lastEvent.data as T);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent, eventType, ...deps]);
}
