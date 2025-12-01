# Script de Validación y Ejecución - Aethermind AgentOS

## 📋 Descripción

`validate-and-run.ts` es un script completo de validación y ejecución para Aethermind AgentOS que verifica todos los requisitos del sistema, ejecuta tests, inicia servicios y monitorea el estado de la aplicación en tiempo real.

## 🚀 Instalación de Dependencias

Antes de ejecutar el script por primera vez, instala las dependencias necesarias:

```bash
pnpm install
```

Las dependencias requeridas (`chalk`, `ora`, `execa`) ya están en `package.json`.

## 🎯 Uso

### Ejecución Completa

```bash
pnpm validate:all
```

O directamente:

```bash
tsx scripts/validate-and-run.ts
```

### Detener el Script

Presiona `Ctrl+C` para detener el monitoreo y los servicios de forma segura.

## 📊 Fases de Ejecución

### FASE 1: Análisis Pre-Ejecución ✅

Verifica:

- ✅ Node.js >= 20.0.0 instalado
- ✅ PNPM >= 9.0.0 instalado  
- ✅ Docker y Docker Compose funcionando
- ✅ Puertos libres: 3000, 3001, 5432, 6379
- ✅ Estructura del proyecto (archivos críticos)
- ✅ Variables de entorno (.env)
- ✅ Dependencias (node_modules)
- ✅ TypeScript (pnpm typecheck)
- ✅ Build (pnpm build)
- ✅ Base de datos (Docker Compose)
- ✅ Tests unitarios

**Duración estimada:** 2-5 minutos

### FASE 2: Ejecución Supervisada 🚀

Inicia servicios en orden:

1. Docker Compose (PostgreSQL + Redis)
2. Healthchecks (espera hasta que estén listos)
3. Migraciones Prisma (pnpm db:migrate)
4. API (pnpm dev:api)
5. Smoke tests (verifica endpoints)

**Duración estimada:** 1-2 minutos

### FASE 3: Monitoreo Activo 📊

Monitorea cada 5 segundos:

- Estado de la API (http://localhost:3001/health)
- Procesos activos
- Logs en tiempo real

**Duración:** Indefinida (hasta Ctrl+C)

## 📄 Reportes Generados

Al finalizar (o interrumpir con Ctrl+C), genera:

### Log JSON (`logs/validation-{timestamp}.log`)

Formato estructurado línea por línea:

```json
{"name":"node_version","status":"success","message":"Node.js 20.10.0","duration":150,"timestamp":"2025-11-29T10:30:00.000Z","phase":"pre-execution"}
{"name":"pnpm_version","status":"success","message":"PNPM 9.1.0","duration":120,"timestamp":"2025-11-29T10:30:01.000Z","phase":"pre-execution"}
...
```

### Reporte Markdown (`logs/validation-report-{timestamp}.md`)

Informe legible con:

- ✅ Checks exitosos
- ⚠️ Warnings
- ❌ Errores
- 📊 Métricas (duración, porcentaje éxito)
- 🔗 URLs disponibles
- 📝 Detalles técnicos por fase

## 🎨 Salida en Terminal

El script usa colores y spinners para mejor legibilidad:

```
🔍 FASE 1: ANÁLISIS PRE-EJECUCIÓN

✔ Node.js 20.10.0 ✅
✔ PNPM 9.1.0 ✅
✔ Docker corriendo ✅
⚠ Puertos en uso: Dashboard (3000)
✔ Todos los archivos críticos existen ✅
...

🚀 FASE 2: INICIANDO SERVICIOS

✔ Servicios Docker iniciados ✅
✔ Healthchecks pasaron ✅
⚠ Migraciones fallaron (puede ser normal si ya están aplicadas)
✔ API responde correctamente ✅

📊 FASE 3: MONITOREO ACTIVO

[10:30:15] ✅ API: healthy
[10:30:15] Servicios activos: 1/1
```

## 🔧 Configuración Avanzada

### Timeouts

Los timeouts están configurados para cada operación:

- Comandos simples: 5-10 segundos
- Instalación de dependencias: 180 segundos
- Build y tests: 180 segundos
- Docker healthchecks: 60 segundos (30 intentos × 2s)

### Puertos Alternativos

Si un puerto está ocupado, el script muestra un warning pero continúa. Los servicios pueden configurarse para usar puertos alternativos en `.env`.

### Logs Rotativos

Se mantienen solo los últimos 10 logs. Los más antiguos se eliminan automáticamente.

## 🚨 Manejo de Errores

### Errores Críticos

Detienen la ejecución inmediatamente:

- Node.js no instalado
- PNPM no instalado
- Docker no disponible
- Archivos críticos faltantes
- Error al instalar dependencias

**Exit code:** `1`

### Errores No Críticos

Muestran warnings pero continúan:

- Puertos ocupados
- Migraciones ya aplicadas
- Tests con errores
- Healthchecks timeout

**Exit code:** `0` (si no hay críticos)

### Warnings

No afectan la ejecución:

- Versiones menores desactualizadas
- .env no existe (usa .env.example)
- Redis sin persistencia

## 📝 Exit Codes

- `0`: Éxito (o solo warnings)
- `1`: Error crítico

Útil para integración con CI/CD:

```bash
pnpm validate:all && echo "Deploy OK" || echo "Deploy FAILED"
```

## 🔍 Troubleshooting

### "Cannot find module 'chalk'"

```bash
pnpm install
```

### "Docker no está corriendo"

```bash
# Windows/Mac
# Inicia Docker Desktop

# Linux
sudo systemctl start docker
```

### "Puerto 3001 en uso"

```bash
# Encuentra el proceso
lsof -i :3001

# Detén el proceso
kill -9 <PID>
```

### "Migraciones fallaron"

```bash
# Resetea la base de datos
pnpm docker:down
pnpm docker:up
pnpm db:migrate
```

## 🎯 Casos de Uso

### Desarrollo Local

```bash
# Primera vez
pnpm validate:all

# Ctrl+C cuando esté listo
# Servicios quedan corriendo
```

### CI/CD

```bash
# En GitHub Actions
- name: Validate Project
  run: pnpm validate:all
  timeout-minutes: 10
```

### Pre-commit Hook

```bash
# .husky/pre-commit
#!/bin/sh
pnpm typecheck && pnpm test
```

## 📚 Recursos

- **Log completo:** `logs/validation-{timestamp}.log`
- **Reporte:** `logs/validation-report-{timestamp}.md`
- **Documentación proyecto:** `README.md`
- **Scripts disponibles:** `package.json` (scripts)

## 🤝 Contribuir

Para mejorar el script:

1. Edita `scripts/validate-and-run.ts`
2. Prueba con `tsx scripts/validate-and-run.ts`
3. Verifica que genere reportes correctamente
4. Envía PR con descripción de cambios

## 📦 Dependencias

- `chalk@5.3.0` - Colores en terminal
- `ora@8.0.1` - Spinners de progreso
- `execa@8.0.1` - Ejecución de comandos

## 🎉 Resultado Esperado

Al finalizar exitosamente:

```
╔═══════════════════════════════════════════════════╗
║   AETHERMIND AGENTOS - VALIDACIÓN COMPLETA       ║
╚═══════════════════════════════════════════════════╝

🔍 FASE 1: ANÁLISIS PRE-EJECUCIÓN
[checks...]

✅ Pre-validación completada exitosamente

🚀 FASE 2: INICIANDO SERVICIOS
[servicios...]

✅ Servicios iniciados correctamente

📊 FASE 3: MONITOREO ACTIVO
[monitoreo...]

📄 Reportes generados:
   - logs/validation-2025-11-29-103000.log
   - logs/validation-report-2025-11-29-103000.md

✅ Validación completada exitosamente
```

---

**Versión:** 1.0.0  
**Autor:** Aethermind Team  
**Última actualización:** 2025-11-29
