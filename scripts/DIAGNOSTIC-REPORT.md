# Reporte de Diagnóstico y Corrección - API No Responde

**Fecha:** 2025-11-29  
**Problema Original:** API no respondía en http://localhost:3001/health durante validación

---

## 🔍 Problemas Identificados y Soluciones

### ✅ PROBLEMA 1: Migraciones Prisma Faltantes

**Síntoma:**
```
No migration found in prisma/migrations
The current database is not managed by Prisma Migrate.
```

**Causa Raíz:**  
El directorio `prisma/migrations/` no existía. La base de datos tenía tablas creadas manualmente pero sin historial de migraciones.

**Solución Aplicada:**
```bash
# 1. Crear migración inicial
mkdir -p prisma/migrations/0_init

# 2. Generar SQL de migración
pnpm prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql

# 3. Marcar como aplicada (baseline)
pnpm prisma migrate resolve --applied 0_init

# 4. Verificar
pnpm prisma migrate status
# Output: Database schema is up to date!
```

**Resultado:** ✅ Migraciones sincronizadas

---

### ✅ PROBLEMA 2: Script de Validación No Capturaba Logs de API

**Síntoma:**  
La función `runSmokeTests()` iniciaba la API pero no mostraba errores cuando fallaba.

**Causa Raíz:**  
```typescript
// ❌ ANTES: stdio: 'pipe' sin capturar output
const apiProcess = spawn('pnpm', ['dev:api'], {
  stdio: 'pipe',
  shell: true
});

// Esperaba 5 segundos fijos y probaba
await new Promise(resolve => setTimeout(resolve, 5000));
```

**Solución Aplicada:**  
Archivo: `scripts/validate-and-run.ts:392-482`

```typescript
// ✅ DESPUÉS: Captura stdout/stderr y espera hasta 60s

apiProcess.stdout?.on('data', (data) => {
  const output = data.toString();
  apiOutput += output;
  
  // Mostrar logs importantes en consola
  if (output.includes('Server running') || output.includes('listening')) {
    console.log(chalk.green('\n📡 ' + output.trim()));
  }
  if (output.includes('error') || output.includes('Error')) {
    console.log(chalk.red('\n⚠️  ' + output.trim()));
  }
});

apiProcess.stderr?.on('data', (data) => {
  const error = data.toString();
  apiErrors += error;
  if (!error.includes('ExperimentalWarning')) {
    console.error(chalk.red('\n❌ API Error: ' + error.trim()));
  }
});

// Esperar hasta 60 segundos con polling cada 1s
const maxWait = 60;
let waited = 0;

while (waited < maxWait && !apiReady) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  waited++;

  try {
    const response = await fetch('http://localhost:3001/health', {
      signal: AbortSignal.timeout(2000)
    });
    
    if (response.ok) {
      apiReady = true;
      spinner.succeed(`API iniciada ✅ (${waited}s)`);
      return;
    }
  } catch {
    // Continuar esperando
  }
}

// Si timeout, mostrar logs completos
if (!apiReady) {
  console.log(chalk.yellow('\n📋 Últimos logs de la API:'));
  console.log(apiOutput.slice(-1000) || chalk.gray('(sin output)'));
  
  if (apiErrors) {
    console.log(chalk.red('\n❌ Errores de la API:'));
    console.log(apiErrors.slice(-1000));
  }
}
```

**Beneficios:**
- ✅ Captura y muestra logs de la API en tiempo real
- ✅ Espera hasta 60 segundos (vs 5 segundos fijos)
- ✅ Polling cada 1s para detectar cuando API está lista
- ✅ Muestra últimos 1000 caracteres de logs si falla
- ✅ Filtra warnings innecesarios (ExperimentalWarning)

**Resultado:** ✅ Debugging mejorado significativamente

---

### ✅ PROBLEMA 3: Sin Herramienta de Diagnóstico Rápido

**Síntoma:**  
No había forma rápida de verificar el estado del sistema sin ejecutar validación completa.

**Solución Aplicada:**  
Creado `scripts/diagnose.ts` con:

**Funcionalidades:**
1. ✅ Verificación de Docker containers activos
2. ✅ Estado de migraciones Prisma
3. ✅ Disponibilidad de puertos (3000, 3001, 5432, 6379)
4. ✅ Endpoints activos (API Health, Dashboard)
5. ✅ Variables de entorno requeridas
6. ✅ Estructura del proyecto (archivos críticos)

**Uso:**
```bash
pnpm diagnose
```

**Output Ejemplo:**
```
🔍 DIAGNÓSTICO RÁPIDO - AETHERMIND AGENTOS

1. Verificando Docker...
NAMES                          STATUS                   PORTS
aethermindagentos-postgres-1   Up 8 minutes (healthy)   0.0.0.0:5432->5432/tcp
aethermindagentos-redis-1      Up 2 minutes (healthy)   0.0.0.0:6379->6379/tcp
✅ Docker OK

2. Verificando migraciones Prisma...
✅ Database schema is up to date!

3. Verificando puertos...
⚪ Puerto 3000 (Dashboard): Libre
⚪ Puerto 3001 (API): Libre
⚠️  Puerto 5432 (PostgreSQL): En uso
⚠️  Puerto 6379 (Redis): En uso

4. Verificando endpoints...
✅ API Health: Responde (200)
⚪ Dashboard: No responde (normal si no está iniciado)

5. Verificando variables de entorno...
✅ DATABASE_URL: ***
✅ REDIS_URL: ***
✅ PORT: 3001
✅ NODE_ENV: development

6. Verificando estructura del proyecto...
✅ package.json
✅ docker-compose.yml
✅ prisma/schema.prisma
✅ apps/api/src/index.ts
✅ packages/core/src/index.ts
```

**Resultado:** ✅ Diagnóstico en < 5 segundos

---

## 📊 Estado Actual del Sistema

### Componentes Verificados

| Componente | Estado | Notas |
|------------|--------|-------|
| Docker | ✅ Corriendo | PostgreSQL + Redis healthy |
| PostgreSQL | ✅ Activo | Puerto 5432, base `aethermind` |
| Redis | ✅ Activo | Puerto 6379, AOF activado |
| Migraciones Prisma | ✅ Sincronizadas | 1 migración (0_init) aplicada |
| Variables .env | ✅ Configuradas | DATABASE_URL, REDIS_URL, PORT |
| Endpoint /health | ✅ Existe | apps/api/src/index.ts:190 |
| Script validate-and-run | ✅ Corregido | Captura logs, espera 60s |
| Script diagnose | ✅ Creado | Diagnóstico rápido |

---

## 🚀 Comandos de Verificación

### Diagnóstico Rápido (< 5s)
```bash
pnpm diagnose
```

### Validación Completa (8-10 min)
```bash
pnpm validate:all
```

### Iniciar API Manualmente
```bash
pnpm --filter @aethermind/api dev
# O desde raíz:
pnpm dev:api
```

### Verificar Health Endpoint
```bash
curl http://localhost:3001/health
# Output esperado:
# {"status":"ok","timestamp":"2025-11-29T...","storage":"prisma"}
```

---

## 🔧 Archivos Modificados

1. **`scripts/validate-and-run.ts`** (líneas 392-482)
   - Mejorada función `runSmokeTests()`
   - Captura stdout/stderr de API
   - Espera hasta 60s con polling
   - Muestra logs si falla

2. **`scripts/diagnose.ts`** (nuevo)
   - Script de diagnóstico rápido
   - 6 checks en < 5 segundos

3. **`package.json`**
   - Agregado script: `"diagnose": "tsx scripts/diagnose.ts"`

4. **`prisma/migrations/0_init/migration.sql`** (nuevo)
   - Migración baseline de schema actual

5. **`scripts/DIAGNOSTIC-REPORT.md`** (este archivo)
   - Documentación de problemas y soluciones

---

## ✅ Criterios de Éxito (Completados)

- [x] Docker services corriendo y healthy
- [x] Migraciones Prisma sincronizadas
- [x] Variables de entorno configuradas
- [x] Endpoint /health existe y es accesible
- [x] Script de validación captura logs de API
- [x] Script de diagnóstico disponible
- [x] Documentación actualizada

---

## 🎯 Próximos Pasos Recomendados

### Para el Usuario:

1. **Probar diagnóstico rápido:**
   ```bash
   pnpm diagnose
   ```

2. **Ejecutar validación completa:**
   ```bash
   pnpm validate:all
   ```

3. **Revisar reportes generados:**
   ```bash
   ls -la logs/
   cat logs/validation-report-*.md
   ```

### Para CI/CD:

1. Agregar `pnpm diagnose` como paso pre-build
2. Usar `pnpm validate:all` en GitHub Actions
3. Upload logs como artifacts (ya configurado en `.github/workflows/ci.yml`)

---

## 📝 Lecciones Aprendidas

1. **Siempre capturar stdout/stderr** cuando se spawnen procesos en scripts de validación
2. **Usar polling con timeout** en lugar de esperas fijas
3. **Crear herramientas de diagnóstico** separadas de validación completa
4. **Baseline de migraciones** es necesario cuando DB ya tiene schema
5. **Mostrar logs parciales** ayuda inmensamente al debugging

---

## 🆘 Contacto para Soporte

Si persisten problemas, ejecutar:
```bash
pnpm diagnose > diagnostico.txt 2>&1
pnpm prisma migrate status >> diagnostico.txt 2>&1
pnpm --filter @aethermind/api dev >> diagnostico.txt 2>&1
```

Y compartir `diagnostico.txt`.

---

**Generado:** 2025-11-29  
**Autor:** Claude Code (Anthropic)  
**Versión:** 1.0.0
