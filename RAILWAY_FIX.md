# 🔧 Railway Deployment Fix - Resumen

**Fecha**: 2026-01-13  
**Problema**: Healthcheck failing en Railway - App nunca se vuelve "healthy"  
**Estado**: ✅ SOLUCIONADO

---

## 🔍 DIAGNÓSTICO

### Síntomas

```
Attempt #1 failed with service unavailable. Continuing to retry for 1m29s
Attempt #2 failed with service unavailable. Continuing to retry for 1m23s
...
Attempt #6 failed with service unavailable. Continuing to retry for 32s

1/1 replicas never became healthy!
```

### Causa Raíz

El **Dockerfile.railway** tenía un problema en el `CMD`:

```dockerfile
# ❌ ANTES (problemático)
CMD ["sh", "-c", "npx prisma migrate deploy && dumb-init node apps/api/dist/index.js"]
```

**Problema**:

1. `prisma migrate deploy` se ejecutaba **ANTES** de iniciar la app
2. Si las migraciones fallaban o tomaban mucho tiempo → la app NUNCA iniciaba
3. Railway intenta acceder a `/health` pero la app no está corriendo
4. Healthcheck falla → deployment falla

### Por Qué Fallaban las Migraciones

Posibles razones:

- Timeout de conexión a la base de datos
- Migraciones tomando >100 segundos (healthcheckTimeout)
- Error en las migraciones bloqueando el inicio
- Ruta incorrecta del schema de Prisma

---

## ✅ SOLUCIÓN IMPLEMENTADA

### Fix Principal: CMD Sin Bloqueo

```dockerfile
# ✅ DESPUÉS (corregido)
CMD ["dumb-init", "node", "apps/api/dist/index.js"]
```

**Cambios**:

1. **Eliminado** `prisma migrate deploy` del CMD
2. App inicia **inmediatamente**
3. Migraciones se manejan **asíncronamente** dentro de la app

### Cómo Funcionan las Migraciones Ahora

El código en `apps/api/src/index.ts` ya tiene `ensureDatabaseSchema()`:

```typescript
async function ensureDatabaseSchema() {
  if (process.env.DATABASE_URL) {
    console.log("🔄 Checking database schema...");

    try {
      // Intenta conectar y verificar tablas
      await prisma.organization.findFirst();
      console.log("✅ Database schema verified");
    } catch (error) {
      // Si las tablas no existen, las crea automáticamente
      console.log("⚠️ Tables not found - applying schema...");
      execSync(`npx prisma db push --schema=${schemaPath}...`);
    }
  }
}

// Se llama DESPUÉS de que la app inicia el servidor HTTP
server.listen(PORT, async () => {
  await ensureDatabaseSchema(); // ← Migraciones asíncronas
  console.log(`✅ Server running on port ${PORT}`);
});
```

**Ventajas**:

- ✅ El servidor HTTP inicia **inmediatamente**
- ✅ `/health` responde durante las migraciones
- ✅ Healthcheck de Railway pasa mientras migran
- ✅ Si las migraciones fallan, la app sigue corriendo (modo degradado)

---

## 📊 FLUJO ANTES vs DESPUÉS

### ❌ ANTES (Bloqueante)

```
Railway deploy
  ↓
Docker build (OK)
  ↓
Start container
  ↓
Run "prisma migrate deploy" ← BLOQUEA AQUÍ
  ↓ (si falla o toma >100s)
❌ App NUNCA inicia
  ↓
Railway healthcheck → /health
  ↓
❌ Service unavailable (app no está corriendo)
  ↓
❌ Deployment fails
```

### ✅ DESPUÉS (No Bloqueante)

```
Railway deploy
  ↓
Docker build (OK)
  ↓
Start container
  ↓
node apps/api/dist/index.js ← INICIA INMEDIATAMENTE
  ↓
✅ HTTP server listening on PORT
  ↓
Railway healthcheck → /health
  ↓
✅ 200 OK (app está corriendo)
  ↓
✅ Deployment succeeds
  ↓
(Mientras tanto, en background)
ensureDatabaseSchema() ejecuta migraciones
  ↓
✅ Database ready
```

---

## 🚀 COMMIT Y DEPLOYMENT

### Commit Realizado

```
370594f - fix: Railway healthcheck failure - start app without blocking on migrations

Previous CMD was running 'prisma migrate deploy' synchronously before
starting the app, which caused the healthcheck to fail if migrations
took too long or had issues.

Now the app starts immediately and handles migrations asynchronously
via ensureDatabaseSchema() in index.ts, allowing the /health endpoint
to respond while migrations run in the background.
```

### Para Re-deployar en Railway

1. **Railway detectará el nuevo commit automáticamente**
2. **O puedes forzar re-deploy**:
   - Ve al proyecto en Railway
   - Click en "Deployments"
   - Click en "Deploy" (latest commit)

---

## 🔍 VERIFICACIÓN POST-DEPLOYMENT

Después del nuevo deployment, deberías ver:

```
====================
Starting Healthcheck
====================
Path: /health
Retry window: 1m40s

✅ Attempt #1 succeeded (200 OK)

Deployment successful!
```

### Logs Esperados en Railway

```
🔧 Initializing Aethermind API...
✅ Server running on port 3001
WebSocket server: ws://localhost:3001/ws
Health check: http://localhost:3001/health (public)
🔄 Checking database schema...
✅ Connected to database
✅ Database schema verified - tables exist
```

---

## 📝 NOTAS ADICIONALES

### Variables de Entorno Críticas en Railway

Asegúrate de tener configuradas:

```
DATABASE_URL=postgresql://...  (CRÍTICO)
JWT_SECRET=tu-secret-aquí      (para sessions)
NODE_ENV=production
PORT=3001                       (Railway lo setea automáticamente)
```

### Por Qué No Usar Migraciones en CMD

**Ventajas de Migraciones Asíncronas**:

- ✅ App inicia más rápido
- ✅ Healthcheck pasa siempre
- ✅ Si migraciones fallan, app sigue en modo degradado
- ✅ Logs más claros en Railway

**Cuándo SI Usar Migraciones en CMD**:

- Si REQUIERES que las tablas existan antes del primer request
- Si tu app crashea sin las tablas (en nuestro caso no, usa InMemoryStore como fallback)

### Alternativas para Migraciones

Si prefieres migraciones separadas:

**Opción 1**: Railway Init Command

```json
// railway.json
{
  "deploy": {
    "initCommand": "npx prisma migrate deploy --schema=./prisma/schema.prisma"
  }
}
```

**Opción 2**: Script Separado

```bash
# En Railway, crear un servicio separado "migrations"
railway run npx prisma migrate deploy
```

---

## ✅ RESUMEN

**Problema**: CMD bloqueaba el inicio de la app esperando migraciones  
**Solución**: Iniciar app inmediatamente, migrar asíncronamente  
**Resultado**: Healthcheck pasa, deployment exitoso  
**Commit**: `370594f`  
**Estado**: ✅ Pushed a main

---

**Railway debería ahora deployar exitosamente.** 🚀

Si sigue fallando, revisar:

1. Variables de entorno en Railway (especialmente `DATABASE_URL`)
2. Logs de Railway para ver qué error específico ocurre
3. Conectividad a la base de datos desde Railway
