# 🔌 API Endpoints Specification

> **Versión:** 1.0.0  
> **Última actualización:** 2026-01-19  
> **Base URL:** `https://api.aethermind.io` o `http://localhost:3001`

---

## Autenticación

Todos los endpoints (excepto `/health` y `/auth/*`) requieren autenticación via JWT Bearer token.

```http
Authorization: Bearer <jwt_token>
```

---

## Endpoints Existentes ✅

### Agents

#### `GET /api/agents`

Lista todos los agentes del usuario.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| offset | number | 0 | Offset para paginación |
| limit | number | 20 | Límite de resultados |
| search | string | - | Búsqueda por nombre |
| status | string | - | Filtrar por status (active, idle, error) |
| model | string | - | Filtrar por modelo |

**Response:**

```json
{
  "data": [
    {
      "id": "agent-001",
      "name": "Customer Support Agent",
      "model": "gpt-4",
      "status": "active",
      "config": {
        "name": "Customer Support Agent",
        "model": "gpt-4",
        "systemPrompt": "You are a helpful assistant...",
        "temperature": 0.7,
        "maxTokens": 2048
      },
      "createdAt": "2026-01-15T10:30:00Z",
      "updatedAt": "2026-01-19T12:00:00Z"
    }
  ],
  "total": 15,
  "offset": 0,
  "limit": 20,
  "hasMore": false
}
```

#### `GET /api/agents/:id`

Obtiene detalle de un agente específico.

**Response:**

```json
{
  "id": "agent-001",
  "name": "Customer Support Agent",
  "model": "gpt-4",
  "status": "active",
  "config": { ... },
  "state": {
    "executionCount": 1247,
    "lastExecutionAt": "2026-01-19T12:00:00Z",
    "totalTokensUsed": 1500000,
    "totalCost": 45.23
  }
}
```

#### `POST /api/agents`

Crea un nuevo agente.

**Request Body:**

```json
{
  "name": "New Agent",
  "model": "gpt-4",
  "systemPrompt": "You are a helpful assistant...",
  "temperature": 0.7,
  "maxTokens": 2048,
  "description": "Optional description",
  "tags": ["support", "customer"]
}
```

#### `DELETE /api/agents/:id`

Elimina un agente.

**Response:** `204 No Content`

#### `POST /api/agents/:id/execute`

Ejecuta un agente con entrada específica.

**Request Body:**

```json
{
  "input": "User message or task"
}
```

**Response:**

```json
{
  "executionId": "exec-123",
  "agentId": "agent-001",
  "status": "completed",
  "output": { ... },
  "startedAt": "2026-01-19T12:00:00Z",
  "completedAt": "2026-01-19T12:00:01Z",
  "duration": 1234
}
```

---

### Traces

#### `GET /api/traces`

Lista todas las trazas.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| offset | number | 0 | Offset para paginación |
| limit | number | 20 | Límite de resultados |
| status | string | - | Filtrar por status |
| agentId | string | - | Filtrar por agente |
| from | string | - | Fecha inicio (ISO) |
| to | string | - | Fecha fin (ISO) |

#### `GET /api/traces/:id`

Obtiene detalle de una traza.

**Response:**

```json
{
  "id": "trace-001",
  "executionId": "exec-123",
  "rootNode": {
    "id": "node-1",
    "name": "Root",
    "type": "workflow",
    "startedAt": "2026-01-19T12:00:00Z",
    "completedAt": "2026-01-19T12:00:01Z",
    "duration": 1234,
    "children": [
      {
        "id": "node-2",
        "name": "Parse Input",
        "type": "agent",
        "input": { ... },
        "output": { ... },
        "children": []
      }
    ]
  },
  "createdAt": "2026-01-19T12:00:00Z"
}
```

---

### Logs

#### `GET /api/logs`

Lista logs del sistema.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| level | string | - | Filtrar por nivel (debug, info, warn, error) |
| agentId | string | - | Filtrar por agente |
| executionId | string | - | Filtrar por ejecución |
| search | string | - | Búsqueda en mensaje |
| from | string | - | Fecha inicio (ISO) |
| to | string | - | Fecha fin (ISO) |
| limit | number | 100 | Límite de resultados |
| offset | number | 0 | Offset para paginación |

**Response:**

```json
{
  "logs": [
    {
      "id": "log-001",
      "timestamp": "2026-01-19T12:00:00.123Z",
      "level": "info",
      "message": "Agent started processing request",
      "agentId": "agent-001",
      "executionId": "exec-123",
      "metadata": {
        "requestId": "req-456",
        "userId": "user-789"
      }
    }
  ],
  "total": 1000
}
```

---

### Costs

#### `GET /api/costs`

Lista costos con filtros.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| executionId | string | - | Filtrar por ejecución |
| model | string | - | Filtrar por modelo |
| from | string | - | Fecha inicio (ISO) |
| to | string | - | Fecha fin (ISO) |
| limit | number | 100 | Límite |
| offset | number | 0 | Offset |

#### `GET /api/costs/summary`

Resumen de costos.

**Response:**

```json
{
  "total": 426.9,
  "totalTokens": 4640000,
  "executionCount": 12847,
  "byModel": {
    "gpt-4": { "count": 5000, "tokens": 2000000, "cost": 234.5 },
    "claude-3": { "count": 3000, "tokens": 1500000, "cost": 156.2 },
    "gpt-3.5-turbo": { "count": 4000, "tokens": 1000000, "cost": 23.4 }
  }
}
```

#### `GET /api/costs/budget`

Estado del presupuesto del usuario.

**Response:**

```json
{
  "limit": 1000,
  "spent": 426.9,
  "remaining": 573.1,
  "percentUsed": 42.69,
  "period": "monthly"
}
```

---

### Budgets

#### `GET /api/budgets`

Lista presupuestos configurados.

#### `POST /api/budgets`

Crea un nuevo presupuesto.

**Request Body:**

```json
{
  "name": "Monthly Budget",
  "limitAmount": 1000,
  "period": "monthly",
  "scope": "user",
  "alertThresholds": [50, 80, 95]
}
```

---

### Health

#### `GET /health`

Estado del sistema (público, sin auth).

**Response:**

```json
{
  "status": "healthy",
  "version": "0.1.0",
  "timestamp": "2026-01-19T12:00:00Z",
  "uptime": 86400,
  "checks": {
    "database": true,
    "redis": true,
    "stripe": true,
    "email": false
  },
  "details": {
    "storage": "drizzle",
    "queue": "disabled",
    "database": "connected",
    "databaseLatencyMs": 5
  }
}
```

---

## Endpoints Necesarios (Por Implementar) 🔴

### Agents (Mejoras)

#### `PATCH /api/agents/:id`

Actualiza un agente existente.

**Request Body:**

```json
{
  "name": "Updated Name",
  "systemPrompt": "Updated prompt...",
  "temperature": 0.8
}
```

**Response:**

```json
{
  "id": "agent-001",
  "name": "Updated Name",
  "model": "gpt-4",
  "status": "active",
  "config": { ... },
  "updatedAt": "2026-01-19T13:00:00Z"
}
```

#### `PATCH /api/agents/:id/status`

Cambia el estado de un agente (pausar/reanudar).

**Request Body:**

```json
{
  "status": "paused"
}
```

---

### Metrics (Nuevo)

#### `GET /api/metrics/current`

Métricas en tiempo real para el dashboard.

**Response:**

```json
{
  "activeAgents": 12,
  "totalExecutions24h": 4567,
  "currentCostToday": 45.2,
  "avgResponseTime": 1.23,
  "errorRate": 1.5,
  "tokensUsed24h": 1500000,
  "tracesRunning": 3,
  "timestamp": "2026-01-19T12:00:00Z"
}
```

---

### Traces (Mejoras)

#### `POST /api/traces/export`

Exporta trazas filtradas.

**Request Body:**

```json
{
  "format": "csv",
  "filters": {
    "status": "success",
    "from": "2026-01-01T00:00:00Z",
    "to": "2026-01-19T23:59:59Z"
  }
}
```

**Response:** Archivo CSV/JSON como blob

---

### Logs (Mejoras)

#### `POST /api/logs/export`

Exporta logs filtrados.

**Request Body:**

```json
{
  "format": "csv",
  "filters": {
    "level": ["error", "warning"],
    "from": "2026-01-19T00:00:00Z"
  }
}
```

---

### Costs (Mejoras)

#### `GET /api/costs/daily`

Desglose diario de costos.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| from | string | 7 días atrás | Fecha inicio |
| to | string | hoy | Fecha fin |

**Response:**

```json
{
  "daily": [
    {
      "date": "2026-01-19",
      "cost": 45.2,
      "tokens": 125000,
      "executions": 234,
      "byModel": {
        "gpt-4": 30.0,
        "claude-3": 15.2
      }
    }
  ]
}
```

#### `GET /api/costs/prediction`

Predicción de costos para fin de mes.

**Response:**

```json
{
  "projectedMonthEnd": 847.5,
  "confidence": 85,
  "confidenceRange": {
    "low": 720.0,
    "high": 975.0
  },
  "trend": "increasing",
  "trendPercentage": 15.3,
  "basedOnDays": 19,
  "warning": "Projected to exceed budget by 15%"
}
```

#### `POST /api/costs/export`

Exporta reporte de costos.

**Request Body:**

```json
{
  "format": "pdf",
  "period": {
    "from": "2026-01-01T00:00:00Z",
    "to": "2026-01-19T23:59:59Z"
  },
  "includeCharts": true
}
```

---

### Recommendations (Nuevo)

#### `GET /api/recommendations`

Obtiene recomendaciones de optimización.

**Response:**

```json
{
  "recommendations": [
    {
      "id": "rec-001",
      "type": "model_switch",
      "title": "Consider GPT-3.5 for 'Customer Support Agent'",
      "description": "This agent handles simple tasks...",
      "estimatedSavings": {
        "monthly": 150.0,
        "percentage": 85
      },
      "effort": "low",
      "affectedAgents": ["agent-001"],
      "actionable": true,
      "action": {
        "type": "auto",
        "endpoint": "/api/agents/agent-001/switch-model"
      }
    }
  ],
  "totalPotentialSavings": 250.0
}
```

---

### Alerts (Nuevo)

#### `GET /api/alerts`

Lista alertas configuradas.

**Response:**

```json
{
  "alerts": [
    {
      "id": "alert-001",
      "name": "Daily Cost Threshold",
      "type": "cost_threshold",
      "condition": {
        "metric": "daily_cost",
        "operator": "gt",
        "value": 50,
        "period": "daily"
      },
      "notifications": {
        "email": true,
        "slack": true,
        "webhook": null
      },
      "enabled": true,
      "lastTriggered": "2026-01-16T08:00:00Z",
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

#### `POST /api/alerts`

Crea una nueva alerta.

#### `PATCH /api/alerts/:id`

Actualiza una alerta.

#### `DELETE /api/alerts/:id`

Elimina una alerta.

---

## WebSocket Events

### Conexión

```javascript
const ws = new WebSocket("wss://api.aethermind.io/ws");

// Autenticación después de conectar
ws.onopen = () => {
  ws.send(JSON.stringify({ type: "auth", token: "jwt-token" }));
};
```

### Eventos Disponibles

| Event             | Descripción                            | Payload                                  |
| ----------------- | -------------------------------------- | ---------------------------------------- |
| `agent:event`     | Evento de agente (status change, etc.) | `{ agentId, event, data }`               |
| `log`             | Nuevo log                              | `{ id, timestamp, level, message, ... }` |
| `trace:new`       | Nueva traza iniciada                   | `{ traceId, agentId, ... }`              |
| `trace:update`    | Actualización de traza                 | `{ traceId, status, ... }`               |
| `cost:update`     | Actualización de costos                | `{ executionId, cost, tokens }`          |
| `metrics:update`  | Métricas actualizadas                  | `{ activeAgents, ... }`                  |
| `alert:triggered` | Alerta disparada                       | `{ alertId, condition, value }`          |

### Ejemplo de Mensaje

```json
{
  "type": "log",
  "data": {
    "id": "log-123",
    "timestamp": "2026-01-19T12:00:00.123Z",
    "level": "info",
    "message": "Agent completed task",
    "agentId": "agent-001",
    "executionId": "exec-456"
  }
}
```

---

## Códigos de Error

| Code | Nombre                | Descripción                      |
| ---- | --------------------- | -------------------------------- |
| 400  | Bad Request           | Parámetros inválidos             |
| 401  | Unauthorized          | Token inválido o expirado        |
| 403  | Forbidden             | Sin permisos para el recurso     |
| 404  | Not Found             | Recurso no encontrado            |
| 409  | Conflict              | Conflicto (ej: nombre duplicado) |
| 422  | Unprocessable Entity  | Validación fallida               |
| 429  | Too Many Requests     | Rate limit excedido              |
| 500  | Internal Server Error | Error del servidor               |

### Formato de Error

```json
{
  "error": "Validation Error",
  "message": "Field 'name' is required",
  "code": "VALIDATION_FAILED",
  "details": {
    "field": "name",
    "constraint": "required"
  }
}
```

---

## Rate Limiting

| Endpoint                  | Límite  | Ventana |
| ------------------------- | ------- | ------- |
| General                   | 100 req | 15 min  |
| `/api/agents/:id/execute` | 60 req  | 1 min   |
| `/api/*/export`           | 10 req  | 1 hora  |
| WebSocket                 | 100 msg | 1 min   |

Headers de respuesta:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705669200
```

---

## Versionado

La API usa versionado en el path para cambios breaking:

- `/api/v1/agents` - Versión actual
- `/api/v2/agents` - Próxima versión (cuando aplique)

Para mantener compatibilidad, las nuevas features se agregan a la versión actual sin romper contratos existentes.
