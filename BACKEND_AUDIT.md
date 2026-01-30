# 🔍 AUDITORÍA DE ARQUITECTURA BACKEND - Aethermind AgentOS

**Fecha:** 2026-01-23
**Auditor:** Antigravity AI Assistant
**Versión del proyecto:** 0.1.0

---

## 📋 RESUMEN EJECUTIVO

| Componente        | Estado           | Comentario                                                |
| ----------------- | ---------------- | --------------------------------------------------------- |
| ✅ **SDK**        | **PUBLICADO**    | `@aethermind/agent@0.1.2` en NPM (3 versiones, 3 semanas) |
| ✅ **Telemetría** | **FUNCIONAL**    | `POST /v1/ingest` implementado con batching               |
| ✅ **API Keys**   | **AUTOMÁTICAS**  | Generadas al signup con prefijo `aethermind_`             |
| ✅ **Onboarding** | **IMPLEMENTADO** | Endpoints `/api/onboarding/*` con tracking de steps       |
| ✅ **Demo data**  | **DISPONIBLE**   | Mock data en dashboard para demos offline                 |
| ✅ **Pricing**    | **IMPLEMENTADO** | Archivo centralizado con OpenAI, Anthropic, Ollama        |

---

## SECCIÓN 1: SDK Y TELEMETRÍA 📦

### 1.1 Estado del SDK ✅ EXISTE Y ESTÁ PUBLICADO

**npm view @aethermind/agent:**

```
@aethermind/agent@0.1.2 | MIT | deps: 1 | versions: 3
Lightweight SDK for monitoring AI API costs with Aethermind
https://aethermind.io

keywords: openai, anthropic, ai, monitoring, cost-tracking, telemetry, llm,
          observability, finops

dependencies: zod: ^3.23.0
maintainers: gonzacba17 <gonzacordoba015@gmail.com>
published: 3 weeks ago
```

**Ubicación en monorepo:** `packages/agent/`

**Estructura del SDK:**

```
packages/agent/
├── src/
│   ├── config/index.ts       # initAethermind(), configuración global
│   ├── interceptors/         # OpenAI y Anthropic interceptors
│   ├── transport/
│   │   ├── BatchTransport.ts # Batching de eventos (50 eventos o 30s)
│   │   └── types.ts          # TelemetryEvent schema
│   └── utils/retry.ts        # Retry con exponential backoff
├── package.json              # versión 0.1.2, ESM
└── README.md                 # Documentación de uso
```

**Características del SDK:**

- ✅ Interceptores automáticos para OpenAI y Anthropic
- ✅ Batching configurable (default: 50 eventos o 30s)
- ✅ Retry con exponential backoff (3 intentos, 1s → 10s)
- ✅ Graceful shutdown (flush en SIGINT/SIGTERM)
- ✅ Schema validado con Zod

---

### 1.2 Endpoint de Telemetría ✅ EXISTE Y FUNCIONAL

**Ruta:** `POST /v1/ingest`
**Archivo:** `apps/api/src/routes/ingestion.ts`

**Autenticación:**

- Header: `X-API-Key`
- Middleware: `apiKeyAuthCached` (con cache de 5 minutos)
- Prefijo requerido: `aether_`

**Rate Limiting:** ✅ Implementado

- FREE: 100 eventos/min
- STARTUP: 1000 eventos/min
- ENTERPRISE: 10000 eventos/min (configurable)

**Schema del Payload:**

```typescript
// POST /v1/ingest
{
  "events": [
    {
      "timestamp": "2026-01-23T12:00:00Z",  // ISO 8601
      "provider": "openai" | "anthropic",
      "model": "gpt-4o",
      "tokens": {
        "promptTokens": 1000,
        "completionTokens": 500,
        "totalTokens": 1500
      },
      "cost": 0.0325,          // USD calculado en cliente
      "latency": 2500,         // ms
      "status": "success" | "error",
      "error": "optional error message"
    }
  ]  // max 1000 eventos por request
}

// Respuesta: 202 Accepted (procesamiento async)
{
  "accepted": 50,
  "message": "Events queued for processing"
}
```

**Procesamiento:**

- ✅ Async con `setImmediate()` (no bloquea respuesta)
- ✅ Bulk insert con `onConflictDoNothing()`
- ⚠️ Sin dead letter queue (eventos perdidos en fallo)

---

### 1.3 Procesamiento de Eventos ✅ IMPLEMENTADO

**Tabla:** `telemetry_events` (PostgreSQL via Drizzle ORM)

**Schema completo:**

```typescript
// apps/api/src/db/schema.ts
export const telemetryEvents = pgTable("telemetry_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  model: varchar("model", { length: 255 }).notNull(),
  promptTokens: integer("prompt_tokens").notNull(),
  completionTokens: integer("completion_tokens").notNull(),
  totalTokens: integer("total_tokens").notNull(),
  cost: decimal("cost", { precision: 10, scale: 6 }).notNull(),
  latency: integer("latency").notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ÍNDICES para queries eficientes:
idx_telemetry_org_time; // (organizationId, timestamp)
idx_telemetry_provider_model; // (provider, model)
idx_telemetry_status; // (status)
idx_telemetry_created_at; // (createdAt)
```

---

## SECCIÓN 2: AUTENTICACIÓN Y ONBOARDING 🔐

### 2.1 Flujo de Registro ✅ COMPLETO

**Endpoint:** `POST /auth/signup`
**Archivo:** `apps/api/src/routes/auth.ts`

**Flujo detallado:**

```
POST /auth/signup { email, password }
  ↓
1. ✅ Validar email/password (min 8 chars)
2. ✅ Verificar usuario no existe
3. ✅ Hash password con bcrypt(10)
4. ✅ Generar API key: `aethermind_${randomBytes(32).hex()}`
5. ✅ Generar verification token (24h expiry)
6. ✅ INSERT en tabla users con:
   - plan: 'free'
   - usageLimit: 100
   - hasCompletedOnboarding: false
   - onboardingStep: 'welcome'
   - subscriptionStatus: 'free'
   - maxAgents: 3
   - logRetentionDays: 30
7. ✅ Enviar email de verificación (async, non-blocking)
8. ✅ Generar JWT (7 días)
9. ✅ Retornar { token, user: { id, email, plan, apiKey, emailVerified } }
```

**Campos de onboarding en tabla `users`:**

```typescript
hasCompletedOnboarding: boolean (default: false)
onboardingStep: varchar (default: 'welcome')
// Opciones válidas: 'welcome', 'profile_setup', 'preferences', 'complete', 'skipped'
```

---

### 2.2 Gestión de API Keys ✅ IMPLEMENTADO

**Tipos de API Keys:**

1. **API Key de Usuario (para autenticación en SDK):**
   - Tabla: `users.apiKey`
   - Formato: `aethermind_${randomBytes(32).hex()}`
   - Generada automáticamente en signup
   - **NO hasheada** (stored en plaintext para display al usuario)

2. **API Key de Organización (para telemetría):**
   - Tabla: `organizations.apiKeyHash`
   - Prefijo esperado: `aether_`
   - **Hasheada con bcrypt** para validación
   - Rate limit asociado por plan

3. **API Keys de Proveedores (OpenAI, Anthropic, etc):**
   - Tabla: `user_api_keys`
   - **Encriptadas con AES-256-CBC**
   - Validación automática con provider API

**Estructura de `user_api_keys`:**

```typescript
export const userApiKeys = pgTable("user_api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  provider: varchar("provider", { length: 50 }).notNull(), // openai, anthropic, etc
  name: varchar("name", { length: 100 }).notNull(), // User-friendly name
  encryptedKey: text("encrypted_key").notNull(), // AES-256 encrypted
  maskedKey: varchar("masked_key", { length: 20 }), // sk-...abc
  isValid: boolean("is_valid").default(true),
  lastValidated: timestamp("last_validated"),
  lastUsed: timestamp("last_used"),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Endpoints de gestión:**

- `GET /api/user/api-keys` - Listar keys (sin decrypt)
- `POST /api/user/api-keys` - Agregar key (valida con provider)
- `DELETE /api/user/api-keys/:id` - Eliminar key
- `POST /api/user/api-keys/:id/validate` - Revalidar key

---

### 2.3 Endpoint de Primera Conexión ⚠️ NO EXISTE DEDICADO

**Situación actual:**

- No existe `GET /health/sdk` o `/status/connected`
- Para detectar primer evento se puede usar `GET /api/costs?limit=1`

**Alternativas disponibles:**

1. `GET /health` - Health check general (no por usuario)
2. Query directo a `telemetry_events` con filtro por org + timestamp

**Índices disponibles para implementación:**

```sql
idx_telemetry_org_time (organizationId, timestamp)  -- Perfecto para "primer evento"
```

**Implementación sugerida:**

```typescript
// GET /api/telemetry/status
{
  "connected": true,
  "firstEventAt": "2026-01-23T12:00:00Z",
  "totalEvents": 1234,
  "lastEventAt": "2026-01-23T18:00:00Z"
}
```

---

## SECCIÓN 3: DATOS Y CÁLCULOS 💰

### 3.1 Cálculo de Costos ✅ IMPLEMENTADO

**Archivo:** `packages/core-shared/src/cost/pricing.ts`

**Precios por 1K tokens (actualizados Diciembre 2024):**

```typescript
// OPENAI
const OPENAI_MODEL_COSTS = {
  "gpt-4": { input: 0.03, output: 0.06 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
  "o1-preview": { input: 0.015, output: 0.06 },
  "o1-mini": { input: 0.003, output: 0.012 },
};

// ANTHROPIC
const ANTHROPIC_MODEL_COSTS = {
  "claude-3-5-sonnet-20241022": { input: 0.003, output: 0.015 },
  "claude-3-opus-20240229": { input: 0.015, output: 0.075 },
  "claude-3-haiku-20240307": { input: 0.00025, output: 0.00125 },
};

// OLLAMA (local, sin costo)
const OLLAMA_MODEL_COSTS = {
  llama2: { input: 0, output: 0 },
  llama3: { input: 0, output: 0 },
  mistral: { input: 0, output: 0 },
};
```

**Función de cálculo:**

```typescript
export function calculateCost(model: string, tokens: TokenUsage): number {
  const inputCost = (tokens.promptTokens / 1000) * costs.input;
  const outputCost = (tokens.completionTokens / 1000) * costs.output;
  return inputCost + outputCost;
}
```

**Actualización de precios:**

- ⚠️ Hardcoded en el código (no en DB)
- 💡 Requiere deploy para actualizar precios

---

### 3.2 Agregaciones para Dashboard ✅ IMPLEMENTADO

**Endpoints disponibles:**

1. **`GET /api/costs/summary`**

```json
{
  "total": 127.45,
  "totalTokens": 2540000,
  "executionCount": 156,
  "byModel": {
    "gpt-4": { "count": 45, "tokens": 890000, "cost": 62.3 },
    "gpt-4-turbo": { "count": 32, "tokens": 640000, "cost": 32.0 }
  }
}
```

2. **`GET /api/costs`** (con filtros)

```
?executionId=xxx
?model=gpt-4
?limit=10
?offset=0
```

3. **`GET /api/costs/budget`**

```json
{
  "limit": 1000,
  "spent": 450.75,
  "remaining": 549.25,
  "percentUsed": 45.075,
  "period": "monthly"
}
```

**Caching:**

- ✅ Redis caching implementado (60 segundos TTL)
- ⚠️ Redis deshabilitado por defecto (usando in-memory fallback)

**Pre-agregaciones:**

- ❌ No hay tablas pre-agregadas (on-the-fly calculation)
- 💡 Para alto volumen, considerar materialized views

---

## SECCIÓN 4: DEMO Y DATOS FAKE 🎭

### 4.1 Generación de Datos de Prueba ✅ DISPONIBLE

**Archivo:** `packages/dashboard/src/lib/mock-data.ts`

**Datos mock disponibles:**

```typescript
// MOCK_AGENTS (4 agentes)
[
  { id: 'agent-1', name: 'Research Assistant', model: 'gpt-4', status: 'idle' },
  { id: 'agent-2', name: 'Code Reviewer', model: 'gpt-4-turbo', status: 'running' },
  { id: 'agent-3', name: 'Content Writer', model: 'gpt-3.5-turbo', status: 'completed' },
  { id: 'agent-4', name: 'Data Analyzer', model: 'claude-3-sonnet', status: 'idle' },
]

// MOCK_TRACES (3 traces con árbol de ejecución)
// MOCK_LOGS (5 entradas: info, debug, warn, error)

// MOCK_COST_SUMMARY
{
  total: 127.45,
  totalTokens: 2540000,
  executionCount: 156,
  byModel: {
    'gpt-4': { count: 45, tokens: 890000, cost: 62.30 },
    'gpt-4-turbo': { count: 32, tokens: 640000, cost: 32.00 },
    'gpt-3.5-turbo': { count: 67, tokens: 820000, cost: 24.60 },
    'claude-3-sonnet': { count: 12, tokens: 190000, cost: 8.55 },
  },
}

// MOCK_COST_HISTORY (3 registros de costo)
```

**Activación:**

```typescript
// Se usa automáticamente cuando NEXT_PUBLIC_API_URL no está configurado
export function shouldUseMockData(): boolean {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  return !apiUrl || apiUrl.trim() === "" || apiUrl === "undefined";
}
```

**Seed Script:**

- ⚠️ **NO EXISTE** `db:seed` script funcional
- La documentación menciona `pnpm db:seed` pero no hay implementación

---

## SECCIÓN 5: PERFORMANCE Y ESCALA 📊

### 5.1 Volumen de Datos Esperado

**Rate Limiting actual:**

| Plan       | Eventos/min | Eventos/hora | Eventos/día |
| ---------- | ----------- | ------------ | ----------- |
| FREE       | 100         | 6,000        | 144,000     |
| STARTUP    | 1,000       | 60,000       | 1,440,000   |
| ENTERPRISE | 10,000      | 600,000      | 14,400,000  |

**Batching:**

- SDK: 50 eventos máximo por request
- API: 1000 eventos máximo por request

**Capacidad de insert:**

- ✅ Bulk insert con Drizzle ORM (`onConflictDoNothing()`)
- ⚠️ Sin particionamiento de tabla
- ⚠️ Sin archivado automático de datos antiguos

**Proyección para 100 clientes (FREE plan):**

```
100 clientes × 144,000 eventos/día = 14.4M eventos/día
14.4M × 30 días = 432M eventos/mes

Tamaño estimado por evento: ~200 bytes
432M × 200 bytes = ~86.4 GB/mes

⚠️ Se requiere particionamiento y archivado para este volumen
```

**Rate Limiter:**

- ✅ Implementado en memoria (Map)
- ⚠️ No distribuido (cada instancia tiene su propio contador)
- 💡 Para multi-instancia, migrar a Redis

---

## 📊 ANÁLISIS DE GAPS

### ❌ GAPS CRÍTICOS (P0)

| Gap                     | Descripción                                                          | Impacto                                                  | Esfuerzo |
| ----------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- | -------- |
| **Endpoint SDK Status** | No existe `GET /api/telemetry/status` para detectar primera conexión | Onboarding wizard no puede mostrar "Waiting for data..." | 4 horas  |
| **Seed Script**         | No hay script para generar datos de demo en DB                       | Demos sin datos reales requieren más setup               | 1 día    |

### ⚠️ GAPS IMPORTANTES (P1)

| Gap                          | Descripción                                         | Impacto                        | Esfuerzo |
| ---------------------------- | --------------------------------------------------- | ------------------------------ | -------- |
| **Dead Letter Queue**        | Eventos perdidos en fallos de ingestion             | Pérdida de datos en errores    | 2 días   |
| **Rate Limiter Distribuido** | Rate limiter en memoria no funciona multi-instancia | Límites incorrectos en scaling | 1 día    |
| **Tabla Pricing en DB**      | Precios hardcoded requieren deploy para actualizar  | Demora en actualizar precios   | 1 día    |
| **Particionamiento**         | Tabla `telemetry_events` sin particiones            | Performance degradada a escala | 2 días   |

### 💡 NICE TO HAVE (P2)

| Gap                  | Descripción                                  | Impacto                                  | Esfuerzo |
| -------------------- | -------------------------------------------- | ---------------------------------------- | -------- |
| WebSocket real-time  | No hay notificación push para nuevos eventos | Dashboard no se actualiza en tiempo real | 2 días   |
| Pre-agregaciones     | Cálculos on-the-fly pueden ser lentos        | Dashboard lento con muchos datos         | 3 días   |
| Archivado automático | No hay cleanup de datos antiguos             | Crecimiento ilimitado de storage         | 2 días   |

---

## 📋 ESTIMACIÓN DE ESFUERZO

| Feature                             | Esfuerzo | Prioridad | Dependencias      |
| ----------------------------------- | -------- | --------- | ----------------- |
| `GET /api/telemetry/status`         | 4 horas  | P0        | Ninguna           |
| Seed script con datos realistas     | 1 día    | P0        | Ninguna           |
| Dead Letter Queue con Redis         | 2 días   | P1        | Redis configurado |
| Rate limiter distribuido (Redis)    | 1 día    | P1        | Redis configurado |
| Tabla `model_pricing` en DB         | 1 día    | P1        | Migración Drizzle |
| Particionamiento `telemetry_events` | 2 días   | P1        | Migración DB      |
| WebSocket para eventos real-time    | 2 días   | P2        | Ninguna           |
| Materialized views para análisis    | 3 días   | P2        | Ninguna           |

---

## 🚀 RECOMENDACIONES

### INMEDIATO (Esta semana)

1. **Implementar `GET /api/telemetry/status`**

   ```typescript
   // apps/api/src/routes/ingestion.ts
   router.get("/status", apiKeyAuthCached, async (req, res) => {
     const { organizationId } = req;
     const [firstEvent] = await db
       .select()
       .from(telemetryEvents)
       .where(eq(telemetryEvents.organizationId, organizationId))
       .orderBy(telemetryEvents.timestamp)
       .limit(1);

     return res.json({
       connected: !!firstEvent,
       firstEventAt: firstEvent?.timestamp || null,
       // Opcional: contar total
     });
   });
   ```

2. **Crear seed script para demos**
   ```bash
   pnpm tsx scripts/db/seed-demo-data.ts
   ```

### CORTO PLAZO (2-4 semanas)

3. **Migrar rate limiter a Redis** (si se escala a múltiples instancias)

4. **Implementar tabla de precios dinámica**

   ```sql
   CREATE TABLE model_pricing (
     id UUID PRIMARY KEY,
     provider VARCHAR(50),
     model VARCHAR(255),
     input_cost_per_1k DECIMAL(10, 6),
     output_cost_per_1k DECIMAL(10, 6),
     effective_from TIMESTAMP,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

5. **Agregar particionamiento por fecha a `telemetry_events`**
   ```sql
   -- Partición mensual
   CREATE TABLE telemetry_events_2026_01 PARTITION OF telemetry_events
   FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
   ```

### LARGO PLAZO (1-3 meses)

6. **Dead Letter Queue** para eventos fallidos
7. **Materialized views** para reportes pesados
8. **Archivado automático** a cold storage (S3/GCS)

---

## ✅ CONCLUSIÓN

El backend de Aethermind AgentOS está **80% listo** para el flujo SaaS propuesto:

| Área              | Estado      | Comentario                                  |
| ----------------- | ----------- | ------------------------------------------- |
| **SDK**           | ✅ Listo    | Publicado en NPM, funcionando               |
| **Ingestion API** | ✅ Listo    | Con batching, rate limiting, auth           |
| **Auth/Signup**   | ✅ Listo    | API keys automáticas, onboarding tracking   |
| **Pricing**       | ✅ Listo    | Pero hardcoded                              |
| **Analytics**     | ✅ Básico   | Falta endpoint de status                    |
| **Demo Data**     | ⚠️ Parcial  | Mock data existe, falta seed script         |
| **Escala**        | ⚠️ Limitada | Necesita particionamiento para alto volumen |

**El flujo de onboarding propuesto es viable** con los gaps menores identificados.

---

_Generado automáticamente por Antigravity AI_
_Última actualización: 2026-01-23 18:21:43 -03:00_
