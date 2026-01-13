# 🚀 Guía de Deployment en Koyeb - Aethermind Backend

## ✅ Problemas Resueltos

1. **Error en Dockerfile (línea 45)**: Corregido el HEALTHCHECK con caracteres de escape incorrectos
2. **Migraciones automáticas**: Agregado `docker-entrypoint.sh` para ejecutar migraciones de Prisma al iniciar
3. **Multi-stage build configurado**: El Dockerfile ahora construye correctamente el target `api`

---

## 📋 Configuración de Koyeb

### 1️⃣ **Build Options**

Selecciona: **Dockerfile** ✅

#### Configuración Override:

| Campo                   | Valor           | Override      |
| ----------------------- | --------------- | ------------- |
| **Dockerfile location** | `./Dockerfile`  | ✅ Activar    |
| **Entrypoint**          | _(dejar vacío)_ | ❌ No activar |
| **Command**             | _(dejar vacío)_ | ❌ No activar |
| **Target**              | `api`           | ✅ Activar    |
| **Work directory**      | _(dejar vacío)_ | ❌ No activar |

### 2️⃣ **Instance Configuration**

- **Tipo de instancia**: Nano (gratis) o superior según necesites
- **Region**: Washington D.C. o la que prefieras
- **Puerto**: `3001` ⚠️ **IMPORTANTE**
- **Health check path**: `/health` (automático desde el Dockerfile)

---

## 🔐 Variables de Entorno Requeridas

En la sección **Environment Variables** de Koyeb, configura las siguientes:

### Variables Esenciales:

```env
# Base de datos PostgreSQL (OBLIGATORIO)
DATABASE_URL=postgresql://usuario:password@host:5432/nombre_db

# Seguridad JWT (OBLIGATORIO - Mínimo 32 caracteres)
JWT_SECRET=tu-secreto-jwt-super-seguro-minimo-32-caracteres-aleatorio

# Sesiones (OBLIGATORIO - Mínimo 32 caracteres)
SESSION_SECRET=tu-secreto-session-super-seguro-minimo-32-caracteres-aleatorio

# Entorno
NODE_ENV=production
PORT=3001
```

### Variables OAuth (si usas autenticación social):

```env
# GitHub OAuth
GITHUB_CLIENT_ID=tu-github-client-id
GITHUB_CLIENT_SECRET=tu-github-client-secret

# Google OAuth
GOOGLE_CLIENT_ID=tu-google-client-id
GOOGLE_CLIENT_SECRET=tu-google-client-secret
```

### Variables de URLs:

```env
# URL de tu API en Koyeb
API_URL=https://tu-servicio.koyeb.app

# URL de tu frontend/dashboard
DASHBOARD_URL=https://tu-frontend.vercel.app

# Callback URLs
GOOGLE_CALLBACK_URL=${API_URL}/api/auth/google/callback
GITHUB_CALLBACK_URL=${API_URL}/api/auth/github/callback
```

### Variables Opcionales (Email, Payments, Monitoring):

```env
# SendGrid (Email)
SENDGRID_API_KEY=tu-sendgrid-api-key
EMAIL_FROM=noreply@tudominio.com

# Stripe (Pagos)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# Sentry (Monitoreo de errores)
SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=tu-sentry-auth-token
```

---

## 🗄️ Configuración de Base de Datos

### Opciones recomendadas:

1. **Neon** (Gratis hasta 0.5GB)

   - URL: https://neon.tech
   - Región: Elige cercana a Koyeb (ej: AWS us-east-1)

2. **Supabase** (Gratis hasta 500MB)

   - URL: https://supabase.com
   - Incluye PostgreSQL + extras

3. **Railway** (Pay as you go)

   - URL: https://railway.app
   - Muy fácil de integrar

4. **Render** (Gratis pero se duerme)
   - URL: https://render.com

### 📝 Pasos para configurar la DB:

1. Crea un proyecto en tu servicio elegido
2. Copia la `DATABASE_URL` (connection string)
3. Pégala en las Environment Variables de Koyeb
4. Formato típico: `postgresql://user:pass@host:5432/dbname?sslmode=require`

---

## 🧪 Generar Secretos Seguros

Para generar `JWT_SECRET` y `SESSION_SECRET`, puedes usar:

### En PowerShell (Windows):

```powershell
# Generar JWT_SECRET
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | % {[char]$_})

# Generar SESSION_SECRET
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | % {[char]$_})
```

### En Bash/Linux:

```bash
# Generar JWT_SECRET
openssl rand -base64 48

# Generar SESSION_SECRET
openssl rand -base64 48
```

### Online:

- https://randomkeygen.com/ (Fort Knox Passwords)

⚠️ **IMPORTANTE**: Nunca compartas estos secretos ni los subas a Git

---

## 🔄 Proceso de Deployment

### Qué sucede al hacer deploy:

1. ✅ **Clone**: Koyeb clona tu repositorio
2. ✅ **Docker Build**: Construye la imagen usando tu Dockerfile
3. ✅ **Target API**: Usa el stage `api` del multi-stage build
4. ✅ **Health Check**: Verifica que `/health` responda 200
5. ✅ **Migrations**: El `docker-entrypoint.sh` ejecuta `prisma migrate deploy`
6. ✅ **Start**: Inicia el servidor en el puerto 3001
7. ✅ **Expose**: Koyeb expone tu API en una URL pública

### 📊 Monitoreo:

- Ve a la pestaña **Logs** para ver la salida en tiempo real
- Busca el mensaje: "✅ Migrations completed successfully!"
- Verifica que veas: "🚀 Starting application..."

---

## ✅ Verificación Post-Deploy

### 1. Test del Health Endpoint:

```bash
curl https://tu-servicio.koyeb.app/health
```

Respuesta esperada:

```json
{
  "status": "healthy",
  "timestamp": "2026-01-13T18:50:00.000Z",
  "uptime": 123.45
}
```

### 2. Test de la API:

```bash
curl https://tu-servicio.koyeb.app/api/health
```

### 3. Logs de Migraciones:

Revisa en Koyeb > Logs que veas:

```
🔄 Running database migrations...
✅ Migrations completed successfully!
🚀 Starting application...
```

---

## 🐛 Troubleshooting

### ❌ Error: "Docker build failed with exit code 1"

- **Solución**: Verifica que el Dockerfile no tenga errores de sintaxis (ya resuelto)
- Revisa los logs de build en Koyeb

### ❌ Error: "Migration failed"

- **Solución**: Verifica que `DATABASE_URL` esté correctamente configurada
- Asegúrate que la DB esté accesible desde internet
- Revisa que el formato incluya `?sslmode=require` si es necesario

### ❌ Error: "Health check failed"

- **Solución**: Verifica que el puerto sea `3001`
- Confirma que el endpoint `/health` funcione localmente
- Revisa los logs de la aplicación

### ❌ Error: "Cannot find module 'prisma'"

- **Solución**: El Dockerfile ya incluye `prisma generate` en el postinstall
- Verifica que el archivo `prisma/schema.prisma` exista en el repo

---

## 📦 Archivos Modificados

### Nuevos archivos creados:

1. `docker-entrypoint.sh` - Script para ejecutar migraciones automáticamente

### Archivos actualizados:

1. `Dockerfile` - Corregido HEALTHCHECK y agregado ENTRYPOINT

### ⚠️ IMPORTANTE: Hacer commit y push

Antes de deployar en Koyeb, asegúrate de:

```bash
git add Dockerfile docker-entrypoint.sh
git commit -m "fix: Docker configuration for Koyeb deployment"
git push origin main
```

---

## 🎯 Checklist de Deployment

- [ ] Base de datos PostgreSQL creada y accesible
- [ ] `DATABASE_URL` configurada en Koyeb
- [ ] `JWT_SECRET` generado (64+ caracteres aleatorios)
- [ ] `SESSION_SECRET` generado (64+ caracteres aleatorios)
- [ ] OAuth credentials configuradas (si aplica)
- [ ] Email service configurado (si aplica)
- [ ] Stripe configurado (si aplica)
- [ ] Dockerfile corregido y pusheado a Git
- [ ] `docker-entrypoint.sh` creado y pusheado a Git
- [ ] En Koyeb: Target = `api`
- [ ] En Koyeb: Port = `3001`
- [ ] En Koyeb: Dockerfile location = `./Dockerfile`

---

## 🚀 ¡Listo para Deploy!

Una vez que tengas todo configurado:

1. Ve a Koyeb > Services > Create Service
2. Conecta tu repositorio GitHub
3. Configura según esta guía
4. Click en **Deploy**
5. ¡Espera unos minutos y tu API estará live! 🎉

---

## 📚 Recursos Adicionales

- [Documentación de Koyeb](https://www.koyeb.com/docs)
- [Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)

---

**Última actualización**: 2026-01-13
**Autor**: Antigravity AI Assistant
