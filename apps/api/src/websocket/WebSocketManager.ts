import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuid } from 'uuid';

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
        console.warn('[WebSocket] Connection rejected: No API key provided');
        ws.close(1008, 'Authentication required: Missing API key');
        return;
      }

      // Check if verifyApiKey function is configured
      if (!this.verifyApiKey) {
        console.error('[WebSocket] Connection rejected: verifyApiKey not configured');
        ws.close(1008, 'Authentication not configured');
        return;
      }

      // Verify the API key
      const authenticated = await this.verifyApiKey(apiKey);

      if (!authenticated) {
        console.warn('[WebSocket] Connection rejected: Invalid API key');
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
      console.log(`[WebSocket] Client connected: ${clientId} (authenticated: ${authenticated})`);

      this.send(ws, 'connected', { clientId, authenticated });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString()) as { type: string; channels?: string[] };
          this.handleMessage(client, message);
        } catch {
          console.error('Invalid WebSocket message');
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`[WebSocket] Client disconnected: ${clientId}`);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
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
