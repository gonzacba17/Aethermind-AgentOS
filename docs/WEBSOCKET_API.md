# WebSocket API Documentation

Aethermind provides real-time updates via WebSocket connections for dashboards and monitoring applications.

## Connection

### Endpoint
```
wss://api.aethermind.io/ws
```

### Authentication

Connect with your API key as a query parameter:

```
wss://api.aethermind.io/ws?token=YOUR_API_KEY
```

Or via the `Authorization` header (for clients that support it):

```
Authorization: Bearer YOUR_API_KEY
```

### Connection Example (JavaScript)

```javascript
const ws = new WebSocket('wss://api.aethermind.io/ws?token=aether_your_api_key');

ws.onopen = () => {
  console.log('Connected to Aethermind WebSocket');

  // Subscribe to channels
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['telemetry', 'costs', 'alerts']
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = (event) => {
  console.log('Connection closed:', event.code, event.reason);
};
```

### Connection Example (Python)

```python
import asyncio
import websockets
import json

async def connect():
    uri = "wss://api.aethermind.io/ws?token=aether_your_api_key"

    async with websockets.connect(uri) as ws:
        # Subscribe to channels
        await ws.send(json.dumps({
            "type": "subscribe",
            "channels": ["telemetry", "costs", "alerts"]
        }))

        # Listen for messages
        async for message in ws:
            data = json.loads(message)
            print(f"Received: {data}")

asyncio.run(connect())
```

## Message Format

All messages use JSON format with the following structure:

### Client → Server

```typescript
interface ClientMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'request';
  channels?: string[];
  requestId?: string;
  data?: any;
}
```

### Server → Client

```typescript
interface ServerMessage {
  type: 'event' | 'response' | 'error' | 'pong' | 'subscribed' | 'unsubscribed';
  channel?: string;
  event?: string;
  data?: any;
  requestId?: string;
  error?: string;
  timestamp: string;
}
```

## Available Channels

### 1. `telemetry`

Real-time telemetry events from your SDK integrations.

**Events:**
- `telemetry.event` - New telemetry event received
- `telemetry.batch` - Batch of events processed

**Payload:**
```json
{
  "type": "event",
  "channel": "telemetry",
  "event": "telemetry.event",
  "data": {
    "id": "evt_123abc",
    "provider": "openai",
    "model": "gpt-4",
    "promptTokens": 150,
    "completionTokens": 50,
    "totalTokens": 200,
    "cost": 0.0045,
    "latency": 1234,
    "status": "success",
    "timestamp": "2024-02-01T12:00:00.000Z"
  },
  "timestamp": "2024-02-01T12:00:00.123Z"
}
```

### 2. `costs`

Real-time cost updates and aggregations.

**Events:**
- `costs.updated` - Cost totals updated
- `costs.threshold` - Cost threshold reached

**Payload:**
```json
{
  "type": "event",
  "channel": "costs",
  "event": "costs.updated",
  "data": {
    "period": "daily",
    "date": "2024-02-01",
    "totalCost": 12.45,
    "totalTokens": 50000,
    "requestCount": 150,
    "byModel": {
      "gpt-4": { "cost": 10.00, "tokens": 30000 },
      "gpt-3.5-turbo": { "cost": 2.45, "tokens": 20000 }
    }
  },
  "timestamp": "2024-02-01T12:00:00.123Z"
}
```

### 3. `alerts`

Budget alerts and system notifications.

**Events:**
- `alerts.budget_warning` - Budget at 80% threshold
- `alerts.budget_exceeded` - Budget exceeded 100%
- `alerts.anomaly` - Anomaly detected

**Payload:**
```json
{
  "type": "event",
  "channel": "alerts",
  "event": "alerts.budget_warning",
  "data": {
    "budgetId": "bgt_123",
    "budgetName": "Monthly Limit",
    "currentSpend": 80.50,
    "limit": 100.00,
    "percentage": 80.5,
    "severity": "warning"
  },
  "timestamp": "2024-02-01T12:00:00.123Z"
}
```

### 4. `agents`

Agent execution updates.

**Events:**
- `agents.execution_started` - Agent execution began
- `agents.execution_completed` - Agent execution finished
- `agents.execution_failed` - Agent execution failed

**Payload:**
```json
{
  "type": "event",
  "channel": "agents",
  "event": "agents.execution_completed",
  "data": {
    "executionId": "exec_123",
    "agentId": "agt_456",
    "agentName": "Customer Support Bot",
    "status": "completed",
    "duration": 2500,
    "tokensUsed": 500,
    "cost": 0.015
  },
  "timestamp": "2024-02-01T12:00:00.123Z"
}
```

### 5. `traces`

Distributed tracing updates.

**Events:**
- `traces.span_started` - New span began
- `traces.span_ended` - Span completed
- `traces.trace_completed` - Full trace completed

**Payload:**
```json
{
  "type": "event",
  "channel": "traces",
  "event": "traces.trace_completed",
  "data": {
    "traceId": "abc123def456",
    "rootSpanName": "chat_completion",
    "totalDuration": 1500,
    "spanCount": 5,
    "status": "ok"
  },
  "timestamp": "2024-02-01T12:00:00.123Z"
}
```

## Client Messages

### Subscribe

```json
{
  "type": "subscribe",
  "channels": ["telemetry", "costs", "alerts"]
}
```

**Response:**
```json
{
  "type": "subscribed",
  "channels": ["telemetry", "costs", "alerts"],
  "timestamp": "2024-02-01T12:00:00.123Z"
}
```

### Unsubscribe

```json
{
  "type": "unsubscribe",
  "channels": ["alerts"]
}
```

**Response:**
```json
{
  "type": "unsubscribed",
  "channels": ["alerts"],
  "timestamp": "2024-02-01T12:00:00.123Z"
}
```

### Ping/Pong (Heartbeat)

```json
{
  "type": "ping"
}
```

**Response:**
```json
{
  "type": "pong",
  "timestamp": "2024-02-01T12:00:00.123Z"
}
```

## Error Handling

### Error Response

```json
{
  "type": "error",
  "error": "Invalid channel: unknown_channel",
  "code": "INVALID_CHANNEL",
  "timestamp": "2024-02-01T12:00:00.123Z"
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Invalid or expired API key |
| `INVALID_MESSAGE` | Malformed JSON message |
| `INVALID_CHANNEL` | Unknown channel name |
| `RATE_LIMITED` | Too many messages |
| `INTERNAL_ERROR` | Server-side error |

## Reconnection Strategy

Implement exponential backoff for reconnection:

```javascript
class AethermindWebSocket {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  connect() {
    this.ws = new WebSocket(`wss://api.aethermind.io/ws?token=${this.apiKey}`);

    this.ws.onopen = () => {
      console.log('Connected');
      this.reconnectDelay = 1000;
      this.reconnectAttempts = 0;
      this.onConnect?.();
    };

    this.ws.onclose = (event) => {
      if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.onMessage?.(message);
    };
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    console.log(`Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      this.maxReconnectDelay
    );
  }

  subscribe(channels) {
    this.send({ type: 'subscribe', channels });
  }

  unsubscribe(channels) {
    this.send({ type: 'unsubscribe', channels });
  }

  send(message) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  close() {
    this.ws?.close(1000, 'Client closed');
  }
}

// Usage
const client = new AethermindWebSocket('aether_your_api_key');
client.onMessage = (msg) => console.log('Received:', msg);
client.onConnect = () => client.subscribe(['telemetry', 'costs']);
client.connect();
```

## Rate Limits

| Limit | Value |
|-------|-------|
| Connections per IP | 10 |
| Messages per second | 50 |
| Subscriptions per connection | 20 |
| Message size | 64 KB |

## Best Practices

1. **Always implement reconnection logic** - Network disconnections are common
2. **Use heartbeats** - Send ping every 30 seconds to keep connection alive
3. **Handle backpressure** - Don't flood the server with messages
4. **Subscribe only to needed channels** - Reduces bandwidth and processing
5. **Parse messages safely** - Always validate message structure
6. **Log connection events** - Helps debugging connection issues

## Testing

Use the WebSocket testing endpoint for development:

```
wss://api.aethermind.io/ws/test?token=YOUR_API_KEY
```

This endpoint echoes back your messages and sends simulated events.
