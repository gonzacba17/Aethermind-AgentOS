# Guía de Deploy - Aethermind AgentOS

## 📦 Plataformas Soportadas

### Dashboard (Frontend)

- **Vercel** (Recomendado) - Deploy automático desde GitHub

### API (Backend)

- **Railway** (Recomendado)
- **Koyeb** (Alternativo)
- **Docker** (Self-hosted)

---

## 🔐 Variables de Entorno Requeridas

### API (Backend)

**Esenciales:**

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Redis (opcional, con graceful fallback)
REDIS_URL=redis://host:6379

# Security
JWT_SECRET=your-jwt-secret-here
SESSION_SECRET=your-session-secret-here
API_KEY_HASH=bcrypt-hash-of-your-api-key

# Node
NODE_ENV=production
PORT=3001
```

**LLM Providers (al menos uno):**

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
```

**OAuth (opcional):**

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://your-api.com/auth/google/callback

GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=https://your-api.com/auth/github/callback
```

**Payments (opcional):**

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Notifications (opcional):**

```env
SENDGRID_API_KEY=SG...
ALERT_EMAIL_FROM=alerts@yourdomain.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

**CORS:**

```env
CORS_ORIGINS=https://yourdashboard.vercel.app,https://yourdomain.com
```

### Dashboard (Frontend)

```env
NEXT_PUBLIC_API_URL=https://your-api.railway.app
```

---

## 🚀 Deploy en Vercel (Dashboard)

### 1. Conectar Repositorio

```bash
vercel login
vercel link
```

### 2. Configurar Build Settings

**Framework Preset:** Next.js

**Root Directory:** `packages/dashboard`

**Build Command:**

```bash
cd ../.. && pnpm install && cd packages/dashboard && pnpm build
```

**Output Directory:** `.next`

**Install Command:**

```bash
pnpm install
```

### 3. Variables de Entorno

En Vercel Dashboard > Settings > Environment Variables:

```
NEXT_PUBLIC_API_URL = https://your-api-url.com
```

### 4. Deploy

```bash
vercel --prod
```

**Detalles:** Ver `docs/deployment/VERCEL-CHECKLIST.md`

---

## 🚂 Deploy en Railway (API)

### 1. Preparación

Crear nuevo proyecto en [Railway](https://railway.app):

```bash
railway login
railway init
```

### 2. Agregar PostgreSQL

En Railway Dashboard:

- Add New > Database > PostgreSQL
- Copiar `DATABASE_URL` que se genera automáticamente

### 3. Configurar Build

**Root Directory:** `apps/api`

**Build Command:**

```bash
cd ../.. && pnpm install && pnpm prisma:generate && cd apps/api && pnpm build
```

**Start Command:**

```bash
cd apps/api && pnpm db:migrate:deploy && pnpm start
```

**Watch Paths:**

```
apps/api/**
packages/core/**
prisma/**
```

### 4. Variables de Entorno

En Railway > Variables:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
PORT=3001
JWT_SECRET=...
SESSION_SECRET=...
# ... resto de variables
```

### 5. Deploy

```bash
railway up
```

**Detalles:** Ver `docs/deployment/RAILWAY-CHECKLIST.md`

---

## 🦅 Deploy en Koyeb (API)

### 1. Configuración de Servicio

**Type:** Web Service
**Builder:** Dockerfile
**Dockerfile:** `Dockerfile.railway`

### 2. Build Settings

**Build command:**

```bash
pnpm install && pnpm prisma:generate && pnpm build
```

**Start command:**

```bash
pnpm db:migrate:deploy && pnpm start
```

### 3. Variables de Entorno

Configurar todas las variables necesarias en Koyeb Dashboard.

**Detalles:** Ver `docs/deployment/KOYEB_DEPLOYMENT_GUIDE.md`

---

## 🐳 Deploy con Docker

### 1. Build de Imágenes

```bash
docker-compose build
```

### 2. Configurar Variables

Editar `.env` con valores de producción:

```env
NODE_ENV=production
POSTGRES_PASSWORD=strong-password-here
# ... resto de configuración
```

### 3. Levantar Servicios

```bash
docker-compose up -d
```

### 4. Ejecutar Migraciones

```bash
docker-compose exec api pnpm db:migrate:deploy
```

### 5. Verificar Health

```bash
curl http://localhost:3001/health
curl http://localhost:3000
```

---

## ✅ Checklist Pre-Deploy

### Seguridad

- [ ] Rotar todos los secrets (JWT_SECRET, SESSION_SECRET)
- [ ] Generar nuevo API_KEY_HASH para producción
- [ ] Verificar que `.env` está en `.gitignore`
- [ ] Configurar CORS_ORIGINS con dominios exactos
- [ ] Activar rate limiting apropiado
- [ ] SSL/TLS habilitado en todas las URLs

### Base de Datos

- [ ] PostgreSQL 16 configurado
- [ ] Backup automático configurado
- [ ] Migraciones probadas en staging
- [ ] Connection pooling configurado (Prisma)

### Monitoreo

- [ ] Sentry configurado para error tracking
- [ ] Prometheus + Grafana (opcional)
- [ ] Logs estructurados con Winston
- [ ] Health checks activos (`/health`, `/metrics`)

### Testing

- [ ] Tests unitarios pasando (`pnpm test`)
- [ ] Tests de integración pasando (`pnpm test:integration`)
- [ ] Build de producción exitoso (`pnpm build`)
- [ ] Tipos verificados (`pnpm typecheck`)

### Performance

- [ ] Redis habilitado para caché (opcional)
- [ ] CDN configurado para assets estáticos
- [ ] Compression habilitado (ya está en código)
- [ ] Prisma query optimization

### Documentación

- [ ] API documentation actualizada
- [ ] Variables de entorno documentadas
- [ ] Runbook de operaciones creado
- [ ] Contactos de soporte definidos

---

## 🔍 Verificación Post-Deploy

### API

```bash
# Health check
curl https://your-api.com/health

# Metrics
curl https://your-api.com/metrics

# Test endpoint (con API key)
curl -H "x-api-key: your-key" https://your-api.com/api/agents
```

### Dashboard

```bash
# Verificar que carga
curl -I https://your-dashboard.vercel.app

# Verificar que se conecta a API
# (abrir DevTools y verificar Network requests)
```

---

## 🚨 Troubleshooting

### Error: "Database connection failed"

1. Verificar `DATABASE_URL` es correcta
2. Verificar que PostgreSQL está accesible desde deploy
3. Verificar firewall rules
4. Revisar logs: `railway logs` o `vercel logs`

### Error: "Prisma Client not generated"

1. Ejecutar `pnpm prisma:generate` en build
2. Verificar que `prisma/schema.prisma` existe
3. Revisar build logs

### Error: "OAuth redirect mismatch"

1. Verificar CALLBACK_URL coincide con configuración en Google/GitHub
2. Usar HTTPS en producción
3. Verificar que dominio está whitelistado

### Error: "CORS blocked"

1. Verificar `CORS_ORIGINS` incluye dominio del dashboard
2. No usar `*` en producción
3. Incluir protocol (https://)

---

## 📚 Referencias Adicionales

- **Railway:** `docs/deployment/RAILWAY-CHECKLIST.md`
- **Vercel:** `docs/deployment/VERCEL-CHECKLIST.md`
- **Koyeb:** `docs/deployment/KOYEB_DEPLOYMENT_GUIDE.md`
- **Architecture:** `docs/architecture/ARCHITECTURE.md`
- **Security:** `docs/security/SECURITY.md`
- **Testing:** `docs/development/TESTING.md`

---

## 📞 Soporte

Para problemas de deploy:

1. Revisar logs de la plataforma
2. Verificar variables de entorno
3. Consultar documentación específica de plataforma
4. Crear issue en GitHub con logs relevantes

---

**Última actualización:** 2026-01-14  
**Versión:** 1.0
