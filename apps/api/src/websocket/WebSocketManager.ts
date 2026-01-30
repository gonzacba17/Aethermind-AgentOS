import { WebSocketServer, WebSocket, RawData } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuid } from 'uuid';
import logger from '../utils/logger';
import { wsRateLimiter, WebSocketRateLimiter } from './WebSocketRateLimiter';

/**
 * WebSocket Client Configuration
 */
interface Client {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  authenticated: boolean;
  /** Organization ID for namespace isolation */
  organizationId?: string;
  /** Client IP address for rate limiting */
  ip: string;
  /** Last activity timestamp for heartbeat timeout */
  lastActivity: number;
  /** Ping pending flag */
  pingPending: boolean;
}

/**
 * WebSocket Manager Configuration
 */
interface WebSocketManagerConfig {
  /** Heartbeat interval in milliseconds (default: 30s) */
  heartbeatInterval: number;
  /** Client timeout after no pong response (default: 60s) */
  clientTimeout: number;
  /** Enable organization namespace isolation */
  enableNamespaceIsolation: boolean;
  /** Enable message rate limiting */
  enableRateLimiting: boolean;
}

const DEFAULT_CONFIG: WebSocketManagerConfig = {
  heartbeatInterval: 30 * 1000,  // 30 seconds
  clientTimeout: 60 * 1000,      // 60 seconds
  enableNamespaceIsolation: true,
  enableRateLimiting: true,
};

export type VerifyApiKeyFn = (apiKey: string | undefined) => Promise<boolean | {
  valid: boolean;
  organizationId?: string;
}>;

/**
 * Secure WebSocket Manager
 *
 * Features:
 * - API key authentication
 * - Organization namespace isolation (clients only receive their org's events)
 * - Per-client message rate limiting
 * - Connection limits per IP and organization
 * - Heartbeat/ping timeout for stale connections
 * - Graceful connection handling
 */
export class WebSocketManager {
  private clients: Map<string, Client> = new Map();
  private verifyApiKey?: VerifyApiKeyFn;
  private config: WebSocketManagerConfig;
  private rateLimiter: WebSocketRateLimiter;
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(
    wss: WebSocketServer,
    verifyApiKey?: VerifyApiKeyFn,
    config: Partial<WebSocketManagerConfig> = {}
  ) {
    this.verifyApiKey = verifyApiKey;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rateLimiter = wsRateLimiter;

    // Start heartbeat checker
    this.startHeartbeat();

    wss.on('connection', async (ws, req: IncomingMessage) => {
      await this.handleConnection(ws, req);
    });

    // Cleanup on server close
    wss.on('close', () => {
      this.stopHeartbeat();
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    const clientId = uuid();
    const ip = this.extractClientIp(req);

    // Extract API key from header or query parameter
    const apiKey = this.extractApiKey(req);

    // Check if API key is provided
    if (!apiKey) {
      logger.warn('WebSocket connection rejected: no API key', { clientId, ip });
      ws.close(1008, 'Authentication required: Missing API key');
      return;
    }

    // Check if verifyApiKey function is configured
    if (!this.verifyApiKey) {
      logger.error('WebSocket connection rejected: verifyApiKey not configured', { clientId });
      ws.close(1008, 'Authentication not configured');
      return;
    }

    // Verify the API key
    const authResult = await this.verifyApiKey(apiKey);
    let authenticated = false;
    let organizationId: string | undefined;

    if (typeof authResult === 'boolean') {
      authenticated = authResult;
    } else {
      authenticated = authResult.valid;
      organizationId = authResult.organizationId;
    }

    if (!authenticated) {
      logger.warn('WebSocket connection rejected: invalid API key', { clientId, ip });
      ws.close(1008, 'Authentication failed: Invalid API key');
      return;
    }

    // Check connection rate limits
    if (this.config.enableRateLimiting) {
      const canConnect = await this.rateLimiter.canConnect(clientId, ip, organizationId);
      if (!canConnect.allowed) {
        logger.warn('WebSocket connection rejected: rate limit', {
          clientId,
          ip,
          organizationId,
          reason: canConnect.reason,
        });
        ws.close(1008, canConnect.reason || 'Connection limit exceeded');
        return;
      }

      // Register the connection for tracking
      this.rateLimiter.registerConnection(clientId, ip, organizationId);
    }

    const client: Client = {
      id: clientId,
      ws,
      subscriptions: new Set(['*']),
      authenticated,
      organizationId,
      ip,
      lastActivity: Date.now(),
      pingPending: false,
    };

    this.clients.set(clientId, client);
    logger.info('WebSocket client connected', {
      clientId,
      authenticated,
      organizationId,
      ip,
    });

    // Send connection confirmation
    this.send(ws, 'connected', {
      clientId,
      authenticated,
      organizationId: organizationId || null,
      features: {
        namespaceIsolation: this.config.enableNamespaceIsolation,
        rateLimiting: this.config.enableRateLimiting,
      },
    });

    // Handle incoming messages
    ws.on('message', async (data) => {
      await this.handleMessage(client, data);
    });

    // Handle pong responses (for heartbeat)
    ws.on('pong', () => {
      client.pingPending = false;
      client.lastActivity = Date.now();
    });

    // Handle close
    ws.on('close', (code, reason) => {
      this.handleDisconnect(client, code, reason.toString());
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error', {
        clientId,
        error: error.message,
        organizationId,
      });
      this.handleDisconnect(client, 1011, 'Internal error');
    });
  }

  /**
   * Handle incoming message from client
   */
  private async handleMessage(client: Client, data: RawData): Promise<void> {
    // Update last activity
    client.lastActivity = Date.now();

    // Check rate limit
    if (this.config.enableRateLimiting) {
      const rateCheck = await this.rateLimiter.checkMessage(client.id);

      if (rateCheck.shouldWarn) {
        this.send(client.ws, 'rate_limit_warning', {
          remaining: rateCheck.remaining,
          resetAt: rateCheck.resetAt,
          message: 'Approaching message rate limit',
        });
      }

      if (!rateCheck.allowed) {
        this.send(client.ws, 'rate_limit_exceeded', {
          resetAt: rateCheck.resetAt,
          message: 'Message rate limit exceeded. Please slow down.',
        });
        return;
      }
    }

    // Parse message
    let message: { type: string; channels?: string[]; data?: unknown };
    try {
      message = JSON.parse(data.toString());
    } catch {
      logger.warn('Invalid WebSocket message format', { clientId: client.id });
      this.send(client.ws, 'error', { message: 'Invalid message format' });
      return;
    }

    // Handle message types
    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(client, message.channels || []);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(client, message.channels || []);
        break;

      case 'ping':
        this.send(client.ws, 'pong', { timestamp: Date.now() });
        break;

      default:
        logger.debug('Unknown WebSocket message type', {
          clientId: client.id,
          type: message.type,
        });
    }
  }

  /**
   * Handle subscribe request
   */
  private handleSubscribe(client: Client, channels: string[]): void {
    for (const channel of channels) {
      // Validate channel name (prevent injection)
      if (!/^[\w:.-]+$/.test(channel) && channel !== '*') {
        logger.warn('Invalid channel name rejected', {
          clientId: client.id,
          channel,
        });
        continue;
      }

      client.subscriptions.add(channel);
    }

    this.send(client.ws, 'subscribed', {
      channels: Array.from(client.subscriptions),
    });
  }

  /**
   * Handle unsubscribe request
   */
  private handleUnsubscribe(client: Client, channels: string[]): void {
    for (const channel of channels) {
      client.subscriptions.delete(channel);
    }

    this.send(client.ws, 'unsubscribed', {
      channels: Array.from(client.subscriptions),
    });
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(client: Client, code: number, reason: string): void {
    // Unregister from rate limiter
    if (this.config.enableRateLimiting) {
      this.rateLimiter.unregisterConnection(client.id, client.ip, client.organizationId);
    }

    // Remove from clients map
    this.clients.delete(client.id);

    logger.info('WebSocket client disconnected', {
      clientId: client.id,
      code,
      reason,
      organizationId: client.organizationId,
    });
  }

  /**
   * Send message to a WebSocket
   */
  private send(ws: WebSocket, type: string, data: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type,
        data,
        timestamp: new Date().toISOString(),
      }));
    }
  }

  /**
   * Broadcast message to all clients (with namespace isolation)
   *
   * @param channel - The event channel
   * @param data - The data to broadcast
   * @param organizationId - If provided, only broadcast to this organization's clients
   */
  broadcast(channel: string, data: unknown, organizationId?: string): void {
    const message = JSON.stringify({
      type: channel,
      data,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.clients.values()) {
      if (client.ws.readyState !== WebSocket.OPEN) {
        continue;
      }

      // Namespace isolation: only send to matching organization
      if (this.config.enableNamespaceIsolation && organizationId) {
        if (client.organizationId !== organizationId) {
          continue;
        }
      }

      // Check channel subscription
      if (client.subscriptions.has('*') || client.subscriptions.has(channel)) {
        client.ws.send(message);
      }
    }
  }

  /**
   * Send message to a specific client
   */
  sendToClient(clientId: string, type: string, data: unknown): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.send(client.ws, type, data);
    }
  }

  /**
   * Send message to all clients in an organization
   */
  sendToOrganization(organizationId: string, type: string, data: unknown): void {
    for (const client of this.clients.values()) {
      if (client.organizationId === organizationId && client.ws.readyState === WebSocket.OPEN) {
        this.send(client.ws, type, data);
      }
    }
  }

  /**
   * Start heartbeat checker
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.checkHeartbeats();
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat checker
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * Check all client heartbeats and terminate stale connections
   */
  private checkHeartbeats(): void {
    const now = Date.now();
    const timeout = this.config.clientTimeout;

    for (const client of this.clients.values()) {
      if (client.ws.readyState !== WebSocket.OPEN) {
        continue;
      }

      // Check if previous ping was not answered
      if (client.pingPending) {
        const timeSinceActivity = now - client.lastActivity;
        if (timeSinceActivity > timeout) {
          logger.warn('WebSocket client timed out (no pong)', {
            clientId: client.id,
            lastActivity: new Date(client.lastActivity).toISOString(),
          });
          client.ws.terminate();
          continue;
        }
      }

      // Send ping
      client.pingPending = true;
      client.ws.ping();
    }
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get all client IDs
   */
  getClients(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Get clients by organization
   */
  getClientsByOrganization(organizationId: string): string[] {
    const result: string[] = [];
    for (const [id, client] of this.clients.entries()) {
      if (client.organizationId === organizationId) {
        result.push(id);
      }
    }
    return result;
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalClients: number;
    authenticatedClients: number;
    organizationCount: number;
    rateLimiterStats: ReturnType<WebSocketRateLimiter['getStats']>;
  } {
    const orgs = new Set<string>();
    let authenticated = 0;

    for (const client of this.clients.values()) {
      if (client.authenticated) authenticated++;
      if (client.organizationId) orgs.add(client.organizationId);
    }

    return {
      totalClients: this.clients.size,
      authenticatedClients: authenticated,
      organizationCount: orgs.size,
      rateLimiterStats: this.rateLimiter.getStats(),
    };
  }

  /**
   * Extract client IP from request
   */
  private extractClientIp(req: IncomingMessage): string {
    // Check forwarded headers (for proxies)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return ips?.split(',')[0]?.trim() ?? 'unknown';
    }

    // Check real IP header (nginx)
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return (Array.isArray(realIp) ? realIp[0] : realIp) ?? 'unknown';
    }

    // Fall back to socket address
    return req.socket.remoteAddress || 'unknown';
  }

  /**
   * Extract API key from request
   */
  private extractApiKey(req: IncomingMessage): string | undefined {
    // Try to get API key from header first
    const headerValue = req.headers['x-api-key'];
    if (headerValue) {
      if (Array.isArray(headerValue)) {
        return headerValue[0];
      }
      return headerValue;
    }

    // Fall back to query parameter
    if (req.url) {
      try {
        const url = new URL(req.url, 'http://localhost');
        return url.searchParams.get('apiKey') || undefined;
      } catch {
        return undefined;
      }
    }

    return undefined;
  }
}
