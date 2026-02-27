# 🔧 Variables de Entorno — Aethermind AgentOS

> Última actualización: 2026-02-25

---

## 🚂 Railway — API Backend (`apps/api`)

### 🔴 OBLIGATORIAS (el servidor NO arranca sin estas)

| Variable                 | Ejemplo                                   | Descripción                                                                                                                             |
| ------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`               | `production`                              | Debe ser `production` en Railway                                                                                                        |
| `DATABASE_URL`           | `postgresql://user:pass@host:5432/dbname` | URL de PostgreSQL (Railway la provee automáticamente si agregas el plugin de Postgres)                                                  |
| `JWT_SECRET`             | `a1b2c3d4...` (mín. 32 chars)             | Secreto para firmar JWT tokens. Generar con: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`                 |
| `SESSION_SECRET`         | `e5f6g7h8...` (mín. 32 chars)             | Secreto para sesiones. **DEBE ser diferente a JWT_SECRET**. Generar igual que arriba                                                    |
| `API_KEY_HASH`           | `$2b$10$...`                              | Hash bcrypt del API key de admin. Generar con: `pnpm generate-api-key`                                                                  |
| `API_KEY_ENCRYPTION_KEY` | `i9j0k1l2...` (mín. 32 chars)             | Clave AES-256 para cifrar API keys de usuarios. Generar con: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### 🟡 IMPORTANTES (funcionalidad reducida sin estas)

| Variable                  | Ejemplo                                                                               | Descripción                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `PORT`                    | `3001`                                                                                | Puerto del servidor. Railway lo setea automáticamente. Default: `3001`                                |
| `REDIS_URL`               | `redis://default:pass@host:6379`                                                      | URL de Redis. Sin esta, usa fallback en memoria (funcional pero sin persistencia de cache)            |
| `FRONTEND_URL`            | `https://aethermind-page.vercel.app`                                                  | URL de la landing page (usada en emails y redirects OAuth)                                            |
| `DASHBOARD_URL`           | `https://aethermind-agent-os-dashboard.vercel.app`                                    | URL del dashboard (usada en redirects post-OAuth)                                                     |
| `CORS_ORIGINS`            | `https://aethermind-page.vercel.app,https://aethermind-agent-os-dashboard.vercel.app` | Lista de orígenes CORS permitidos (separados por coma). Si no se setea, usa los defaults hardcodeados |
| `ALLOWED_OAUTH_REDIRECTS` | `https://aethermind-page.vercel.app,https://aethermind-agent-os-dashboard.vercel.app` | Lista de URLs válidas para redirect post-OAuth                                                        |

### 🟢 OAuth (necesarias para login con Google/GitHub)

| Variable               | Ejemplo                                                  | Descripción                                                                       |
| ---------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | `123456.apps.googleusercontent.com`                      | Client ID de la consola de Google Cloud                                           |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...`                                             | Client Secret de Google Cloud                                                     |
| `GOOGLE_CALLBACK_URL`  | `https://tu-api.up.railway.app/api/auth/google/callback` | URL de callback de Google OAuth. **DEBE terminar en `/api/auth/google/callback`** |
| `GITHUB_CLIENT_ID`     | `Iv1.abc123`                                             | Client ID de GitHub OAuth App                                                     |
| `GITHUB_CLIENT_SECRET` | `ghp_...`                                                | Client Secret de GitHub OAuth App                                                 |
| `GITHUB_CALLBACK_URL`  | `https://tu-api.up.railway.app/api/auth/github/callback` | URL de callback de GitHub OAuth                                                   |

### 🟢 Stripe (necesarias para pagos)

| Variable                     | Ejemplo                       | Descripción                                 |
| ---------------------------- | ----------------------------- | ------------------------------------------- |
| `STRIPE_SECRET_KEY`          | `sk_live_...` o `sk_test_...` | API key secreta de Stripe                   |
| `STRIPE_WEBHOOK_SECRET`      | `whsec_...`                   | Secreto para verificar webhooks de Stripe   |
| `STRIPE_PRO_PRICE_ID`        | `price_1N...`                 | ID del precio del plan Pro en Stripe        |
| `STRIPE_ENTERPRISE_PRICE_ID` | `price_1N...`                 | ID del precio del plan Enterprise en Stripe |

### 🟢 Email (necesarias para enviar correos)

| Variable           | Ejemplo                  | Descripción                                                      |
| ------------------ | ------------------------ | ---------------------------------------------------------------- |
| `SENDGRID_API_KEY` | `SG.abc...`              | API key de SendGrid (prioridad 1)                                |
| `SMTP_HOST`        | `smtp.gmail.com`         | Host SMTP (prioridad 2, si no hay SendGrid)                      |
| `SMTP_PORT`        | `587`                    | Puerto SMTP. Default: `587`. Usar `465` para SSL                 |
| `SMTP_USER`        | `user@gmail.com`         | Usuario SMTP                                                     |
| `SMTP_PASS`        | `app-password`           | Contraseña SMTP                                                  |
| `FROM_EMAIL`       | `noreply@aethermind.com` | Dirección de envío. Default: `noreply@aethermind.com`            |
| `ALERT_FROM_EMAIL` | `alerts@aethermind.ai`   | Dirección de envío para alertas. Default: `alerts@aethermind.ai` |

### 🟢 LLM Providers (necesarias para ejecutar agentes)

| Variable            | Ejemplo      | Descripción                                                     |
| ------------------- | ------------ | --------------------------------------------------------------- |
| `OPENAI_API_KEY`    | `sk-...`     | API key de OpenAI. Si se provee, se setea como provider default |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | API key de Anthropic. Se registra como provider "anthropic"     |

### 🟢 Alertas & Notificaciones

| Variable            | Ejemplo                                          | Descripción                              |
| ------------------- | ------------------------------------------------ | ---------------------------------------- |
| `SLACK_WEBHOOK_URL` | `https://hooks.slack.com/services/T.../B.../xxx` | Webhook de Slack para alertas (opcional) |

### ⚪ OPCIONALES (fine-tuning)

| Variable                     | Default                       | Descripción                                      |
| ---------------------------- | ----------------------------- | ------------------------------------------------ |
| `DISABLE_AUTH`               | `false`                       | Solo funciona en dev, **ignorada en production** |
| `LOG_LEVEL`                  | `info` (prod) / `debug` (dev) | Nivel de log: `error`, `warn`, `info`, `debug`   |
| `DB_POOL_MAX`                | `20`                          | Tamaño máximo del pool de conexiones a la DB     |
| `LLM_TIMEOUT_MS`             | `30000`                       | Timeout para llamadas LLM en milisegundos        |
| `QUEUE_CONCURRENCY`          | `10`                          | Concurrencia de la cola de tareas                |
| `RATE_LIMIT_WINDOW_MS`       | `900000` (15 min)             | Ventana de rate limiting en ms                   |
| `RATE_LIMIT_MAX_REQUESTS`    | `100`                         | Máximo de requests por ventana                   |
| `REQUEST_BODY_LIMIT`         | `10mb`                        | Límite de tamaño del body de requests            |
| `CONFIG_WATCHER_DEBOUNCE_MS` | `300`                         | Debounce para el config watcher                  |
| `COOKIE_DOMAIN`              | _(none)_                      | Dominio para cookies de autenticación            |

---

## 🔷 Vercel — Dashboard (`packages/dashboard`)

Todas las variables del dashboard son `NEXT_PUBLIC_*` (expuestas al cliente).

| Variable                  | Ejemplo                              | Descripción                                                                                                   |
| ------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`     | `https://tu-api.up.railway.app`      | **⚠️ Sin `/api` al final**. URL base de la API en Railway. Si no se setea, el dashboard muestra datos de demo |
| `NEXT_PUBLIC_LANDING_URL` | `https://aethermind-page.vercel.app` | URL de la landing page (para redirects de login/logout). Default: `http://localhost:3000`                     |
| `NEXT_PUBLIC_WS_URL`      | `wss://tu-api.up.railway.app/ws`     | URL del WebSocket. Si no se setea, se infiere de `NEXT_PUBLIC_API_URL`                                        |

> **Nota importante**: `NEXT_PUBLIC_API_URL` debe ser la URL **raíz** del servidor (ej: `https://aethermindapi-production.up.railway.app`), **NO** incluir `/api` porque el código ya lo agrega.

---

## 🟣 Vercel — Landing Page (`apps/landing`)

| Variable                             | Ejemplo                                            | Descripción                                                                                                      |
| ------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`                | `https://tu-api.up.railway.app/api`                | **⚠️ CON `/api` al final**. URL completa del API. Default: `https://aethermindapi-production.up.railway.app/api` |
| `NEXT_PUBLIC_DASHBOARD_URL`          | `https://aethermind-agent-os-dashboard.vercel.app` | URL del dashboard para redirects post-login                                                                      |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` o `pk_test_...`                      | Clave pública de Stripe para el checkout                                                                         |
| `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID`    | `price_1N...`                                      | ID del precio del plan Pro (mismo que en Railway)                                                                |
| `NEXT_PUBLIC_GA_ID`                  | `G-XXXXXXXXXX`                                     | Google Analytics Measurement ID (opcional)                                                                       |

> **⚠️ OJO**: La landing page usa `NEXT_PUBLIC_API_URL` **con** `/api`, mientras que el dashboard lo usa **sin** `/api`. Esto es intencional — revisa el código si cambias algo.

---

## 🚀 Resumen Rápido — Mínimo para funcionar

### Railway (API) — mínimo absoluto:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...     # Plugin de Postgres en Railway
JWT_SECRET=<random-64-hex>
SESSION_SECRET=<random-64-hex>    # DIFERENTE a JWT_SECRET
API_KEY_HASH=<bcrypt-hash>
API_KEY_ENCRYPTION_KEY=<random-64-hex>

# OAuth (para login)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://tu-api.up.railway.app/api/auth/google/callback

# URLs de los frontends
FRONTEND_URL=https://aethermind-page.vercel.app
DASHBOARD_URL=https://aethermind-agent-os-dashboard.vercel.app
CORS_ORIGINS=https://aethermind-page.vercel.app,https://aethermind-agent-os-dashboard.vercel.app
```

### Vercel Dashboard — mínimo:

```env
NEXT_PUBLIC_API_URL=https://tu-api.up.railway.app
NEXT_PUBLIC_LANDING_URL=https://aethermind-page.vercel.app
```

### Vercel Landing — mínimo:

```env
NEXT_PUBLIC_API_URL=https://tu-api.up.railway.app/api
NEXT_PUBLIC_DASHBOARD_URL=https://aethermind-agent-os-dashboard.vercel.app
```

---

## 🔑 Cómo generar secretos

```bash
# JWT_SECRET, SESSION_SECRET, API_KEY_ENCRYPTION_KEY (cada uno diferente)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# API_KEY_HASH (genera la key Y el hash)
cd apps/api && pnpm generate-api-key
```
