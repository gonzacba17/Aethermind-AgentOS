# Testing del Script validate-and-run.ts

Este documento describe cómo probar el script de validación paso a paso.

## ✅ Pre-requisitos

Antes de ejecutar el script, asegúrate de tener:

```bash
# 1. Node.js >= 20.0.0
node --version  # Debería mostrar v20.x.x o superior

# 2. PNPM >= 9.0.0
pnpm --version  # Debería mostrar 9.x.x o superior

# 3. Docker Desktop corriendo
docker info  # Debería mostrar información del daemon

# 4. Instalar dependencias del script
cd /path/to/Aethermind\ Agent\ os
pnpm install
```

## 🧪 Test 1: Verificación de Sintaxis

```bash
# Verificar que el script no tiene errores de TypeScript
npx tsc --noEmit scripts/validate-and-run.ts

# Salida esperada: Sin errores (puede tener warnings de módulos no encontrados si las deps no están instaladas)
```

## 🧪 Test 2: Dry Run (Solo Pre-checks)

Para probar solo la fase 1 sin iniciar servicios, puedes modificar temporalmente el script o ejecutar checks individuales:

```bash
# Verificar Node
node --version

# Verificar PNPM
pnpm --version

# Verificar Docker
docker info

# Verificar estructura del proyecto
ls -la package.json docker-compose.yml prisma/schema.prisma
```

## 🧪 Test 3: Ejecución Completa (Recomendado)

```bash
# Limpiar servicios previos (opcional)
docker compose down
pnpm clean

# Ejecutar el script completo
pnpm validate:all
```

### Salida Esperada

```
╔═══════════════════════════════════════════════════╗
║   AETHERMIND AGENTOS - VALIDACIÓN COMPLETA       ║
╚═══════════════════════════════════════════════════╝

🔍 FASE 1: ANÁLISIS PRE-EJECUCIÓN

✔ Node.js 20.10.0 ✅
✔ PNPM 9.1.0 ✅
✔ Docker corriendo ✅
✔ Todos los puertos disponibles ✅
✔ Estructura del proyecto correcta ✅
✔ Archivo .env existe ✅
✔ Dependencias instaladas ✅
✔ TypeCheck pasó ✅
✔ Build exitoso ✅
✔ Docker Compose configurado ✅
✔ Tests pasaron (125 tests) ✅

✅ Pre-validación completada exitosamente

🚀 FASE 2: INICIANDO SERVICIOS

✔ Servicios Docker iniciados ✅
✔ Healthchecks pasaron ✅
✔ Migraciones aplicadas ✅
✔ API responde correctamente ✅

✅ Servicios iniciados correctamente

📊 FASE 3: MONITOREO ACTIVO

Presiona Ctrl+C para detener

[14:30:15] ✅ API: healthy
[14:30:15] Servicios activos: 1/1
[14:30:20] ✅ API: healthy
[14:30:20] Servicios activos: 1/1
...

^C
⚠️  Recibido SIGINT, cerrando servicios...
Deteniendo API...

📄 Reportes generados:
   - logs/validation-2025-11-29-143015.log
   - logs/validation-report-2025-11-29-143015.md

✅ Validación completada exitosamente
```

## 🧪 Test 4: Verificar Reportes

```bash
# Listar reportes generados
ls -la logs/

# Ver reporte Markdown
cat logs/validation-report-*.md | head -50

# Ver log JSON (primeras 5 líneas)
head -5 logs/validation-*.log

# Verificar que tiene formato JSON válido
cat logs/validation-*.log | jq . | head -20
```

## 🧪 Test 5: Prueba de Errores Controlados

### Simular Error: Node.js no disponible

```bash
# Temporalmente renombrar node (NO HACER EN PRODUCCIÓN)
# Solo para test, revertir inmediatamente

# En su lugar, verificar el mensaje de error en el código
grep -A5 "Node.js no encontrado" scripts/validate-and-run.ts
```

### Simular Error: Puerto ocupado

```bash
# En terminal 1: Ocupar puerto 3001
nc -l 3001

# En terminal 2: Ejecutar script
pnpm validate:all

# Debería mostrar: ⚠ Puertos en uso: API (3001)
```

### Simular Error: Docker detenido

```bash
# Detener Docker Desktop

# Ejecutar script
pnpm validate:all

# Debería mostrar: ❌ Docker no está corriendo
# Y salir con exit code 1
```

## 🧪 Test 6: Verificar Exit Codes

```bash
# Test con éxito (exit code 0)
pnpm validate:all && echo "EXIT CODE: $?" || echo "EXIT CODE: $?"

# Test con error crítico simulado
# (modificar temporalmente código para forzar error crítico)
```

## 🧪 Test 7: Integración CI/CD (Simulado)

```bash
# Simular ambiente CI
export CI=true
export DATABASE_URL=postgresql://test:test@localhost:5432/test
export REDIS_URL=redis://localhost:6379

# Ejecutar
pnpm validate:all

# Verificar que se genera reporte
ls -la logs/
```

## 🧪 Test 8: Prueba de Graceful Shutdown

```bash
# Iniciar script
pnpm validate:all

# Esperar a que llegue a FASE 3 (monitoreo)
# Presionar Ctrl+C

# Verificar que:
# 1. Muestra mensaje: "⚠️  Recibido SIGINT, cerrando servicios..."
# 2. Detiene procesos: "Deteniendo API..."
# 3. Genera reportes: "📄 Reportes generados..."
# 4. Sale limpiamente sin errores
```

## 🧪 Test 9: Limpieza de Logs Antiguos

```bash
# Generar más de 10 logs
for i in {1..12}; do
  touch logs/validation-2025-11-0$i-100000.log
done

# Ejecutar script
pnpm validate:all

# Verificar que solo quedan 10 logs
ls -la logs/*.log | wc -l  # Debería ser <= 10
```

## 🧪 Test 10: Performance Benchmark

```bash
# Medir tiempo de ejecución
time pnpm validate:all

# Tiempo esperado:
# - Fase 1 (pre-checks): 2-5 minutos
# - Fase 2 (inicio): 1-2 minutos
# - Fase 3: Hasta que se detenga
# Total (sin fase 3): < 10 minutos
```

## 📊 Checklist de Validación

- [ ] Script se ejecuta sin errores de sintaxis
- [ ] Fase 1 completa todos los checks
- [ ] Fase 2 inicia servicios correctamente
- [ ] Fase 3 monitorea en tiempo real
- [ ] Ctrl+C cierra servicios gracefully
- [ ] Se generan logs JSON válidos
- [ ] Se genera reporte Markdown legible
- [ ] Exit code correcto (0 éxito, 1 error)
- [ ] Logs antiguos se eliminan (mantiene 10)
- [ ] Colores y spinners funcionan en terminal

## 🐛 Troubleshooting

### Error: "Cannot find module 'chalk'"

```bash
pnpm install
```

### Error: "ELIFECYCLE Command failed"

```bash
# Limpiar caché
pnpm store prune

# Reinstalar
rm -rf node_modules
pnpm install
```

### Script se queda colgado

```bash
# Verificar procesos zombies
ps aux | grep node

# Matar procesos
pkill -f "pnpm dev:api"

# Limpiar Docker
docker compose down
```

### Logs no se generan

```bash
# Verificar permisos del directorio logs/
ls -la logs/

# Crear manualmente si no existe
mkdir -p logs
chmod 755 logs
```

## ✅ Criterios de Aceptación

El script pasa la validación si:

1. ✅ Se ejecuta sin errores fatales en JavaScript/TypeScript
2. ✅ Todos los checks de Fase 1 completan (pueden tener warnings)
3. ✅ Servicios de Fase 2 inician correctamente
4. ✅ Monitoreo de Fase 3 muestra estado cada 5 segundos
5. ✅ Ctrl+C cierra servicios sin errores
6. ✅ Genera ambos reportes (JSON + Markdown)
7. ✅ Exit code es 0 si no hay errores críticos
8. ✅ Logs tienen formato JSON válido
9. ✅ Reporte Markdown es legible y completo
10. ✅ Tiempo total < 10 minutos (sin fase 3)

## 📝 Notas de Testing

- **Ambiente recomendado:** Ubuntu/Mac con Docker Desktop
- **RAM recomendada:** >= 8GB
- **Espacio en disco:** >= 2GB libres
- **Conexión:** Internet estable (para descargar imágenes Docker)
- **Terminal:** Soporte para colores ANSI (bash, zsh, fish)

---

**Última actualización:** 2025-11-29  
**Versión del script:** 1.0.0
