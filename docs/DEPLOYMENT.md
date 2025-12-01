# Guía de Despliegue - AethermindOS

Esta guía te llevará paso a paso por el proceso de despliegue de AethermindOS en Railway (backend) y Vercel (frontend).

## 📋 Requisitos Previos

- [ ] Cuenta en [Railway](https://railway.app)
- [ ] Cuenta en [Vercel](https://vercel.com)
- [ ] Repositorio en GitHub con tu código
- [ ] Dominio configurado (opcional pero recomendado)
- [ ] Node.js 18+ y pnpm 9+ instalados localmente

## 🏗️ Arquitectura de Despliegue

```
┌─────────────────────────────────────────────────────────┐
│                     tudominio.com                        │
│                   (Vercel - Frontend)                    │
│              packages/dashboard (Next.js)                │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ API Calls
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  app.tudominio.com                       │
│                  (Railway - Backend)                     │
│          apps/api (Express + WebSockets)                 │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  PostgreSQL  │  │    Redis     │  │   API Server │  │
│  │   (Railway)  │  │  (Railway)   │  │   (Docker)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Parte 1: Despliegue del Backend en Railway

### Paso 1: Preparar el Repositorio

1. **Asegúrate de que todos los archivos estén en tu repositorio:**
   ```bash
   git add railway.json Dockerfile.railway .env.production.example
   git commit -m "Add Railway deployment configuration"
   git push origin main
   ```

### Paso 2: Crear Proyecto en Railway

1. Ve a [Railway Dashboard](https://railway.app/dashboard)
2. Click en **"New Project"**
3. Selecciona **"Deploy from GitHub repo"**
4. Autoriza Railway a acceder a tu repositorio
5. Selecciona el repositorio `Aethermind-AgentOS`

### Paso 3: Agregar PostgreSQL

1. En tu proyecto de Railway, click en **"+ New"**
2. Selecciona **"Database"** → **"Add PostgreSQL"**
3. Railway creará automáticamente la base de datos y generará `DATABASE_URL`
4. Anota el nombre del servicio (ej: `postgres`)

### Paso 4: Agregar Redis

1. Click en **"+ New"** nuevamente
2. Selecciona **"Database"** → **"Add Redis"**
3. Railway generará automáticamente `REDIS_URL`
4. Anota el nombre del servicio (ej: `redis`)

### Paso 5: Configurar el Servicio API

1. Click en el servicio de tu aplicación (el que tiene tu código)
2. Ve a **"Settings"**
3. En **"Build"**, verifica que detecte `Dockerfile.railway`
4. En **"Deploy"**, configura:
   - **Start Command**: `node apps/api/dist/index.js` (ya está en railway.json)
   - **Health Check Path**: `/health`

### Paso 6: Configurar Variables de Entorno

1. En el servicio API, ve a la pestaña **"Variables"**
2. Click en **"Raw Editor"** y pega las siguientes variables:

```bash
# Node Environment
NODE_ENV=production
PORT=3001

# Database (Railway auto-genera DATABASE_URL, pero verifica que esté)
# DATABASE_URL se genera automáticamente al conectar PostgreSQL

# Redis (Railway auto-genera REDIS_URL al conectar Redis)
# REDIS_URL se genera automáticamente

# LLM Providers (reemplaza con tus keys reales)
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# Security - CRÍTICO
# Genera JWT_SECRET con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=tu-jwt-secret-de-minimo-32-caracteres-aqui

# Genera API_KEY_HASH localmente con: pnpm run generate-api-key
# Luego copia el hash generado aquí
API_KEY_HASH=tu-api-key-hash-generado

# CORS - Agrega tu dominio de Vercel
CORS_ORIGINS=https://tudominio.com,https://www.tudominio.com
ALLOWED_ORIGINS=https://tudominio.com,https://www.tudominio.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Paso 7: Generar Secretos de Seguridad

**En tu máquina local:**

1. **Generar JWT_SECRET:**

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Copia el resultado y pégalo en Railway como `JWT_SECRET`

2. **Generar API_KEY_HASH:**
   ```bash
   pnpm run generate-api-key
   ```
   Esto generará:
   - Un API Key (guárdalo en un lugar seguro, lo necesitarás para hacer requests)
   - Un API Key Hash (cópialo y pégalo en Railway como `API_KEY_HASH`)

### Paso 8: Ejecutar Migraciones de Prisma

1. En Railway, ve al servicio API
2. Click en **"Deployments"**
3. Una vez que el deploy esté completo, abre la **"Terminal"** (ícono de terminal en la esquina)
4. Ejecuta:
   ```bash
   cd /app
   pnpm prisma migrate deploy
   ```

### Paso 9: Configurar Dominio Personalizado (Opcional)

1. En el servicio API, ve a **"Settings"** → **"Domains"**
2. Click en **"Generate Domain"** (Railway te dará un dominio gratuito como `xxx.railway.app`)
3. O click en **"Custom Domain"** para usar tu propio dominio:
   - Ingresa: `app.tudominio.com`
   - Configura el registro CNAME en tu proveedor de DNS:
     ```
     CNAME  app  xxx.railway.app
     ```

### Paso 10: Verificar el Despliegue

1. Espera a que el deploy termine (indicador verde)
2. Abre la URL de tu API (ej: `https://app.tudominio.com` o `https://xxx.railway.app`)
3. Verifica el health check:
   ```bash
   curl https://app.tudominio.com/health
   ```
   Deberías ver:
   ```json
   {
     "status": "ok",
     "timestamp": "2025-12-01T...",
     "storage": "prisma"
   }
   ```

---

## 🎨 Parte 2: Despliegue del Frontend en Vercel

### Paso 1: Preparar Vercel

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Click en **"Add New..."** → **"Project"**
3. Importa tu repositorio de GitHub
4. Selecciona el repositorio `Aethermind-AgentOS`

### Paso 2: Configurar el Proyecto

1. **Framework Preset**: Next.js (debe detectarse automáticamente)
2. **Root Directory**: Deja en blanco (usará la raíz)
3. **Build Command**:
   ```bash
   pnpm turbo run build --filter=@aethermind/dashboard
   ```
4. **Output Directory**:
   ```
   packages/dashboard/.next
   ```
5. **Install Command**:
   ```bash
   pnpm install --frozen-lockfile
   ```

### Paso 3: Configurar Variables de Entorno

1. En la sección **"Environment Variables"**, agrega:

```bash
# URL del API en Railway
NEXT_PUBLIC_API_URL=https://app.tudominio.com

# O si usas el dominio gratuito de Railway:
# NEXT_PUBLIC_API_URL=https://xxx.railway.app
```

> **Nota**: Las variables que empiezan con `NEXT_PUBLIC_` son accesibles en el cliente.

### Paso 4: Deploy

1. Click en **"Deploy"**
2. Vercel comenzará el build y deploy automáticamente
3. Espera a que termine (usualmente 2-3 minutos)

### Paso 5: Configurar Dominio Personalizado

1. Una vez deployado, ve a **"Settings"** → **"Domains"**
2. Agrega tu dominio:
   - `tudominio.com`
   - `www.tudominio.com`
3. Configura los registros DNS en tu proveedor:
   ```
   A      @      76.76.21.21
   CNAME  www    cname.vercel-dns.com
   ```

### Paso 6: Verificar el Despliegue

1. Abre tu dominio: `https://tudominio.com`
2. Verifica que la landing page cargue correctamente
3. Abre la consola del navegador (F12) y verifica que no haya errores
4. Si tu dashboard hace llamadas al API, verifica que funcionen

---

## 🔄 Actualizaciones y Re-deploys

### Railway (Backend)

Railway hace **auto-deploy** en cada push a `main`:

```bash
git add .
git commit -m "Update API"
git push origin main
```

Para hacer deploy manual:

1. Ve a Railway Dashboard → Tu proyecto
2. Click en el servicio API
3. Click en **"Deployments"** → **"Deploy"**

### Vercel (Frontend)

Vercel también hace **auto-deploy** en cada push:

```bash
git add .
git commit -m "Update frontend"
git push origin main
```

Para hacer deploy manual:

1. Ve a Vercel Dashboard → Tu proyecto
2. Click en **"Deployments"**
3. Click en los tres puntos del último deployment → **"Redeploy"**

---

## 🔧 Troubleshooting

### Error: "JWT_SECRET must be set and at least 32 characters"

**Causa**: No configuraste `JWT_SECRET` o es muy corto.

**Solución**:

```bash
# Genera un nuevo secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Cópialo y agrégalo en Railway → Variables → JWT_SECRET
```

### Error: "API_KEY_HASH must be configured in production"

**Causa**: No configuraste `API_KEY_HASH`.

**Solución**:

```bash
# En tu máquina local
pnpm run generate-api-key

# Copia el hash generado y agrégalo en Railway → Variables → API_KEY_HASH
```

### Error: "Cannot connect to database"

**Causa**: Prisma no puede conectarse a PostgreSQL.

**Solución**:

1. Verifica que `DATABASE_URL` esté configurada en Railway
2. Verifica que el servicio PostgreSQL esté corriendo
3. Ejecuta las migraciones:
   ```bash
   pnpm prisma migrate deploy
   ```

### Error: "Redis connection failed"

**Causa**: No se puede conectar a Redis.

**Solución**:

1. Verifica que `REDIS_URL` esté configurada
2. Verifica que el servicio Redis esté corriendo en Railway
3. El API debería funcionar sin Redis (con advertencias), pero con rendimiento reducido

### Frontend no puede conectarse al API

**Causa**: CORS o URL incorrecta.

**Solución**:

1. Verifica que `NEXT_PUBLIC_API_URL` en Vercel apunte a tu API de Railway
2. Verifica que `CORS_ORIGINS` en Railway incluya tu dominio de Vercel:
   ```bash
   CORS_ORIGINS=https://tudominio.com,https://www.tudominio.com
   ```
3. Re-deploya ambos servicios después de cambiar variables de entorno

### Build falla en Railway

**Causa**: Dependencias faltantes o error en el build.

**Solución**:

1. Revisa los logs en Railway → Deployments → Click en el deployment fallido
2. Verifica que `pnpm-lock.yaml` esté actualizado:
   ```bash
   pnpm install
   git add pnpm-lock.yaml
   git commit -m "Update lockfile"
   git push
   ```

### Build falla en Vercel

**Causa**: Error en el build de Next.js o configuración incorrecta.

**Solución**:

1. Revisa los logs en Vercel → Deployments → Click en el deployment fallido
2. Verifica que el build funcione localmente:
   ```bash
   cd packages/dashboard
   pnpm build
   ```
3. Verifica que `vercel.json` tenga la configuración correcta

---

## 📊 Monitoreo

### Railway

1. **Logs**: Railway → Tu servicio → Logs
2. **Métricas**: Railway → Tu servicio → Metrics (CPU, memoria, requests)
3. **Health Check**: Automático en `/health`

### Vercel

1. **Analytics**: Vercel → Tu proyecto → Analytics
2. **Logs**: Vercel → Tu proyecto → Deployments → Click en deployment → Logs
3. **Performance**: Vercel → Tu proyecto → Speed Insights (requiere plan Pro)

---

## 🔐 Seguridad Post-Despliegue

### Checklist de Seguridad

- [ ] `JWT_SECRET` configurado (mínimo 32 caracteres)
- [ ] `API_KEY_HASH` configurado
- [ ] `CORS_ORIGINS` configurado solo con tus dominios
- [ ] Variables de entorno sensibles NO están en el código
- [ ] HTTPS habilitado (automático en Railway y Vercel)
- [ ] Rate limiting configurado
- [ ] Logs de autenticación fallida activados

### Rotar Secretos

**Cada 90 días, rota tus secretos:**

1. **JWT_SECRET**:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Actualiza en Railway → Variables

2. **API_KEY_HASH**:
   ```bash
   pnpm run generate-api-key
   ```
   Actualiza en Railway → Variables

---

## 📞 Soporte

Si encuentras problemas:

1. Revisa los logs en Railway y Vercel
2. Verifica que todas las variables de entorno estén configuradas
3. Consulta la documentación:
   - [Railway Docs](https://docs.railway.app)
   - [Vercel Docs](https://vercel.com/docs)
   - [Next.js Deployment](https://nextjs.org/docs/deployment)

---

## ✅ Checklist Final

### Railway (Backend)

- [ ] Proyecto creado en Railway
- [ ] PostgreSQL agregado y conectado
- [ ] Redis agregado y conectado
- [ ] Variables de entorno configuradas
- [ ] `JWT_SECRET` generado y configurado
- [ ] `API_KEY_HASH` generado y configurado
- [ ] Migraciones de Prisma ejecutadas
- [ ] Dominio personalizado configurado (opcional)
- [ ] Health check respondiendo correctamente

### Vercel (Frontend)

- [ ] Proyecto importado en Vercel
- [ ] Build command configurado
- [ ] Output directory configurado
- [ ] `NEXT_PUBLIC_API_URL` configurado
- [ ] Dominio personalizado configurado (opcional)
- [ ] Landing page cargando correctamente
- [ ] Llamadas al API funcionando

### General

- [ ] Auto-deploy configurado en ambos servicios
- [ ] CORS configurado correctamente
- [ ] Monitoreo configurado
- [ ] Backups de base de datos configurados (Railway automático)
- [ ] Documentación actualizada

---

## 📚 Documentación Adicional (Docker Local)

Para despliegue local con Docker, consulta las secciones originales de este archivo sobre Docker Compose, backups y troubleshooting.

¡Felicidades! 🎉 Tu AethermindOS está ahora desplegado en producción.
