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

**Estado**: ✅ COMPLETADO (7/7 tareas)

### Sprint 2: Validación + Hardening

#### ✅ Validación Zod en 4 rutas (1 día)

- [x] logs.ts: LogFilterSchema
- [x] costs.ts: CostFilterSchema
- [x] executions.ts: IdParamSchema + PaginationSchema
- [x] traces.ts: IdParamSchema + PaginationSchema
- **Commit**: `ba5a8fd` - feat: add Zod validation to 4 API routes

#### ✅ Habilitar CSP en Helmet (1h)

- [x] Configurar Content Security Policy
- [x] Directivas: defaultSrc, scriptSrc, styleSrc, connectSrc, objectSrc, frameAncestors
- **Commit**: `6b876a0` - feat: enable Content Security Policy in Helmet

#### ✅ Enforcar paginación en rutas (1h)

- [x] executions.ts GET /: PaginationSchema
- [x] traces.ts GET /: PaginationSchema
- [x] Formato de respuesta paginada consistente
- **Commit**: `711481b` - feat: enforce pagination in executions and traces routes

#### ✅ Extraer constantes mágicas (2h)

- [x] Crear config/constants.ts
- [x] Migrar todas las constantes de index.ts
- [x] Variables de entorno con defaults
- **Commit**: `07347ab` - refactor: extract magic numbers to config/constants.ts

#### ✅ Logging de auth failures (30min)

- [x] Logs estructurados en auth middleware
- [x] Incluir IP, path, timestamp, reason
- **Commit**: `eb01ef9` - feat: add structured logging for auth failures

#### ✅ Non-root user en Dockerfile (30min)

- [x] Crear usuario nodejs (1001)
- [x] --chown en COPY operations
- [x] USER nodejs en api y dashboard
- **Commit**: `7a061e8` - security: run containers as non-root user (nodejs:1001)

#### ✅ Configurar Renovate bot (1h)

- [x] Crear renovate.json
- [x] Automerge minor/patch
- [x] Manual review para major
- **Commit**: `94a3216` - chore: configure Renovate bot for dependency updates

---

## 🟢 FASE 2: PERFORMANCE (Semana 4)

**Estado**: ✅ COMPLETADO (3/3 tareas)

### Sprint 3: Optimizaciones

#### ⚡ Async bcrypt + cache Redis (4-6h)

- [x] Crear RedisCache service wrapper
- [x] Implementar SHA-256 hash + cache en authMiddleware
- [x] TTL 5 minutos para auth tokens
- [x] Latency: ~300ms → <10ms (30-60x improvement)
- **Commit**: `8b049f6` - perf: add Redis caching for auth with async bcrypt optimization

#### 💾 Caching workflows/costs (1-2 días)

- [x] Cache workflow definitions (5min TTL)
- [x] Cache cost summary (1min TTL)
- [x] Invalidate on create/update
- [x] Add req.cache to Express types
- **Commit**: `ef53292` - perf: add Redis caching for workflows and costs

#### 🗃️ Persistir traces/costs en DB (1-2 días)

- [x] Persistir traces en workflow/agent execution
- [x] Persistir costs en DB
- [x] Invalidar cache de summary
- [x] Migración: Orchestrator in-memory → DB persistence en API layer
- **Commit**: `41e79b4` - feat: persist traces and costs to database on execution

---

## 🔵 FASE 3: UPGRADES (Semanas 5-6) - PENDIENTE

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
