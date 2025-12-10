# API Documentation - Aethermind AgentOS

> Complete REST API and WebSocket reference for Aethermind AgentOS v0.1.0

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Agents API](#agents-api)
- [Workflows API](#workflows-api)
- [Executions API](#executions-api)
- [Logs API](#logs-api)
- [Traces API](#traces-api)
- [Costs API](#costs-api)
- [WebSocket API](#websocket-api)

---

## Base URL

```
Development: http://localhost:3001
Production: https://your-domain.com
```

All API endpoints are prefixed with `/api`.

---

## Authentication

All API requests require authentication using an API key.

### API Key Authentication

Include your API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key-here" \
     http://localhost:3001/api/agents
```

### Generating an API Key

```bash
pnpm generate-api-key
```

This will output:
- **API Key** - Save this securely (e.g., `ak_abc123xyz789...`)
- **API Key Hash** - Add to `.env` as `API_KEY_HASH`

### Authentication Errors

| Status | Error | Description |
|--------|-------|-------------|
| 401 | Unauthorized | Missing API key |
| 403 | Forbidden | Invalid API key |

---

## Rate Limiting

- **Limit**: 100 requests per 15 minutes per IP
- **Headers**:
  - `X-RateLimit-Limit`: Total requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Timestamp when limit resets

**429 Too Many Requests** response when limit exceeded.

---

## Error Handling

### Error Response Format

```json
{
  "error": "ErrorType",
  "message": "Human-readable error message",
  "code": "E101",
  "suggestion": "How to fix the error",
  "details": {
    "field": "Additional context"
  }
}
```

### Common Error Codes

| Code | Error | Description |
|------|-------|-------------|
| E101 | ProviderError | LLM provider error (invalid API key, rate limit) |
| E102 | ValidationError | Invalid input data |
| E103 | NotFoundError | Resource not found |
| E104 | TimeoutError | Execution timeout |
| E105 | ExecutionError | Agent execution failed |

---

## Agents API

### List All Agents

```http
GET /api/agents
```

**Response:**
```json
{
  "agents": [
    {
      "id": "agent-uuid",
      "name": "researcher",
      "model": "gpt-4",
      "status": "idle",
      "createdAt": "2024-11-26T10:00:00Z"
    }
  ]
}
```

---

### Get Agent by ID

```http
GET /api/agents/:id
```

**Response:**
```json
{
  "id": "agent-uuid",
  "name": "researcher",
  "model": "gpt-4",
  "systemPrompt": "You are a research assistant.",
  "config": {
    "temperature": 0.7,
    "maxTokens": 2000
  },
  "status": "idle",
  "createdAt": "2024-11-26T10:00:00Z"
}
```

**Errors:**
- `404` - Agent not found

---

### Create Agent

```http
POST /api/agents
```

**Request Body:**
```json
{
  "name": "researcher",
  "model": "gpt-4",
  "systemPrompt": "You are a research assistant.",
  "config": {
    "temperature": 0.7,
    "maxTokens": 2000,
    "timeout": 30000,
    "maxRetries": 3
  }
}
```

**Response:**
```json
{
  "id": "agent-uuid",
  "name": "researcher",
  "model": "gpt-4",
  "status": "idle",
  "createdAt": "2024-11-26T10:00:00Z"
}
```

**Errors:**
- `400` - Invalid request body
- `409` - Agent with name already exists

---

### Execute Agent

```http
POST /api/agents/:id/execute
```

**Request Body:**
```json
{
  "input": {
    "topic": "AI market analysis",
    "depth": "detailed"
  },
  "config": {
    "timeout": 60000
  }
}
```

**Response:**
```json
{
  "executionId": "exec-uuid",
  "agentId": "agent-uuid",
  "status": "completed",
  "output": {
    "findings": ["Finding 1", "Finding 2"],
    "summary": "Market analysis summary"
  },
  "cost": {
    "totalCost": 0.05,
    "currency": "USD",
    "tokens": {
      "prompt": 150,
      "completion": 500,
      "total": 650
    }
  },
  "duration": 5234,
  "createdAt": "2024-11-26T10:00:00Z",
  "completedAt": "2024-11-26T10:00:05Z"
}
```

**Errors:**
- `404` - Agent not found
- `408` - Execution timeout
- `500` - Execution failed

---

### Chat with Agent

```http
POST /api/agents/:id/chat
```

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "What is the capital of France?"
    }
  ],
  "config": {
    "temperature": 0.7,
    "maxTokens": 500
  }
}
```

**Response:**
```json
{
  "message": {
    "role": "assistant",
    "content": "The capital of France is Paris."
  },
  "cost": {
    "totalCost": 0.002,
    "tokens": {
      "prompt": 20,
      "completion": 10,
      "total": 30
    }
  }
}
```

---

## Workflows API

### List Workflows

```http
GET /api/workflows
```

**Response:**
```json
{
  "workflows": [
    {
      "name": "research-workflow",
      "description": "Research and analysis workflow",
      "steps": 3,
      "createdAt": "2024-11-26T10:00:00Z"
    }
  ]
}
```

---

### Get Workflow

```http
GET /api/workflows/:name
```

**Response:**
```json
{
  "name": "research-workflow",
  "description": "Research and analysis workflow",
  "steps": [
    {
      "id": "research",
      "agent": "researcher",
      "description": "Gather information"
    },
    {
      "id": "analyze",
      "agent": "analyst",
      "dependsOn": ["research"],
      "description": "Analyze findings"
    },
    {
      "id": "write",
      "agent": "writer",
      "dependsOn": ["analyze"],
      "description": "Write report"
    }
  ],
  "createdAt": "2024-11-26T10:00:00Z"
}
```

---

### Create Workflow

```http
POST /api/workflows
```

**Request Body:**
```json
{
  "name": "research-workflow",
  "description": "Research and analysis workflow",
  "steps": [
    {
      "id": "research",
      "agent": "researcher",
      "input": {
        "topic": "{{input.topic}}"
      }
    },
    {
      "id": "analyze",
      "agent": "analyst",
      "dependsOn": ["research"],
      "input": {
        "data": "{{research.output}}"
      }
    }
  ]
}
```

**Response:**
```json
{
  "name": "research-workflow",
  "status": "created",
  "createdAt": "2024-11-26T10:00:00Z"
}
```

---

### Execute Workflow

```http
POST /api/workflows/:name/execute
```

**Request Body:**
```json
{
  "input": {
    "topic": "AI market trends 2024"
  }
}
```

**Response:**
```json
{
  "executionId": "exec-uuid",
  "workflowName": "research-workflow",
  "status": "completed",
  "results": {
    "research": {
      "output": { "findings": [...] }
    },
    "analyze": {
      "output": { "analysis": "..." }
    },
    "write": {
      "output": { "report": "..." }
    }
  },
  "totalCost": 0.15,
  "duration": 15234,
  "createdAt": "2024-11-26T10:00:00Z",
  "completedAt": "2024-11-26T10:00:15Z"
}
```

---

### Estimate Workflow Cost

```http
POST /api/workflows/:name/estimate
```

**Request Body:**
```json
{
  "input": {
    "topic": "AI market trends 2024"
  }
}
```

**Response:**
```json
{
  "estimatedCost": 0.12,
  "currency": "USD",
  "breakdown": [
    {
      "step": "research",
      "agent": "researcher",
      "model": "gpt-4",
      "estimatedCost": 0.05,
      "estimatedTokens": 1000
    },
    {
      "step": "analyze",
      "agent": "analyst",
      "model": "gpt-4",
      "estimatedCost": 0.04,
      "estimatedTokens": 800
    },
    {
      "step": "write",
      "agent": "writer",
      "model": "gpt-3.5-turbo",
      "estimatedCost": 0.03,
      "estimatedTokens": 1500
    }
  ],
  "confidence": 0.75,
  "method": "historical"
}
```

---

## Executions API

### List Executions

```http
GET /api/executions?agentId=agent-uuid&status=completed&limit=50
```

**Query Parameters:**
- `agentId` (optional) - Filter by agent ID
- `status` (optional) - Filter by status: `pending`, `running`, `completed`, `failed`
- `limit` (optional) - Max results (default: 100, max: 1000)
- `offset` (optional) - Pagination offset

**Response:**
```json
{
  "executions": [
    {
      "id": "exec-uuid",
      "agentId": "agent-uuid",
      "status": "completed",
      "duration": 5234,
      "cost": 0.05,
      "createdAt": "2024-11-26T10:00:00Z",
      "completedAt": "2024-11-26T10:00:05Z"
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

---

### Get Execution

```http
GET /api/executions/:id
```

**Response:**
```json
{
  "id": "exec-uuid",
  "agentId": "agent-uuid",
  "agentName": "researcher",
  "status": "completed",
  "input": {
    "topic": "AI market analysis"
  },
  "output": {
    "findings": ["Finding 1", "Finding 2"]
  },
  "cost": {
    "totalCost": 0.05,
    "tokens": {
      "prompt": 150,
      "completion": 500,
      "total": 650
    }
  },
  "duration": 5234,
  "createdAt": "2024-11-26T10:00:00Z",
  "completedAt": "2024-11-26T10:00:05Z"
}
```

---

## Logs API

### Get Logs

```http
GET /api/logs?level=error&executionId=exec-uuid&limit=100
```

**Query Parameters:**
- `level` (optional) - Filter by level: `debug`, `info`, `warn`, `error`
- `executionId` (optional) - Filter by execution ID
- `agentId` (optional) - Filter by agent ID
- `limit` (optional) - Max results (default: 100, max: 1000)
- `offset` (optional) - Pagination offset

**Response:**
```json
{
  "logs": [
    {
      "id": "log-uuid",
      "level": "info",
      "message": "Agent execution started",
      "timestamp": "2024-11-26T10:00:00Z",
      "executionId": "exec-uuid",
      "agentId": "agent-uuid",
      "metadata": {
        "model": "gpt-4",
        "input": "..."
      }
    }
  ],
  "total": 250,
  "limit": 100,
  "offset": 0
}
```

---

## Traces API

### Get Trace

```http
GET /api/traces/:executionId
```

**Response:**
```json
{
  "executionId": "exec-uuid",
  "workflowName": "research-workflow",
  "trace": {
    "id": "root",
    "type": "workflow",
    "name": "research-workflow",
    "status": "completed",
    "startTime": "2024-11-26T10:00:00Z",
    "endTime": "2024-11-26T10:00:15Z",
    "children": [
      {
        "id": "research",
        "type": "agent",
        "name": "researcher",
        "status": "completed",
        "startTime": "2024-11-26T10:00:00Z",
        "endTime": "2024-11-26T10:00:05Z",
        "cost": 0.05
      },
      {
        "id": "analyze",
        "type": "agent",
        "name": "analyst",
        "status": "completed",
        "startTime": "2024-11-26T10:00:05Z",
        "endTime": "2024-11-26T10:00:10Z",
        "cost": 0.04
      }
    ]
  }
}
```

---

## Costs API

### Get Costs

```http
GET /api/costs?agentId=agent-uuid&startDate=2024-11-01&endDate=2024-11-30
```

**Query Parameters:**
- `agentId` (optional) - Filter by agent ID
- `model` (optional) - Filter by model
- `startDate` (optional) - Start date (ISO 8601)
- `endDate` (optional) - End date (ISO 8601)

**Response:**
```json
{
  "costs": [
    {
      "id": "cost-uuid",
      "executionId": "exec-uuid",
      "agentId": "agent-uuid",
      "model": "gpt-4",
      "totalCost": 0.05,
      "currency": "USD",
      "tokens": {
        "prompt": 150,
        "completion": 500,
        "total": 650
      },
      "timestamp": "2024-11-26T10:00:00Z"
    }
  ],
  "summary": {
    "totalCost": 15.75,
    "totalExecutions": 350,
    "byModel": {
      "gpt-4": 10.50,
      "gpt-3.5-turbo": 3.25,
      "claude-3-sonnet": 2.00
    }
  }
}
```

---

### Get Total Cost

```http
GET /api/costs/total?startDate=2024-11-01&endDate=2024-11-30
```

**Response:**
```json
{
  "totalCost": 15.75,
  "currency": "USD",
  "period": {
    "startDate": "2024-11-01T00:00:00Z",
    "endDate": "2024-11-30T23:59:59Z"
  },
  "breakdown": {
    "byModel": {
      "gpt-4": 10.50,
      "gpt-3.5-turbo": 3.25,
      "claude-3-sonnet": 2.00
    },
    "byAgent": {
      "researcher": 8.00,
      "analyst": 4.50,
      "writer": 3.25
    }
  }
}
```

---

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3001/ws?apiKey=your-api-key');

// Or with header (Node.js)
const ws = new WebSocket('ws://localhost:3001/ws', {
  headers: {
    'x-api-key': 'your-api-key'
  }
});
```

### Authentication

WebSocket connections require API key authentication via:
- **Query parameter**: `?apiKey=your-api-key`
- **Header**: `x-api-key: your-api-key` (Node.js only)

**Authentication failure** closes connection with code `1008`.

---

### Message Types

#### Connected

Sent when connection is established:

```json
{
  "type": "connected",
  "data": {
    "timestamp": "2024-11-26T10:00:00Z"
  }
}
```

#### Log

New log entry:

```json
{
  "type": "log",
  "data": {
    "id": "log-uuid",
    "level": "info",
    "message": "Agent execution started",
    "timestamp": "2024-11-26T10:00:00Z",
    "executionId": "exec-uuid",
    "agentId": "agent-uuid"
  }
}
```

#### Agent Event

Agent lifecycle events:

```json
{
  "type": "agent:event",
  "data": {
    "event": "agent:started",
    "agentId": "agent-uuid",
    "executionId": "exec-uuid",
    "timestamp": "2024-11-26T10:00:00Z"
  }
}
```

#### Workflow Events

```json
{
  "type": "workflow:started",
  "data": {
    "workflowName": "research-workflow",
    "executionId": "exec-uuid",
    "timestamp": "2024-11-26T10:00:00Z"
  }
}
```

#### Config Change (Hot Reload)

```json
{
  "type": "config:change",
  "data": {
    "agentId": "agent-uuid",
    "changes": ["systemPrompt", "temperature"],
    "timestamp": "2024-11-26T10:00:00Z"
  }
}
```

---

### Subscribing to Channels

```javascript
// Subscribe to specific channels
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: ['log', 'agent:event', 'workflow:started']
}));

// Unsubscribe
ws.send(JSON.stringify({
  type: 'unsubscribe',
  channels: ['log']
}));
```

**Available Channels:**
- `log` - All log messages
- `agent:event` - Agent lifecycle events
- `workflow:started` - Workflow start events
- `workflow:completed` - Workflow completion events
- `workflow:failed` - Workflow failure events
- `config:change` - Configuration changes
- `agent:reloaded` - Agent reload events

---

### Ping/Pong

Keep connection alive:

```javascript
// Send ping
ws.send(JSON.stringify({ type: 'ping' }));

// Receive pong
{
  "type": "pong",
  "data": {
    "timestamp": "2024-11-26T10:00:00Z"
  }
}
```

---

## Examples

### Complete Agent Execution Example

```bash
# 1. Create an agent
curl -X POST http://localhost:3001/api/agents \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "researcher",
    "model": "gpt-4",
    "systemPrompt": "You are a research assistant."
  }'

# 2. Execute the agent
curl -X POST http://localhost:3001/api/agents/agent-uuid/execute \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "topic": "AI market analysis"
    }
  }'

# 3. Get execution details
curl http://localhost:3001/api/executions/exec-uuid \
  -H "X-API-Key: your-api-key"

# 4. Get logs
curl "http://localhost:3001/api/logs?executionId=exec-uuid" \
  -H "X-API-Key: your-api-key"
```

---

**Last Updated**: 2025-11-26  
**Version**: 0.1.0  
**Maintainer**: Aethermind Team
