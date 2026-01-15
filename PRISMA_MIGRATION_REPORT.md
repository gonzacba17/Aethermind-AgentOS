# 🔍 Informe de Auditoría: Desajuste del Esquema de Prisma

**Fecha:** 2026-01-15  
**Severidad:** 🔴 **CRÍTICO (P0)**  
**Impacto:** Backend de producción fallando en Railway

---

## 📋 Resumen Ejecutivo

La base de datos de producción en Railway está **desactualizada** respecto al esquema de Prisma en el código. Faltan **11 columnas** en la tabla `users` que el código espera encontrar, causando errores críticos en:

- ✅ Endpoint `/auth/me`
- ✅ Proceso de OAuth (Google/GitHub)
- ✅ Activación del plan Free
- ✅ Sistema de onboarding

---

## 🐛 Problema Identificado

### Errores Reportados:

```
prisma:error Invalid `prisma.user.findUnique()` invocation:
The column `users.verification_expiry` does not exist in the current database.

prisma:error Invalid `prisma.user.findUnique()` invocation:
The column `users.has_completed_onboarding` does not exist in the current database.
```

### Causa Raíz:

El esquema `prisma/schema.prisma` (líneas 29-85) define el modelo `User` con campos que **NUNCA** fueron migrados a la base de datos de producción:

#### **Campos Faltantes:**

| Campo                      | Tipo        | Uso en Código                 | Archivos Afectados                                                   |
| -------------------------- | ----------- | ----------------------------- | -------------------------------------------------------------------- |
| `verification_expiry`      | `DateTime?` | Validación de tokens de email | `routes/auth.ts` (4 usos)                                            |
| `has_completed_onboarding` | `Boolean`   | Tracking de onboarding        | `routes/auth.ts`, `routes/onboarding.ts`, `services/OAuthService.ts` |
| `onboarding_step`          | `String?`   | Paso actual del onboarding    | Schema definido                                                      |
| `trial_started_at`         | `DateTime?` | Inicio del trial              | Schema definido                                                      |
| `trial_ends_at`            | `DateTime?` | Fin del trial                 | Schema definido                                                      |
| `subscription_status`      | `String`    | Estado de la suscripción      | Schema definido                                                      |
| `last_login_at`            | `DateTime?` | Último login                  | Schema definido                                                      |
| `first_login_at`           | `DateTime?` | Primer login                  | Schema definido                                                      |
| `max_agents`               | `Int`       | Límite de agentes tier free   | Schema definido                                                      |
| `log_retention_days`       | `Int`       | Retención de logs tier free   | Schema definido                                                      |
| `name`                     | `String?`   | Nombre del usuario OAuth      | Schema definido                                                      |

---

## 📂 Estado Actual de Migraciones

### Migraciones Existentes:

```
prisma/migrations/
├── 20251130000603_initial_schema_with_users/
│   └── migration.sql                          ← Migración inicial (solo campos básicos)
├── manual_add_budgets_and_alerts.sql          ← Tablas Budget y AlertLog
├── manual_add_multi_tenant.sql                ← Tabla Organizations
└── migration_lock.toml
```

### **Problema:**

La migración inicial `20251130000603_initial_schema_with_users` solo crea estos campos en `users`:

```sql
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,  -- ❌ NO es nullable
    "api_key" VARCHAR(255) NOT NULL,
    "plan" VARCHAR(50) NOT NULL DEFAULT 'free',
    -- ... otros campos básicos
    -- ❌ FALTAN los 11 campos nuevos
);
```

---

## ✅ Solución Implementada

### 1️⃣ **Migración Creada:** `20260115000000_add_user_onboarding_fields`

Archivo: `prisma/migrations/20260115000000_add_user_onboarding_fields/migration.sql`

**Acciones:**

- ✅ Agrega `verification_expiry` (DateTime nullable)
- ✅ Agrega `has_completed_onboarding` (Boolean, default: false)
- ✅ Agrega `onboarding_step` (String, default: 'welcome')
- ✅ Agrega `trial_started_at` y `trial_ends_at`
- ✅ Agrega `subscription_status` (String, default: 'free')
- ✅ Agrega `last_login_at` y `first_login_at`
- ✅ Agrega `max_agents` (Int, default: 3)
- ✅ Agrega `log_retention_days` (Int, default: 30)
- ✅ Agrega `name`, `google_id`, `github_id` (para OAuth)
- ✅ Hace `password_hash` nullable (para usuarios OAuth)
- ✅ Crea tabla `subscription_logs` si no existe
- ✅ Crea índices únicos para `google_id` y `github_id`

**Características:**

- 🛡️ Usa `ADD COLUMN IF NOT EXISTS` → Seguro para ejecutar múltiples veces
- 🛡️ Usa `ALTER COLUMN ... DROP NOT NULL` solo si es necesario
- 🛡️ No afecta datos existentes (valores por defecto aplicados)

### 2️⃣ **Scripts de Deploy Creados:**

#### Para Railway (Linux):

```bash
scripts/railway-migrate.sh
```

**Uso en Railway:**

```bash
chmod +x scripts/railway-migrate.sh
./scripts/railway-migrate.sh
```

#### Para desarrollo local (Windows):

```powershell
scripts/railway-migrate.ps1
```

---

## 🚀 Plan de Aplicación en Producción

### **Opción A: Aplicar Migración Manualmente en Railway (RECOMENDADO)**

1. **Conectar a Railway CLI:**

   ```bash
   railway login
   railway link
   ```

2. **Ejecutar migración directamente en la base de datos:**

   ```bash
   railway run psql $DATABASE_URL < prisma/migrations/20260115000000_add_user_onboarding_fields/migration.sql
   ```

3. **Verificar que se aplicó:**

   ```bash
   railway run npx prisma migrate status
   ```

4. **Hacer redeploy del backend:**
   ```bash
   git push
   ```

---

### **Opción B: Actualizar Dockerfile para Railway (AUTOMÁTICO)**

Modificar `Dockerfile.railway` para ejecutar migraciones antes del build:

```dockerfile
# Antes de RUN pnpm turbo run build...
RUN npx prisma migrate deploy --schema=./prisma/schema.prisma
RUN npx prisma generate --schema=./prisma/schema.prisma
```

Luego hacer commit y push:

```bash
git add Dockerfile.railway
git commit -m "fix: add prisma migrate deploy to Railway build"
git push
```

---

### **Opción C: Script de Migración Separado (MÁS CONTROL)**

1. **Crear script de migración:**

   ```bash
   chmod +x scripts/railway-migrate.sh
   ```

2. **Ejecutar en Railway antes del deploy:**

   ```bash
   railway run ./scripts/railway-migrate.sh
   ```

3. **Luego hacer deploy:**
   ```bash
   railway up
   ```

---

## 🔍 Verificación Post-Migración

### 1. **Verificar columnas creadas:**

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN (
    'verification_expiry',
    'has_completed_onboarding',
    'onboarding_step',
    'subscription_status',
    'trial_started_at',
    'trial_ends_at',
    'last_login_at',
    'first_login_at',
    'max_agents',
    'log_retention_days',
    'name'
)
ORDER BY column_name;
```

### 2. **Probar OAuth login:**

```bash
curl https://aethermindapi-production.up.railway.app/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. **Verificar registro de nuevos usuarios:**

```bash
curl https://aethermindapi-production.up.railway.app/api/auth/signup \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}'
```

---

## 📝 Archivos Modificados/Creados

| Archivo                                                                     | Tipo      | Descripción                                        |
| --------------------------------------------------------------------------- | --------- | -------------------------------------------------- |
| `prisma/migrations/20260115000000_add_user_onboarding_fields/migration.sql` | **NUEVO** | ✅ Migración SQL con todos los campos faltantes    |
| `scripts/railway-migrate.sh`                                                | **NUEVO** | ✅ Script bash para aplicar migraciones en Railway |
| `scripts/railway-migrate.ps1`                                               | **NUEVO** | ✅ Script PowerShell para desarrollo local         |
| `PRISMA_MIGRATION_REPORT.md`                                                | **NUEVO** | ✅ Este informe                                    |

---

## ⚠️ Riesgos y Mitigación

| Riesgo                            | Probabilidad | Impacto | Mitigación                                        |
| --------------------------------- | ------------ | ------- | ------------------------------------------------- |
| Migración falla por sintaxis SQL  | Baja         | Alto    | ✅ Script usa `IF NOT EXISTS`                     |
| Datos existentes se corrompen     | Muy Baja     | Crítico | ✅ Solo agrega columnas, no modifica datos        |
| Downtime durante migración        | Baja         | Medio   | ✅ Railway hace rolling deploy                    |
| Conflicto con migraciones futuras | Media        | Bajo    | ✅ Usar timestamp correcto en nombre de migración |

---

## 🎯 Próximos Pasos (Orden Recomendado)

### **AHORA (Urgente - P0):**

1. ✅ Revisar este informe
2. ⬜ Decidir Opción A, B o C
3. ⬜ Aplicar migración en Railway
4. ⬜ Verificar que el backend vuelve a funcionar
5. ⬜ Probar OAuth login con Google
6. ⬜ Hacer commit de los archivos de migración

### **HOY (Importante - P1):**

7. ⬜ Documentar en README cómo aplicar migraciones
8. ⬜ Crear workflow de GitHub Actions para migraciones automáticas
9. ⬜ Agregar tests de integración para verificar esquema de BD

### **ESTA SEMANA (Deseable - P2):**

10. ⬜ Implementar sistema de migraciones automáticas en Railway
11. ⬜ Crear script de rollback de migraciones
12. ⬜ Configurar alertas para errores de Prisma en producción

---

## 📞 Soporte

Si encuentras algún problema durante la aplicación:

1. **Revisar logs de Railway:**

   ```bash
   railway logs
   ```

2. **Verificar estado de Prisma:**

   ```bash
   railway run npx prisma migrate status
   ```

3. **Regenerar cliente de Prisma:**
   ```bash
   railway run npx prisma generate
   ```

---

## 📚 Referencias

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Railway Deployment Guides](https://docs.railway.app/deploy/deployments)
- Versión de Prisma en uso: **6.19.1**
- Schema de Prisma: `prisma/schema.prisma` (líneas 29-85)

---

**Documento generado el:** 2026-01-15  
**Preparado por:** Antigravity AI  
**Estado:** ✅ LISTO PARA APLICAR
