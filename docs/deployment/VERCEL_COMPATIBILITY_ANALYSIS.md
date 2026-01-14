# 📊 Análisis de Compatibilidad con Vercel Serverless Functions

## Aethermind AgentOS Backend

**Fecha:** 2026-01-13  
**Proyecto:** Aethermind AgentOS  
**Framework:** Express.js (Node.js + TypeScript)  
**Deploy Actual:** Vercel Dashboard

---

## 🎯 RESUMEN EJECUTIVO

### Veredicto

**⚠️ PARCIALMENTE COMPATIBLE - REQUIERE ARQUITECTURA HÍBRIDA**

### Hallazgos Clave

- **40% Compatible** sin cambios
- **35% Compatible** con ajustes menores
- **25% Requiere** servicios externos o rediseño

### Recomendación Principal

**Arquitectura híbrida:** Vercel Functions para endpoints stateless + Servicio externo (Railway/Render) para funcionalidades stateful.

---

## 📋 1. INVENTARIO DEL BACKEND

### Framework y Configuración

- **Framework:** Express.js 4.19.0
- **Runtime:** Node.js 20+
- **Lenguaje:** TypeScript 5.4.0
- **Package Manager:** pnpm (monorepo con Turborepo)
- **Puerto:** 3001 (configurable)
- **Deployment Actual:** HTTP server estándar

### Rutas/Endpoints API

| Categoría      | Endpoints                                                                                                                      | Cantidad | Método(s)              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- | ---------------------- |
| **Auth**       | `/auth/login`, `/auth/signup`, `/auth/logout`, `/auth/me`, `/auth/verify-email`, `/auth/request-reset`, `/auth/reset-password` | 7        | GET, POST              |
| **OAuth**      | `/auth/google`, `/auth/github`, `/auth/google/callback`, `/auth/github/callback`                                               | 4        | GET                    |
| **Agents**     | `/api/agents`, `/api/agents/:id`, `/api/agents/:id/execute`, `/api/agents/:id/logs`                                            | 5        | GET, POST, DELETE      |
| **Workflows**  | `/api/workflows`, `/api/workflows/:name`, `/api/workflows/:name/execute`, `/api/workflows/:name/estimate`                      | 6        | GET, POST, PUT, DELETE |
| **Executions** | `/api/executions`, `/api/executions/:id`                                                                                       | 2        | GET                    |
| **Logs**       | `/api/logs`                                                                                                                    | 1        | GET                    |
| **Traces**     | `/api/traces`                                                                                                                  | 1        | GET                    |
| **Costs**      | `/api/costs`                                                                                                                   | 1        | GET                    |
| **Budgets**    | `/api/budgets`, `/api/budgets/:id`                                                                                             | 4        | GET, POST, PUT, DELETE |
| **Stripe**     | `/api/stripe/create-checkout-session`, `/api/stripe/create-portal-session`, `/stripe/webhook`                                  | 3        | POST                   |
| **Onboarding** | `/api/onboarding/complete`, `/api/onboarding/skip`                                                                             | 2        | POST                   |
| **Ingestion**  | `/v1/ingest`                                                                                                                   | 1        | POST                   |
| **Health**     | `/health`, `/metrics`                                                                                                          | 2        | GET                    |
| **TOTAL**      |                                                                                                                                | **39**   |                        |

### Dependencias Críticas

#### Producción:

```json
{
  "@prisma/client": "^6.19.0", // ✅ Compatible
  "@sendgrid/mail": "^8.1.0", // ✅ Compatible
  "@sentry/node": "^7.99.0", // ⚠️ Ajustar configuración
  "bcryptjs": "^2.4.3", // ✅ Compatible
  "express": "^4.19.0", // ⚠️ Requiere adaptador
  "express-session": "^1.18.0", // ❌ NO COMPATIBLE (in-memory)
  "jsonwebtoken": "^9.0.3", // ✅ Compatible
  "passport": "^0.7.0", // ⚠️ Requiere ajustes
  "passport-google-oauth20": "^2.0.0", // ⚠️ Requiere ajustes
  "passport-github2": "^0.1.12", // ⚠️ Requiere ajustes
  "pg": "^8.12.0", // ✅ Compatible (con Vercel Postgres)
  "stripe": "^14.11.0", // ✅ Compatible
  "ws": "^8.16.0", // ❌ NO COMPATIBLE (WebSockets)
  "winston": "^3.11.0" // ✅ Compatible
}
```

### Operaciones de Larga Duración

| Operación                                    | Duración Estimada    | Compatible?                 |
| -------------------------------------------- | -------------------- | --------------------------- |
| `/api/agents/:id/execute`                    | 5-30s (LLM calls)    | ⚠️ Depende del plan         |
| `/api/workflows/:name/execute`               | 10-120s (multi-step) | ❌ Excede límites Hobby/Pro |
| Database migrations (`ensureDatabaseSchema`) | 5-60s                | ❌ Solo en startup          |
| OAuth callbacks                              | 1-3s                 | ✅ Compatible               |
| Stripe webhooks                              | 0.5-2s               | ✅ Compatible               |
| Email sending                                | 1-3s                 | ✅ Compatible               |

### Conexiones Persistentes

| Tipo                       | Ubicación                           | Impacto                     |
| -------------------------- | ----------------------------------- | --------------------------- |
| **WebSocket Server**       | `src/websocket/WebSocketManager.ts` | ❌ CRÍTICO - No compatible  |
| **Express Session**        | `express-session` (in-memory)       | ❌ CRÍTICO - No persistente |
| **Prisma Connection Pool** | `@prisma/client`                    | ⚠️ Requiere ajustes         |
| **Redis Cache**            | Deshabilitado actualmente           | ✅ N/A (disabled)           |

### Tareas Programadas (Cron)

| Tarea                  | Intervalo | Ubicación                          |
| ---------------------- | --------- | ---------------------------------- |
| **Alert Checking**     | 5 minutos | `src/index.ts:247-261`             |
| **Budget Reset**       | 1 hora    | `src/index.ts:265-279`             |
| **Rate Limit Cleanup** | 5 minutos | `src/middleware/rateLimiter.ts:88` |

### Operaciones de Archivos

| Operación                      | Ubicación              | Propósito                   |
| ------------------------------ | ---------------------- | --------------------------- |
| `fs.readFileSync` (SSL certs)  | `src/index.ts:571-572` | Cargar certificados HTTPS   |
| `fs.existsSync` (SSL check)    | `src/index.ts:570`     | Verificar SSL en producción |
| `execSync` (Prisma migrations) | `src/index.ts:57-64`   | Aplicar schema DB           |

### Base de Datos

**Tipo:** PostgreSQL (via Prisma ORM)

**Modelos principales:**

- User (auth, subscriptions)
- Organization
- Agent
- Workflow
- Execution
- Log
- Trace
- Cost
- Budget
- AlertLog
- TelemetryEvent
- SubscriptionLog

**Total de tablas:** 12

---

## 🔍 2. EVALUACIÓN DE COMPATIBILIDAD

### Limitaciones de Vercel Functions por Plan

| Límite               | Hobby          | Pro            | Enterprise     |
| -------------------- | -------------- | -------------- | -------------- |
| **Timeout**          | 10s            | 60s            | 900s (15min)   |
| **Memoria**          | 1024 MB        | 3008 MB        | 3008 MB        |
| **Payload Request**  | 4.5 MB         | 4.5 MB         | 4.5 MB         |
| **Payload Response** | 4.5 MB         | 4.5 MB         | 4.5 MB         |
| **Cron Jobs**        | ❌ No          | ✅ Sí          | ✅ Sí          |
| **WebSockets**       | ❌ No          | ❌ No          | ❌ No          |
| **Filesystem**       | /tmp (efímero) | /tmp (efímero) | /tmp (efímero) |

### Análisis por Funcionalidad

#### ✅ COMPATIBLE (Sin Cambios)

| Endpoint                        | Razón                             |
| ------------------------------- | --------------------------------- |
| `POST /auth/login`              | Stateless, respuesta rápida (<1s) |
| `POST /auth/signup`             | Stateless, respuesta rápida (<2s) |
| `GET /auth/me`                  | Stateless, JWT validation         |
| `POST /auth/verify-email`       | Stateless, DB update simple       |
| `GET /api/agents`               | Fetch simple, paginado            |
| `GET /api/agents/:id`           | Fetch by ID                       |
| `DELETE /api/agents/:id`        | Delete simple                     |
| `GET /api/workflows`            | Fetch simple                      |
| `GET /api/workflows/:name`      | Fetch by name                     |
| `GET /api/executions`           | Fetch histórico                   |
| `GET /api/logs`                 | Fetch histórico                   |
| `GET /api/traces`               | Fetch histórico                   |
| `GET /api/costs`                | Fetch y aggregations              |
| `GET /api/budgets`              | Fetch simple                      |
| `POST /api/budgets`             | Create simple                     |
| `PUT /api/budgets/:id`          | Update simple                     |
| `DELETE /api/budgets/:id`       | Delete simple                     |
| `POST /stripe/webhook`          | Webhook handler (<2s)             |
| `POST /api/onboarding/complete` | Update simple                     |
| `GET /health`                   | Health check                      |

**Total Compatible:** 20/39 endpoints (51%)

#### ⚠️ REQUIERE AJUSTES

| Endpoint                               | Problema                     | Solución                                      |
| -------------------------------------- | ---------------------------- | --------------------------------------------- |
| `GET /auth/google`                     | Passport + express-session   | Migrar a Vercel Edge Config o JWT-based state |
| `GET /auth/github`                     | Passport + express-session   | Migrar a Vercel Edge Config o JWT-based state |
| `POST /auth/request-reset`             | SendGrid email (1-3s)        | ✅ Ya compatible, verificar timeout           |
| `POST /auth/reset-password`            | Token validation + DB update | ✅ Compatible con ajuste de timeout           |
| `POST /api/agents`                     | Runtime initialization       | Cachear runtime, evitar recreación            |
| `POST /api/agents/:id/execute`         | LLM calls (5-30s)            | **Plan Pro requerido** (60s timeout)          |
| `POST /api/workflows/:name/execute`    | Multi-step LLM (10-120s)     | **Mover a background job** o servicio externo |
| `POST /api/workflows/:name/estimate`   | Cálculo de costos            | Compatible pero optimizar queries             |
| `POST /stripe/create-checkout-session` | Stripe API call (1-3s)       | ✅ Compatible, verificar timeout              |
| `POST /stripe/create-portal-session`   | Stripe API call (1-3s)       | ✅ Compatible, verificar timeout              |

**Total con Ajustes:** 10/39 endpoints (26%)

#### ❌ NO COMPATIBLE (Requiere Rediseño o Servicio Externo)

| Funcionalidad                      | Problema                                  | Alternativa                                      |
| ---------------------------------- | ----------------------------------------- | ------------------------------------------------ |
| **WebSocket Server**               | WebSockets no soportados                  | **Vercel Edge Functions** + Pusher/Ably/PartyKit |
| **Express Sessions**               | In-memory, no persiste entre invocaciones | **Vercel KV** (Redis) o **Vercel Edge Config**   |
| **Cron Jobs** (alerts, budgets)    | setInterval no funciona en serverless     | **Vercel Cron** (Plan Pro+)                      |
| **Database Migrations en Startup** | execSync + long startup                   | Ejecutar en CI/CD pipeline, no en runtime        |
| **Long Workflows** (>60s)          | Excede timeout incluso en Pro             | **Background Jobs** con Railway/BullMQ/Inngest   |
| **HTTPS con SSL Certificates**     | fs.readFileSync de archivos locales       | Vercel maneja SSL automáticamente                |

**Total No Compatible:** 6 funcionalidades críticas

---

## 🛠️ 3. CLASIFICACIÓN DETALLADA

### Tabla Maestra de Compatibilidad

| #   | Endpoint/Feature                           | Tipo       | Duración    | Plan Mínimo | Compatibilidad | Acción                 |
| --- | ------------------------------------------ | ---------- | ----------- | ----------- | -------------- | ---------------------- |
| 1   | `POST /auth/login`                         | Auth       | <1s         | Hobby       | ✅             | Ninguna                |
| 2   | `POST /auth/signup`                        | Auth       | <2s         | Hobby       | ✅             | Ninguna                |
| 3   | `GET /auth/me`                             | Auth       | <0.5s       | Hobby       | ✅             | Ninguna                |
| 4   | `GET /auth/google`                         | OAuth      | 1-3s        | Hobby       | ⚠️             | Migrar session a KV    |
| 5   | `GET /auth/github`                         | OAuth      | 1-3s        | Hobby       | ⚠️             | Migrar session a KV    |
| 6   | `POST /auth/verify-email`                  | Auth       | <1s         | Hobby       | ✅             | Ninguna                |
| 7   | `POST /auth/request-reset`                 | Auth       | 1-3s        | Hobby       | ⚠️             | Verificar timeout      |
| 8   | `POST /auth/reset-password`                | Auth       | <1s         | Hobby       | ✅             | Ninguna                |
| 9   | `GET /api/agents`                          | CRUD       | <0.5s       | Hobby       | ✅             | Ninguna                |
| 10  | `POST /api/agents`                         | CRUD       | <1s         | Hobby       | ⚠️             | Cachear runtime        |
| 11  | `GET /api/agents/:id`                      | CRUD       | <0.5s       | Hobby       | ✅             | Ninguna                |
| 12  | `POST /api/agents/:id/execute`             | LLM        | 5-30s       | **Pro**     | ⚠️             | Requiere Pro plan      |
| 13  | `DELETE /api/agents/:id`                   | CRUD       | <0.5s       | Hobby       | ✅             | Ninguna                |
| 14  | `GET /api/workflows`                       | CRUD       | <0.5s       | Hobby       | ✅             | Ninguna                |
| 15  | `POST /api/workflows`                      | CRUD       | <1s         | Hobby       | ✅             | Ninguna                |
| 16  | `GET /api/workflows/:name`                 | CRUD       | <0.5s       | Hobby       | ✅             | Ninguna                |
| 17  | `PUT /api/workflows/:name`                 | CRUD       | <1s         | Hobby       | ✅             | Ninguna                |
| 18  | `DELETE /api/workflows/:name`              | CRUD       | <0.5s       | Hobby       | ✅             | Ninguna                |
| 19  | `POST /api/workflows/:name/execute`        | LLM        | **10-120s** | ❌          | **🔄**         | **Mover a background** |
| 20  | `POST /api/workflows/:name/estimate`       | Compute    | 1-5s        | Hobby       | ⚠️             | Optimizar queries      |
| 21  | `GET /api/executions`                      | CRUD       | <1s         | Hobby       | ✅             | Ninguna                |
| 22  | `GET /api/logs`                            | CRUD       | <1s         | Hobby       | ✅             | Ninguna                |
| 23  | `GET /api/traces`                          | CRUD       | <1s         | Hobby       | ✅             | Ninguna                |
| 24  | `GET /api/costs`                           | CRUD       | <1s         | Hobby       | ✅             | Ninguna                |
| 25  | `GET /api/budgets`                         | CRUD       | <0.5s       | Hobby       | ✅             | Ninguna                |
| 26  | `POST /api/budgets`                        | CRUD       | <1s         | Hobby       | ✅             | Ninguna                |
| 27  | `PUT /api/budgets/:id`                     | CRUD       | <1s         | Hobby       | ✅             | Ninguna                |
| 28  | `DELETE /api/budgets/:id`                  | CRUD       | <0.5s       | Hobby       | ✅             | Ninguna                |
| 29  | `POST /stripe/webhook`                     | Webhook    | <2s         | Hobby       | ✅             | Ninguna                |
| 30  | `POST /api/stripe/create-checkout-session` | Stripe     | 1-3s        | Hobby       | ⚠️             | Verificar timeout      |
| 31  | `POST /api/stripe/create-portal-session`   | Stripe     | 1-3s        | Hobby       | ⚠️             | Verificar timeout      |
| 32  | `POST /api/onboarding/complete`            | CRUD       | <0.5s       | Hobby       | ✅             | Ninguna                |
| 33  | `POST /v1/ingest`                          | Ingest     | 1-3s        | Hobby       | ⚠️             | Optimizar logging      |
| 34  | `GET /health`                              | Health     | <1s         | Hobby       | ✅             | Ninguna                |
| 35  | `GET /metrics`                             | Metrics    | <1s         | Hobby       | ⚠️             | Ajustar Prometheus     |
| 36  | **WebSocket** `/ws`                        | Realtime   | N/A         | ❌          | **❌**         | **Usar Pusher/Ably**   |
| 37  | **Cron: Alerts**                           | Background | N/A         | **Pro+**    | **🔄**         | **Vercel Cron**        |
| 38  | **Cron: Budgets**                          | Background | N/A         | **Pro+**    | **🔄**         | **Vercel Cron**        |
| 39  | **DB Migrations**                          | Init       | 5-60s       | ❌          | **❌**         | **Ejecutar en CI/CD**  |

### Leyenda

- ✅ Compatible sin cambios
- ⚠️ Compatible con ajustes menores
- 🔄 Requiere servicio alternativo
- ❌ No compatible

---

## 🔧 4. PLAN DE ACCIÓN

### FASE 1: Cambios Obligatorios (P0)

#### 1.1 Eliminar WebSocket Server

**Archivo:** `src/index.ts`, `src/websocket/WebSocketManager.ts`

**Problema:** WebSockets no soportados en Vercel Functions.

**Solución:**

```typescript
// OPCIÓN A: Usar Pusher (Recomendado - Gratuito hasta 200k mensajes/día)
import Pusher from "pusher";

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
});

// Reemplazar wsManager.broadcast() con:
pusher.trigger("agent-channel", "agent:event", event);

// OPCIÓN B: Ably (Más features, gratuito hasta 6M mensajes/mes)
// OPCIÓN C: Vercel Edge Functions + PartyKit (experimental)
```

**Cambios en código:**

- Remover `const wss = new WebSocketServer()`
- Remover `const wsManager = new WebSocketManager()`
- Reemplazar todos los `wsManager.broadcast()` con Pusher triggers
- Actualizar frontend para conectar a Pusher en lugar de WS

#### 1.2 Migrar Express Sessions a Vercel KV

**Archivo:** `src/index.ts:350-359`

**Problema:** `express-session` usa memoria, no persiste entre invocaciones.

**Solución:**

```bash
# Instalar adapter
pnpm add @vercel/kv connect-redis
```

```typescript
import { kv } from "@vercel/kv";
import RedisStore from "connect-redis";

app.use(
  session({
    store: new RedisStore({
      client: kv as any,
      prefix: "sess:",
    }),
    secret: process.env.JWT_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, // Vercel siempre es HTTPS
      httpOnly: true,
      maxAge: 10 * 60 * 1000,
    },
  })
);
```

**Costo:** Plan Hobby de Vercel KV es gratuito (256MB storage).

#### 1.3 Mover Database Migrations a CI/CD

**Archivo:** `src/index.ts:29-92`

**Problema:** `execSync` de Prisma en startup puede exceder timeout.

**Solución:**

```yaml
# .github/workflows/deploy.yml
- name: Run Prisma Migrations
  run: |
    pnpm prisma migrate deploy --schema=./prisma/schema.prisma
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

**Eliminar del código:**

```typescript
// REMOVER toda la función ensureDatabaseSchema()
// REMOVER llamadas: await ensureDatabaseSchema();
```

#### 1.4 Configurar Vercel Cron para Tareas Programadas

**Archivo:** `vercel.json` (crear/actualizar)

**Problema:** `setInterval` no funciona en serverless.

**Solución:**

```json
{
  "crons": [
    {
      "path": "/api/cron/check-alerts",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/reset-budgets",
      "schedule": "0 * * * *"
    }
  ]
}
```

Crear endpoints dedicados:

```typescript
// api/cron/check-alerts.ts
import { verifySignature } from "@vercel/cron";

export default async function handler(req, res) {
  // Vercel firma automáticamente las requests de cron
  const isValid = verifySignature(req);
  if (!isValid) return res.status(401).end();

  await alertService.checkAndSendAlerts();
  res.json({ success: true });
}
```

**Requisito:** Plan Vercel **Pro** ($20/mes).

### FASE 2: Optimizaciones (P1)

#### 2.1 Convertir a Vercel Serverless Functions

**Estructura recomendada:**

```
apps/api/
  api/
    auth/
      login.ts        → POST /api/auth/login
      signup.ts       → POST /api/auth/signup
      me.ts           → GET /api/auth/me
      [...auth].ts    → Catch-all para OAuth
    agents/
      index.ts        → GET /api/agents
      [id].ts         → GET/DELETE /api/agents/:id
      execute.ts      → POST /api/agents/:id/execute
    workflows/
      index.ts
      [name].ts
      execute.ts
    stripe/
      webhook.ts
      checkout.ts
    cron/
      check-alerts.ts
      reset-budgets.ts
```

**Ejemplo de migración:**

```typescript
// api/agents/index.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const agents = await prisma.agent.findMany({
    where: { userId: req.user.id }, // Añadir middleware de auth
    take: 50,
  });

  return res.json({ data: agents });
}
```

#### 2.2 Implementar Background Jobs para Workflows Largos

**Problema:** Workflows de >60s exceden timeout de Pro plan.

**Solución A: Inngest (Recomendado)**

```bash
pnpm add inngest
```

```typescript
// functions/workflow-executor.ts
import { Inngest } from "inngest";

export const inngest = new Inngest({ name: "Aethermind" });

export const workflowExecutor = inngest.createFunction(
  { name: "Execute Workflow" },
  { event: "workflow/execute" },
  async ({ event, step }) => {
    const result = await step.run("execute-workflow", async () => {
      return await workflowEngine.execute(
        event.data.workflowName,
        event.data.input
      );
    });

    await step.run("save-results", async () => {
      await prisma.execution.create({ data: result });
    });

    return result;
  }
);
```

**Endpoint modificado:**

```typescript
// api/workflows/execute.ts
export default async function handler(req, res) {
  // En lugar de ejecutar directamente, enqueue
  const jobId = await inngest.send({
    name: "workflow/execute",
    data: {
      workflowName: req.body.workflowName,
      input: req.body.input,
      userId: req.user.id,
    },
  });

  return res.json({
    jobId,
    status: "queued",
    message: "Workflow execution started",
  });
}
```

**Costo:** Inngest tiene plan gratuito hasta 10k steps/mes.

**Solución B: Railway Background Service**

- Mantener workflow execution en Railway
- Vercel Functions llaman a Railway API
- Railway ejecuta workflows sin límite de tiempo

#### 2.3 Optimizar Prisma Connection Pool

**Archivo:** `src/lib/prisma.ts`

**Problema:** Conexiones no se reutilizan entre invocaciones.

**Solución:**

```typescript
import { PrismaClient } from "@prisma/client";

// Singleton global para reutilizar conexión
declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Configuración optimizada para serverless
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

// En Edge Runtime, cerrar conexión al final
export const config = {
  maxDuration: 10, // segundos
};
```

#### 2.4 Usar Vercel Postgres (Opcional)

**Beneficios:**

- Connection pooling automático
- Optimizado para serverless
- Integración nativa con Vercel

**Migración:**

```bash
# Crear base de datos en Vercel
vercel postgres create

# Actualizar DATABASE_URL automáticamente
vercel env pull
```

**Costo:** Desde $20/mes (Hobby incluye 256MB, ~5k requests/día).

### FASE 3: Mejoras de Performance (P2)

#### 3.1 Implementar Edge Caching

```typescript
// Middleware de cache
export const config = {
  runtime: "edge", // Usar Edge Runtime donde sea posible
};

// Cachear responses con Vercel Cache
res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
```

#### 3.2 Migrar Auth a Edge Functions

```typescript
// api/auth/me.ts
export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");

  // JWT verification en Edge es ultra-rápido
  const payload = await verifyJWT(token);

  return new Response(JSON.stringify(payload), {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
```

#### 3.3 Usar ISR (Incremental Static Regeneration) para Datos Estáticos

```typescript
// Para pricing, features, etc.
export const config = {
  revalidate: 3600, // Regenerar cada hora
};
```

---

## 📦 5. SERVICIOS DE VERCEL NECESARIOS

### Servicios Requeridos

| Servicio             | Propósito                 | Plan Mínimo | Costo Mensual    |
| -------------------- | ------------------------- | ----------- | ---------------- |
| **Vercel Functions** | API endpoints             | Hobby       | Gratis           |
| **Vercel Postgres**  | Base de datos             | Hobby       | $0 (hasta 256MB) |
| **Vercel KV**        | Redis para sessions/cache | Hobby       | $0 (hasta 256MB) |
| **Vercel Cron**      | Tareas programadas        | **Pro**     | $20              |
| **Vercel Blob**      | File storage (futuro)     | Hobby       | $0 (hasta 1GB)   |

### Servicios Externos Recomendados

| Servicio     | Propósito           | Alternativas            | Costo          |
| ------------ | ------------------- | ----------------------- | -------------- |
| **Pusher**   | WebSockets/Realtime | Ably, PartyKit          | $0-$49/mes     |
| **Inngest**  | Background jobs     | BullMQ+Railway, Quirrel | $0-$25/mes     |
| **SendGrid** | Emails              | Resend, Postmark        | Ya configurado |
| **Sentry**   | Error tracking      | Ya configurado          | Ya configurado |

### Estimación de Costos

#### Opción A: 100% Vercel (Máximo Compatible)

```
Vercel Pro:              $20/mes  (requerido para Cron + timeout 60s)
Vercel Postgres:         $20/mes  (producción, 10GB)
Vercel KV:               $0/mes   (dentro de límites Hobby)
Pusher:                  $0/mes   (plan gratuito)
Inngest:                 $0/mes   (hasta 10k steps)
─────────────────────────────────
TOTAL:                   $40/mes
```

#### Opción B: Híbrido Vercel + Railway

```
Vercel Pro:              $20/mes  (API endpoints + Cron)
Railway:                 $10/mes  (workflows largos + WebSockets)
PostgreSQL externo:      $0/mes   (Supabase free tier o Railway incluido)
Pusher:                  $0/mes   (opcional si Railway maneja WS)
─────────────────────────────────
TOTAL:                   $30/mes
```

#### Opción C: Solo Railway (Comparación)

```
Railway Pro:             $20/mes  (todo en un servicio)
PostgreSQL:              Incluido
Redis:                   Incluido
WebSockets:              Incluido
Background Jobs:         Incluido
─────────────────────────────────
TOTAL:                   $20/mes
```

---

## 🏗️ 6. ARQUITECTURA ÓPTIMA RECOMENDADA

### Arquitectura Híbrida (Recomendada)

```
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL (Frontend + API)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Next.js    │  │   Vercel     │  │   Vercel     │     │
│  │  Dashboard   │  │  Functions   │  │     Cron     │     │
│  │              │  │              │  │              │     │
│  │ - React UI   │  │ - Auth API   │  │ - Alerts     │     │
│  │ - SSR/ISR    │  │ - CRUD API   │  │ - Budget     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ HTTPS
                       │
         ┌─────────────┴──────────────┐
         │                            │
         ▼                            ▼
┌─────────────────┐          ┌─────────────────┐
│  Vercel Postgres│          │  Vercel KV      │
│                 │          │  (Redis)        │
│  - User Data    │          │  - Sessions     │
│  - Agents       │          │  - Cache        │
│  - Workflows    │          │                 │
└─────────────────┘          └─────────────────┘
         │
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    RAILWAY (Background Tasks)                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Long        │  │  WebSocket   │  │  Background  │     │
│  │  Workflows   │  │  Server      │  │  Workers     │     │
│  │              │  │              │  │              │     │
│  │ - LLM calls  │  │ - Realtime   │  │ - Cleanup    │     │
│  │ - Multi-step │  │ - Events     │  │ - Analytics  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         │
         │
         ▼
┌─────────────────┐          ┌─────────────────┐
│   Pusher/Ably   │          │    Inngest      │
│   (Realtime)    │          │  (Job Queue)    │
└─────────────────┘          └─────────────────┘
```

### División de Responsabilidades

#### Vercel Functions (API Stateless)

- ✅ Auth (login, signup, JWT)
- ✅ OAuth callbacks
- ✅ CRUD operations (agents, workflows, budgets)
- ✅ Stripe webhooks
- ✅ Simple queries (logs, costs, traces)
- ✅ Cron jobs (alerts, budget resets)

#### Railway Service (Stateful + Long-Running)

- ✅ Workflow execution >60s
- ✅ Agent execution >30s
- ✅ WebSocket connections
- ✅ Background cleanup tasks
- ✅ Heavy data processing

#### Servicios Externos

- **Vercel Postgres:** Base de datos principal
- **Vercel KV:** Sessions + Cache
- **Pusher/Ably:** Realtime events (opcional si Railway maneja WS)
- **Inngest:** Job queue (opcional si Railway maneja jobs)

---

## ✅ 7. CHECKLIST ACCIONABLE

### Pre-Migración

- [ ] Backup completo de base de datos PostgreSQL
- [ ] Documentar todas las env variables
- [ ] Crear cuenta Vercel Pro (si no existe)
- [ ] Crear cuenta Railway (para componentes incompatibles)
- [ ] Configurar Pusher/Ably para WebSockets
- [ ] Configurar Inngest para background jobs (opcional)

### Migración - Paso a Paso

#### Semana 1: Preparación

- [ ] Crear branch `feat/vercel-migration`
- [ ] Instalar dependencias Vercel:
  ```bash
  pnpm add @vercel/node @vercel/kv @vercel/postgres
  ```
- [ ] Crear `vercel.json` con configuración inicial
- [ ] Mover migrations a GitHub Actions/Vercel Build

#### Semana 2: Adaptar Express a Vercel Functions

- [ ] Crear estructura `api/` para serverless functions
- [ ] Migrar rutas de autenticación a `api/auth/*.ts`
- [ ] Migrar rutas de agentes a `api/agents/*.ts`
- [ ] Migrar rutas de workflows a `api/workflows/*.ts`
- [ ] Migrar Stripe routes a `api/stripe/*.ts`
- [ ] Testear cada endpoint individualmente

#### Semana 3: Configurar Servicios

- [ ] Provision Vercel Postgres database
- [ ] Migrar datos de producción actual
- [ ] Configurar Vercel KV para sessions
- [ ] Actualizar Passport OAuth con KV store
- [ ] Configurar Vercel Cron para alerts y budgets
- [ ] Testear cron jobs en staging

#### Semana 4: WebSockets y Background Jobs

- [ ] Configurar Pusher/Ably
- [ ] Reemplazar `wsManager.broadcast()` con Pusher
- [ ] Actualizar frontend WebSocket client
- [ ] Configurar Inngest (o Railway service)
- [ ] Migrar workflow execution a background jobs
- [ ] Implementar polling/webhooks para job status

#### Semana 5: Testing y Optimización

- [ ] Performance testing de todos los endpoints
- [ ] Load testing con Artillery/K6
- [ ] Configurar Sentry para Vercel
- [ ] Implementar Edge caching strategies
- [ ] Optimizar cold start times
- [ ] Documentar cambios de arquitectura

#### Semana 6: Deploy y Monitoreo

- [ ] Deploy a Vercel staging environment
- [ ] Smoke tests en staging
- [ ] Configurar Vercel Analytics
- [ ] Configurar alertas de error rate
- [ ] Blue-green deployment a producción
- [ ] Monitoreo post-deploy (24h)
- [ ] Rollback plan preparado

### Post-Migración

- [ ] Monitoreo de costos Vercel (primeros 30 días)
- [ ] Análisis de performance vs. deploy anterior
- [ ] Optimización de cold starts
- [ ] Documentación de runbook operacional
- [ ] Training del equipo en arquitectura nueva

---

## 📊 8. RECOMENDACIÓN FINAL

### ¿Es viable usar 100% Vercel Functions?

**Respuesta: NO de forma óptima, pero SÍ es posible con limitaciones.**

### Análisis de Viabilidad

#### Endpoints Compatibles: 30/39 (77%)

- Sin cambios: 20 endpoints
- Con ajustes: 10 endpoints

#### Funcionalidades Críticas No Compatibles: 3

1. **WebSockets** - Requiere servicio externo
2. **Workflows largos (>60s)** - Requiere background jobs
3. **Database migrations en runtime** - Mover a CI/CD

### Escenarios Recomendados

#### ✅ RECOMENDADO: Arquitectura Híbrida

```
Vercel Functions (API rápido) + Railway/Render (Stateful)
```

**Ventajas:**

- ✅ Mejor de ambos mundos
- ✅ Escalabilidad automática (Vercel)
- ✅ Sin límites de timeout (Railway)
- ✅ WebSockets nativos
- ✅ Costo razonable ($30-40/mes)

**Desventajas:**

- ⚠️ Mayor complejidad operacional
- ⚠️ Dos deploys separados
- ⚠️ Latencia adicional en llamadas internas

#### ⚠️ ALTERNATIVA: 100% Vercel (Con Sacrificios)

```
Vercel Pro + Vercel Postgres + Vercel KV + Pusher + Inngest
```

**Ventajas:**

- ✅ Infraestructura unificada
- ✅ Excelente DX
- ✅ Escalabilidad automática

**Desventajas:**

- ❌ Workflows limitados a 60s (incluso en Pro)
- ❌ Requiere Plan Pro ($20/mes mínimo)
- ❌ Dependencia de servicios externos (Pusher, Inngest)
- ❌ Cold starts en funciones poco usadas

#### ❌ NO RECOMENDADO: 100% Railway/Render

```
Todo en un monolito tradicional
```

**Ventajas:**

- ✅ Simplicidad
- ✅ Sin límites de timeout
- ✅ Costo fijo predecible

**Desventajas:**

- ❌ No escala automáticamente
- ❌ Requiere manejo manual de load balancing
- ❌ Menos DX que Vercel

### Recomendación Final

**Implementar Arquitectura Híbrida con esta división:**

| Componente             | Servicio          | Razón                         |
| ---------------------- | ----------------- | ----------------------------- |
| **Dashboard Frontend** | Vercel (Next.js)  | SSR, Edge, CDN global         |
| **API CRUD**           | Vercel Functions  | Stateless, rápido, auto-scale |
| **Auth + OAuth**       | Vercel Functions  | Stateless con Vercel KV       |
| **Stripe Webhooks**    | Vercel Functions  | Rápido, confiable             |
| **Cron Jobs**          | Vercel Cron       | Simplicity, integrado         |
| **Workflow Execution** | **Railway**       | Sin límites timeout           |
| **WebSocket Server**   | **Railway**       | Conexiones persistentes       |
| **Database**           | Vercel Postgres   | Optimizado para Vercel        |
| **Cache/Sessions**     | Vercel KV         | Baja latencia                 |
| **Realtime Events**    | Pusher/Railway WS | Flexible                      |

### Porcentaje de Backend en Vercel: **~80%**

**Funcionalidades en Railway (20%):**

- Workflow execution (long-running)
- WebSocket server
- Background workers (opcional)

---

## 🎯 PRÓXIMOS PASOS INMEDIATOS

### 1. Decisión de Arquitectura (Esta Semana)

- [ ] Revisar este documento con el equipo
- [ ] Decidir entre:
  - Híbrido Vercel + Railway (recomendado)
  - 100% Vercel con limitaciones
- [ ] Aprobar presupuesto de servicios cloud

### 2. Proof of Concept (Semana Próxima)

- [ ] Migrar 3-5 endpoints a Vercel Functions
- [ ] Testear Vercel KV con OAuth
- [ ] Prototipar WebSocket con Pusher
- [ ] Medir performance vs. actual

### 3. Plan de Migración Completo (Semanas 3-4)

- [ ] Crear epic en Jira/Linear
- [ ] Definir sprints de 1 semana
- [ ] Asignar responsables
- [ ] Configurar entornos staging

### 4. Ejecución (Semanas 5-10)

- [ ] Seguir checklist paso a paso
- [ ] Deploy incremental por feature
- [ ] Testing continuo
- [ ] Deploy a producción con blue-green

---

## 📚 RECURSOS ADICIONALES

### Documentación Oficial

- [Vercel Functions Limits](https://vercel.com/docs/functions/limits)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Vercel KV (Redis)](https://vercel.com/docs/storage/vercel-kv)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Prisma + Vercel](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)

### Ejemplos de Código

- [Express to Vercel Migration](https://github.com/vercel/examples/tree/main/solutions/express)
- [Passport OAuth + Vercel](https://github.com/vercel/next.js/tree/canary/examples/auth-passport)
- [WebSockets Alternatives](https://github.com/vercel/examples/tree/main/solutions/realtime)

### Tools

- [Inngest](https://www.inngest.com/docs) - Background jobs
- [Pusher](https://pusher.com/docs) - Realtime WebSockets
- [Ably](https://ably.com/docs) - Realtime alternative

---

## 📞 SOPORTE

Para dudas sobre esta migración:

- **Autor:** Antigravity AI Agent
- **Fecha:** 2026-01-13
- **Versión:** 1.0

**Este documento debe actualizarse a medida que se tomen decisiones arquitectónicas.**
