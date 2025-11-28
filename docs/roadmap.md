# 🚀 ROADMAP DE IMPLEMENTACIÓN AETHERMIND AGENTOS

---

## 🔴 FASE 0: TESTING CRÍTICO (Semanas 1-2)

**⚠️ BLOQUEANTE**

### Sprint 1: Baseline + Tests Core

**Objetivo:** Coverage 12% → 40%  
**Estado**: ✅ COMPLETADO (5/5 tareas - 146 tests implementados)

#### 📊 Establecer baseline coverage (2h)

- [x] Ejecutar `pnpm test:coverage`
- [x] Ajustar thresholds en `jest.config.js` a 20%
- [x] Habilitar `fail_ci_if_error: true` en CI
- **Commit**: `d9fc2b3` - chore: establish coverage baseline at 20% with CI enforcement

#### 🗄️ PrismaStore.test.ts (2 días)

- [x] CRUD completo (create, read, update, delete)
- [x] Paginación (limit, offset, max 1000)
- [x] Filtros (timestamp, level, executionId)
- [x] Manejo de errores (constraint violations, connection errors)
- **58 tests implementados**: Connection (2), Logs (10), Executions (10), Traces (7), Costs (11), Edge cases (18)
- **Commit**: `a54fdfc` - test: add comprehensive PrismaStore test suite (58 tests)

#### 🎯 Orchestrator.test.ts (2 días)

- [x] Workflow execution (DAG, conditions, retries)
- [x] Bull queue integration (job creation, processing, completion)
- [x] Traces tracking (tree structure, persistence)
- [x] Cost tracking (accumulation, per-step)
- **23 tests totales** (5 existentes + 18 nuevos): Linear workflows (2), DAG conditions (2), Failure handling (2), Timeout (1), Queue management (5), Traces (3), Costs (3)
- **Commit**: `99e61be` - test: expand Orchestrator integration tests (37 total tests)

#### 🤖 OpenAIProvider.test.ts (1 día)

- [x] Retry con backoff exponencial
- [x] Timeout handling
- [x] Cost estimation
- [x] Tool calls support
- **33 tests implementados**: Cost calculation (8), Retry logic (6), Timeout handling (2), Error handling (3), Successful requests (3), Request configuration (3)
- **Commit**: `8771c57` - test: add comprehensive OpenAIProvider test suite (33 tests)

#### 🛣️ routes/agents.test.ts (1 día)

- [x] Validación Zod (payloads válidos/inválidos)
- [x] Auth middleware (API key válido/inválido)
- [x] CRUD endpoints (GET, POST, PUT, DELETE)
- **32 tests implementados**: Validation (9), CRUD (8), Authentication (6), Edge cases (9)
- **Commit**: `2d5471f` - test: complete agents routes test suite with auth middleware tests

---

## 🟡 FASE 1: SEGURIDAD + QUICK WINS (Semana 3)

### Sprint 2: Validación + Hardening

#### ✅ Validación Zod en 4 rutas (1 día)

```typescript
// logs.ts, costs.ts, executions.ts, traces.ts
const QuerySchema = z.object({
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
  // ... campos específicos
});
```

#### 🛡️ Habilitar CSP en Helmet (1h)

```typescript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    connectSrc: ["'self'", "ws:", "wss:"]
  }
}
```

#### 📄 Enforcar paginación en rutas (1h)

```typescript
const MAX_LIMIT = 1000;
const limit = Math.min(parseInt(req.query.limit) || 100, MAX_LIMIT);
```

#### 🔧 Extraer constantes mágicas (2h)

```typescript
// config/constants.ts
export const DB_POOL_MAX = parseInt(process.env.DB_POOL_MAX || "20");
export const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || "30000");
export const QUEUE_CONCURRENCY = parseInt(
  process.env.QUEUE_CONCURRENCY || "10"
);
```

#### 📝 Logging de auth failures (30min)

```typescript
logger.warn("auth_failure", { ip: req.ip, timestamp: new Date() });
```

#### 🐳 Non-root user en Dockerfile (30min)

```dockerfile
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs
```

#### 🤖 Configurar Renovate bot (1h)

```json
{
  "extends": ["config:base"],
  "packageRules": [
    { "matchUpdateTypes": ["major"], "automerge": false },
    { "matchUpdateTypes": ["minor", "patch"], "automerge": true }
  ]
}
```

---

## 🟢 FASE 2: PERFORMANCE (Semana 4)

### Sprint 3: Optimizaciones

#### ⚡ Async bcrypt + cache Redis (4-6h)

```typescript
const cached = await redis.get(`auth:${hash}`);
if (cached) return next();
const isValid = await bcrypt.compare(apiKey, storedHash);
if (isValid) await redis.setex(`auth:${hash}`, 300, "1");
```

#### 💾 Caching workflows/costs (1-2 días)

```typescript
async getWorkflow(id: string) {
  const cached = await redis.get(`workflow:${id}`);
  if (cached) return JSON.parse(cached);
  const workflow = await prisma.workflow.findUnique({where: {id}});
  await redis.setex(`workflow:${id}`, 300, JSON.stringify(workflow));
  return workflow;
}
```

#### 🗃️ Persistir traces/costs en DB (1-2 días)

- [ ] Migrar de `Map<string, Trace[]>` a PrismaStore
- [ ] Actualizar en cada step de workflow
- [ ] Query con paginación en `getTraces()`

---

## 🔵 FASE 3: UPGRADES (Semanas 5-6)

### Sprint 4: Dependencias

#### 📦 Upgrade Prisma 6 → 7 (3-5 días)

- [ ] Review breaking changes
- [ ] Actualizar schema (syntax changes)
- [ ] Ejecutar `pnpm prisma:generate`
- [ ] Suite tests completa
- [ ] Rollback plan

#### 🧪 Upgrade Jest 29 → 30 (1-2 días)

- [ ] Review Jest 30 breaking changes
- [ ] Actualizar ts-jest, configs
- [ ] Validar todos los tests pasan

---

## 📊 MÉTRICAS DE ÉXITO

| Métrica                  | Actual | Target | Sprint     |
| ------------------------ | ------ | ------ | ---------- |
| **Coverage**             | 12%    | 60%    | Sprint 1-2 |
| **Rutas con Zod**        | 2/6    | 6/6    | Sprint 2   |
| **Latencia auth**        | ~300ms | <10ms  | Sprint 3   |
| **Deps desactualizadas** | 13     | 0      | Sprint 4   |
| **CSP habilitado**       | ❌     | ✅     | Sprint 2   |
| **Traces persistidos**   | ❌     | ✅     | Sprint 3   |

---

> [!TIP]
> Este roadmap está diseñado para ser ejecutado de forma secuencial. Cada fase depende del éxito de la anterior.

> [!IMPORTANT]
> La Fase 0 es **BLOQUEANTE** - no avanzar a las siguientes fases sin completar el 40% de coverage.
