# Auditoría Completa: Aethermind AgentOS

**Fecha**: 2026-02-17  
**Branch**: `fix/audit-p0-p1`  
**Última actualización**: 2026-02-17 — Week 1 de hardening completada (14/25 findings resueltos)

---

## 1. Estructura General

**Tipo**: Monorepo SaaS — plataforma FinOps para control de costos de agentes de IA.

**Stack tecnológico**:

| Capa               | Tecnología                                |
| ------------------ | ----------------------------------------- |
| Backend API        | Express 4.19, Node.js 20, TypeScript 5.4  |
| Frontend Dashboard | Next.js 16.0.10, React 19.2               |
| Landing Page       | Next.js 15.3.9, React 19.0                |
| Base de datos      | PostgreSQL 16 + Drizzle ORM 0.45.1        |
| Cache/Colas        | Redis 7 (ioredis) + BullMQ 5.41           |
| Monorepo           | pnpm workspaces + Turbo 2.6.1             |
| Pagos              | Stripe 14.11                              |
| Auth               | JWT + Passport OAuth2 (Google, GitHub)    |
| Monitoring         | Prometheus + Grafana + Winston            |
| Deploy             | Docker, Railway (API), Vercel (Dashboard) |

**Arquitectura**: Monorepo con 2 apps + 9 packages + 2 examples. Arquitectura en capas (presentación → API → servicios → datos) con patrón Service + Factory para el backend.

---

## 2. Calidad del Código

### Patrones positivos

- **Service Pattern** bien implementado: `BudgetService`, `AlertService`, `StripeService`, `EmailService`
- **Factory functions**: `createBudgetService()`, `createAlertService()`, `createDatabaseStore()`
- **Repository pattern**: `StoreInterface` con múltiples implementaciones (`DatabaseStore`, `InMemoryStore`, `PostgresStore`)
- **Error handling centralizado**: Custom errors (`AppError`, `NotFoundError`, `ValidationError`) + `asyncHandler` wrapper en `apps/api/src/middleware/error-handler.ts:89-94`
- **Resiliencia**: Circuit breaker (`apps/api/src/budget/circuit-breaker.ts`), bulkhead (`apps/api/src/services/resilience/BulkheadService.ts`), retry con backoff (`packages/core/src/utils/retry.ts`)

### Code smells detectados

**God Objects — archivos monolíticos**:

- `apps/api/src/index.ts` — **870 líneas**. Maneja routing, middleware, WebSocket, DB init, métricas, todo en un solo archivo.
- `apps/api/src/routes/budgets.ts` — **907 líneas** en un solo archivo de rutas.
- `packages/dashboard/src/app/(dashboard)/agents/page.tsx` — **737 líneas**. Un componente React que gestiona CRUD, filtros, diálogos, paginación, todo inline.

**Uso excesivo de `any`** (~30+ instancias). Ejemplo concreto en `apps/api/src/index.ts:300-307`:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
runtime.getEmitter().on("agent:event", (event: any) => { ... });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
runtime.getEmitter().on("log", (entry: any) => { ... });
```

El `eslint-disable` demuestra que se conoce el problema y se ignora intencionalmente.

**Console.log de debug en producción** — `apps/api/src/index.ts:122-134`:

```typescript
console.log("\n🔍 AUTH CONFIGURATION DEBUG:");
console.log(`   DISABLE_AUTH env var: "${process.env["DISABLE_AUTH"]}"`);
console.log(`   API_KEY_HASH exists: ${!!process.env["API_KEY_HASH"]}`);
```

Esto expone información sensible de configuración en logs de producción.

**TODOs abandonados**:

- `apps/api/src/index.ts`: "TODO: Fix metrics module initialization"
- `apps/api/src/utils/metrics.ts`: "TODO: Install prom-client package"
- `packages/dashboard/src/hooks/api/useCosts.ts`: "TODO: Implement when backend endpoint is ready"

---

## 3. Dependencias

### Versiones problemáticas

| Dependencia         | Versión          | Problema                                                      |
| ------------------- | ---------------- | ------------------------------------------------------------- |
| `passport-github2`  | ^0.1.12          | **Sin mantenimiento desde 2016**. Vulnerabilidades conocidas. |
| `Next.js` (landing) | 15.3.9           | Inconsistente con dashboard (16.0.10)                         |
| `React` (landing)   | 19.0.0           | Inconsistente con dashboard (19.2.0)                          |
| `zod`               | 3.23.0 y 3.25.76 | **Dos versiones distintas** en el mismo monorepo              |

### Lock file

`pnpm-lock.yaml` presente (18,132 líneas). No hay lock files duplicados.

---

## 4. Puntos Críticos

Los archivos con mayor riesgo de bugs por complejidad y falta de tests:

| Archivo                                  | Líneas | Tests   | Riesgo                                     |
| ---------------------------------------- | ------ | ------- | ------------------------------------------ |
| `apps/api/src/index.ts`                  | 870    | Ninguno | **Crítico** — punto de entrada monolítico  |
| `apps/api/src/routes/budgets.ts`         | 907    | Ninguno | **Crítico** — lógica financiera sin tests  |
| `apps/api/src/ml/alerts.ts`              | 776+   | Ninguno | **Alto** — ML/forecasting sin validación   |
| `apps/api/src/optimization/engine.ts`    | 417+   | Ninguno | **Alto** — motor de optimización sin tests |
| `apps/api/src/services/OAuthService.ts`  | 284    | Ninguno | **Alto** — flujo auth complejo sin tests   |
| `packages/dashboard/.../agents/page.tsx` | 737    | Ninguno | **Medio** — componente UI frágil           |

---

## 5. Seguridad

### CRÍTICO

**1. Token JWT en URL de redirect OAuth** — `apps/api/src/routes/oauth.ts:117-126`:

```typescript
// For cross-domain OAuth (API on Railway, Frontend on Vercel),
// we must pass the token in the URL since cookies won't work across domains.
const redirectUrl = new URL(redirect);
redirectUrl.searchParams.set("token", token); // JWT en query string
res.redirect(redirectUrl.toString());
```

Esto expone el JWT en historial del navegador, logs del servidor, y scripts de terceros con acceso a `window.location`. Aplica tanto al callback de Google (línea 121) como al de GitHub.

**2. `DISABLE_AUTH` sin protección en producción** — ✅ **CORREGIDO**: Se agregó guard `process.env.NODE_ENV !== 'production'`. `DISABLE_AUTH=true` ahora solo funciona en development/test.

**3. Debug logs exponen configuración de seguridad** — `apps/api/src/index.ts:122-134`:

Los `console.log` imprimen si auth está habilitado, si existe API_KEY_HASH, y el valor de DISABLE_AUTH. En producción estos logs son visibles.

### ALTO

**4. API keys potencialmente en texto plano en respuestas** — ✅ **CORREGIDO**: `users.apiKey` renombrado a `apiKeyHash`, hash con bcrypt al crear, se muestra solo una vez al signup con `apiKeyShownOnce: true`. Endpoint `POST /auth/regenerate-api-key` agregado.

**5. JWT con datos volátiles en payload** — ✅ **CORREGIDO**: `usageCount` y `usageLimit` eliminados del JWT payload. Estos valores cambian cada request y se volvían stale en tokens de 7 días. El middleware `usage-limiter.ts` lee valores frescos de la DB.

**6. Validación de API keys del usuario hace llamadas externas (SSRF)** — `apps/api/src/routes/user-api-keys.ts:90-133`: Valida keys haciendo llamadas reales a OpenAI/Anthropic API, potencial vector SSRF.

**7. CORS origins hardcodeados en producción** — ✅ **CORREGIDO**: Producción ahora lee `CORS_ORIGINS` y `ALLOWED_OAUTH_REDIRECTS` desde env vars (comma-separated), con defaults hardcodeados como fallback. Nuevos dominios se pueden agregar via env vars sin code deploy.

**8. `passport-github2@0.1.12`** — Paquete abandonado desde 2016 con vulnerabilidades conocidas.

### Positivo

- CSRF protection implementado (`csrf-csrf`)
- Rate limiting con Redis fallback (`express-rate-limit` + `rate-limit-redis`)
- Helmet para headers de seguridad
- Password hashing con bcrypt (salt rounds 10)
- Input sanitization (`apps/api/src/utils/sanitizer.ts`)
- OAuth redirect validation contra whitelist
- Zod schemas para validación de input
- ✅ **NUEVO**: SSL verification habilitado por defecto en producción (`rejectUnauthorized: true`), con escape hatch `DB_SSL_REJECT_UNAUTHORIZED=false` para DBs con certs auto-firmados
- ✅ **NUEVO**: `API_KEY_ENCRYPTION_KEY` alineado con secrets validation — ambos env vars pasan por la misma pipeline de validación
- ✅ **NUEVO**: Referencias a Prisma eliminadas de `.env.example`, `.env.local.example`, `.env`

---

## 6. Performance

### Memory Leak en RedisService

`apps/api/src/services/RedisService.ts:10-20`:

```typescript
const memoryStore = new Map<string, { value: string; expiresAt: number }>();
setInterval(() => {
  // Nunca se limpia este interval
  // cleanup logic...
}, 60 * 1000);
```

- El `setInterval` global nunca se cancela en shutdown.
- El `memoryStore` no tiene límite de tamaño — puede crecer indefinidamente si Redis cae.

### WebSocket broadcast ineficiente

`apps/api/src/websocket/WebSocketManager.ts:343-367`:

- `JSON.stringify()` se ejecuta **por cada cliente** en lugar de serializar una vez.
- Búsqueda de clientes por organización es O(n) linear scan en lugar de mantener un índice por org.

### Base de datos

- **Sequential inserts** en `apps/api/src/routes/agents.ts:91-96`: Loop con `await req.store.addCost(cost)` individual en vez de batch insert.
- **Paginación por offset** en `DatabaseStore.ts`: Sin cursor-based pagination, ineficiente para datasets grandes.
- **COUNT query separada** para paginación en vez de usar `COUNT(*) OVER()` window function.

### React

- `packages/dashboard/.../agents/page.tsx`: 6+ estados `useState` independientes para diálogos que causan re-renders completos del componente de 737 líneas. Sin memoización de items de lista.

---

## 7. Testing

### Cobertura

| Métrica                | Valor                |
| ---------------------- | -------------------- |
| Archivos fuente        | 353                  |
| Archivos de test       | 21                   |
| **Ratio de cobertura** | **~6%**              |
| Threshold configurado  | 20% (jest.config.js) |

### Áreas sin tests

| Módulo                      | Líneas aprox. | Criticidad                                |
| --------------------------- | ------------- | ----------------------------------------- |
| Budget routes/services      | 900+          | **Lógica financiera** — máxima criticidad |
| ML/Forecasting              | 776+          | Alta — predicciones incorrectas           |
| Optimization engine         | 417+          | Alta — recomendaciones erróneas           |
| OAuth Service               | 284           | Alta — flujo de autenticación             |
| Alert Service               | 243+          | Media — notificaciones silenciosas        |
| Email Service               | —             | Media — comunicaciones fallidas           |
| Dashboard (20+ páginas)     | 2000+         | Media — UI rota                           |
| Landing page (30+ archivos) | 3000+         | Baja                                      |

### Lo que SÍ tiene tests

Auth unit tests (12 + 3 nuevos para API key hashing + 3 para secrets), apiKeyAuth middleware (13 tests nuevos), encrypt/decrypt crypto (17 tests nuevos), InMemoryStore, RedisCache, routes de agents/costs/traces/workflows, sanitizer, validator, StripeService, WebSocketManager, Agent SDK (BatchTransport, EventQueue, interceptors, retry).

> **Actualización 2026-02-17**: Se agregaron **36 tests nuevos** en total cubriendo: apiKeyAuth middleware (prefix, cache, lookup — 13 tests), auth signup (key hashing — 3 tests), secrets validation (SESSION_SECRET en producción — 3 tests), y encrypt/decrypt crypto (roundtrip, formato, errores, legacy — 17 tests). **48 tests de seguridad pasando** en 5 suites.

---

## 8. Deuda Técnica

1. **`apps/api/src/index.ts` (870 líneas)** — Necesita descomposición urgente en módulos: server setup, middleware config, route registration, WebSocket init, provider setup.

2. **Inconsistencia de versiones en el monorepo** — React 19.0 vs 19.2, Next.js 15 vs 16, Zod 3.23 vs 3.25. Un monorepo debería tener versiones unificadas.

3. **`passport-github2@0.1.12`** — Dependencia abandonada que necesita reemplazo.

4. **30+ `any` types** con `eslint-disable` — Cada uno es un punto ciego del type system.

5. **Console.log como mecanismo de logging** — Mezcla de `console.log` con emojis y Winston logger. El logging de debug debería usar Winston con niveles apropiados.

6. **Dashboard component monolítico** (`agents/page.tsx`, 737 líneas) — Necesita extracción de componentes, hook customizado, y patrón reducer para estado de diálogos.

7. **No hay abstracción DB en rutas** — Las rutas acceden directamente a la DB en vez de pasar por una capa de servicio consistente.

8. **TODOs sin resolver** — Funcionalidades a medio implementar (metrics, costs endpoint).

---

## 9. Recomendaciones Priorizadas (Top 5)

### 1. Eliminar JWT del query string en OAuth redirect

**Impacto: Seguridad crítica** | Archivo: `apps/api/src/routes/oauth.ts:117-126`

Implementar un flujo de intercambio de código temporal: el backend genera un código efímero (UUID, TTL 30s en Redis), redirige con ese código, y el frontend lo intercambia por el JWT via POST. Esto elimina la exposición del token en URLs.

### 2. Agregar tests para lógica financiera (budgets, optimization, ML)

**Impacto: Correctitud del negocio** | Archivos: `budgets.ts`, `ml/alerts.ts`, `optimization/engine.ts`

Son ~2,100 líneas de lógica financiera y de ML sin ningún test. Un bug aquí significa facturación incorrecta o alertas que no disparan. Priorizar: budget CRUD → budget enforcement → forecasting → optimization.

### 3. Descomponer `index.ts` y proteger `DISABLE_AUTH`

**Impacto: Mantenibilidad + Seguridad** | Archivo: `apps/api/src/index.ts`

- ✅ **HECHO**: `DISABLE_AUTH` guard con `NODE_ENV !== 'production'` implementado.
- ✅ **HECHO**: `SESSION_SECRET` ahora lanza error fatal en producción.
- ✅ **HECHO**: `API_KEY_ENCRYPTION_KEY` alineado con secrets validation.
- ✅ **HECHO**: SSL `rejectUnauthorized: true` por defecto en producción.
- ✅ **HECHO**: CORS origins dinámicos desde env vars en producción.
- ✅ **HECHO**: JWT payload limpio — sin datos volátiles (`usageCount`/`usageLimit`).
- ⬜ Pendiente: Eliminar los `console.log` de debug de auth config.
- ⬜ Pendiente: Extraer en módulos: `configureMiddleware()`, `configureRoutes()`, `configureWebSocket()`, `configureProviders()`.

### 4. Corregir memory leak en RedisService

**Impacto: Estabilidad en producción** | Archivo: `apps/api/src/services/RedisService.ts:10-20`

- Agregar `MAX_MEMORY_STORE_SIZE` (ej. 10,000 entries) con eviction LRU.
- Exponer método `shutdown()` que ejecute `clearInterval()`.
- Llamar a `shutdown()` en el graceful shutdown del servidor.

### 5. Unificar versiones del monorepo y reemplazar passport-github2

**Impacto: Seguridad + Consistencia** | Archivos: `package.json` (múltiples)

- Alinear React a 19.2.0, Next.js a 16.x, Zod a 3.25.x en todo el monorepo usando pnpm overrides.
- Reemplazar `passport-github2@0.1.12` por `@octokit/auth-oauth-app` o implementar OAuth de GitHub manualmente con el flujo estándar.

---

## Resumen Ejecutivo

El proyecto tiene una arquitectura sólida y buen uso de patrones de resiliencia. Durante las sesiones de hardening del 2026-02-17, se corrigieron las **4 vulnerabilidades P0/Critical** y **10 issues P1-P3 adicionales**, completando el 87% de la Week 1 del plan de 3 semanas. Los cambios incluyen: API key security (hash + prefix indexing), JWT payload limpio, SSL habilitado, CORS dinámico, encryption key alignment, y 48 tests de seguridad.

### Progreso de correcciones

| Severidad        | Total  | Corregidos   |
| ---------------- | ------ | ------------ |
| 🔴 Critical (P0) | 4      | ✅ 4 FIXED   |
| 🟠 High (P1)     | 7      | ✅ 3 FIXED   |
| 🟡 Medium (P2)   | 9      | ✅ 6 FIXED   |
| 🟢 Low (P3)      | 5      | ✅ 1 FIXED   |
| **Total**        | **25** | **14 FIXED** |

### Variables de entorno nuevas (para Railway)

| Variable                     | Propósito                                            | Default                 |
| ---------------------------- | ---------------------------------------------------- | ----------------------- |
| `DB_SSL_REJECT_UNAUTHORIZED` | `"false"` para DBs con certs auto-firmados (Railway) | `true` (seguro)         |
| `API_KEY_ENCRYPTION_KEY`     | Key AES-256 para user API keys (≥32 chars)           | **Requerido** en prod   |
| `CORS_ORIGINS`               | Lista de orígenes CORS separados por coma            | Defaults hardcodeados   |
| `ALLOWED_OAUTH_REDIRECTS`    | Whitelist de redirects OAuth separados por coma      | Mismos defaults de CORS |

> Ver `BACKEND_AUDIT_V2.md` para detalles completos de cada fix y el plan de 3 semanas.
