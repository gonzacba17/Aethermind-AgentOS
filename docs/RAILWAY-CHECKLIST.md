# Checklist de Configuración de Railway - Paso a Paso

Esta guía te llevará por la configuración EXACTA de Railway, paso por paso, con todos los valores que necesitas.

---

## 📋 PARTE 1: Crear Proyecto en Railway

### ✅ Paso 1.1: Crear Nuevo Proyecto

- [ ] Ve a https://railway.app/dashboard
- [ ] Click en **"New Project"**
- [ ] Selecciona **"Deploy from GitHub repo"**
- [ ] Autoriza Railway a acceder a tu GitHub (si es primera vez)
- [ ] Selecciona tu repositorio: `Aethermind-AgentOS`
- [ ] Railway creará automáticamente un servicio con tu código

**Resultado:** Verás un proyecto con 1 servicio (tu aplicación)

---

## 📋 PARTE 2: Agregar Base de Datos PostgreSQL

### ✅ Paso 2.1: Agregar PostgreSQL

- [ ] En tu proyecto de Railway, click en **"+ New"** (esquina superior derecha)
- [ ] Selecciona **"Database"**
- [ ] Click en **"Add PostgreSQL"**
- [ ] Espera 10-15 segundos a que se cree

### ✅ Paso 2.2: Verificar Variables Generadas

- [ ] Click en el servicio **"Postgres"** que se creó
- [ ] Ve a la pestaña **"Variables"**
- [ ] Verifica que existan estas variables (Railway las crea automáticamente):
  - `PGHOST`
  - `PGPORT`
  - `PGUSER`
  - `PGPASSWORD`
  - `PGDATABASE`
  - `DATABASE_URL` ← **Esta es la importante**

### ✅ Paso 2.3: Conectar PostgreSQL a tu Aplicación

- [ ] Click en el servicio de tu aplicación (el que tiene tu código)
- [ ] Ve a la pestaña **"Variables"**
- [ ] Click en **"+ New Variable"**
- [ ] Selecciona **"Add Reference"**
- [ ] En el dropdown, selecciona: **Postgres → DATABASE_URL**
- [ ] Click **"Add"**

**Resultado:** Tu aplicación ahora tiene acceso a `DATABASE_URL`

---

## 📋 PARTE 3: Agregar Redis

### ✅ Paso 3.1: Agregar Redis

- [ ] En tu proyecto, click en **"+ New"** nuevamente
- [ ] Selecciona **"Database"**
- [ ] Click en **"Add Redis"**
- [ ] Espera 10-15 segundos a que se cree

### ✅ Paso 3.2: Verificar Variables Generadas

- [ ] Click en el servicio **"Redis"** que se creó
- [ ] Ve a la pestaña **"Variables"**
- [ ] Verifica que exista:
  - `REDIS_URL` ← **Esta es la importante**

### ✅ Paso 3.3: Conectar Redis a tu Aplicación

- [ ] Click en el servicio de tu aplicación
- [ ] Ve a la pestaña **"Variables"**
- [ ] Click en **"+ New Variable"**
- [ ] Selecciona **"Add Reference"**
- [ ] En el dropdown, selecciona: **Redis → REDIS_URL**
- [ ] Click **"Add"**

**Resultado:** Tu aplicación ahora tiene acceso a `REDIS_URL`

---

## 📋 PARTE 4: Configurar Variables de Entorno de la Aplicación

### ✅ Paso 4.1: Acceder a Variables

- [ ] Click en el servicio de tu aplicación (el que tiene tu código)
- [ ] Ve a la pestaña **"Variables"**
- [ ] Click en **"Raw Editor"** (esquina superior derecha)

### ✅ Paso 4.2: Pegar Variables de Entorno

**IMPORTANTE:** Antes de pegar, necesitas generar algunos valores. Abre una terminal local y ejecuta:

```powershell
# 1. Generar JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copia el resultado

# 2. Generar API_KEY_HASH
pnpm generate-api-key
# Copia el HASH (no el key, el hash)
```

Ahora, en el **Raw Editor** de Railway, pega lo siguiente (reemplaza los valores marcados con `<...>`):

```bash
# ============================================================================
# Node Environment
# ============================================================================
NODE_ENV=production
PORT=3001

# ============================================================================
# Database (Ya configurado via Reference, pero verifica que esté)
# ============================================================================
# DATABASE_URL ya debe estar aquí desde el Paso 2.3
# Si no está, agrégalo manualmente desde References

# ============================================================================
# Redis (Ya configurado via Reference, pero verifica que esté)
# ============================================================================
# REDIS_URL ya debe estar aquí desde el Paso 3.3
# Si no está, agrégalo manualmente desde References

# ============================================================================
# LLM Providers (REEMPLAZA CON TUS KEYS REALES)
# ============================================================================
OPENAI_API_KEY=<tu-openai-api-key-aqui>
ANTHROPIC_API_KEY=<tu-anthropic-api-key-aqui>

# ============================================================================
# Security - CRÍTICO (REEMPLAZA CON LOS VALORES GENERADOS)
# ============================================================================
# Usa el valor generado con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=<pega-aqui-el-jwt-secret-generado-64-caracteres>

# Usa el valor generado con: pnpm generate-api-key (copia el HASH)
API_KEY_HASH=<pega-aqui-el-api-key-hash-generado>

# ============================================================================
# CORS - IMPORTANTE: Agrega tu dominio de Vercel aquí
# ============================================================================
# Reemplaza tudominio.com con tu dominio real
CORS_ORIGINS=https://tudominio.com,https://www.tudominio.com
ALLOWED_ORIGINS=https://tudominio.com,https://www.tudominio.com

# ============================================================================
# Rate Limiting
# ============================================================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# ============================================================================
# Performance
# ============================================================================
DB_POOL_MAX=20
LLM_TIMEOUT_MS=30000
QUEUE_CONCURRENCY=10
REQUEST_BODY_LIMIT=10mb
```

- [ ] Click **"Update Variables"**

### ✅ Paso 4.3: Verificar Variables Críticas

Asegúrate de que estas variables estén configuradas (ve a la pestaña Variables):

- [ ] ✅ `NODE_ENV` = `production`
- [ ] ✅ `PORT` = `3001`
- [ ] ✅ `DATABASE_URL` = `postgresql://...` (desde Reference)
- [ ] ✅ `REDIS_URL` = `redis://...` (desde Reference)
- [ ] ✅ `JWT_SECRET` = (64 caracteres hexadecimales)
- [ ] ✅ `API_KEY_HASH` = (hash bcrypt, empieza con `$2b$`)
- [ ] ✅ `OPENAI_API_KEY` = `sk-...`
- [ ] ✅ `CORS_ORIGINS` = tu dominio de Vercel

---

## 📋 PARTE 5: Configurar Settings del Proyecto

### ✅ Paso 5.1: Configurar Build Settings

- [ ] En el servicio de tu aplicación, ve a **"Settings"**
- [ ] Scroll hasta **"Build"**
- [ ] Verifica/configura:
  - **Builder**: `DOCKERFILE`
  - **Dockerfile Path**: `Dockerfile.railway`
  - **Build Command**: (déjalo vacío, usa el Dockerfile)

### ✅ Paso 5.2: Configurar Deploy Settings

- [ ] En la misma página de Settings, scroll hasta **"Deploy"**
- [ ] Configura:
  - **Start Command**: `node apps/api/dist/index.js`
  - **Restart Policy**: `ON_FAILURE`
  - **Health Check Path**: `/health`
  - **Health Check Timeout**: `100` segundos

### ✅ Paso 5.3: Configurar Root Directory (IMPORTANTE)

- [ ] En Settings, scroll hasta **"Source"**
- [ ] Verifica que **"Root Directory"** esté en blanco o sea `/`
- [ ] (No cambies esto, el Dockerfile maneja la estructura del monorepo)

---

## 📋 PARTE 6: Ejecutar Migraciones de Prisma

### ✅ Paso 6.1: Esperar el Primer Deploy

- [ ] Ve a la pestaña **"Deployments"**
- [ ] Espera a que el primer deployment termine (indicador verde)
- [ ] Esto puede tardar 3-5 minutos

### ✅ Paso 6.2: Abrir Terminal

- [ ] Una vez que el deploy esté completo (verde), ve a **"Deployments"**
- [ ] Click en el deployment más reciente
- [ ] Click en el ícono de **terminal** (esquina superior derecha, parece `>_`)

### ✅ Paso 6.3: Ejecutar Migraciones

En la terminal que se abrió, ejecuta:

```bash
cd /app
npx prisma migrate deploy
```

- [ ] Espera a que termine (verás algo como "✓ Applied X migrations")
- [ ] Cierra la terminal

**Resultado:** Base de datos inicializada con el schema correcto

---

## 📋 PARTE 7: Configurar Dominio Personalizado

### ✅ Paso 7.1: Generar Dominio de Railway (Temporal)

- [ ] En el servicio de tu aplicación, ve a **"Settings"**
- [ ] Scroll hasta **"Domains"**
- [ ] Click en **"Generate Domain"**
- [ ] Railway te dará un dominio como: `your-app-production.up.railway.app`
- [ ] Copia este dominio (lo necesitarás para Vercel)

### ✅ Paso 7.2: Agregar Dominio Personalizado (Opcional)

**Si tienes un dominio propio:**

- [ ] En la misma sección "Domains", click en **"Custom Domain"**
- [ ] Ingresa: `app.tudominio.com` (o el subdominio que prefieras)
- [ ] Railway te mostrará un registro CNAME para configurar

**En tu proveedor de DNS (GoDaddy, Namecheap, Cloudflare, etc.):**

- [ ] Ve a la configuración de DNS de tu dominio
- [ ] Agrega un registro CNAME:
  - **Type**: `CNAME`
  - **Name**: `app` (o el subdominio que elegiste)
  - **Value**: `your-app-production.up.railway.app` (el dominio de Railway)
  - **TTL**: `Auto` o `3600`
- [ ] Guarda los cambios
- [ ] Espera 5-10 minutos para que se propague

**De vuelta en Railway:**

- [ ] Verifica que el dominio muestre un ✅ verde
- [ ] Si no, espera unos minutos más

---

## 📋 PARTE 8: Verificar el Despliegue

### ✅ Paso 8.1: Verificar Health Check

- [ ] Abre tu navegador
- [ ] Ve a: `https://your-app-production.up.railway.app/health`
  - (O `https://app.tudominio.com/health` si configuraste dominio personalizado)

**Deberías ver:**

```json
{
  "status": "ok",
  "timestamp": "2025-12-01T...",
  "storage": "prisma"
}
```

### ✅ Paso 8.2: Verificar Logs

- [ ] En Railway, ve a la pestaña **"Logs"** de tu aplicación
- [ ] Verifica que veas:
  ```
  Aethermind API server running on port 3001
  WebSocket server running on ws://localhost:3001/ws
  Health check: http://localhost:3001/health
  Storage: Prisma
  Auth: Enabled
  ```

### ✅ Paso 8.3: Verificar Servicios

- [ ] En la vista general del proyecto, verifica que los 3 servicios estén verdes:
  - [ ] ✅ Tu aplicación (API)
  - [ ] ✅ PostgreSQL
  - [ ] ✅ Redis

---

## 📋 PARTE 9: Actualizar CORS para Vercel

**IMPORTANTE:** Una vez que despliegues en Vercel, necesitarás actualizar CORS.

### ✅ Paso 9.1: Obtener URL de Vercel

- [ ] Después de desplegar en Vercel, copia la URL (ej: `https://tudominio.vercel.app`)

### ✅ Paso 9.2: Actualizar Variables en Railway

- [ ] En Railway, ve a tu aplicación → **"Variables"**
- [ ] Actualiza `CORS_ORIGINS` y `ALLOWED_ORIGINS`:
  ```
  CORS_ORIGINS=https://tudominio.com,https://www.tudominio.com,https://tudominio.vercel.app
  ALLOWED_ORIGINS=https://tudominio.com,https://www.tudominio.com,https://tudominio.vercel.app
  ```
- [ ] Click **"Update Variables"**
- [ ] Railway re-deployará automáticamente

---

## 📋 RESUMEN DE CONFIGURACIÓN

### Servicios Creados

- [x] Aplicación (tu código)
- [x] PostgreSQL
- [x] Redis

### Variables de Entorno Configuradas

- [x] `NODE_ENV=production`
- [x] `PORT=3001`
- [x] `DATABASE_URL` (Reference)
- [x] `REDIS_URL` (Reference)
- [x] `JWT_SECRET` (generado)
- [x] `API_KEY_HASH` (generado)
- [x] `OPENAI_API_KEY`
- [x] `ANTHROPIC_API_KEY` (opcional)
- [x] `CORS_ORIGINS`
- [x] `ALLOWED_ORIGINS`
- [x] Rate limiting vars
- [x] Performance vars

### Settings Configurados

- [x] Builder: DOCKERFILE
- [x] Dockerfile Path: Dockerfile.railway
- [x] Start Command: node apps/api/dist/index.js
- [x] Health Check Path: /health
- [x] Restart Policy: ON_FAILURE

### Tareas Completadas

- [x] Migraciones de Prisma ejecutadas
- [x] Dominio configurado
- [x] Health check verificado
- [x] Logs verificados

---

## 🎯 Siguiente Paso

Una vez que Railway esté funcionando correctamente:

1. **Guarda tu API URL**: `https://app.tudominio.com` (o el dominio de Railway)
2. **Continúa con Vercel**: Usa esta URL para configurar `NEXT_PUBLIC_API_URL` en Vercel
3. **Sigue la guía**: [docs/DEPLOYMENT.md](file:///c:/wamp64/www/Aethermind%20Agent%20os/docs/DEPLOYMENT.md) - Parte 2 (Vercel)

---

## 🔧 Troubleshooting Railway

### Error: "Build failed"

- [ ] Verifica que `Dockerfile.railway` esté en la raíz del repo
- [ ] Revisa los logs de build en Railway
- [ ] Verifica que `pnpm-lock.yaml` esté en el repo

### Error: "Health check failed"

- [ ] Verifica que `DATABASE_URL` y `REDIS_URL` estén configurados
- [ ] Verifica que las migraciones de Prisma se ejecutaron
- [ ] Revisa los logs de la aplicación

### Error: "JWT_SECRET must be set"

- [ ] Verifica que `JWT_SECRET` tenga al menos 32 caracteres
- [ ] Verifica que `NODE_ENV=production`

### Deployment muy lento

- [ ] Es normal la primera vez (3-5 minutos)
- [ ] Deployments subsecuentes serán más rápidos (1-2 minutos)

---

¡Configuración de Railway completada! 🚀
