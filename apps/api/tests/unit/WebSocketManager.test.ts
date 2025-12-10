import { WebSocketManager } from '../../src/websocket/WebSocketManager';
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';

class MockWebSocket extends EventEmitter {
  readyState = WebSocket.OPEN;
  send = jest.fn();
  close = jest.fn();
}

class MockWebSocketServer extends EventEmitter {
  clients = new Set();
}

describe('WebSocketManager', () => {
  let wss: MockWebSocketServer;
  let manager: WebSocketManager;
  let verifyApiKey: jest.Mock;

  beforeEach(() => {
    wss = new MockWebSocketServer();
    verifyApiKey = jest.fn().mockResolvedValue(true);
    manager = new WebSocketManager(wss as any, verifyApiKey);
  });

  describe('Connection Handling', () => {
    it('accepts authenticated connection', async () => {
      const ws = new MockWebSocket();
      const req = {
        headers: { 'x-api-key': 'valid-key' },
        url: '/ws'
      };

      wss.emit('connection', ws, req);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(verifyApiKey).toHaveBeenCalledWith('valid-key');
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"connected"')
      );
      expect(manager.getClientCount()).toBe(1);
    });

    it('rejects connection without API key', async () => {
      const ws = new MockWebSocket();
      const req = { headers: {}, url: '/ws' };

      wss.emit('connection', ws, req);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(ws.close).toHaveBeenCalledWith(1008, 'Authentication required: Missing API key');
      expect(manager.getClientCount()).toBe(0);
    });

    it('rejects connection with invalid API key', async () => {
      verifyApiKey.mockResolvedValue(false);
      const ws = new MockWebSocket();
      const req = {
        headers: { 'x-api-key': 'invalid-key' },
        url: '/ws'
      };

      wss.emit('connection', ws, req);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(ws.close).toHaveBeenCalledWith(1008, 'Authentication failed: Invalid API key');
      expect(manager.getClientCount()).toBe(0);
    });

    it('extracts API key from query parameter', async () => {
      const ws = new MockWebSocket();
      const req = {
        headers: {},
        url: '/ws?apiKey=query-key'
      };

      wss.emit('connection', ws, req);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(verifyApiKey).toHaveBeenCalledWith('query-key');
    });

    it('prefers header over query parameter', async () => {
      const ws = new MockWebSocket();
      const req = {
        headers: { 'x-api-key': 'header-key' },
        url: '/ws?apiKey=query-key'
      };

      wss.emit('connection', ws, req);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(verifyApiKey).toHaveBeenCalledWith('header-key');
    });

    it('handles disconnection', async () => {
      const ws = new MockWebSocket();
      const req = {
        headers: { 'x-api-key': 'valid-key' },
        url: '/ws'
      };

      wss.emit('connection', ws, req);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(manager.getClientCount()).toBe(1);

      ws.emit('close');
      expect(manager.getClientCount()).toBe(0);
    });

    it('handles WebSocket errors', async () => {
      const ws = new MockWebSocket();
      const req = {
        headers: { 'x-api-key': 'valid-key' },
        url: '/ws'
      };

      wss.emit('connection', ws, req);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(manager.getClientCount()).toBe(1);

      ws.emit('error', new Error('Connection error'));
      expect(manager.getClientCount()).toBe(0);
    });
  });

  describe('Message Handling', () => {
    let ws: MockWebSocket;

    beforeEach(async () => {
      ws = new MockWebSocket();
      const req = {
        headers: { 'x-api-key': 'valid-key' },
        url: '/ws'
      };
      wss.emit('connection', ws, req);
      await new Promise(resolve => setTimeout(resolve, 10));
      ws.send.mockClear();
    });

    it('handles ping message', () => {
      ws.emit('message', JSON.stringify({ type: 'ping' }));

      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"pong"')
      );
    });

    it('handles subscribe message', () => {
      ws.emit('message', JSON.stringify({ 
        type: 'subscribe', 
        channels: ['agent:events', 'workflow:updates']
      }));

      manager.broadcast('agent:events', { test: 'data' });
      expect(ws.send).toHaveBeenCalled();
    });

    it('handles unsubscribe message', () => {
      ws.emit('message', JSON.stringify({ 
        type: 'subscribe', 
        channels: ['test-channel']
      }));
      ws.send.mockClear();

      ws.emit('message', JSON.stringify({ 
        type: 'unsubscribe', 
        channels: ['*']
      }));

      manager.broadcast('test-channel', { test: 'data' });
      expect(ws.send).toHaveBeenCalled();
    });

    it('ignores invalid JSON messages', () => {
      ws.emit('message', 'invalid json');
      expect(ws.send).not.toHaveBeenCalled();
    });
  });

  describe('Broadcasting', () => {
    let ws1: MockWebSocket;
    let ws2: MockWebSocket;

    beforeEach(async () => {
      ws1 = new MockWebSocket();
      ws2 = new MockWebSocket();
      
      wss.emit('connection', ws1, { 
        headers: { 'x-api-key': 'key1' }, 
        url: '/ws' 
      });
      
      wss.emit('connection', ws2, { 
        headers: { 'x-api-key': 'key2' }, 
        url: '/ws' 
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      ws1.send.mockClear();
      ws2.send.mockClear();
    });

    it('broadcasts to all connected clients', () => {
      manager.broadcast('test:event', { message: 'Hello' });

      expect(ws1.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"test:event"')
      );
      expect(ws2.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"test:event"')
      );
    });

    it('only broadcasts to subscribed clients', () => {
      ws1.emit('message', JSON.stringify({ 
        type: 'unsubscribe', 
        channels: ['*']
      }));
      ws1.emit('message', JSON.stringify({ 
        type: 'subscribe', 
        channels: ['specific-channel']
      }));
      ws1.send.mockClear();

      manager.broadcast('other-channel', { test: 'data' });
      expect(ws1.send).not.toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
    });

    it('does not send to closed connections', () => {
      ws1.readyState = WebSocket.CLOSED;

      manager.broadcast('test:event', { message: 'Hello' });

      expect(ws1.send).not.toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
    });
  });

  describe('Direct Messaging', () => {
    let ws: MockWebSocket;
    let clientId: string;

    beforeEach(async () => {
      ws = new MockWebSocket();
      wss.emit('connection', ws, { 
        headers: { 'x-api-key': 'valid-key' }, 
        url: '/ws' 
      });
      await new Promise(resolve => setTimeout(resolve, 10));
      
      clientId = manager.getClients()[0];
      ws.send.mockClear();
    });

    it('sends message to specific client', () => {
      manager.sendToClient(clientId, 'direct:message', { content: 'Hello' });

      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"direct:message"')
      );
    });

    it('does nothing for non-existent client', () => {
      manager.sendToClient('non-existent-id', 'test', { data: 'test' });
      expect(ws.send).not.toHaveBeenCalled();
    });
  });

  describe('Client Management', () => {
    it('tracks client count', async () => {
      expect(manager.getClientCount()).toBe(0);

      const ws1 = new MockWebSocket();
      wss.emit('connection', ws1, { 
        headers: { 'x-api-key': 'key1' }, 
        url: '/ws' 
      });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(manager.getClientCount()).toBe(1);

      const ws2 = new MockWebSocket();
      wss.emit('connection', ws2, { 
        headers: { 'x-api-key': 'key2' }, 
        url: '/ws' 
      });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(manager.getClientCount()).toBe(2);

      ws1.emit('close');
      expect(manager.getClientCount()).toBe(1);
    });

    it('returns list of client IDs', async () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();
      
      wss.emit('connection', ws1, { 
        headers: { 'x-api-key': 'key1' }, 
        url: '/ws' 
      });
      wss.emit('connection', ws2, { 
        headers: { 'x-api-key': 'key2' }, 
        url: '/ws' 
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));

      const clients = manager.getClients();
      expect(clients).toHaveLength(2);
      expect(clients[0]).toMatch(/^[0-9a-f-]{36}$/);
      expect(clients[1]).toMatch(/^[0-9a-f-]{36}$/);
    });
  });
});
