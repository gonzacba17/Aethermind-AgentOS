# 🔬 Análisis y Optimización de Código — Aethermind AgentOS

**Fecha de análisis**: 2026-02-24  
**Última actualización**: 2026-02-25  
**Scope**: Monorepo completo — 2 apps, 8 packages, scripts, configuración, Docker, CI/CD  
**Versión**: 0.1.0  
**Branch de trabajo**: `optimization/phase-3-refactoring` (8 commits sobre `main`)  
**Herramienta de análisis**: Revisión manual exhaustiva de código + grep estático

---

## 📊 ANÁLISIS DEL PROYECTO

### Resumen Ejecutivo (post-optimización)

| Componente   | Ubicación                        | Stack                                              | Líneas aprox. | Estado                                     |
| ------------ | -------------------------------- | -------------------------------------------------- | ------------- | ------------------------------------------ |
| API Server   | `apps/api`                       | Express + Drizzle ORM + PostgreSQL                 | ~5,400        | Activo — producción                        |
| Landing Page | `apps/landing`                   | Next.js 15                                         | ~3,200        | Activo — producción                        |
| Dashboard    | `packages/dashboard`             | Next.js 16 (App Router) + React Query              | ~8,500        | Activo — producción                        |
| Core Engine  | `packages/core`                  | TypeScript puro — agentes, orquestador, workflows  | ~2,400        | Activo                                     |
| SDK Agent    | `packages/agent`                 | TypeScript — interceptores, telemetría, transporte | ~1,700        | Activo                                     |
| SDK Legacy   | `packages/sdk`                   | TypeScript — wrapper sobre `@aethermind/core`      | ~240          | **⚠️ Redundante** (pendiente)              |
| API Client   | `packages/api-client`            | TypeScript — clase `AethermindClient`              | ~185          | **⚠️ Duplicado con dashboard** (pendiente) |
| Types        | `packages/types`                 | TypeScript — interfaces compartidas                | ~260          | Activo                                     |
| Core Shared  | `packages/core-shared`           | TypeScript — pricing, cálculos de costo            | ~200          | Activo — fuente canónica pricing           |
| CLI Scaffold | `packages/create-aethermind-app` | TypeScript + templates                             | ~400          | Activo                                     |

> **Nota**: `packages/vscode-extension` fue eliminado en Phase 4.  
> Sus snippets se conservan en `docs/tools/vscode-snippets.json`.

### Hallazgos Clave — Estado Actual

| Categoría                               | Estado Original                  | Estado Post-Optimización                              | Evidencia                                              |
| --------------------------------------- | -------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| **Archivos a eliminar**                 | 9 archivos (77 KB)               | ✅ **0** — todos eliminados                           | Phase 1, 4                                             |
| **Tablas de pricing triplicadas**       | 3 copias                         | 🟡 **2** — eliminada copia agent                      | La 3ra (`cost-calculator.ts`) tiene interfaz diferente |
| **Tipos duplicados**                    | 106 líneas copiadas              | ⏳ **Pendiente**                                      | Requiere E2E testing                                   |
| **Código comentado**                    | ~150 líneas en `index.ts`        | ✅ **0** — preservado en `docs/b2b-beta-migration.md` | Phase 3a                                               |
| **Funciones exportadas sin importar**   | 5 funciones                      | ✅ **0** — todas eliminadas                           | Phase 2                                                |
| **Archivos `RedisCache` no-op**         | 1 archivo (50 líneas)            | ✅ **0** — unificado con RedisService                 | Phase 3c                                               |
| **Patrón mock-data repetido**           | ~50 llamadas en 13 hooks         | 🟡 Utility creada, adopción pendiente                 | `useQueryWithFallback` en Phase 3d                     |
| **Configs Jest redundantes**            | 5 archivos, 4 consolidables      | ✅ **1** archivo con `projects`                       | Phase 3b                                               |
| **Docs de auditoría en raíz**           | 4 archivos (87 KB)               | ✅ Movidos a `docs/audits/`                           | Phase 1                                                |
| **Dockerfile obsoleto**                 | 1 (referencia Prisma)            | ✅ Unificado con `Dockerfile.railway`                 | Phase 3a                                               |
| **Shutdown handlers duplicados**        | `SIGINT` + `SIGTERM` idénticos   | ✅ Unificados en `gracefulShutdown()`                 | Phase 2                                                |
| **Método `getPrisma()` legacy**         | 1 alias muerto                   | ✅ Eliminado                                          | Phase 2                                                |
| **Servicios Docker no-funcionales**     | Prometheus + Grafana (60 líneas) | ✅ Eliminados de `docker-compose.yml`                 | Phase 4a                                               |
| **Health endpoints inline en index.ts** | ~200 líneas inline               | ✅ Extraídos a `server/health.ts`                     | Phase 4a                                               |
| **Startup banner duplicado**            | 2 copias (HTTP + HTTPS)          | ✅ Unificado en `logStartupBanner()`                  | Phase 4b                                               |

---

## 📋 REGISTRO DE EJECUCIÓN

### Phase 1 — Sin Riesgo (Limpieza) ✅ Completada

**Commit**: `139acce` — `refactor: Phase 1 - Remove obsolete files, dead code, and debug logging`

| #   | Acción                                                                         | Archivos           | Líneas |
| --- | ------------------------------------------------------------------------------ | ------------------ | ------ |
| 1   | Eliminar `auth.ts.deprecated`                                                  | -1 archivo         | -1,408 |
| 2   | Eliminar `jest.simple.config.js`                                               | -1 archivo         | -27    |
| 3   | Eliminar `issue-esm-legacy-tests.md`                                           | -1 archivo         | —      |
| 4   | Eliminar `pr-description.md`                                                   | -1 archivo         | —      |
| 5   | Eliminar `check-columns.mjs`                                                   | -1 archivo         | -27    |
| 6   | Eliminar directorio `backups/`                                                 | -1 dir             | —      |
| 7   | Mover audits a `docs/audits/`                                                  | 4 archivos movidos | 0      |
| 8   | Eliminar `utils/env.ts` (0 importadores)                                       | -1 archivo         | -22    |
| 9   | Eliminar debug `console.log("AUTH CONFIGURATION DEBUG")` en `index.ts:129-142` | 1 archivo          | -14    |
| 10  | Eliminar `console.log("[Hot Reload]...")` en `index.ts:356`                    | 1 archivo          | -1     |
| 11  | Eliminar código comentado en `dashboard/lib/api.ts` y `auth-utils.ts`          | 2 archivos         | -13    |

### Phase 2 — Bajo Riesgo (Consolidación) ✅ Completada

**Commit**: `194341d` — `refactor: Phase 2 - Consolidate duplicated code and remove dead functions`

| #   | Acción                                                                      | Archivos   | Líneas |
| --- | --------------------------------------------------------------------------- | ---------- | ------ |
| 12  | Extraer `hashForCache()` a `utils/crypto.ts`                                | 4 archivos | -10    |
| 13  | Renombrar `PostgresStore.ts` → `store-types.ts` + actualizar Prisma comment | 4 archivos | 0      |
| 14  | Eliminar `skipAuth()` y `configureAuth()` no utilizados                     | 1 archivo  | -15    |
| 15  | Eliminar `getPrisma()` legacy de `DatabaseStore.ts`                         | 1 archivo  | -3     |
| 16  | Unificar shutdown handlers SIGINT/SIGTERM → `gracefulShutdown()`            | 1 archivo  | -25    |
| 17  | Consolidar `API_URL` duplicada → `getApiBaseUrl()` en `config.ts`           | 3 archivos | -15    |

### Phase 3 — Medio Riesgo (Refactoring) ✅ Completada

| Sub | Commit    | Descripción                                                                                                                                                                                                                                                                                                                                                                                          | Líneas                                     |
| --- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 3a  | `0930111` | Unificar `Dockerfile` + `Dockerfile.railway` en un solo `Dockerfile` multi-stage. Eliminar `docker-entrypoint.sh`. Remover ~114 líneas de código `[B2B BETA]` comentado de `index.ts`. Crear `docs/b2b-beta-migration.md` como referencia. Remover imports muertos (`httpRequestDuration`, `httpRequestTotal`).                                                                                      | -114                                       |
| 3b  | `c45bc68` | Consolidar 4 configs Jest (`jest.config.js`, `jest.unit.config.js`, `jest.integration.config.js`, `jest.e2e.config.js`) en 1 archivo con `projects: [unit, integration, e2e]`. Config compartida factorizada en `sharedConfig`.                                                                                                                                                                      | -3 archivos                                |
| 3c  | `75a8d99` | Unificar `RedisCache.ts` (stub no-op 50 líneas) con `RedisService.ts` (implementación real). Extender `RedisService` con API compatible: `isConnected()`, `set(key, val, ttl?)`, `has()`, `invalidatePattern()`, `clear()`. Actualizar imports en `index.ts`, `auth.ts`, tipo `Express.Request`. Renombrar property interna `isConnected` → `_isConnected` para evitar conflicto con método público. | -50 (stub eliminado), +30 (nuevos métodos) |
| 3d  | `3dd98e1` | Crear utility `useQueryWithFallback<T>(key, fetcher, mockData, hookName, options?)` en `packages/dashboard/src/hooks/api/`. Elimina ~15 líneas de boilerplate por hook (`shouldUseMockData()` + `reportMockFallback` + try/catch). Listo para adopción incremental.                                                                                                                                  | +58                                        |

**Detalles técnicos Phase 3c (Redis unification)**:

El `RedisCache.ts` era un stub 100% no-op que se importaba en `index.ts` como `authCache` y se inyectaba en `req.cache`. Los routes (`workflows.ts`, `costs.ts`, `agents.ts`) usaban `req.cache.get()`, `req.cache.set(key, value, ttl)`, `req.cache.del()`. `RedisService.ts` tenía métodos equivalentes pero con firma diferente para `set` (sin TTL — separate `setex`).

Solución: extender `RedisService` con:

- `set(key, value, ttlSeconds?)` — delega a `setex()` si se pasa TTL
- `isConnected()` — alias de `_isConnected` para compatibilidad con health checks
- `has(key)` — alias de `exists()`
- `invalidatePattern(pattern)` — soporta glob patterns con keys scan
- `clear()` — flushdb con fallback a `memoryStore.clear()`

### Phase 4 — Alto Impacto (Arquitectura) ✅ Parcialmente Completada

| Sub | Commit    | Descripción                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Líneas     |
| --- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 4a  | `8c7899d` | **(1)** Eliminar `packages/vscode-extension` (placeholder sin código, solo snippets). Snippets preservados en `docs/tools/vscode-snippets.json`. **(2)** Remover servicios Prometheus y Grafana de `docker-compose.yml` (60 líneas) porque `utils/metrics.ts` es todo stubs no-op. **(3)** Eliminar `packages/agent/src/shared/pricing.ts` (copia byte-identical de `core-shared`). Agregar `@aethermind/core-shared` como workspace dependency de `agent`. Actualizar import en `BaseInterceptor.ts`. **(4)** Extraer ~200 líneas de health endpoints (`/health`, `/health/db`, `/metrics`) de `index.ts` a `apps/api/src/server/health.ts` con patrón de dependency injection. Eliminar import muerto de `register` en index.ts. | -270 netas |
| 4b  | `2023477` | DRY startup banner: extraer función `logStartupBanner(host, protocol)` que reemplaza 2 copias idénticas del banner de inicio (HTTP + HTTPS).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | -16        |

**Detalles técnicos Phase 4a (health router extraction)**:

Se creó `apps/api/src/server/health.ts` con factory pattern:

```typescript
export function createHealthRouter(deps: HealthDeps): Router {
  const { authCache, databaseStore, queueService } = deps;
  // GET /metrics - Prometheus
  // GET /health - Service overview
  // GET /health/db - Detailed DB diagnostics
  return router;
}
```

Dependency injection evita que el router importe singletons globales directamente. `index.ts` monta con:

```typescript
const healthRouter = createHealthRouter({
  authCache,
  databaseStore,
  queueService,
});
app.use(healthRouter);
```

---

## 📊 MÉTRICAS FINALES

### Impacto Acumulado (8 commits, Fases 1-4)

```
47 files changed, 1,439 insertions(+), 2,987 deletions(-)
Net: -1,548 líneas
```

| Métrica                               | Antes (main)  | Después | Cambio                            |
| ------------------------------------- | ------------- | ------- | --------------------------------- |
| **Líneas en `index.ts` (API)**        | 889           | **512** | **-42%**                          |
| **Archivos en raíz del repo**         | ~35           | ~19     | **-46%**                          |
| **Paquetes workspace**                | 9             | **8**   | -1 (`vscode-extension`)           |
| **Copias de pricing**                 | 3             | **2**   | -1 (byte-identical en agent)      |
| **Servicios Redis**                   | 2 (1 fake)    | **1**   | Eliminado stub no-op              |
| **Configs Jest en raíz**              | 5             | **1**   | Consolidados con `projects`       |
| **Código comentado B2B**              | ~150 líneas   | **0**   | Preservado en docs                |
| **Funciones exportadas sin importar** | 5             | **0**   | Todas eliminadas                  |
| **Servicios Docker muertos**          | 2             | **0**   | Prometheus + Grafana removidos    |
| **Debug console.logs en prod**        | 3             | **0**   | Todos eliminados                  |
| **Interfaces duplicadas dashboard**   | 106 líneas    | ⏳ 106  | Pendiente                         |
| **Regex API_URL duplicada**           | 4 ocurrencias | 1       | Centralizada en `getApiBaseUrl()` |
| **Health endpoints inline**           | ~200 líneas   | **0**   | Extraídos a `server/health.ts`    |
| **Startup banner duplicado**          | 2 copias      | **1**   | `logStartupBanner()`              |

### Archivos Eliminados (16 total)

| Archivo                                  | Fase | Razón                                     |
| ---------------------------------------- | ---- | ----------------------------------------- |
| `apps/api/src/routes/auth.ts.deprecated` | 1    | Reemplazado por directorio `routes/auth/` |
| `jest.simple.config.js`                  | 1    | Sin referencia, CJS en codebase ESM       |
| `issue-esm-legacy-tests.md`              | 1    | Debería ser GitHub Issue                  |
| `pr-description.md`                      | 1    | PR ya mergeado                            |
| `check-columns.mjs`                      | 1    | Script de debugging de un solo uso        |
| `backups/.gitkeep`                       | 1    | Directorio vacío versionado               |
| `apps/api/src/utils/env.ts`              | 1    | 0 importadores                            |
| `docker-entrypoint.sh`                   | 3a   | Solo referenciado por Dockerfile obsoleto |
| `Dockerfile.railway`                     | 3a   | Mergeado en `Dockerfile` unificado        |
| `jest.unit.config.js`                    | 3b   | Consolidado en `jest.config.js`           |
| `jest.integration.config.js`             | 3b   | Consolidado en `jest.config.js`           |
| `jest.e2e.config.js`                     | 3b   | Consolidado en `jest.config.js`           |
| `apps/api/src/services/RedisCache.ts`    | 3c   | Stub no-op, unificado con RedisService    |
| `packages/vscode-extension/` (completo)  | 4a   | Placeholder sin código funcional          |
| `packages/agent/src/shared/pricing.ts`   | 4a   | Copia byte-identical de core-shared       |

### Archivos Nuevos/Movidos (7 total)

| Archivo                                                    | Fase | Descripción                                        |
| ---------------------------------------------------------- | ---- | -------------------------------------------------- |
| `docs/b2b-beta-migration.md`                               | 3a   | Referencia del código B2B comentado eliminado      |
| `docs/tools/vscode-snippets.json`                          | 4a   | Snippets preservados de vscode-extension eliminado |
| `apps/api/src/server/health.ts`                            | 4a   | Health endpoints extraídos de index.ts             |
| `apps/api/src/utils/crypto.ts`                             | 2    | `hashForCache()` compartida                        |
| `packages/dashboard/src/hooks/api/useQueryWithFallback.ts` | 3d   | Utility DRY para mock-data en hooks                |
| `docs/audits/` (4 archivos)                                | 1    | Movidos desde raíz del repo                        |
| `apps/api/src/services/store-types.ts`                     | 2    | Renombrado desde `PostgresStore.ts`                |

---

## 🗑️ ARCHIVOS ORIGINALMENTE DETECTADOS PARA ELIMINAR

> ✅ = Eliminado | ⏳ = Pendiente

### ✅ 1. `apps/api/src/routes/auth.ts.deprecated` — **48,209 bytes (1,408 líneas)**

- **Estado**: ✅ Eliminado en Phase 1
- **Razón**: Archivo de rutas de autenticación completamente reemplazado por el directorio `routes/auth/` (8 archivos modulares). No existe ningún import que lo referencie.

### ✅ 2. `Dockerfile` (raíz) — **Unificado en Phase 3a**

- **Estado**: ✅ Reescrito — mergeado con mejoras de `Dockerfile.railway`
- **Acción realizada**: Se fusionaron ambos Dockerfiles en uno solo multi-stage con stages `api` y `dashboard`. Incorpora mejoras de Railway: Drizzle schema sync, `startup.js`, directorio de logs, healthcheck dinámico con `$PORT`. Se eliminó `Dockerfile.railway` como archivo separado.
- **docker-compose.yml**: Actualizado para referenciar el Dockerfile unificado.

### ✅ 3. `docker-entrypoint.sh` (raíz) — **195 bytes**

- **Estado**: ✅ Eliminado en Phase 3a
- **Razón**: Solo referenciado por el Dockerfile obsoleto.

### ✅ 4. `jest.simple.config.js` — **618 bytes (27 líneas)**

- **Estado**: ✅ Eliminado en Phase 1
- **Razón**: CJS en codebase ESM, `testMatch` cubierto por `jest.e2e.config.js`, sin referencia en scripts.

### ✅ 5. `issue-esm-legacy-tests.md` (raíz) — **2,481 bytes**

- **Estado**: ✅ Eliminado en Phase 1

### ✅ 6. `pr-description.md` (raíz) — **4,758 bytes**

- **Estado**: ✅ Eliminado en Phase 1

### ✅ 7. `check-columns.mjs` (raíz) — **792 bytes**

- **Estado**: ✅ Eliminado en Phase 1

### ✅ 8. `backups/` (directorio) — solo `.gitkeep`

- **Estado**: ✅ Eliminado en Phase 1
- **docker-compose.yml**: Se removió el mount `./backups:/backups` del servicio postgres.

### ✅ 9. `packages/agent/src/shared/pricing.ts` — **4,195 bytes (126 líneas)**

- **Estado**: ✅ Eliminado en Phase 4a
- **Acción realizada**: Se añadió `@aethermind/core-shared: workspace:*` como dependencia de `@aethermind/agent`. Se actualizó `BaseInterceptor.ts` para importar `calculateCost` y `TokenUsage` desde `@aethermind/core-shared` en vez de `../shared/pricing.js`.

---

## 🔀 PROPUESTAS DE UNIFICACIÓN — Estado Actual

### ✅ 1. Unificar las 3 tablas de pricing de modelos LLM — **PARCIAL**

- **Archivos afectados originales**:
  - `packages/core-shared/src/cost/pricing.ts` (126 líneas) — original canónico
  - `packages/agent/src/shared/pricing.ts` (126 líneas) — ✅ **ELIMINADA**
  - `apps/api/src/optimization/cost-calculator.ts` (450 líneas) — ⏳ **PENDIENTE** (interfaz diferente)
- **Estado**: Copia byte-identical de agent eliminada. La 3ra tabla en `cost-calculator.ts` usa interfaz `ModelPricing` con campos adicionales (`provider`, `tier`, `contextWindow`, `capabilities`) y formato diferente (`inputPer1k`/`outputPer1k` vs `input`/`output`). Unificarla requiere crear un adapter o extender la interfaz de `core-shared`, lo cual impacta todos los consumidores.
- **Riesgo restante**: 🟠 Medio — requiere adapter + unit tests extensivos

### ⏳ 2. Eliminar tipos duplicados entre `dashboard/lib/api.ts` y `packages/types`

- **Estado**: ⏳ Pendiente
- **Razón de no ejecución**: 106 líneas de interfaces duplicadas. Requiere verificar que los tipos sean 100% idénticos y actualizar 13+ archivos de imports en el dashboard. Riesgo de Side-effects visuales requiere E2E testing completo.

### ⏳ 3. Unificar `packages/dashboard/src/lib/api.ts` con `packages/api-client`

- **Estado**: ⏳ Pendiente
- **Razón de no ejecución**: Impacta 13 hooks de React Query. Requiere E2E testing del dashboard completo.

### ⏳ 4. Evaluar eliminación de `packages/sdk`

- **Estado**: ⏳ Pendiente
- **Razón de no ejecución**: Requiere actualizar `examples/`, `README.md`, `Dockerfile`. Tiene consumidores externos documentados.

### ✅ 5. Unificar `RedisCache.ts` con `RedisService.ts`

- **Estado**: ✅ Completado en Phase 3c
- **Acción realizada**: `RedisCache.ts` (stub no-op) eliminado. `RedisService.ts` extendido con los métodos compatibles (`isConnected()`, `set(key, val, ttl?)`, `has()`, `invalidatePattern()`, `clear()`). Imports actualizados en `index.ts` y `auth.ts`. Tipo `Express.Request.cache` actualizado de `RedisCache` a `RedisService`.

### ✅ 6. Consolidar normalización de `API_URL` duplicada

- **Estado**: ✅ Completado en Phase 2
- **Acción realizada**: `getApiBaseUrl()` exportada desde `config.ts`, importada en consumidores inline.

---

## 🎯 SIMPLIFICACIONES — Estado Actual

### ✅ 1. Descomponer `apps/api/src/index.ts` — 889 → 512 líneas

- **Estado**: ✅ Parcialmente completado (Phases 3a, 4a, 4b)
- **Resultado**: 889 → 512 líneas (**-42%**)
- **Extracciones realizadas**:
  - `server/health.ts` — `/health`, `/health/db`, `/metrics` (~200 líneas extraídas)
  - `utils/crypto.ts` — `hashForCache()` compartida
  - DRY `logStartupBanner()` — eliminó 2 copias del banner de startup
  - DRY `gracefulShutdown()` — unificó SIGINT/SIGTERM idénticos
  - Eliminación de 114 líneas de código B2B comentado
  - Eliminación de imports muertos (`httpRequestDuration`, `httpRequestTotal`, `register`)
  - Eliminación de debug console.logs
- **Pendiente para futuro**: Extraer middleware setup (helmet, cors, compression, morgan) y route mounting a módulos separados si se desea reducir a ~300 líneas.

### ✅ 2. Eliminar ~150 líneas de código comentado en `index.ts`

- **Estado**: ✅ Completado en Phase 3a
- **Acción realizada**: 14 bloques `[B2B BETA]` eliminados (114 líneas). Código preservado en `docs/b2b-beta-migration.md` organizado por feature area (imports, session/passport, CSRF, OAuth, Stripe, metrics).

### ✅ 3. Unificar shutdown handlers SIGINT/SIGTERM

- **Estado**: ✅ Completado en Phase 2
- **Acción realizada**: Función `gracefulShutdown(signal)` reemplaza 2 handlers idénticos.

### ✅ 4. Refactorizar patrón `shouldUseMockData()` disperso

- **Estado**: ✅ Utility creada, adopción incremental pendiente (Phase 3d)
- **Acción realizada**: `useQueryWithFallback<T>()` creada en `packages/dashboard/src/hooks/api/useQueryWithFallback.ts`. Elimina ~15 líneas de boilerplate por hook.
- **Pendiente**: Migrar los 13 hooks existentes para usar la utility.

### ✅ 5. Extraer `hashForCache()` duplicada

- **Estado**: ✅ Completado en Phase 2
- **Acción realizada**: `apps/api/src/utils/crypto.ts` creado, imports actualizados en `apiKeyAuth.ts`, `clientAuth.ts`, y `auth.ts`.

### ✅ 6. Renombrar `PostgresStore.ts` → `store-types.ts`

- **Estado**: ✅ Completado en Phase 2
- **Acción realizada**: Archivo renombrado, comentario de Prisma actualizado, 3 imports actualizados.

---

## 🧹 CÓDIGO MUERTO — Estado Actual

### En el Backend (`apps/api/src`)

| Ubicación                                   | Estado        | Acción Tomada                                                                                              |
| ------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------- |
| `middleware/auth.ts` — `skipAuth()`         | ✅ Eliminado  | Phase 2                                                                                                    |
| `middleware/auth.ts` — `configureAuth()`    | ✅ Eliminado  | Phase 2                                                                                                    |
| `middleware/auth.ts` — `verifyApiKey()`     | Mantenido     | Solo 1 consumidor (`WebSocketManager.ts`), moverlo sería premature                                         |
| `utils/env.ts` completo (22 líneas)         | ✅ Eliminado  | Phase 1 — 0 importadores                                                                                   |
| `services/DatabaseStore.ts` — `getPrisma()` | ✅ Eliminado  | Phase 2                                                                                                    |
| `utils/metrics.ts` completo (75 líneas)     | ⏳ Mantenido  | Stubs no-op pero endpoint `/metrics` aún activo. Evaluar implementar `prom-client` o eliminar por completo |
| `index.ts` — debug console.logs             | ✅ Eliminados | Phase 1 — AUTH debug + Hot Reload                                                                          |
| `index.ts` — ~150 líneas B2B comentado      | ✅ Eliminados | Phase 3a — Preservados en `docs/b2b-beta-migration.md`                                                     |
| `index.ts` — imports muertos de metrics     | ✅ Eliminados | Phase 3a, 4a — `httpRequestDuration`, `httpRequestTotal`, `register`                                       |

### En el Dashboard (`packages/dashboard/src`)

| Ubicación                                       | Estado          | Acción Tomada                   |
| ----------------------------------------------- | --------------- | ------------------------------- |
| `lib/api.ts:13-16` — código comentado JWT       | ✅ Eliminado    | Phase 1                         |
| `lib/auth-utils.ts:10-18` — OLD JWT impl        | ✅ Eliminado    | Phase 1                         |
| `hooks/api/useAgents.ts:200,226` — regex inline | ✅ Centralizado | Phase 2 — usa `getApiBaseUrl()` |

### En `docker-compose.yml`

| Ubicación                                           | Estado        | Acción Tomada                                                            |
| --------------------------------------------------- | ------------- | ------------------------------------------------------------------------ |
| `build: { context: ., target: api }` — ref obsoleta | ✅ Corregido  | Phase 3a — apunta al Dockerfile unificado                                |
| Servicios `prometheus` + `grafana` (60 líneas)      | ✅ Eliminados | Phase 4a — metrics es todo stubs, servicios consumían recursos sin datos |
| Mount `./backups:/backups` en postgres              | ✅ Eliminado  | Phase 3a — directorio eliminado en Phase 1                               |

---

## ⚠️ ITEMS PENDIENTES (para futuras fases)

### Alta Prioridad

| #   | Item                                                                  | Impacto     | Riesgo   | Estimación |
| --- | --------------------------------------------------------------------- | ----------- | -------- | ---------- |
| 1   | **Unificar 3ra tabla pricing** (`cost-calculator.ts` → `core-shared`) | ~270 líneas | 🟠 Medio | 3h         |
| 2   | **Importar tipos desde `@aethermind/types` en dashboard**             | ~106 líneas | 🟡 Bajo  | 2h         |
| 3   | **Adoptar `useQueryWithFallback` en 13 hooks**                        | ~200 líneas | 🟡 Bajo  | 2h         |

### Media Prioridad

| #   | Item                                                                                   | Impacto     | Riesgo   | Estimación |
| --- | -------------------------------------------------------------------------------------- | ----------- | -------- | ---------- |
| 4   | **Unificar `api.ts` + `api-client`** en un solo cliente configurable                   | ~200 líneas | 🟠 Medio | 4h         |
| 5   | **Evaluar eliminación de `packages/sdk`**                                              | ~240 líneas | 🟠 Medio | 2h         |
| 6   | **Implementar `prom-client` real** o eliminar `utils/metrics.ts` y `/metrics` endpoint | ~75 líneas  | 🟡 Bajo  | 2h         |

### Baja Prioridad

| #   | Item                                                                             | Impacto    | Riesgo  | Estimación |
| --- | -------------------------------------------------------------------------------- | ---------- | ------- | ---------- |
| 7   | **Extraer middleware setup** de `index.ts` a `server/middleware.ts`              | ~60 líneas | ⬇️ Bajo | 1h         |
| 8   | **Extraer route mounting** de `index.ts` a `server/routes.ts`                    | ~30 líneas | ⬇️ Bajo | 30min      |
| 9   | **Extraer event listeners** de `index.ts` a `server/events.ts`                   | ~30 líneas | ⬇️ Bajo | 30min      |
| 10  | **Mover `verifyApiKey`** de `auth.ts` a `WebSocketManager.ts` (único consumidor) | ~20 líneas | ⬇️ Bajo | 15min      |

---

## ⚠️ CONSIDERACIONES TÉCNICAS

### Pre-existing Issues (no abordados)

1. **TypeScript errors en `apps/api/src/routes/oauth.ts`**: Errores de tipado de sesión pre-existentes. No fueron introducidos ni agravados por la optimización.
2. **`utils/metrics.ts` es 100% stubs**: El módulo existe pero no hace nada. Los servicios Prometheus/Grafana fueron removidos pero el endpoint `/metrics` sigue activo (retorna string vacío). Decisión pendiente: implementar con `prom-client` o eliminar por completo.

### Decisiones de Diseño

1. **Dependency Injection en health router**: Se eligió el patrón factory (`createHealthRouter(deps)`) en vez de imports directos de singletons para facilitar testing y evitar circular dependencies.
2. **`RedisService._isConnected` vs `isConnected()`**: Se renombró la property interna a `_isConnected` para permitir un método público `isConnected()` que sirve como API compatible con el antiguo `RedisCache`.
3. **`set(key, value, ttl?)` overload**: En vez de forzar a los consumidores a cambiar de `set` a `setex`, se añadió un parámetro opcional `ttlSeconds` que delega internamente a `setex()`.
4. **No unificar 3ra pricing table**: La interfaz `ModelPricing` en `cost-calculator.ts` es fundamentalmente diferente (8 campos vs 2 campos). Unificarla requiere un adapter o restructuración de `core-shared`, con impacto en múltiples paquetes.

---

## 📎 NOTAS ADICIONALES

### Sobre el Patrón B2B Beta

El código B2B Beta (~150 líneas) fue eliminado de `index.ts` y preservado en `docs/b2b-beta-migration.md`. Las features eliminadas incluían: session store PostgreSQL, Passport.js, CSRF tokens, Stripe webhooks, OAuth/auth routes legacy, y Prometheus metrics middleware. El sistema activo usa `clientAuth` middleware con `X-Client-Token`.

### Sobre Prometheus/Grafana

Los servicios fueron eliminados de `docker-compose.yml` con un comentario explicativo. Se pueden restaurar cuando se implemente `prom-client` real. Los volúmenes `prometheus_data` y `grafana_data` también fueron eliminados.

### Sobre `packages/vscode-extension`

El paquete fue eliminado completamente. Solo contenía un `README.md`, `package.json`, y un archivo de snippets. No tenía `src/`, ni entrypoint, ni extensión funcional. Los snippets se preservaron en `docs/tools/vscode-snippets.json` para referencia futura.

### Sobre `packages/agent` y pricing

El paquete agent ahora depende de `@aethermind/core-shared` (workspace:\*) para pricing data. Esto significa que cualquier actualización de precios en `core-shared/cost/pricing.ts` se propaga automáticamente al agent SDK sin necesidad de copiar archivos.

---

_Análisis original generado el 2026-02-24 a las 23:02 UTC-3_  
_Ejecución de optimización: 2026-02-25 00:00 – 02:30 UTC-3_  
_Revisión completa de 2 apps, 8 packages (post-optimización), scripts, configs, Docker, CI/CD_  
_Branch: `optimization/phase-3-refactoring` — 8 commits, 47 archivos modificados, -1,548 líneas netas_
