import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuid } from 'uuid';
import logger from '../utils/logger';

interface Client {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  authenticated: boolean;
}

export type VerifyApiKeyFn = (apiKey: string | undefined) => Promise<boolean>;

export class WebSocketManager {
  private clients: Map<string, Client> = new Map();
  private verifyApiKey?: VerifyApiKeyFn;

  constructor(wss: WebSocketServer, verifyApiKey?: VerifyApiKeyFn) {
    this.verifyApiKey = verifyApiKey;

    wss.on('connection', async (ws, req: IncomingMessage) => {
      const clientId = uuid();

      // Extract API key from header or query parameter
      const apiKey = this.extractApiKey(req);

      // Check if API key is provided
      if (!apiKey) {
        logger.warn('WebSocket connection rejected: no API key', { clientId });
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
      const authenticated = await this.verifyApiKey(apiKey);

      if (!authenticated) {
        logger.warn('WebSocket connection rejected: invalid API key', { clientId });
        ws.close(1008, 'Authentication failed: Invalid API key');
        return;
      }

      const client: Client = {
        id: clientId,
        ws,
        subscriptions: new Set(['*']),
        authenticated,
      };

      this.clients.set(clientId, client);
      logger.info('WebSocket client connected', { clientId, authenticated });

      this.send(ws, 'connected', { clientId, authenticated });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString()) as { type: string; channels?: string[] };
          this.handleMessage(client, message);
        } catch {
          logger.error('Invalid WebSocket message received');
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        logger.info('WebSocket client disconnected', { clientId });
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error', { clientId, error: error.message });
        this.clients.delete(clientId);
      });
    });
  }

  private handleMessage(client: Client, message: { type: string; channels?: string[] }): void {
    switch (message.type) {
      case 'subscribe':
        if (message.channels) {
          for (const channel of message.channels) {
            client.subscriptions.add(channel);
          }
        }
        break;

      case 'unsubscribe':
        if (message.channels) {
          for (const channel of message.channels) {
            client.subscriptions.delete(channel);
          }
        }
        break;

      case 'ping':
        this.send(client.ws, 'pong', { timestamp: Date.now() });
        break;
    }
  }

  private send(ws: WebSocket, type: string, data: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, data, timestamp: new Date().toISOString() }));
    }
  }

  broadcast(channel: string, data: unknown): void {
    const message = JSON.stringify({
      type: channel,
      data,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        if (client.subscriptions.has('*') || client.subscriptions.has(channel)) {
          client.ws.send(message);
        }
      }
    }
  }

  sendToClient(clientId: string, type: string, data: unknown): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.send(client.ws, type, data);
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getClients(): string[] {
    return Array.from(this.clients.keys());
  }

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
