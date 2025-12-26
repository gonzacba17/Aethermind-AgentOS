# 🗺️ ROADMAP: Pivote a Modelo Híbrido - Aethermind AgentOS

**Objetivo**: Transformar Aethermind de plataforma self-hosted a SaaS híbrido con agente local + dashboard cloud

**Duración Total**: 8-10 semanas  
**Estado Actual**: MVP Self-Hosted Funcional (7.2/10 según auditoría)  
**Estado Objetivo**: SaaS Híbrido con 10 Beta Customers

---

## 📊 RESUMEN EJECUTIVO

### Estrategia de Pivote

```
ANTES (Self-Hosted):                DESPUÉS (Híbrido):
┌─────────────────────┐            ┌──────────────────────┐
│  Cliente instala    │            │ Cliente instala SDK  │
│  todo el sistema    │            │ (1 línea de código)  │
│  (API + Dashboard)  │    →       │                      │
│                     │            │ Dashboard en Cloud   │
│  Complejo, lento    │            │ (Vercel)             │
└─────────────────────┘            └──────────────────────┘
```

### Fases del Roadmap

| Fase                               | Duración    | Output                | Validación       |
| ---------------------------------- | ----------- | --------------------- | ---------------- |
| **Fase 0: Preparación**            | 1 semana    | Repo restructurado    | CI verde         |
| **Fase 1: SDK Agente**             | 2-3 semanas | NPM package funcional | 3 test apps      |
| **Fase 2: API Ingestion**          | 1-2 semanas | Endpoint /v1/ingest   | 1M events/day    |
| **Fase 3: Dashboard Multi-tenant** | 2 semanas   | Vercel deploy         | 5 orgs separadas |
| **Fase 4: Beta & Launch**          | 2 semanas   | 10 beta users         | $500 MRR         |

---

## 🚀 FASE 0: PREPARACIÓN Y ARQUITECTURA

**Duración**: 1 semana (5 días)  
**Owner**: Tech Lead  
**Blocker**: Ninguno

### Objetivos

- [ ] Reestructurar monorepo para soportar dual-mode
- [ ] Documentar nueva arquitectura
- [ ] Setup infrastructure básica

### Tasks

#### Day 1-2: Reestructuración del Repo

**Task 0.1: Crear nuevo package `@aethermind/agent`**

```bash
mkdir -p packages/agent/src/{interceptors,transport,config}
cd packages/agent
pnpm init
```

Estructura objetivo:

```
packages/agent/
├── src/
│   ├── index.ts              # Public API
│   ├── AethermindMonitor.ts  # Main class
│   ├── interceptors/
│   │   ├── OpenAIInterceptor.ts
│   │   ├── AnthropicInterceptor.ts
│   │   └── BaseInterceptor.ts
│   ├── transport/
│   │   ├── BatchTransport.ts
│   │   └── RetryTransport.ts
│   ├── config/
│   │   └── AgentConfig.ts
│   └── utils/
│       ├── costCalculator.ts
│       └── tokenCounter.ts
├── tests/
├── package.json
└── README.md
```

**Task 0.2: Extraer lógica reutilizable**
Mover de `apps/api` a `packages/core-shared`:

- `CostEstimationService.ts` → `packages/core-shared/cost/`
- Token counting logic
- Model pricing tables

**Task 0.3: Actualizar `package.json` workspaces**

```json
{
  "workspaces": [
    "apps/*",
    "packages/*",
    "packages/agent" // ← Añadir
  ]
}
```

#### Day 3: Nueva API Architecture

**Task 0.4: Diseñar API de Ingestion**

Crear especificación OpenAPI:

```yaml
# docs/api-spec-ingestion.yml
paths:
  /v1/ingest:
    post:
      summary: Ingest telemetry from agent
      security:
        - ApiKeyAuth: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                events:
                  type: array
                  items:
                    $ref: "#/components/schemas/TelemetryEvent"
```

**Task 0.5: Crear migration para multi-tenancy**

```sql
-- prisma/migrations/XXX_add_multitenancy.sql
ALTER TABLE users ADD COLUMN organization_id UUID;
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  api_key_hash VARCHAR(255),
  plan VARCHAR(50),
  created_at TIMESTAMP
);
CREATE INDEX idx_users_org ON users(organization_id);
```

#### Day 4-5: Infrastructure Setup

**Task 0.6: Vercel Project Setup**

- [ ] Crear nuevo proyecto en Vercel para dashboard
- [ ] Configurar env vars en Vercel
- [ ] Setup preview deployments

**Task 0.7: Database para SaaS**

- [ ] Provision PostgreSQL en Railway/Neon
- [ ] Configurar connection pooling (PgBouncer)
- [ ] Setup automated backups

**Task 0.8: Monitoring Baseline**

```bash
# Re-habilitar Prometheus (del TOP 1 de auditoría)
# Crear dashboards en Grafana Cloud para nueva arquitectura
```

### Entregables Fase 0

- ✅ Repo reestructurado con `packages/agent/`
- ✅ API spec documentada
- ✅ Vercel + Database provisioned
- ✅ CI/CD adaptado para nuevos packages

### Criterios de Éxito

- [ ] `pnpm build` exitoso en todos los packages
- [ ] Tests existentes siguen pasando
- [ ] Nueva estructura documentada en ARCHITECTURE.md

---

## 🔌 FASE 1: SDK DEL AGENTE

**Duración**: 2-3 semanas  
**Owner**: Backend Dev  
**Blocker**: Fase 0 completada

### Objetivos

- [ ] SDK funcional que intercepta OpenAI/Anthropic
- [ ] Batching y retry automático
- [ ] Publicado en npm (private registry inicialmente)

### Arquitectura del Agente

```typescript
// packages/agent/src/index.ts - API Pública
export { AethermindMonitor } from "./AethermindMonitor";
export type { MonitorConfig, TelemetryEvent } from "./types";

// Uso por el cliente:
import { AethermindMonitor } from "@aethermind/agent";

AethermindMonitor.init({
  apiKey: "am_xxx",
  endpoint: "https://api.aethermind.io",
  autoInstrument: ["openai", "anthropic"],
  batchSize: 50,
  flushInterval: 30000, // 30s
});
```

### Tasks

#### Week 1: Core Interceptors

**Task 1.1: BaseInterceptor Abstract Class**

```typescript
// packages/agent/src/interceptors/BaseInterceptor.ts
export abstract class BaseInterceptor {
  abstract instrument(): void;
  abstract captureRequest(req: any): TelemetryEvent;
  abstract captureResponse(res: any): TelemetryEvent;

  protected calculateCost(model: string, tokens: TokenUsage): number {
    // Reusar tu CostEstimationService existente
  }
}
```

**Task 1.2: OpenAI Interceptor**

```typescript
// packages/agent/src/interceptors/OpenAIInterceptor.ts
import OpenAI from "openai";

export class OpenAIInterceptor extends BaseInterceptor {
  instrument() {
    // Monkey-patch OpenAI.chat.completions.create
    const originalCreate = OpenAI.Chat.Completions.prototype.create;

    OpenAI.Chat.Completions.prototype.create = async function (...args) {
      const startTime = Date.now();
      const request = args[0];

      try {
        const response = await originalCreate.apply(this, args);

        // Capturar métricas
        const event: TelemetryEvent = {
          timestamp: Date.now(),
          provider: "openai",
          model: request.model,
          tokensPrompt: response.usage?.prompt_tokens,
          tokensCompletion: response.usage?.completion_tokens,
          cost: this.calculateCost(request.model, response.usage),
          latency: Date.now() - startTime,
          status: "success",
        };

        // Enviar a transport
        MonitorTransport.getInstance().addEvent(event);

        return response;
      } catch (error) {
        // Capturar errores
        const errorEvent = {
          ...baseEvent,
          status: "error",
          error: error.message,
        };
        MonitorTransport.getInstance().addEvent(errorEvent);
        throw error;
      }
    };
  }
}
```

**Task 1.3: Anthropic Interceptor**
Similar al de OpenAI pero para `@anthropic-ai/sdk`

**Task 1.4: Tests de Interceptors**

```typescript
// packages/agent/tests/interceptors/OpenAIInterceptor.test.ts
describe("OpenAIInterceptor", () => {
  it("should capture successful completion", async () => {
    const monitor = new AethermindMonitor({ apiKey: "test" });
    const events: TelemetryEvent[] = [];

    monitor.on("event", (e) => events.push(e));

    // Mock OpenAI response
    const mockResponse = {
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    };

    // Execute
    await openai.chat.completions.create({ model: "gpt-4", messages: [] });

    // Assert
    expect(events).toHaveLength(1);
    expect(events[0].tokensPrompt).toBe(10);
    expect(events[0].cost).toBeGreaterThan(0);
  });
});
```

#### Week 2: Transport Layer

**Task 1.5: Batch Transport con Retry**

```typescript
// packages/agent/src/transport/BatchTransport.ts
export class BatchTransport {
  private batch: TelemetryEvent[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private config: {
      endpoint: string;
      apiKey: string;
      batchSize: number;
      flushInterval: number;
    }
  ) {
    this.startFlushTimer();
  }

  addEvent(event: TelemetryEvent) {
    this.batch.push(event);

    if (this.batch.length >= this.config.batchSize) {
      this.flush();
    }
  }

  async flush() {
    if (this.batch.length === 0) return;

    const events = [...this.batch];
    this.batch = [];

    try {
      await this.sendWithRetry(events);
    } catch (error) {
      // Log error pero NO fallar la app del cliente
      console.error("[Aethermind] Failed to send telemetry:", error);
      // TODO: Persistir en disco para retry posterior
    }
  }

  private async sendWithRetry(events: TelemetryEvent[], retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        await fetch(`${this.config.endpoint}/v1/ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": this.config.apiKey,
          },
          body: JSON.stringify({ events }),
        });
        return; // Success
      } catch (error) {
        if (i === retries - 1) throw error;
        await this.sleep(Math.pow(2, i) * 1000); // Exponential backoff
      }
    }
  }
}
```

**Task 1.6: Graceful Shutdown**

```typescript
// Asegurar que flush pendientes antes de exit
process.on("SIGINT", async () => {
  await AethermindMonitor.getInstance().shutdown();
  process.exit(0);
});
```

#### Week 3: Polish & Distribution

**Task 1.7: Configuration Management**

```typescript
// packages/agent/src/config/AgentConfig.ts
export interface MonitorConfig {
  apiKey: string;
  endpoint?: string; // Default: https://api.aethermind.io
  autoInstrument?: ("openai" | "anthropic")[];
  batchSize?: number; // Default: 50
  flushInterval?: number; // Default: 30000ms
  debug?: boolean;
  onError?: (error: Error) => void;
}

export function validateConfig(config: MonitorConfig): void {
  if (!config.apiKey || !config.apiKey.startsWith("am_")) {
    throw new Error('Invalid API key format. Must start with "am_"');
  }
  // Más validaciones...
}
```

**Task 1.8: Package.json del Agent**

```json
{
  "name": "@aethermind/agent",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "prepublishOnly": "pnpm build && pnpm test"
  },
  "peerDependencies": {
    "openai": "^4.0.0",
    "@anthropic-ai/sdk": "^0.9.0"
  },
  "dependencies": {
    "node-fetch": "^3.3.0"
  },
  "keywords": ["ai", "monitoring", "cost-tracking", "llm"]
}
```

**Task 1.9: Publicar en npm (scoped private)**

```bash
# Login a npm
npm login

# Publicar (inicialmente private)
cd packages/agent
npm publish --access restricted

# Más tarde: hacer público
npm access public @aethermind/agent
```

### Entregables Fase 1

- ✅ NPM package `@aethermind/agent@0.1.0` publicado
- ✅ Interceptores OpenAI + Anthropic funcionando
- ✅ Batching + retry implementado
- ✅ Tests con >80% coverage
- ✅ README con quick start

### Criterios de Éxito

- [ ] Test app con OpenAI captura eventos correctamente
- [ ] Test app con Anthropic captura eventos correctamente
- [ ] Batch de 50 eventos envía en <2s
- [ ] Retry funciona ante falla de red simulada
- [ ] Zero crashes en app del cliente si API down

---

## 📥 FASE 2: API DE INGESTION

**Duración**: 1-2 semanas  
**Owner**: Backend Dev  
**Blocker**: Fase 1 completada

### Objetivos

- [ ] Endpoint `/v1/ingest` funcional
- [ ] Autenticación multi-tenant
- [ ] Rate limiting por organización
- [ ] Escribir a PostgreSQL con alta throughput

### Tasks

#### Week 1: Endpoint & Auth

**Task 2.1: Nuevo endpoint de ingestion**

```typescript
// apps/api/src/routes/ingestion.ts
import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { IngestionService } from "../services/IngestionService";

const router = Router();

router.post(
  "/v1/ingest",
  authMiddleware, // Valida API key y extrae organizationId
  async (req, res) => {
    try {
      const { events } = req.body;

      // Validar schema
      const validatedEvents = validateTelemetryBatch(events);

      // Guardar en DB (async, no bloquear response)
      IngestionService.ingestBatch(req.organizationId!, validatedEvents);

      res.status(202).json({
        accepted: events.length,
        message: "Events queued for processing",
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

export default router;
```

**Task 2.2: Schema Validation con Zod**

```typescript
// apps/api/src/schemas/telemetry.ts
import { z } from "zod";

export const TelemetryEventSchema = z.object({
  timestamp: z.number(),
  provider: z.enum(["openai", "anthropic", "google", "local"]),
  model: z.string(),
  tokensPrompt: z.number().optional(),
  tokensCompletion: z.number().optional(),
  cost: z.number(),
  latency: z.number(),
  status: z.enum(["success", "error"]),
  error: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const TelemetryBatchSchema = z.object({
  events: z.array(TelemetryEventSchema).max(1000), // Max 1k events por request
});
```

**Task 2.3: Multi-tenant Auth Middleware**

```typescript
// apps/api/src/middleware/auth.ts (actualizar)
export const authMiddleware = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({ error: "API key required" });
  }

  // Buscar organización por API key
  const org = await prisma.organization.findUnique({
    where: { apiKeyHash: hashApiKey(apiKey) },
    include: { plan: true },
  });

  if (!org) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  // Rate limiting por org
  const allowed = await checkRateLimit(org.id, org.plan.requestsPerMinute);
  if (!allowed) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  // Inyectar en request
  req.organizationId = org.id;
  req.organization = org;
  next();
};
```

#### Week 2: Persistence & Performance

**Task 2.4: Ingestion Service con Buffering**

```typescript
// apps/api/src/services/IngestionService.ts
export class IngestionService {
  private buffer: Map<string, TelemetryEvent[]> = new Map();
  private flushInterval = 5000; // 5s

  constructor() {
    setInterval(() => this.flushAll(), this.flushInterval);
  }

  async ingestBatch(orgId: string, events: TelemetryEvent[]) {
    // Agregar a buffer por org
    const current = this.buffer.get(orgId) || [];
    this.buffer.set(orgId, [...current, ...events]);

    // Flush si buffer muy grande
    if (current.length > 1000) {
      await this.flush(orgId);
    }
  }

  private async flush(orgId: string) {
    const events = this.buffer.get(orgId);
    if (!events || events.length === 0) return;

    this.buffer.delete(orgId);

    // Bulk insert con Prisma
    await prisma.telemetryEvent.createMany({
      data: events.map((e) => ({
        ...e,
        organizationId: orgId,
      })),
    });

    // Actualizar agregaciones en tiempo real
    await this.updateAggregations(orgId, events);
  }

  private async updateAggregations(orgId: string, events: TelemetryEvent[]) {
    // Pre-calcular métricas para dashboard
    const totalCost = events.reduce((sum, e) => sum + e.cost, 0);
    const totalTokens = events.reduce(
      (sum, e) => sum + (e.tokensPrompt || 0) + (e.tokensCompletion || 0),
      0
    );

    await prisma.organizationMetrics.upsert({
      where: {
        organizationId_date: {
          organizationId: orgId,
          date: new Date().toISOString().split("T")[0],
        },
      },
      update: {
        totalCost: { increment: totalCost },
        totalTokens: { increment: totalTokens },
        requestCount: { increment: events.length },
      },
      create: {
        organizationId: orgId,
        date: new Date().toISOString().split("T")[0],
        totalCost,
        totalTokens,
        requestCount: events.length,
      },
    });
  }
}
```

**Task 2.5: Database Schema para Telemetry**

```prisma
// prisma/schema.prisma (añadir)

model Organization {
  id            String   @id @default(uuid())
  name          String
  apiKeyHash    String   @unique
  plan          Plan     @default(FREE)
  createdAt     DateTime @default(now())

  events        TelemetryEvent[]
  metrics       OrganizationMetrics[]
  users         User[]
}

model TelemetryEvent {
  id                String   @id @default(uuid())
  organizationId    String
  timestamp         DateTime
  provider          String
  model             String
  tokensPrompt      Int?
  tokensCompletion  Int?
  cost              Float
  latency           Int
  status            String
  error             String?
  metadata          Json?

  organization      Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId, timestamp])
  @@index([organizationId, model])
}

model OrganizationMetrics {
  id                String   @id @default(uuid())
  organizationId    String
  date              String   // YYYY-MM-DD
  totalCost         Float
  totalTokens       BigInt
  requestCount      Int

  organization      Organization @relation(fields: [organizationId], references: [id])

  @@unique([organizationId, date])
  @@index([organizationId, date])
}

enum Plan {
  FREE
  STARTUP
  BUSINESS
  ENTERPRISE
}
```

**Task 2.6: Tests de Ingestion**

```typescript
// apps/api/tests/integration/ingestion.test.ts
describe("POST /v1/ingest", () => {
  it("should accept valid telemetry batch", async () => {
    const response = await request(app)
      .post("/v1/ingest")
      .set("X-API-Key", "am_test_key")
      .send({
        events: [
          {
            timestamp: Date.now(),
            provider: "openai",
            model: "gpt-4",
            tokensPrompt: 100,
            tokensCompletion: 50,
            cost: 0.0015,
            latency: 1200,
            status: "success",
          },
        ],
      });

    expect(response.status).toBe(202);
    expect(response.body.accepted).toBe(1);
  });

  it("should reject invalid API key", async () => {
    const response = await request(app)
      .post("/v1/ingest")
      .set("X-API-Key", "invalid")
      .send({ events: [] });

    expect(response.status).toBe(401);
  });

  it("should rate limit excessive requests", async () => {
    // Enviar 100 requests en 1s
    const promises = Array(100)
      .fill(0)
      .map(() =>
        request(app)
          .post("/v1/ingest")
          .set("X-API-Key", "am_test_key")
          .send({ events: [mockEvent] })
      );

    const responses = await Promise.all(promises);
    const rateLimited = responses.filter((r) => r.status === 429);

    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```

### Entregables Fase 2

- ✅ Endpoint `/v1/ingest` deployado en Railway/Fly.io
- ✅ Autenticación multi-tenant funcionando
- ✅ Rate limiting por plan
- ✅ Database schema con índices optimizados
- ✅ Puede procesar 1M events/día sin degradación

### Criterios de Éxito

- [ ] Latency p95 < 100ms para ingestion
- [ ] Throughput > 10k events/min
- [ ] Rate limit funciona según plan
- [ ] No data loss bajo carga

---

## 🎨 FASE 3: DASHBOARD MULTI-TENANT

**Duración**: 2 semanas  
**Owner**: Frontend Dev  
**Blocker**: Fase 2 completada

### Objetivos

- [ ] Dashboard adaptado para multi-tenancy
- [ ] Sign up flow con generación de API key
- [ ] Visualizaciones en tiempo real
- [ ] Deploy a Vercel

### Tasks

#### Week 1: Multi-tenant UI

**Task 3.1: Auth Flow con Next-Auth**

```typescript
// packages/dashboard/pages/api/auth/[...nextauth].ts
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Crear u obtener organización
      const org = await prisma.organization.upsert({
        where: { email: user.email },
        update: {},
        create: {
          name: user.name || user.email!,
          email: user.email!,
          apiKeyHash: await generateApiKey(),
          plan: "FREE",
        },
      });

      // Asociar user a org
      user.organizationId = org.id;
      return true;
    },
    async session({ session, token }) {
      session.organizationId = token.organizationId;
      return session;
    },
  },
});
```

**Task 3.2: Página de Onboarding**

```typescript
// packages/dashboard/pages/onboarding.tsx
export default function Onboarding() {
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    // Generar API key al completar signup
    async function generateKey() {
      const response = await fetch("/api/organizations/api-key", {
        method: "POST",
      });
      const { apiKey } = await response.json();
      setApiKey(apiKey);
    }
    generateKey();
  }, []);

  return (
    <div>
      <h1>Welcome to Aethermind!</h1>
      <p>Your API Key (save this securely):</p>
      <code className="bg-gray-100 p-4 block">{apiKey || "Generating..."}</code>

      <h2>Quick Start</h2>
      <pre className="bg-black text-green-400 p-4">
        {`npm install @aethermind/agent

// index.js
import { AethermindMonitor } from '@aethermind/agent';

AethermindMonitor.init({
  apiKey: '${apiKey || "YOUR_API_KEY"}',
});`}
      </pre>

      <button onClick={() => router.push("/dashboard")}>Go to Dashboard</button>
    </div>
  );
}
```

**Task 3.3: Dashboard Principal Adaptado**

```typescript
// packages/dashboard/pages/dashboard.tsx
export default function Dashboard() {
  const { data: session } = useSession();
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    // Fetch metrics para la org del user
    async function fetchMetrics() {
      const response = await fetch("/api/metrics", {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });
      const data = await response.json();
      setMetrics(data);
    }

    fetchMetrics();

    // WebSocket para updates en tiempo real
    const ws = new WebSocket(
      `wss://api.aethermind.io/ws?token=${session.accessToken}`
    );
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      if (update.type === "metrics") {
        setMetrics(update.data);
      }
    };

    return () => ws.close();
  }, [session]);

  if (!metrics) return <Loading />;

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Cards de métricas */}
      <MetricCard
        title="Total Cost Today"
        value={`$${metrics.costToday.toFixed(2)}`}
        change={metrics.costTodayChange}
      />
      <MetricCard
        title="Requests"
        value={metrics.requestsToday}
        change={metrics.requestsTodayChange}
      />
      <MetricCard title="Avg Latency" value={`${metrics.avgLatency}ms`} />

      {/* Gráfico de costos */}
      <div className="col-span-3">
        <CostChart data={metrics.costHistory} />
      </div>

      {/* Tabla de requests recientes */}
      <div className="col-span-3">
        <RequestsTable requests={metrics.recentRequests} />
      </div>
    </div>
  );
}
```

#### Week 2: Real-time & Deploy

**Task 3.4: API Endpoints para Dashboard**

```typescript
// apps/api/src/routes/metrics.ts
router.get("/api/metrics", authMiddleware, async (req, res) => {
  const orgId = req.organizationId!;
  const today = new Date().toISOString().split("T")[0];

  const [todayMetrics, history, recentRequests] = await Promise.all([
    // Métricas de hoy
    prisma.organizationMetrics.findUnique({
      where: { organizationId_date: { organizationId: orgId, date: today } },
    }),

    // Historial últimos 30 días
    prisma.organizationMetrics.findMany({
      where: {
        organizationId: orgId,
        date: { gte: subtractDays(today, 30) },
      },
      orderBy: { date: "asc" },
    }),

    // Requests recientes
    prisma.telemetryEvent.findMany({
      where: { organizationId: orgId },
      orderBy: { timestamp: "desc" },
      take: 100,
    }),
  ]);

  res.json({
    costToday: todayMetrics?.totalCost || 0,
    requestsToday: todayMetrics?.requestCount || 0,
    avgLatency: await calculateAvgLatency(orgId, today),
    costHistory: history.map((h) => ({ date: h.date, cost: h.totalCost })),
    recentRequests,
  });
});
```

**Task 3.5: WebSocket Real-time Updates**

```typescript
// apps/api/src/websocket/WebSocketManager.ts (actualizar)
export class WebSocketManager {
  private connections: Map<string, WebSocket[]> = new Map();

  async handleConnection(ws: WebSocket, orgId: string) {
    // Agregar conexión a pool de la org
    const orgConnections = this.connections.get(orgId) || [];
    orgConnections.push(ws);
    this.connections.set(orgId, orgConnections);

    ws.on('close', () => {
      // Remover de pool
      const updated = orgConnections.filter(c => c !== ws);
      this.connections.set(orgId, updated);
    });
  }

  broadcastToOrg(orgId: string, message: any) {
    const connections = this.connections.get(orgId) || [];
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }
}

// Usar en IngestionService después de flush
await this.updateAggregations(orgId, events);
websocketManager.broadcastToOrg(orgId, {
  type: 'metrics',
  data: { newEvents: events.length, totalCost: ... },
});
```

**Task 3.6: Vercel Deployment**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy dashboard
cd packages/dashboard
vercel --prod

# Configurar env vars en Vercel UI:
# - DATABASE_URL
# - NEXTAUTH_SECRET
# - GOOGLE_CLIENT_ID
# - GOOGLE_CLIENT_SECRET
```

**Task 3.7: Custom Domain Setup**

```bash
# En Vercel:
# 1. Add domain: dashboard.aethermind.io
# 2. Configure DNS (A record o CNAME)
# 3. Enable SSL (automático con Vercel)
```

### Entregables Fase 3

- ✅ Dashboard multi-tenant deployado en Vercel
- ✅ Sign up flow funcional
- ✅ Visualizaciones en tiempo real vía WebSocket
- ✅ API key management UI
- ✅ Custom domain configurado

### Criterios de Éxito

- [ ] User puede sign up con Google en <60s
- [ ] Dashboard carga métricas en <2s
- [ ] Real-time updates delay <5s
- [ ] Mobile responsive
- [ ] 5 test accounts funcionando concurrentemente

---

## 🚀 FASE 4: BETA LAUNCH & ITERACIÓN

**Duración**: 2 semanas  
**Owner**: Product + Marketing  
**Blocker**: Fase 3 completada

### Objetivos

- [ ] 10 beta users activos
- [ ] Feedback loop establecido
- [ ] $500 MRR (5 users en plan Startup)
- [ ] Documentation completa

### Tasks

#### Week 1: Beta Preparation

**Task 4.1: Landing Page**

```html
<!-- Crear en packages/landing o en Vercel -->
<!DOCTYPE html>
<html>
  <head>
    <title>Aethermind - AI Cost Observability</title>
  </head>
  <body>
    <header>
      <h1>Never overspend on AI APIs again</h1>
      <p>Real-time cost tracking for OpenAI, Anthropic, and more</p>
      <button onclick="window.location='/signup'">Start Free Trial</button>
    </header>

    <section id="how-it-works">
      <h2>How it works</h2>
      <div class="steps">
        <div class="step">
          <h3>1. Install SDK</h3>
          <pre>npm install @aethermind/agent</pre>
        </div>
        <div class="step">
          <h3>2. Add 2 lines of code</h3>
          <pre>AethermindMonitor.init({ apiKey: 'xxx' });</pre>
        </div>
        <div class="step">
          <h3>3. Monitor costs in real-time</h3>
          <img src="/dashboard-screenshot.png" />
        </div>
      </div>
    </section>

    <section id="pricing">
      <h2>Pricing</h2>
      <!-- Usar tabla de precios del roadmap -->
    </section>
  </body>
</html>
```

**Task 4.2: Documentation Site**

```markdown
<!-- docs/quickstart.md -->

# Quick Start

## Installation

\`\`\`bash
npm install @aethermind/agent
\`\`\`

## Basic Setup

\`\`\`typescript
import { AethermindMonitor } from '@aethermind/agent';

// Initialize at app startup
AethermindMonitor.init({
apiKey: process.env.AETHERMIND_API_KEY,
autoInstrument: ['openai', 'anthropic'],
});

// That's it! Now all your AI API calls are monitored.
\`\`\`

## Viewing Your Dashboard

Visit [dashboard.aethermind.io](https://dashboard.aethermind.io) to see:

- Real-time cost tracking
- Request latencies
- Error rates
- Usage by model

## Setting Budget Alerts

\`\`\`typescript
AethermindMonitor.configure({
alerts: {
dailyBudget: 100, // USD
webhook: 'https://hooks.slack.com/your-webhook',
},
});
\`\`\`

## Advanced: Manual Tracking

\`\`\`typescript
// Track custom LLM calls
AethermindMonitor.trackEvent({
provider: 'custom',
model: 'my-local-llm',
tokensPrompt: 500,
tokensCompletion: 200,
cost: 0.01,
});
\`\`\`
```

**Task 4.3: Beta User Recruitment**
Estrategia:

1. **ProductHunt launch** (anunciar fecha)
2. **Developer communities**:
   - Post en r/MachineLearning
   - Post en r/LangChain
   - Tweet thread explicando problema
3. **Direct outreach**:
   - 20 empresas en tu network que usen AI
   - Ofrecer 3 meses gratis plan Startup
4. **Content marketing**:
   - Blog post: "We spent $10k on OpenAI by accident. Here's what we learned"
   - Tutorial: "How to track your AI costs in 5 minutes"

**Task 4.4: Onboarding Email Sequence**

```
Day 0: Welcome + API key
Day 1: "Have you installed the SDK?"
Day 3: "Your first insights are ready!"
Day 7: "Advanced features you might have missed"
Day 14: Survey + offer to schedule call
```

#### Week 2: Iteration

**Task 4.5: Feedback Collection System**

```typescript
// Añadir en dashboard
<FeedbackWidget>
  <button onClick={() => setShowFeedback(true)}>
    💬 Send Feedback
  </button>
</FeedbackWidget>

// Enviar a API
POST /api/feedback
{
  userId: session.userId,
  message: "Would love to see support for Google Gemini",
  category: "feature-request"
}
```

**Task 4.6: Analytics & Tracking**

```typescript
// packages/dashboard/lib/analytics.ts
import posthog from "posthog-js";

posthog.init("phc_your_api_key", {
  api_host: "https://app.posthog.com",
});

// Track key events
export function trackEvent(event: string, properties?: any) {
  posthog.capture(event, properties);
}

// Usage
trackEvent("sdk_installed", { userId: user.id });
trackEvent("first_event_received", { organizationId: org.id });
trackEvent("upgraded_to_paid", { plan: "startup" });
```

**Task 4.7: Iterar Based on Feedback**
Ejemplo de feedback común:

- "Necesito soporte para Google Gemini" → Priorizar en Sprint 5
- "El dashboard es lento" → Optimizar queries en Fase 3
- "Quiero exportar datos a CSV" → Feature simple, añadir en 2 días

**Task 4.8: Pricing Page con Stripe**

```typescript
// packages/dashboard/pages/api/checkout.ts
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export default async function handler(req, res) {
  const { plan } = req.body;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price: plan === "startup" ? "price_startup" : "price_business",
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: `${process.env.NEXTAUTH_URL}/dashboard?upgraded=true`,
    cancel_url: `${process.env.NEXTAUTH_URL}/pricing`,
  });

  res.json({ url: session.url });
}
```

### Entregables Fase 4

- ✅ 10 beta users activos usando el SDK
- ✅ Landing page live
- ✅ Documentation completa
- ✅ Payment flow con Stripe
- ✅ $500 MRR alcanzado
- ✅ Feedback loop establecido

### Criterios de Éxito

- [ ] 10+ organizations creadas
- [ ] 5+ users en plan Startup ($49/mes)
- [ ] NPS > 8/10 de beta users
- [ ] <5% churn en primer mes
- [ ] 3+ testimonials positivos

---

## 📊 MÉTRICAS DE ÉXITO (KPIs)

### KPIs Técnicos

| Métrica                  | Baseline | Target  | Fase   |
| ------------------------ | -------- | ------- | ------ |
| **Test Coverage**        | 60%      | 80%     | Fase 1 |
| **API Latency (p95)**    | N/A      | <100ms  | Fase 2 |
| **Ingestion Throughput** | N/A      | 10k/min | Fase 2 |
| **Dashboard Load Time**  | N/A      | <2s     | Fase 3 |
| **Uptime**               | N/A      | 99.5%   | Todas  |

### KPIs de Negocio

| Métrica         | Target Fase 4 | Target 3 Meses | Target 6 Meses |
| --------------- | ------------- | -------------- | -------------- |
| **Signups**     | 20            | 100            | 500            |
| **Active Orgs** | 10            | 50             | 200            |
| **MRR**         | $500          | $2,500         | $10,000        |
| **Churn Rate**  | <10%          | <5%            | <3%            |
| **NPS**         | 8             | 9              | 9              |

### KPIs de Producto

| Métrica                  | Target |
| ------------------------ | ------ |
| **Time to First Event**  | <5 min |
| **Events per Day (avg)** | 1,000+ |
| **Dashboard DAU/MAU**    | >40%   |
| **Support Tickets/User** | <0.5   |

---

## 🎯 SIGUIENTE FASE (Post-Beta)

### Fase 5: Scale & Advanced Features (Mes 3-4)

**Prioritized Backlog**:

1. **Google Gemini Support** (si demandado por beta users)
2. **Slack Integration** para alerts
3. **Budget Enforcement** (block requests cuando se excede límite)
4. **Team Management** (múltiples users por org)
5. **CSV/JSON Export**
6. **Anomaly Detection** (ML para detectar gastos inusuales)
7. **Custom Dashboards** (user-configurable widgets)

### Fase 6: Enterprise (Mes 5-6)

**Enterprise Features**:

- SSO (SAML, OAuth)
- Audit logs
- Custom retention policies
- White-label dashboard
- Dedicated support
- SLA guarantees

---

## 🔄 ROLLBACK PLAN

Si algo sale muy mal en producción:

### Scenario 1: Agent SDK causa crashes

**Síntomas**: Clientes reportan que su app crashea después de instalar
**Acción**:

1. Publicar hotfix en npm (v0.1.1)
2. Comunicar vía email a todos los beta users
3. Ofrecer 1 mes gratis como compensación

### Scenario 2: API Ingestion se cae

**Síntomas**: 500 errors en /v1/ingest
**Acción**:

1. Rollback a deployment anterior en Railway
2. Escalar infra (más RAM/CPU)
3. Post-mortem y fix en <24h

### Scenario 3: Nadie usa el producto

**Síntomas**: Después de 1 mes, <3 signups
**Acción**:

1. Re-evaluar value proposition
2. Entrevistar a 10 potential customers
3. Pivotar o perseverar basado en feedback

---

## 💬 COMUNICACIÓN & UPDATES

### Weekly Standups (Viernes 10am)

**Agenda**:

1. Qué se completó esta semana
2. Blockers actuales
3. Plan para próxima semana
4. Decisiones que necesitan input

### Stakeholder Updates (Lunes cada 2 semanas)

**Formato**:

- Progress vs roadmap
- Key metrics
- Customer feedback highlights
- Budget status

### Beta User Updates (Viernes)

**Newsletter**:

- New features this week
- Bug fixes
- Upcoming features
- Spotlight: Power user story

---

## 🛠️ HERRAMIENTAS & RECURSOS

### Development

- **GitHub**: Code repository + Issues + Projects
- **Linear**: Sprint planning (alternativa a Jira)
- **Notion**: Documentation + Specs
- **Figma**: UI/UX designs

### Monitoring

- **Sentry**: Error tracking
- **PostHog**: Product analytics
- **Grafana Cloud**: Infrastructure metrics
- **Better Uptime**: Uptime monitoring

### Communication

- **Slack**: Team chat
- **Loom**: Async video updates
- **Canny**: Feature requests de users
- **Intercom**: Customer support chat

---

## 📋 CHECKLIST DE PRE-LAUNCH

**1 Semana Antes de Fase 4**:

- [ ] Todos los tests pasan
- [ ] Performance benchmarks alcanzados
- [ ] Security audit completado
- [ ] Legal: Terms of Service + Privacy Policy
- [ ] Stripe configurado en modo live
- [ ] Monitoring dashboards configurados
- [ ] On-call rotation definida
- [ ] Backup strategy en producción
- [ ] Incident response playbook
- [ ] Marketing materials preparados
- [ ] Testimonials de alpha users
- [ ] Video demo grabado
- [ ] FAQ documentada

**Día del Launch**:

- [ ] 🚀 Deploy a producción
- [ ] 📧 Email a waitlist
- [ ] 🐦 Tweet announcement
- [ ] 📱 ProductHunt launch
- [ ] 📊 Monitor metrics cada hora
- [ ] 💬 Responder feedback en real-time
- [ ] 🍾 Celebrar! 🎉

---

## 🎓 LECCIONES APRENDIDAS (Placeholder)

_Después de cada fase, documentar aquí:_

- Qué funcionó bien
- Qué no funcionó
- Qué haríamos diferente next time

**Ejemplo**:

> **Fase 1 Learnings**:  
> ✅ Auto-instrumentación fue más fácil de lo esperado  
> ❌ Subestimamos complejidad de batching (tomó 2 días extra)  
> 💡 Next time: Prototipar batching antes de commitment

---

**FIN DEL ROADMAP**

_Este roadmap es un living document. Actualizar semanalmente con progress real._
