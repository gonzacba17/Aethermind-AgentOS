# Aethermind AgentOS — Architecture & Auth Diagnostic

> Generado: 2026-03-01 | Commit base: `fc0b7d9`

---

## Parte 1 — Mapa del Repositorio

### Vista general

Monorepo gestionado con **pnpm workspaces** + **Turborepo**.
Stack: TypeScript 5.4, Node >= 18, PostgreSQL 16, Redis 7 (opcional).

```
Aethermind Agent OS/
├── apps/              ← Aplicaciones desplegables
│   ├── api/           ← Express REST + WebSocket (Railway)
│   └── landing/       ← Marketing + Auth (Vercel)
├── packages/          ← Paquetes compartidos
│   ├── dashboard/     ← Next.js Dashboard (Vercel, otro dominio)
│   ├── agent/         ← SDK publicado en npm (@aethermind/agent)
│   ├── core/          ← Runtime de agentes (server-side)
│   ├── core-shared/   ← Pricing tables + token utils
│   ├── types/         ← TypeScript types compartidos
│   ├── sdk/           ← Re-export barrel (core + agent)
│   ├── api-client/    ← HTTP client tipado
│   └── create-aethermind-app/  ← CLI scaffolding (npx)
├── docs/              ← Documentación técnica (50+ archivos)
├── examples/          ← Demos y tests de integración
├── infrastructure/    ← Docker, Nginx, guías de scaling
├── scripts/           ← Admin, DB, dev, security, testing
├── tests/             ← E2E y tests de integración globales
└── .github/           ← CI/CD workflows
```

---

### `apps/api/` — Backend API (Express + Drizzle + PostgreSQL)

Desplegado en **Railway** en `https://aethermind-agentos-production.up.railway.app`.

| Directorio | Archivos | Rol |
|------------|----------|-----|
| `src/index.ts` | 1 | Entry point. Monta middleware, rutas, WebSocket, crons |
| `src/config/` | `constants.ts`, `secrets.ts`, `subscription.ts` | Constantes, validación de secrets con Zod, planes Stripe |
| `src/db/` | `schema.ts` (24 tablas), `index.ts`, `migrations/` (11 SQL) | Drizzle ORM schema, pool de conexiones, migraciones |
| `src/routes/` | 17 archivos | Todos los endpoints REST |
| `src/routes/auth/` | 7 archivos | Signup, login, logout, password, session, plan, profile |
| `src/middleware/` | 14 archivos | Auth (JWT, API key, client token, SDK key), rate limiting, WAF, CSRF, validación |
| `src/services/` | 24 archivos | Lógica de negocio: Stripe, email, cache semántico, budget, alertas, benchmarks |
| `src/ml/` | 4 archivos | Feature extraction, pattern detection, forecasting, alertas predictivas |
| `src/optimization/` | 4 archivos | Motor de routing, cálculo de costos, análisis, recomendaciones |
| `src/budget/` | 4 archivos | Guard, circuit breaker, scheduler, action rules |
| `src/websocket/` | 2 archivos | WebSocket manager + rate limiter |
| `src/utils/` | 5 archivos | Logger (Winston), crypto, sanitizer, auth helpers, métricas (stub) |
| `src/server/` | `health.ts` | Health check, DB diagnostics, Prometheus stub |
| `tests/` | 17 unit + 1 integration | Jest tests |

**Rutas principales:**

| Ruta | Auth | Descripción |
|------|------|-------------|
| `POST /api/auth/signup` | Pública | Crea user + org + client en una transacción |
| `POST /api/auth/login` | Pública | Retorna JWT + clientAccessToken |
| `GET /api/client/me` | `X-Client-Token` | Valida token B2B, retorna info del cliente |
| `GET /api/client/metrics` | `X-Client-Token` | Métricas de telemetría del cliente |
| `POST /v1/ingest` | SDK API Key | Ingestion batch de eventos de telemetría |
| `GET /api/agents` | JWT | CRUD de agentes |
| `GET /api/costs/summary` | JWT | Resumen de costos |
| `POST /stripe/webhook` | Stripe Signature | Procesa eventos de Stripe |

---

### `apps/landing/` — Landing + Auth (Next.js 15)

Desplegado en **Vercel** en `https://aethermind-page.vercel.app`.

| Directorio | Rol |
|------------|-----|
| `app/login/`, `app/signup/` | Formularios de auth |
| `app/onboarding/` | 5 pasos de onboarding (welcome → demo → value → pricing → setup → complete) |
| `app/pricing/` | Planes y checkout Stripe |
| `app/forgot-password/`, `app/reset-password/`, `app/verify-email/` | Recovery flows |
| `components/` | Marketing (hero, pricing, FAQ) + UI (shadcn/ui completo) |
| `lib/auth-utils.ts` | `saveToken()`, `saveClientToken()`, `buildDashboardUrl()`, `redirectAfterAuth()` |
| `lib/api/auth.ts` | `authAPI.login()`, `authAPI.signup()` — HTTP client para la API |
| `lib/config.ts` | URLs de API y Dashboard |
| `hooks/useAuth.ts` | Hook de auth con cross-tab sync |
| `middleware.ts` | Next.js middleware: protege rutas, lee cookie `token` |

---

### `packages/dashboard/` — Dashboard (Next.js 16)

Desplegado en **Vercel** en `https://aethermind-agent-os-dashboard.vercel.app`.

| Directorio | Rol |
|------------|-----|
| `src/app/page.tsx` | **Token capture**: lee `?token=` de la URL, guarda en localStorage, redirige a `/home` |
| `src/app/(dashboard)/layout.tsx` | Envuelve todo en `AuthGuard` → sidebar + header |
| `src/app/(dashboard)/home/` | Página de bienvenida con SDK key y guía de inicio |
| `src/app/(dashboard)/dashboard/` | Dashboard principal con 14 widgets |
| `src/app/(dashboard)/costs/` | Analytics de costos con gráficos Recharts |
| `src/app/(dashboard)/forecasting/` | Forecasting con intervalos de confianza |
| `src/app/(dashboard)/insights/` | Recomendaciones generadas por ML |
| `src/app/(dashboard)/` (otros) | agents, budgets, logs, traces, workflows, optimization, routing, settings |
| `src/components/AuthGuard.tsx` | Llama `initialize()` una vez → muestra contenido o "access denied" |
| `src/store/useAuthStore.ts` | Zustand store: `initialize()` valida token via `GET /api/client/me` |
| `src/hooks/api/` | 20 hooks React Query para cada sección del dashboard |
| `src/lib/auth-utils.ts` | `getAuthToken()` / `setAuthToken()` — localStorage key `client_token` |
| `src/lib/api.ts` | `apiRequest()` con retry, adjunta `X-Client-Token` automáticamente |
| `src/lib/config.ts` | `API_URL`, `LANDING_PAGE_URL` |

---

### `packages/agent/` — SDK npm (`@aethermind/agent` v0.2.0)

SDK publicable que los clientes instalan con `npm install @aethermind/agent`.

| Directorio | Rol |
|------------|-----|
| `src/interceptors/` | Monkey-patches para OpenAI, Anthropic, Gemini y fetch global |
| `src/transport/` | Batch de eventos → `POST /v1/ingest` con retry + DLQ |
| `src/routing/` | Clasificación de prompts + resolución de modelo óptimo |
| `src/cache/` | Cache semántico client-side |
| `src/budget/` | Enforcement de presupuesto pre-call |
| `src/compression/` | Compresión de prompts |
| `src/pricing/` | Tablas de pricing por modelo (vendored de core-shared) |

---

### `packages/core/` — Runtime de agentes

Motor server-side usado por la API.

| Directorio | Rol |
|------------|-----|
| `src/agent/` | Clase `Agent` + `AgentRuntime` |
| `src/orchestrator/` | Coordinación multi-agente |
| `src/workflow/` | Motor de workflows |
| `src/providers/` | Adaptadores para OpenAI, Anthropic, Ollama |
| `src/queue/` | Task queue (BullMQ) |
| `src/services/` | Config watcher, cost estimation |

---

### Otros packages

| Package | Rol |
|---------|-----|
| `packages/core-shared/` | Tablas de pricing canónicas + utilidades de tokens |
| `packages/types/` | Tipos TypeScript compartidos (Agent, Cost, Execution, Log, Trace) |
| `packages/sdk/` | Re-export barrel de core + agent |
| `packages/api-client/` | HTTP client tipado para la API |
| `packages/create-aethermind-app/` | CLI scaffolding (`npx create-aethermind-app`) |

---

### Directorios de soporte

| Directorio | Contenido |
|------------|-----------|
| `docs/` | 50+ archivos: architecture, API specs, OpenAPI, auditorías, deployment guides, changelogs |
| `examples/` | `basic-agent/` (demo completa), `test-integration/` (tests contra APIs reales) |
| `infrastructure/` | `docker/Dockerfile.api`, `nginx/nginx.conf` (reverse proxy + SSL), `SCALING.md` |
| `scripts/` | `admin/` (crear usuarios), `db/` (init + migrate), `dev/` (diagnóstico), `security/` (generar keys), `test/` (E2E pipeline) |
| `tests/` | `e2e/full-workflow.test.ts`, `integration/orchestrator.test.ts`, setup global |
| `.github/` | `ci.yml` (build + typecheck + lint + test), `publish-sdk.yml` (npm publish), `dependabot.yml` |

---

### Archivos de configuración raíz

| Archivo | Rol |
|---------|-----|
| `package.json` | Workspace root, scripts de Turborepo |
| `pnpm-workspace.yaml` | Define `packages/*`, `apps/*`, `examples/*` |
| `turbo.json` | Pipeline: build → test → dev |
| `tsconfig.base.json` | Shared TS config (ES2022, strict, NodeNext) |
| `docker-compose.yml` | 5 servicios: api, dashboard, redis, postgres, postgres-backup |
| `Dockerfile` / `Dockerfile.railway` | Multi-stage builds |
| `.env.production.example` | Template de variables de entorno |

---

## Parte 2 — Diagnóstico del flujo de autenticación

### 2.1 El flujo completo, paso a paso

```
┌─────────────────────────────────────────────────────────────────────┐
│  LANDING (aethermind-page.vercel.app)                               │
│                                                                     │
│  1. Usuario llena login form                                        │
│     📄 apps/landing/app/login/page.tsx                              │
│                                                                     │
│  2. Submit → authAPI.login(email, password)                         │
│     📄 apps/landing/lib/api/auth.ts                                 │
│                                                                     │
│  3. POST /api/auth/login → API retorna:                             │
│     { token: "jwt...", clientAccessToken: "ct_...", user: {...} }   │
│     📄 apps/api/src/routes/auth/login.ts                           │
│                                                                     │
│  4. Landing guarda ambos tokens:                                    │
│     - JWT → localStorage('token') o sessionStorage('token')        │
│       + cookie 'token' (para middleware Next.js)                    │
│     - clientAccessToken → localStorage('clientAccessToken')         │
│     📄 apps/landing/lib/auth-utils.ts (saveToken, saveClientToken) │
│                                                                     │
│  5. redirectAfterAuth() → buildDashboardUrl()                       │
│     URL = dashboard.vercel.app?token={clientAccessToken}            │
│     📄 apps/landing/lib/auth-utils.ts (buildDashboardUrl)          │
│                                                                     │
│  6. window.location.href = URL  (cross-origin redirect)             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  DASHBOARD (aethermind-agent-os-dashboard.vercel.app)                │
│                                                                     │
│  7. RootPage lee ?token= de la URL                                  │
│     📄 packages/dashboard/src/app/page.tsx                          │
│                                                                     │
│  8. setAuthToken(token) → localStorage.setItem('client_token', t)  │
│     📄 packages/dashboard/src/lib/auth-utils.ts                    │
│                                                                     │
│  9. window.location.href = '/home'                                  │
│                                                                     │
│  10. (dashboard)/layout.tsx monta <AuthGuard>                       │
│      📄 packages/dashboard/src/app/(dashboard)/layout.tsx           │
│                                                                     │
│  11. AuthGuard → useAuthStore.initialize()                          │
│      📄 packages/dashboard/src/components/AuthGuard.tsx             │
│      📄 packages/dashboard/src/store/useAuthStore.ts                │
│                                                                     │
│  12. initialize() lee localStorage('client_token')                  │
│      → fetch GET /api/client/me con header X-Client-Token           │
│      📄 packages/dashboard/src/store/useAuthStore.ts                │
│                                                                     │
│  13. API valida token en tabla clients (LRU cache 5min)             │
│      → Retorna { companyName, sdkApiKey, id }                      │
│      📄 apps/api/src/middleware/clientAuth.ts                       │
│      📄 apps/api/src/routes/client.ts (GET /me, línea 35)          │
│                                                                     │
│  14. Zustand store se llena → isAuthenticated = true                │
│      → Dashboard renderiza                                          │
│                                                                     │
│  15. Hooks de datos (metrics, forecasting, etc.) leen token con     │
│      getAuthToken() y lo envían como X-Client-Token                 │
│      📄 packages/dashboard/src/lib/api.ts (getHeaders, línea 26)   │
│      📄 packages/dashboard/src/hooks/api/*.ts                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Inventario de archivos del flujo

| Paso | Archivo exacto | Función/línea clave |
|------|----------------|---------------------|
| Login form | `apps/landing/app/login/page.tsx` | Submit handler |
| API call login | `apps/landing/lib/api/auth.ts` | `authAPI.login()` |
| Endpoint login | `apps/api/src/routes/auth/login.ts` | `POST /api/auth/login` |
| Guardar JWT | `apps/landing/lib/auth-utils.ts` | `saveToken()` :17 |
| Guardar client token | `apps/landing/lib/auth-utils.ts` | `saveClientToken()` :89 |
| Construir URL dashboard | `apps/landing/lib/auth-utils.ts` | `buildDashboardUrl()` :4 |
| Decidir redirect | `apps/landing/lib/auth-utils.ts` | `redirectAfterAuth()` :145 |
| Config URL dashboard | `apps/landing/lib/config.ts` | `config.dashboardUrl` :15 |
| Capturar token en URL | `packages/dashboard/src/app/page.tsx` | `RootPage` useEffect :21 |
| Persistir token | `packages/dashboard/src/lib/auth-utils.ts` | `setAuthToken()` :27 |
| Layout con AuthGuard | `packages/dashboard/src/app/(dashboard)/layout.tsx` | `<AuthGuard>` :14 |
| AuthGuard component | `packages/dashboard/src/components/AuthGuard.tsx` | `initialize().then()` :25 |
| Store initialize | `packages/dashboard/src/store/useAuthStore.ts` | `initialize()` :25 |
| Config API URL | `packages/dashboard/src/lib/config.ts` | `API_URL` :24 |
| Middleware clientAuth | `apps/api/src/middleware/clientAuth.ts` | LRU cache + DB lookup |
| Endpoint /me | `apps/api/src/routes/client.ts` | `router.get('/me')` :35 |
| Rate limiter global | `apps/api/src/index.ts` | `limiter` :126, `clientLimiter` :133 |
| Rate limiter custom | `apps/api/src/middleware/rateLimiter.ts` | Redis-backed con fallback |
| Headers en hooks | `packages/dashboard/src/lib/api.ts` | `getHeaders()` :26 |
| Token reader helper | `packages/dashboard/src/lib/auth-utils.ts` | `getAuthToken()` :15 |

---

### 2.3 Bugs recientes (ya corregidos)

| Bug | Causa raíz | Archivo | Commit |
|-----|-----------|---------|--------|
| Token no persiste entre recargas | `sessionStorage` en vez de `localStorage` en dashboard auth-utils | `packages/dashboard/src/lib/auth-utils.ts` | `c6ed4d7` |
| AuthGuard llama `/me` dos veces | AuthGuard hacía `fetch()` propio + luego `initialize()` que hacía el mismo fetch | `packages/dashboard/src/components/AuthGuard.tsx` | `fc0b7d9` |
| 4 hooks enviaban token vacío | Leían `localStorage.getItem('clientToken')` (camelCase) pero auth-utils guarda como `client_token` | `useClientMetrics.ts`, `useClientAnalytics.ts`, `useClientBudgets.ts`, `useClientForecast.ts` | `fc0b7d9` |
| Rate limit 429 en /api/client/me | Limiter global (100 req/15min) aplicaba a TODAS las rutas sin excepción | `apps/api/src/index.ts` | `fc0b7d9` |

---

### 2.4 ¿Por qué hay tantos archivos/capas para algo tan simple?

El flujo parece excesivo porque **no fue diseñado como un flujo simple**. Hay tres capas de complejidad que se acumularon:

**1. Tres dominios separados (cross-origin)**

El sistema corre en tres orígenes distintos:
- `aethermind-page.vercel.app` (landing)
- `aethermind-agent-os-dashboard.vercel.app` (dashboard)
- `aethermind-agentos-production.up.railway.app` (API)

Esto impide compartir cookies o localStorage entre landing y dashboard. El token tiene que viajar via URL query param (`?token=`), ser capturado, y re-guardado en el localStorage del otro dominio. Eso solo ya requiere: auth-utils en landing + page.tsx capture en dashboard + auth-utils en dashboard.

**2. Dos sistemas de auth paralelos**

El sistema mantiene dos flujos de auth simultáneos que nunca fueron unificados:
- **JWT (usuario)**: para el landing y endpoints `/api/*` generales (`Authorization: Bearer`)
- **Client Token B2B (`ct_*`)**: para el dashboard y endpoints `/api/client/*` (`X-Client-Token`)

Login retorna ambos (`token` + `clientAccessToken`). Landing guarda ambos en keys distintas. Dashboard solo usa el client token. Esto duplica archivos de auth-utils, middleware, y validación.

**3. Acumulación orgánica sin refactor**

Cada feature se agregó con su propio hook, su propio `fetchWithClientToken()`, y su propia forma de leer el token. En vez de centralizar en `lib/api.ts` (que ya tenía `getHeaders()` con `getAuthToken()`), cada hook duplicó la lógica. Los 4 hooks con el bug de `clientToken` vs `client_token` son evidencia directa de esto.

---

### 2.5 Puntos de falla potenciales NO corregidos

#### P1 — URL de API inconsistente entre landing y dashboard (ALTA)

| App | Variable | Fallback hardcoded |
|-----|----------|-------------------|
| Landing | `NEXT_PUBLIC_API_URL` | `https://aethermindapi-production.up.railway.app/api` |
| Dashboard | `NEXT_PUBLIC_API_URL` | `https://aethermind-agentos-production.up.railway.app` |

Los fallbacks apuntan a **hostnames diferentes** (`aethermindapi` vs `aethermind-agentos`). Si alguno cambia, el otro sigue apuntando al viejo. Ambos deberían usar el mismo hostname.

- `apps/landing/lib/config.ts` :10
- `packages/dashboard/src/lib/config.ts` :23

#### P2 — Token expuesto en la URL (MEDIA)

El `clientAccessToken` viaja en la URL como query param:
```
https://dashboard.vercel.app?token=ct_abc123...
```
Esto significa que:
- Queda en el historial del browser
- Puede loggearse en proxies o analytics (Vercel Analytics, Google Analytics)
- Aparece en `Referer` headers si el dashboard hace requests a terceros

El sistema ya tiene un mecanismo de sesión temporal (`?session=` + `POST /api/auth/session`) que es más seguro, pero no se usa como default.

- `apps/landing/lib/auth-utils.ts` :4-10 (`buildDashboardUrl`)
- `packages/dashboard/src/app/page.tsx` :30-35

#### P3 — No se limpia el token de la URL después de capturarlo (MEDIA)

`RootPage` lee `?token=` y redirige con `window.location.href = '/home'`, pero si el usuario bookmarkea la URL intermedia o el redirect falla, el token queda visible en la URL.

- `packages/dashboard/src/app/page.tsx` :30-35

#### P4 — React Query refetch agresivo puede amplificar rate limits (BAJA)

La configuración de React Query tiene:
```
refetchOnWindowFocus: true   // refetch al volver a la tab
refetchOnMount: true         // refetch al montar componente
refetchOnReconnect: true     // refetch al reconectar red
retry: 3                     // 3 reintentos
```

Si el usuario navega entre tabs frecuentemente, cada regreso triggerea refetches de TODOS los hooks montados. Con 14 widgets en `/dashboard`, eso puede ser 14+ requests simultáneos al volver a la tab.

- `packages/dashboard/src/lib/query-client.ts` :17-33

#### P5 — `lib/api.ts` y hooks duplican lógica de headers (BAJA)

`lib/api.ts` ya centraliza `getHeaders()` con `getAuthToken()`, pero los hooks de `useClientMetrics`, `useClientAnalytics`, etc. tienen su propio `fetchWithClientToken()` en vez de usar `apiRequest()`. Esto significa que cualquier cambio futuro en la lógica de auth tiene que replicarse en dos lugares.

- `packages/dashboard/src/lib/api.ts` :26-39
- `packages/dashboard/src/hooks/api/useClientMetrics.ts` :43-56
- `packages/dashboard/src/hooks/api/useClientAnalytics.ts` :35
- `packages/dashboard/src/hooks/api/useClientBudgets.ts` :35
- `packages/dashboard/src/hooks/api/useClientForecast.ts` :32

#### P6 — Console.logs de diagnóstico en producción (BAJA)

`RootPage` y `useAuthStore` todavía tienen `console.log` con información sensible (primeros 8 chars del token). Esto es visible en la consola del browser de cualquier usuario.

- `packages/dashboard/src/app/page.tsx` :26-28

#### P7 — Logout no invalida el token server-side (BAJA)

`logout()` en el dashboard solo limpia localStorage y redirige. El `clientAccessToken` sigue siendo válido en la base de datos indefinidamente. No hay endpoint de revocación ni TTL en el token.

- `packages/dashboard/src/store/useAuthStore.ts` :61-64
- `apps/api/src/middleware/clientAuth.ts` — LRU cache de 5min, pero el token en DB no expira

---

### 2.6 Simplificaciones recomendadas

#### R1 — Unificar `fetchWithClientToken()` en un solo lugar

Los 4 hooks (`useClientMetrics`, `useClientAnalytics`, `useClientBudgets`, `useClientForecast`) tienen cada uno su propio `fetchWithClientToken()`. Reemplazar todas por `apiRequest()` de `lib/api.ts` que ya hace lo mismo correctamente.

**Impacto:** Elimina ~80 líneas duplicadas y un vector de bugs futuros.

```typescript
// En cada hook, reemplazar:
async function fetchWithClientToken<T>(path: string): Promise<T> { ... }

// Por:
import { apiRequest } from '@/lib/api';
// Y usar apiRequest(path) directamente en queryFn
```

#### R2 — Usar `?session=` por defecto en vez de `?token=`

Cambiar `buildDashboardUrl()` en el landing para que genere una sesión temporal (60 segundos, un solo uso) en vez de pasar el token directo. El mecanismo ya existe en la API (`POST /api/auth/create-temp-session`).

**Impacto:** El token nunca aparece en la URL, historial, o logs.

#### R3 — Limpiar la URL después de capturar el token

En `RootPage`, después de `setAuthToken(token)`, usar `window.history.replaceState()` para eliminar `?token=` de la URL antes de redirigir:

```typescript
setAuthToken(token);
window.history.replaceState({}, '', '/');
window.location.href = '/home';
```

#### R4 — Remover console.logs de diagnóstico

Limpiar los `console.log` de `RootPage` y cualquier otro lugar que loguee tokens parciales en producción.

#### R5 — Unificar API URL fallbacks

Asegurar que landing y dashboard usen el mismo hostname de API como fallback. Idealmente, nunca depender de fallbacks hardcoded y siempre exigir `NEXT_PUBLIC_API_URL` en las variables de entorno de Vercel.

#### R6 — Agregar `staleTime` más alto para `/api/client/me`

El endpoint `/me` no cambia durante la sesión. Se podría wrappear la llamada de `initialize()` para que, si ya tiene datos, no vuelva a llamar al API (o setear `staleTime: Infinity` en un React Query wrapper).

---

### 2.7 Diagrama resumen de tokens y storage

```
┌─────────────────────────────────────────────────────────────────┐
│                    LANDING (Vercel)                              │
│                                                                 │
│  POST /api/auth/login                                           │
│  ← { token: "jwt...", clientAccessToken: "ct_..." }            │
│                                                                 │
│  localStorage['token']            = "jwt..."     (o session)    │
│  localStorage['rememberMe']       = "true"                      │
│  cookie['token']                  = "jwt..."     (para Next MW) │
│  localStorage['clientAccessToken'] = "ct_..."                   │
│                                                                 │
│  buildDashboardUrl() → ...dashboard.vercel.app?token=ct_...    │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ window.location.href
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DASHBOARD (Vercel, otro dominio)               │
│                                                                 │
│  RootPage: URLSearchParams.get('token') → "ct_..."             │
│  setAuthToken("ct_...") →                                       │
│  localStorage['client_token'] = "ct_..."                        │
│                                                                 │
│  AuthGuard → initialize() →                                     │
│  getAuthToken() → localStorage.getItem('client_token')          │
│  fetch(API/api/client/me, { X-Client-Token: "ct_..." })        │
│                                                                 │
│  Todos los hooks:                                               │
│  getAuthToken() → "ct_..." → header X-Client-Token             │
└─────────────────────────────────────────────────────────────────┘

⚠️  Nota: el JWT del landing NO se usa en el dashboard.
    El dashboard opera exclusivamente con el clientAccessToken.
    Son dos auth systems independientes.
```

---

### 2.8 Resumen de archivos por preocupación

| Preocupación | Landing | Dashboard | API |
|-------------|---------|-----------|-----|
| Login form | `app/login/page.tsx` | — | `routes/auth/login.ts` |
| Token storage | `lib/auth-utils.ts` | `lib/auth-utils.ts` | — |
| Token validation | — | `store/useAuthStore.ts` | `middleware/clientAuth.ts` |
| Token en requests | — | `lib/api.ts` | — |
| Rate limiting | — | — | `index.ts` + `middleware/rateLimiter.ts` |
| Redirect logic | `lib/auth-utils.ts` | `app/page.tsx` | — |
| Config URLs | `lib/config.ts` | `lib/config.ts` | `config/constants.ts` |
| Guard/protección | `middleware.ts` | `components/AuthGuard.tsx` | `middleware/auth.ts` |
