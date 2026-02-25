# 🔬 Análisis y Optimización de Código — Aethermind AgentOS

**Fecha**: 2026-02-24  
**Scope**: Monorepo completo — 2 apps, 9 packages, scripts, configuración, Docker, CI/CD  
**Versión**: 0.1.0  
**Herramienta de análisis**: Revisión manual exhaustiva de código + grep estático

---

## 📊 ANÁLISIS DEL PROYECTO

### Resumen Ejecutivo

| Componente   | Ubicación                        | Stack                                              | Líneas aprox. | Estado                           |
| ------------ | -------------------------------- | -------------------------------------------------- | ------------- | -------------------------------- |
| API Server   | `apps/api`                       | Express + Drizzle ORM + PostgreSQL                 | ~5,800        | Activo — producción              |
| Landing Page | `apps/landing`                   | Next.js 15                                         | ~3,200        | Activo — producción              |
| Dashboard    | `packages/dashboard`             | Next.js 16 (App Router) + React Query              | ~8,500        | Activo — producción              |
| Core Engine  | `packages/core`                  | TypeScript puro — agentes, orquestador, workflows  | ~2,400        | Activo                           |
| SDK Agent    | `packages/agent`                 | TypeScript — interceptores, telemetría, transporte | ~1,800        | Activo                           |
| SDK Legacy   | `packages/sdk`                   | TypeScript — wrapper sobre `@aethermind/core`      | ~240          | **⚠️ Redundante**                |
| API Client   | `packages/api-client`            | TypeScript — clase `AethermindClient`              | ~185          | **⚠️ Duplicado con dashboard**   |
| Types        | `packages/types`                 | TypeScript — interfaces compartidas                | ~260          | Activo                           |
| Core Shared  | `packages/core-shared`           | TypeScript — pricing, cálculos de costo            | ~200          | **⚠️ Duplicado en 2 sitios más** |
| CLI Scaffold | `packages/create-aethermind-app` | TypeScript + templates                             | ~400          | Activo                           |
| VS Code Ext. | `packages/vscode-extension`      | Solo snippets (sin entrypoint)                     | ~50           | **⚠️ Incompleto**                |

### Hallazgos Clave

| Categoría                             | Cantidad                       | Impacto                                 | Evidencia                                      |
| ------------------------------------- | ------------------------------ | --------------------------------------- | ---------------------------------------------- |
| **Archivos a eliminar**               | 9                              | 🔴 Alto — 77 KB de código muerto        | `.deprecated`, docs de PR, scripts de un uso   |
| **Tablas de pricing triplicadas**     | 3 copias                       | 🔴 Alto — precios fuera de sync         | `core-shared`, `agent/shared`, `optimization/` |
| **Tipos duplicados**                  | 106 líneas copiadas            | 🔴 Alto — fuente de bugs                | `dashboard/lib/api.ts` vs `packages/types`     |
| **Código comentado**                  | ~150 líneas en `index.ts`      | 🟠 Medio — ruido en archivo más crítico | Bloques `[B2B BETA]` en API server             |
| **Funciones exportadas sin importar** | 5 funciones                    | 🟠 Medio — dead code                    | `skipAuth`, `configureAuth`, `env.ts` completo |
| **Archivos `RedisCache` no-op**       | 1 archivo (50 líneas)          | 🟠 Medio — confusión de abstracción     | Stub que siempre retorna `null`                |
| **Patrón mock-data repetido**         | ~50 llamadas en 13 hooks       | 🟠 Medio — boilerplate evitable         | `shouldUseMockData()` disperso                 |
| **Configs Jest redundantes**          | 5 archivos, 4 consolidables    | 🟡 Bajo — 80% de config idéntica        | `jest.*.config.js`                             |
| **Docs de auditoría en raíz**         | 4 archivos (87 KB)             | 🟡 Bajo — contamina raíz del repo       | Deberían estar en `docs/audits/`               |
| **Dockerfile obsoleto**               | 1 (referencia Prisma)          | 🟡 Bajo — confusión                     | `Dockerfile` vs `Dockerfile.railway`           |
| **Shutdown handlers duplicados**      | `SIGINT` + `SIGTERM` idénticos | 🟡 Bajo — DRY violation                 | `index.ts` líneas 823-865                      |
| **Método `getPrisma()` legacy**       | 1 alias muerto                 | ⬇️ Mínimo — código legacy               | `DatabaseStore.ts:66-68`                       |

---

## 🗑️ ARCHIVOS A ELIMINAR

### 1. `apps/api/src/routes/auth.ts.deprecated` — **48,209 bytes (1,408 líneas)**

- **Razón**: Archivo de rutas de autenticación completamente reemplazado por el directorio `routes/auth/` (8 archivos modulares: `signup.ts`, `login.ts`, `password.ts`, `plan.ts`, `profile.ts`, `session.ts`, `oauth.ts`, `index.ts`). No existe ningún import que lo referencie en todo el codebase. Es el archivo más grande del proyecto después de `index.ts`.
- **Riesgo**: ⬇️ Ninguno — no hay imports ni referencias.

### 2. `Dockerfile` (raíz) — **2,699 bytes (70 líneas)**

- **Razón**: Referencia obsoleta a Prisma en línea 37: `COPY ... /app/prisma ./prisma`. El proyecto migró completamente a Drizzle ORM. El archivo `Dockerfile.railway` es la versión correcta y actualizada. `docker-compose.yml` usa `target: api` que apunta al `Dockerfile` genérico, lo cual es un **bug activo** — debería referenciar `Dockerfile.railway`.
- **Riesgo**: 🟠 Medio — `docker-compose.yml` línea 7 referencia `target: api` del `Dockerfile` obsoleto. **Requiere actualizar `docker-compose.yml` simultáneamente.**

### 3. `docker-entrypoint.sh` (raíz) — **195 bytes**

- **Razón**: Solo referenciado por el `Dockerfile` obsoleto (línea 40). `Dockerfile.railway` usa `startup.js` como entrypoint. Sin otros consumidores.
- **Riesgo**: ⬇️ Ninguno — eliminación derivada del punto anterior.

### 4. `jest.simple.config.js` — **618 bytes (27 líneas)**

- **Razón**: (a) Es el único config Jest que usa `module.exports` (CJS) mientras los otros 4 usan `export default` (ESM). (b) Su `testMatch` (`**/tests/api/**`) ya está cubierto por `jest.e2e.config.js` (que incluye `**/tests/api/**`). (c) No está referenciado en ningún script de `package.json` ni en CI (`ci.yml`).
- **Riesgo**: ⬇️ Ninguno — verificar con `grep -r 'jest.simple' .` que no hay scripts manuales.

### 5. `issue-esm-legacy-tests.md` (raíz) — **2,481 bytes**

- **Razón**: Documento de tracking de un bug específico (imports ESM en tests legacy). Esta información ya está duplicada en `pr-description.md` (sección "⚠️ Nota sobre Tests Legacy"). Debería ser un GitHub Issue, no un archivo en el working tree.
- **Riesgo**: ⬇️ Ninguno.

### 6. `pr-description.md` (raíz) — **4,758 bytes**

- **Razón**: Descripción de un PR ya mergeado (`fix/audit-p0-p1`). La información pertenece a la historia de Git, no al tree. El contenido de implementación está en `IMPLEMENTATION_PROGRESS.md`.
- **Riesgo**: ⬇️ Ninguno.

### 7. `check-columns.mjs` (raíz) — **792 bytes**

- **Razón**: Script de debugging de un solo uso para verificar columnas de la tabla `users`. No está referenciado en `package.json`, ni en documentación, ni en CI. Tiene problemas de encoding (UTF-16LE) que causan errores al ejecutarse.
- **Riesgo**: ⬇️ Ninguno.

### 8. `backups/` (directorio) — solo contiene `.gitkeep`

- **Razón**: Directorio vacío versionado. Los backups de DB son gestionados por el servicio `postgres-backup` en `docker-compose.yml` que monta `./backups:/backups` — pero este directorio nunca debería contener datos versionados. Si se necesita la estructura, el compose mount lo crea automáticamente.
- **Riesgo**: ⬇️ Ninguno — verificar que `docker-compose.yml` no falle si el directorio no existe (el mount lo crea).

### 9. `packages/agent/src/shared/pricing.ts` — **4,195 bytes (126 líneas)**

- **Razón**: Es una **copia byte-a-byte exacta** de `packages/core-shared/src/cost/pricing.ts`. Ambos archivos tienen exactamente 4,195 bytes y 126 líneas. El archivo `pricing.ts` en `agent/shared/` duplica las mismas interfaces (`TokenUsage`, `ModelCost`), constantes (`OPENAI_MODEL_COSTS`, `ANTHROPIC_MODEL_COSTS`, `OLLAMA_MODEL_COSTS`), y funciones (`calculateCost`, `getModelPricing`) que ya exporta `@aethermind/core-shared`.
- **Riesgo**: 🟡 Bajo — requiere que `packages/agent` importe `calculateCost` desde `@aethermind/core-shared` en vez de `../shared/pricing`.

---

## 🔀 PROPUESTAS DE UNIFICACIÓN

### 1. 🔴 **Unificar las 3 tablas de pricing de modelos LLM**

- **Archivos afectados**:
  - `packages/core-shared/src/cost/pricing.ts` (126 líneas) — original canónico
  - `packages/agent/src/shared/pricing.ts` (126 líneas) — **copia idéntica**
  - `apps/api/src/optimization/cost-calculator.ts` (450 líneas) — **tercera tabla de precios** con formato diferente (`inputPer1k`/`outputPer1k` vs `input`/`output`)
- **Problema**: Los precios de modelos LLM están definidos en **3 lugares distintos** con posibilidad de divergencia. Ejemplo concreto: `core-shared` define `gpt-4 → {input: 0.03, output: 0.06}` mientras `optimization/cost-calculator.ts` no incluye `gpt-4` base pero sí modelos exclusivos como `claude-3-5-sonnet-latest`. Cualquier actualización de precios (que ocurre cada trimestre) requiere modificar 3 archivos.
- **Beneficio**: Una sola fuente de verdad para pricing, eliminación de 250+ líneas duplicadas, actualización de precios en un solo lugar.
- **Acción**:
  1. Extender `core-shared/pricing.ts` con los campos adicionales de `cost-calculator.ts` (`provider`, `tier`, `contextWindow`, `capabilities`)
  2. Eliminar `agent/src/shared/pricing.ts` — reemplazar imports con `@aethermind/core-shared`
  3. Refactorizar `CostCalculator` para consumir pricing de `@aethermind/core-shared`
- **Riesgo**: 🟠 Medio — interfaces ligeramente diferentes (`input`/`output` vs `inputPer1k`/`outputPer1k`), requiere adapter
- **Líneas ahorradas**: ~270

### 2. 🔴 **Eliminar tipos duplicados entre `dashboard/lib/api.ts` y `packages/types`**

- **Archivos afectados**:
  - `packages/types/src/cost.ts` líneas 1-49 — definición canónica de `CostSummary`, `CostEstimate`, `StepCostEstimate`, `CostInfo`
  - `packages/dashboard/src/lib/api.ts` líneas 121-226 — copias manuales de `Agent`, `LogEntry`, `ExecutionResult`, `TraceNode`, `Trace`, `CostSummary`, `CostEstimate`, `StepCostEstimate`, `CostInfo`
- **Problema**: 106 líneas de interfaces copiadas a mano entre paquetes. Comparación directa:

  ```
  // packages/types/src/cost.ts:1-6
  export interface CostSummary {
    total: number; totalTokens: number; executionCount: number;
    byModel: Record<string, { count: number; tokens: number; cost: number }>;
  }

  // packages/dashboard/src/lib/api.ts:179-184  ← COPIA EXACTA
  export interface CostSummary {
    total: number; totalTokens: number; executionCount: number;
    byModel: Record<string, { count: number; tokens: number; cost: number }>;
  }
  ```

  Si un campo cambia en el API server, el dashboard seguirá compilando pero con datos incorrectos — bugs silenciosos.

- **Beneficio**: Single source of truth, errores de TypeScript en compile-time si hay divergencia.
- **Acción**: Añadir `@aethermind/types` como dependencia del dashboard, importar tipos desde allí.
- **Riesgo**: 🟡 Bajo — los tipos son idénticos, solo cambian las líneas de import.
- **Líneas ahorradas**: ~106

### 3. 🟠 **Unificar `packages/dashboard/src/lib/api.ts` con `packages/api-client`**

- **Archivos afectados**:
  - `packages/dashboard/src/lib/api.ts` — 368 líneas, funciones standalone (`fetchAgents`, `fetchLogs`, etc.)
  - `packages/api-client/src/core/client.ts` — 185 líneas, clase `AethermindClient` con métodos equivalentes
- **Problema**: Son dos implementaciones paralelas del mismo cliente API con interfaces casi idénticas:
  | Feature | `dashboard/lib/api.ts` | `api-client/core/client.ts` |
  |---|---|---|
  | Auth header | `X-Client-Token` (B2B beta) | `Authorization: Bearer` |
  | Retry | Sí, con backoff exponencial | No |
  | Timeout | No | Sí, `AbortController` |
  | URL normalization | Sí (`replace(/\/api\/?$/, '')`) | No |
  | Error class | Inline | `ApiError` class |
- **Beneficio**: Un solo cliente API configurable para ambos contextos, retry y timeout unificados.
- **Acción**:
  1. Extender `AethermindClient` con opciones de auth mode (`bearer` | `x-client-token`)
  2. Añadir retry con backoff al `AethermindClient`
  3. Refactorizar hooks del dashboard para usar `AethermindClient`
- **Riesgo**: 🟠 Medio — impacta 13 hooks de React Query, requiere E2E testing del dashboard.
- **Líneas ahorradas**: ~200

### 4. 🟠 **Evaluar eliminación de `packages/sdk` (wrapper sobre `@aethermind/core`)**

- **Archivos afectados**: `packages/sdk/src/index.ts` — 240 líneas (único archivo fuente)
- **Problema**: El paquete `@aethermind/sdk` es un wrapper trivial que:
  1. Importa funciones de `@aethermind/core` (`createRuntime`, `createOrchestrator`, etc.)
  2. Mantiene estado global (`globalRuntime`, `globalOrchestrator`)
  3. Expone helpers como `createAgent()` y `executeTask()` que son wrappers de 5-10 líneas

  **No confundir con `@aethermind/agent`** — que es el SDK de telemetría/interceptores con lógica propia.

- **Beneficio**: Eliminar un paquete workspace, simplificar `Dockerfile.railway` (líneas 53-54), reducir confusión SDK vs agent.
- **Acción**: Mover los helpers a `@aethermind/core/helpers/` y actualizar imports en `examples/`.
- **Riesgo**: 🟠 Medio:
  - `examples/basic-agent/` importa de `@aethermind/sdk`
  - `README.md` documenta `@aethermind/sdk` en la guía de quick start
  - `Dockerfile.railway` copia `packages/sdk/dist`
- **Líneas ahorradas**: ~240

### 5. 🟠 **Unificar `RedisCache.ts` (stub no-op) con `RedisService.ts` (implementación real)**

- **Archivos afectados**:
  - `apps/api/src/services/RedisCache.ts` — 50 líneas, **100% no-op**: todas las funciones retornan `null`/`false`/`void`
  - `apps/api/src/services/RedisService.ts` — 219 líneas, implementación real con fallback in-memory
- **Problema**: `RedisCache` es un stub puro que imprime "ℹ️ Redis cache is disabled" y nunca hace nada. Sin embargo, se importa en `index.ts` (línea 71) y se inyecta en `req.cache`. Mientras tanto, `RedisService.ts` implementa la misma funcionalidad con fallback graceful. La existencia de ambos genera confusión sobre cuál usar.
- **Beneficio**: Eliminar la abstracción falsa, usar una sola implementación consistente.
- **Acción**: Reemplazar `RedisCache` con `RedisService` en `index.ts`. Actualizar la interfaz si es necesario.
- **Riesgo**: 🟠 Medio — `index.ts` importa `redisCache` y lo inyecta en `req.cache`. Requiere renombrar y verificar los consumidores.
- **Líneas ahorradas**: ~50

### 6. 🟡 **Consolidar normalización de `API_URL` duplicada**

- **Archivos afectados**:
  - `packages/dashboard/src/lib/api.ts` línea 6: `RAW_API_URL.replace(/\/api\/?$/, '').replace(/\/+$/, '')`
  - `packages/dashboard/src/lib/config.ts` línea 22: `(process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/?$/, '').replace(/\/+$/, '')`
  - `packages/dashboard/src/hooks/api/useAgents.ts` líneas 200, 226: regex de normalización copiada inline
- **Problema**: La misma regex `replace(/\/api\/?$/, '').replace(/\/+$/, '')` aparece en **4 lugares**. Este patrón fue la causa del bug de "API URL duplicada" documentado en conversación `263f0023` (2026-02-24).
- **Beneficio**: Evitar bugs futuros por inconsistencia, cambio en un solo lugar.
- **Acción**: Exportar `getApiBaseUrl()` desde `config.ts`, importar en todos los consumidores.
- **Riesgo**: ⬇️ Bajo.
- **Líneas ahorradas**: ~15

---

## 🎯 SIMPLIFICACIONES RECOMENDADAS

### 1. **Descomponer `apps/api/src/index.ts` — 889 líneas → ~300 líneas**

- **Problema**: El archivo principal del server contiene la inicialización de servicios (líneas 1-238), el `startServer()` de 582 líneas que mezcla middleware setup, route mounting, event listeners, health check con 137 líneas de diagnóstico SQL inline, y shutdown handlers.
- **Cambio propuesto**: Extraer en módulos:
  ```
  src/server/
    middleware.ts      — helmet, cors, compression, morgan, rate limiting (~80 líneas)
    routes.ts          — montaje de todas las rutas (~40 líneas)
    health.ts          — endpoint /health y /health/db (~150 líneas)
    events.ts          — event listeners del runtime (~30 líneas)
    shutdown.ts        — SIGINT/SIGTERM handlers unificados (~25 líneas)
  ```
- **Líneas ahorradas**: ~580 del `index.ts` (quedan ~300 con imports + `startServer()` simplificado)
- **Impacto**: Mayor legibilidad, debugging más rápido, PRs atómicos más claros.

### 2. **Eliminar ~150 líneas de código comentado en `index.ts`**

- **Problema**: `index.ts` contiene 14 bloques de código comentado marcados `[B2B BETA]` (líneas 53-57, 64-67, 80-81, 83-84, 109-116, 144-153, 388-415, 446-451, 456-467, 521-541, 571-573, 714-718, 726-727, 730-731, 755-757). Cada bloque está anotado con "commented out, not deleted", pero **la decisión ya fue tomada**: el sistema B2B está activo con `clientAuth`.
- **Cambio propuesto**: Mover el código comentado a un archivo `docs/b2b-beta-migration.md` como referencia, limpiando `index.ts`.
- **Líneas ahorradas**: ~150
- **Impacto**: El archivo más crítico del sistema pasa de 889 líneas a ~740 inmediatamente, sin ningún riesgo funcional.

### 3. **Unificar shutdown handlers SIGINT/SIGTERM**

- **Problema**: Los handlers de `SIGINT` (líneas 823-843) y `SIGTERM` (líneas 845-865) son **idénticos** — mismas 20 líneas copiadas.
- **Cambio propuesto**:
  ```typescript
  async function gracefulShutdown(signal: string) {
    console.log(`\n${signal} received — shutting down...`);
    try {
      await orchestrator.shutdown();
    } catch (e) {
      /* ... */
    }
    if (databaseStore) await databaseStore.close();
    try {
      await authCache.close();
    } catch (e) {
      /* ... */
    }
    server.close();
    process.exit(0);
  }
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  ```
- **Líneas ahorradas**: ~25
- **Impacto**: DRY, cualquier cambio futuro en shutdown se aplica una sola vez.

### 4. **Refactorizar patrón `shouldUseMockData()` disperso — ~50 llamadas en 13 hooks**

- **Problema**: El patrón `if (shouldUseMockData()) { return MOCK_X }` está repetido en cada hook del dashboard. Cada hook de `hooks/api/` (13 archivos, ~121 KB total) repite la misma lógica:
  ```typescript
  // Repetido en useAgents, useLogs, useTraces, useCosts, useAlerts,
  // useWorkflows, useForecasting, useOptimization, useOrganization, useBudget...
  if (shouldUseMockData()) {
    if (!reportedRef.current) {
      reportMockFallback("useX", "NEXT_PUBLIC_API_URL not configured");
      reportedRef.current = true;
    }
    return MOCK_DATA;
  }
  ```
- **Cambio propuesto**: Crear wrapper `createQueryWithFallback<T>()`:
  ```typescript
  function createQueryWithFallback<T>(
    key: readonly unknown[],
    fetcher: () => Promise<T>,
    mockData: T,
    hookName: string,
  ) {
    const { reportMockFallback } = useMockDataContext();
    const reportedRef = useRef(false);
    return useQuery({
      queryKey: key,
      queryFn: async () => {
        if (shouldUseMockData()) {
          if (!reportedRef.current) {
            reportMockFallback(hookName, "API not configured");
            reportedRef.current = true;
          }
          return mockData;
        }
        try {
          return await fetcher();
        } catch (error) {
          if (!reportedRef.current) {
            reportMockFallback(hookName, (error as Error).message);
            reportedRef.current = true;
          }
          return mockData;
        }
      },
    });
  }
  ```
- **Líneas ahorradas**: ~200 (15 líneas por hook × 13 hooks)
- **Impacto**: Hooks más legibles, lógica de mock centralizada, fácil de desactivar mock globalmente.

### 5. **Extraer `hashForCache()` duplicada a `utils/crypto.ts`**

- **Problema**: La función `hashForCache(token) → SHA-256 hex` está implementada **identically** en:
  - `apps/api/src/middleware/apiKeyAuth.ts` líneas 36-38
  - `apps/api/src/middleware/clientAuth.ts` líneas 27-29
  - `apps/api/src/middleware/auth.ts` línea 196 (inline, sin helper)
- **Cambio propuesto**: Crear `apps/api/src/utils/crypto.ts`:
  ```typescript
  import crypto from "crypto";
  export function hashForCache(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex");
  }
  ```
- **Líneas ahorradas**: ~10
- **Impacto**: DRY, patrón reusable, elimina la responsabilidad de elegir el hash algorithm de cada middleware.

### 6. **Renombrar `PostgresStore.ts` → `store-types.ts`**

- **Problema**: El archivo `apps/api/src/services/PostgresStore.ts` (73 líneas) contiene el comentario engañoso `"The actual implementation is in PrismaStore.ts"` (línea 5) — Prisma ya no existe en el proyecto. El archivo solo define interfaces (`StoreInterface`, `PaginatedResult`, `AgentRecord`) sin implementación real. El nombre "PostgresStore" sugiere una implementación de PostgreSQL que no existe aquí — la implementación real es `DatabaseStore.ts`.
- **Cambio propuesto**: Renombrar a `store-types.ts`, actualizar el comentario, actualizar 3 imports que lo referencian (`DatabaseStore.ts`, `InMemoryStore.ts`, `index.ts`).
- **Líneas ahorradas**: 0 (solo rename)
- **Impacto**: Elimina confusión, el nombre refleja el contenido real.

---

## 🧹 CÓDIGO MUERTO DETECTADO

### En el Backend (`apps/api/src`)

| Ubicación                               | Tipo                            | Descripción                                                                                                                                                                                                               | Evidencia                                                                       |
| --------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `middleware/auth.ts:241-243`            | Función exportada no importada  | `skipAuth()` — exportada pero nunca importada en ningún archivo del proyecto                                                                                                                                              | `grep -r 'skipAuth' src/` → solo 1 resultado (la definición)                    |
| `middleware/auth.ts:40-42`              | Función exportada no llamada    | `configureAuth()` — existe la definición y un import comentado en `index.ts:145-153`, pero **nunca se ejecuta**                                                                                                           | `configureAuth` solo aparece en `auth.ts` (definición) e `index.ts` (comentado) |
| `middleware/auth.ts:245-265`            | Función exportada, 1 consumidor | `verifyApiKey()` — solo usada en `WebSocketManager.ts`. Podría moverse allí como función privada                                                                                                                          | `grep -r 'verifyApiKey'` → 3 resultados: definición, export, y WebSocketManager |
| `utils/env.ts` completo (22 líneas)     | Módulo sin importadores         | `getEnv()`, `requireEnv()`, `getEnvOrDefault()` — **ninguno de los 3 se importan en ningún sitio**. El proyecto usa `process.env[]` directamente y `config/constants.ts` para defaults                                    | `grep -r 'from.*utils/env' src/` → 0 resultados                                 |
| `services/DatabaseStore.ts:66-68`       | Método legacy                   | `getPrisma()` — alias de `getDrizzle()` para "backward compatibility". Solo `getDrizzle()` se usa en `index.ts:743`. `getPrisma()` no tiene importadores                                                                  | `grep -r 'getPrisma' src/` → solo la definición                                 |
| `utils/metrics.ts` completo (75 líneas) | Módulo no-op                    | Todas las métricas son stubs vacíos. `httpRequestDuration` y `httpRequestTotal` se importan en `index.ts` pero el middleware que las usa está **comentado** (líneas 456-467). El endpoint `/metrics` retorna string vacío | Los imports existen pero los stubs hacen literalmente nada                      |
| `index.ts:129-142`                      | Debug logging en producción     | 14 líneas de `console.log("AUTH CONFIGURATION DEBUG:")` que imprimen configuración de auth en cada inicio. Debería usar `logger.debug()` o eliminarse                                                                     | `console.log` en producción para debug                                          |
| `index.ts:356`                          | Console log residual            | `console.log("[Hot Reload] Feature deprecated - use API to update agents")` — mensaje de feature eliminado, se imprime en cada startup                                                                                    | Código muerto informativo                                                       |

### En el Dashboard (`packages/dashboard/src`)

| Ubicación                        | Tipo                   | Descripción                                                                                                                                                                                  |
| -------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/api.ts:13-16`               | Código comentado       | 4 líneas de refresh JWT logic comentada                                                                                                                                                      |
| `lib/auth-utils.ts:10-18`        | Código comentado       | ~9 líneas de implementación JWT anterior (con `// OLD JWT implementation` header)                                                                                                            |
| `hooks/api/useAgents.ts:200,226` | Regex duplicada inline | `(process.env.NEXT_PUBLIC_API_URL \|\| '').replace(/\/api\/?$/, '').replace(/\/+$/, '')` — copiada inline en `useUpdateAgent` y `useDeleteAgent` en vez de usar `API_BASE` del mismo paquete |

### En `docker-compose.yml`

| Ubicación                                           | Tipo                     | Descripción                                                                                                                                                                            |
| --------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Líneas 4-7                                          | Referencia obsoleta      | `build: { context: ., target: api }` apunta al stage `api` del `Dockerfile` obsoleto (que copia `/app/prisma`). Debería usar `Dockerfile.railway`                                      |
| Servicios `prometheus` + `grafana` (líneas 144-202) | Servicios no funcionales | El módulo `metrics.ts` es un stub no-op → Prometheus scrapeará `/metrics` y obtendrá un string vacío. Grafana mostrará dashboards vacíos. 60 líneas de config para servicios sin datos |

---

## ⚠️ CONSIDERACIONES

### Efectos Secundarios Potenciales

1. **Eliminar `Dockerfile` (raíz)** → `docker-compose.yml` línea 7 (`target: api`) referencia stages de este Dockerfile. **Hay que actualizar `docker-compose.yml` para usar `dockerfile: Dockerfile.railway`** o unificar ambos Dockerfiles.

2. **Eliminar `packages/agent/src/shared/pricing.ts`** → `packages/agent/src/interceptors/BaseInterceptor.ts` importa `calculateCost` desde `../shared/pricing`. Requiere cambiar a `import { calculateCost } from '@aethermind/core-shared'` y añadir `@aethermind/core-shared` como dependencia en `packages/agent/package.json`.

3. **Eliminar `packages/sdk`** → requiere actualizar:
   - `examples/basic-agent/package.json` + código fuente
   - `README.md` secciones de Quick Start y Usage
   - `Dockerfile.railway` línea 54: `COPY --from=builder ... packages/sdk/dist`
   - `pnpm-lock.yaml` (regenerar con `pnpm install`)

4. **Unificar `RedisCache.ts` y `RedisService.ts`** → `index.ts` importa `redisCache` (línea 71), lo inyecta en `req.cache` (línea 739), y lo usa en `health` endpoint (línea 518). Todos estos puntos necesitan actualización.

5. **Refactorizar hooks mock-data** → Los tests del dashboard (si existen) podrían depender del comportamiento actual de `shouldUseMockData()` en cada hook individual.

### Cambios que Requieren Testing Extensivo

| Cambio                           | Tests Necesarios                                                      | Estimación |
| -------------------------------- | --------------------------------------------------------------------- | ---------- |
| Unificar pricing tables          | Unit tests de `calculateCost()` con todos los modelos                 | 2h         |
| Unificar `api.ts` ↔ `api-client` | E2E del dashboard completo (auth, list, detail, mutations)            | 4h         |
| Eliminar `RedisCache` stub       | Unit test de `auth middleware`, integration test de `health` endpoint | 1h         |
| Actualizar `docker-compose.yml`  | Docker compose up/down cycle, health check validation                 | 1h         |
| Descomponer `index.ts`           | Full integration test suite + smoke test del server startup           | 2h         |

---

## 📋 ORDEN DE IMPLEMENTACIÓN SEGURO

### Fase 1 — Sin Riesgo (Limpieza) ⚡ ~2 horas

Cambios que no afectan ningún comportamiento funcional:

1. ☐ Eliminar `apps/api/src/routes/auth.ts.deprecated` (48 KB)
2. ☐ Eliminar `jest.simple.config.js` (618 B)
3. ☐ Eliminar `issue-esm-legacy-tests.md` (2.5 KB)
4. ☐ Eliminar `pr-description.md` (4.8 KB)
5. ☐ Eliminar `check-columns.mjs` (792 B)
6. ☐ Eliminar directorio `backups/` (solo `.gitkeep`)
7. ☐ Mover 4 archivos de auditoría de raíz a `docs/audits/`: `AUDIT_REPORT.md`, `BACKEND_AUDIT.md`, `CODE_QUALITY_REPORT.md`, `IMPLEMENTATION_PROGRESS.md`
8. ☐ Eliminar código comentado en `dashboard/lib/api.ts` (4 líneas) y `dashboard/lib/auth-utils.ts` (9 líneas)
9. ☐ Eliminar debug `console.log("AUTH CONFIGURATION DEBUG:")` en `index.ts:129-142`
10. ☐ Eliminar `console.log("[Hot Reload]...")` en `index.ts:356`
11. ☐ Eliminar `utils/env.ts` (22 líneas, 0 importadores)

### Fase 2 — Bajo Riesgo (Consolidación) 🔧 ~4 horas

Cambios con impacto mínimo que requieren actualización de imports:

12. ☐ Eliminar `packages/agent/src/shared/pricing.ts` → importar desde `@aethermind/core-shared`
13. ☐ Unificar normalización de `API_URL` → exportar `getApiBaseUrl()` desde `config.ts`
14. ☐ Extraer `hashForCache()` a `utils/crypto.ts` compartido
15. ☐ Renombrar `PostgresStore.ts` → `store-types.ts` + actualizar comentario de Prisma
16. ☐ Eliminar `skipAuth()` y `configureAuth()` no utilizados de `middleware/auth.ts`
17. ☐ Eliminar `getPrisma()` legacy de `DatabaseStore.ts`
18. ☐ Importar tipos desde `@aethermind/types` en el dashboard (eliminar 106 líneas duplicadas)
19. ☐ Unificar shutdown handlers SIGINT/SIGTERM

### Fase 3 — Medio Riesgo (Refactoring) 🔨 ~8 horas

Cambios estructurales que requieren testing:

20. ☐ Eliminar `Dockerfile` obsoleto + `docker-entrypoint.sh` + actualizar `docker-compose.yml`
21. ☐ Eliminar ~150 líneas de código comentado `[B2B BETA]` en `index.ts` (mover referencia a `docs/`)
22. ☐ Descomponer `index.ts` de 889 → ~300 líneas (extraer middleware, routes, health, events, shutdown)
23. ☐ Consolidar 4 configs Jest en una con `projects: []`
24. ☐ Unificar `RedisCache.ts` y `RedisService.ts` en un solo servicio
25. ☐ Crear wrapper `createQueryWithFallback<T>()` para mock-data en dashboard

### Fase 4 — Alto Impacto (Arquitectura) 🏗️ ~12 horas

Cambios que afectan la arquitectura de paquetes:

26. ☐ Unificar las 3 tablas de pricing en `@aethermind/core-shared`
27. ☐ Evaluar eliminación de `packages/sdk` → mover helpers a `core`
28. ☐ Unificar `api.ts` y `api-client` en un solo cliente API configurable
29. ☐ Decidir destino de `packages/vscode-extension` (completar o eliminar)
30. ☐ Eliminar servicios Prometheus/Grafana del `docker-compose.yml` o implementar métricas reales

---

## 📈 MÉTRICAS DE MEJORA ESPERADA

| Métrica                            | Actual        | Post Fase 1-2 | Post Fase 3-4     |
| ---------------------------------- | ------------- | ------------- | ----------------- |
| Archivos en raíz del repo          | 35            | 27 (-23%)     | 24 (-31%)         |
| Paquetes workspace                 | 9             | 9             | 7-8               |
| Líneas en `index.ts` (API)         | 889           | ~740          | ~300              |
| Definiciones de pricing de modelos | 3             | 2             | **1**             |
| Interfaces de tipos duplicadas     | 106 líneas    | 0             | 0                 |
| Configs Jest en raíz               | 5             | 4             | **1** (+projects) |
| Código comentado muerto            | ~150 líneas   | ~20           | 0                 |
| Funciones exportadas sin importar  | 5             | 0             | 0                 |
| Archivos no-op/stub sin valor      | 2             | 1             | 0                 |
| Líneas totales eliminadas          | —             | ~350          | ~1,100            |
| Regex API_URL duplicada            | 4 ocurrencias | 1             | 1                 |
| Llamadas `shouldUseMockData()`     | ~50           | ~50           | ~13 (1 por hook)  |

---

## 📎 NOTAS ADICIONALES

### Sobre el Patrón B2B Beta

Actualmente `index.ts` tiene ~150 líneas de código comentado del sistema auth anterior (JWT + OAuth + session + CSRF + Stripe). El sistema **activo** usa `clientAuth` middleware con `X-Client-Token`. La decisión arquitectónica ya fue tomada, pero el código anterior se mantiene "por referencia". Recomendación: documentar la migración en un archivo dedicado y limpiar `index.ts`.

### Sobre Prometheus/Grafana

`docker-compose.yml` define servicios Prometheus y Grafana (60 líneas) que consumen un módulo `metrics.ts` que es **100% stubs no-op**. Esto significa que estos servicios Docker arrancan, consumen recursos, pero no muestran datos útiles. Recomendación: o implementar `prom-client` realmente, o eliminar estos servicios hasta que se necesiten.

### Sobre `packages/vscode-extension`

Este paquete contiene solo un `README.md`, un `package.json`, y un directorio `snippets/` con 1 archivo. No tiene `src/`, no tiene entrypoint, no tiene extensión funcional. Es un placeholder para un feature futuro que nunca se implementó. Recomendación: mover los snippets a `docs/tools/vscode-snippets/` y eliminar el paquete.

---

_Análisis generado el 2026-02-24 a las 23:02 UTC-3_  
_Revisión completa de 2 apps, 9 packages, 23 scripts, 5 Jest configs, 2 Dockerfiles, CI/CD pipeline_
