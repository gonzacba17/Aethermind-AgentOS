# 🔍 Verificación del Deploy en Railway

**Última actualización:** 2026-01-15 14:30

---

## ✅ Estado de los Fixes Pusheados a GitHub

### **Commits aplicados:**

```bash
0ff0d05 - fix(prisma): agregar migración para campos faltantes en tabla users
43ade6f - fix: excluir directorios de backup del workspace para corregir build
17f83a0 - chore: agregar directorios de backup al .gitignore
54a6cd8 - fix: eliminar duplicación de /auth/callback en redirect de OAuth
```

---

## 🎯 Problema 1: Duplicación de `/auth/callback`

### **Status:** ✅ **CORREGIDO EN CÓDIGO**

**Commit:** `54a6cd8`  
**Archivo:** `apps/api/src/routes/oauth.ts`  
**Líneas corregidas:** 91-93 (Google) y 185-187 (GitHub)

### **Código ANTES (INCORRECTO):**

```typescript
const callbackUrl = `${redirect}/auth/callback`; // ❌ DUPLICABA
res.redirect(`${callbackUrl}?token=${token}`);
```

### **Código AHORA (CORRECTO):**

```typescript
// Note: redirect already contains /auth/callback from frontend
res.redirect(`${redirect}?token=${token}`); // ✅ USA DIRECTO
```

### **¿Por qué sigue fallando?**

**Railway NO ha redespleado todavía** o está usando código cacheado.

### **Cómo verificar el estado del deploy:**

#### **Opción 1: Dashboard de Railway**

1. Ve a: https://railway.app/dashboard
2. Selecciona el proyecto `aethermindapi-production`
3. Ve a la pestaña **"Deployments"**
4. Verifica que el último deploy sea del commit `0ff0d05` o posterior
5. Revisa el status:
   - 🟢 **Success** → Deploy completado
   - 🔵 **Building** → Aún compilando
   - 🔴 **Failed** → Falló, revisa los logs

#### **Opción 2: Railway CLI**

```bash
# Instalar Railway CLI si no lo tienes
npm install -g @railway/cli

# Login
railway login

# Vincular al proyecto
railway link

# Ver logs en tiempo real
railway logs --tail

# Ver estado del último deploy
railway status
```

#### **Opción 3: Verificar URL manualmente**

Prueba hacer login con Google y observa la URL de redirect:

```
Inicio: https://aethermindapi-production.up.railway.app/auth/google?redirect=https://aethermind-page.vercel.app/auth/callback

Si funciona → Redirige a:
✅ https://aethermind-page.vercel.app/auth/callback?token=eyJ...

Si falla → Redirige a:
❌ https://aethermind-page.vercel.app/auth/callback/auth/callback?token=eyJ...
```

### **Si Railway NO ha redespleado:**

#### **Forzar redeploy manualmente:**

```bash
# Opción 1: Hacer un commit vacío
git commit --allow-empty -m "chore: force Railway redeploy"
git push

# Opción 2: Desde Railway Dashboard
# 1. Ve a Deployments
# 2. Click en el último deployment
# 3. Click en "Redeploy"

# Opción 3: Desde Railway CLI
railway up --detach
```

---

## 🎯 Problema 2: Columnas Faltantes en BD (`verification_expiry`, `has_completed_onboarding`)

### **Status:** ✅ **MIGRACIÓN CREADA Y PUSHEADA**

**Commit:** `0ff0d05`  
**Migración:** `prisma/migrations/20260115000000_add_user_onboarding_fields/migration.sql`  
**Dockerfile:** `Dockerfile.railway` actualizado para aplicar migraciones automáticamente

### **Qué hace la migración:**

Agrega **11 columnas faltantes** a la tabla `users`:

```sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verification_expiry" TIMESTAMPTZ(6);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "has_completed_onboarding" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_step" VARCHAR(50) DEFAULT 'welcome';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trial_started_at" TIMESTAMPTZ(6);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMPTZ(6);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_status" VARCHAR(50) NOT NULL DEFAULT 'free';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMPTZ(6);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_login_at" TIMESTAMPTZ(6);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "max_agents" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "log_retention_days" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255);
-- + google_id, github_id, subscription_logs table...
```

### **¿Qué pasa durante el deploy de Railway?**

El `Dockerfile.railway` ejecuta automáticamente:

```bash
echo 'Aplicando migraciones...'
npx prisma migrate deploy --schema=./prisma/schema.prisma
echo 'Generando cliente Prisma...'
npx prisma generate --schema=./prisma/schema.prisma
echo 'Iniciando aplicación...'
dumb-init node apps/api/dist/index.js
```

### **Cómo verificar que las migraciones se aplicaron:**

#### **Desde Railway CLI:**

```bash
# Conectar a la base de datos de Railway
railway run psql $DATABASE_URL

# Dentro de psql, ejecutar:
\d users

# Deberías ver las nuevas columnas:
# - verification_expiry
# - has_completed_onboarding
# - onboarding_step
# - subscription_status
# - trial_started_at
# - trial_ends_at
# - last_login_at
# - first_login_at
# - max_agents
# - log_retention_days
# - name
# - google_id
# - github_id
```

#### **Verificar estado de migraciones:**

```bash
railway run npx prisma migrate status
```

Deberías ver:

```
✓ 20251130000603_initial_schema_with_users
✓ 20260115000000_add_user_onboarding_fields   ← NUEVA

All migrations have been applied.
```

### **Si las migraciones NO se aplicaron:**

#### **Aplicar manualmente:**

```bash
# Desde Railway CLI
railway run npx prisma migrate deploy --schema=./prisma/schema.prisma

# O directamente con SQL
railway run psql $DATABASE_URL < prisma/migrations/20260115000000_add_user_onboarding_fields/migration.sql
```

---

## 🚨 Troubleshooting

### **Build de Railway fallando:**

#### **Revisar logs de build:**

```bash
railway logs --deployment [deployment-id]
```

#### **Errores comunes:**

**1. Workspace duplicado:**

```
Failed to add workspace "@aethermind/dashboard"
```

**Fix:** Ya aplicado en commit `43ade6f` (pnpm-workspace.yaml actualizado)

**2. Migración falla:**

```
Migration failed to apply
```

**Fix:** La migración usa `IF NOT EXISTS`, es segura. Aplicar manualmente.

**3. DATABASE_URL no configurada:**

```
ERROR: DATABASE_URL no está configurada
```

**Fix:** Configurar en Railway Dashboard → Variables → DATABASE_URL

### **OAuth sigue fallando después del deploy:**

#### **Limpiar caché del navegador:**

```bash
# Chrome/Edge
Ctrl + Shift + Delete → Borrar caché y cookies

# O usar modo incógnito
Ctrl + Shift + N
```

#### **Verificar que el backend desplegado tiene el fix:**

```bash
# Hacer una petición de prueba y ver los headers
curl -I https://aethermindapi-production.up.railway.app/health

# Ver el commit hash del deployment en Railway Dashboard
# Debe ser 0ff0d05 o posterior
```

---

## ✅ Checklist de Verificación Post-Deploy

- [ ] Railway deployment status = **Success**
- [ ] Commit hash en Railway = `0ff0d05` o posterior
- [ ] Logs de Railway muestran: "Aplicando migraciones... ✓"
- [ ] Logs de Railway muestran: "Generando cliente Prisma... ✓"
- [ ] Logs de Railway muestran: "Iniciando aplicación... ✓"
- [ ] No hay errores de `column does not exist` en los logs
- [ ] OAuth redirect va a `/auth/callback` (sin duplicación)
- [ ] Endpoint `/auth/me` responde sin errores de Prisma
- [ ] La tabla `users` tiene las 11 nuevas columnas

---

## 📞 Si Todo Falla

### **Plan B: Rollback + Fix Manual**

```bash
# 1. Conectar a Railway
railway login
railway link

# 2. Aplicar migración manualmente
railway run psql $DATABASE_URL < prisma/migrations/20260115000000_add_user_onboarding_fields/migration.sql

# 3. Regenerar cliente Prisma
railway run npx prisma generate

# 4. Redeploy forzado
railway up --detach

# 5. Monitorear logs
railway logs --tail
```

---

## 📊 Tiempo Estimado

| Etapa                  | Tiempo Estimado               |
| ---------------------- | ----------------------------- |
| Railway detecta push   | 10-30 segundos                |
| Build de Docker        | 3-5 minutos                   |
| Aplicar migraciones    | 10-20 segundos                |
| Generar cliente Prisma | 5-10 segundos                 |
| Iniciar aplicación     | 10-20 segundos                |
| **TOTAL**              | **4-7 minutos desde el push** |

---

## 🎯 Próximo Paso AHORA

**1. Verifica el estado del deploy en Railway:**

```bash
railway logs --tail
```

**Busca estas líneas:**

```
Aplicando migraciones...
✓ Migration 20260115000000_add_user_onboarding_fields applied (10ms)
Generando cliente Prisma...
✓ Generated Prisma Client
Iniciando aplicación...
🚀 Server listening on port 3001
```

**2. Si ves errores, copia y pégalos aquí para diagnóstico.**

**3. Si NO ves actividad, el deploy no ha iniciado. Fuerza un redeploy:**

```bash
git commit --allow-empty -m "chore: force redeploy"
git push
```

---

**Última actualización:** 2026-01-15 14:30  
**Commits aplicados:** `0ff0d05`, `43ade6f`, `17f83a0`, `54a6cd8`  
**Estado:** ✅ Código corregido, esperando deploy de Railway
