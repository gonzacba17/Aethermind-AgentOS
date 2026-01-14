# Guía de Verificación Local - Pre-Despliegue

Esta guía te ayudará a verificar que todo funciona correctamente **antes** de desplegar a Railway y Vercel.

## 📋 Pre-requisitos

Asegúrate de tener instalado:

- ✅ Docker Desktop (para Windows)
- ✅ Node.js 18+
- ✅ pnpm 9+

## 🔧 Paso 1: Preparar el Entorno

### 1.1 Instalar Dependencias

```powershell
# En la raíz del proyecto
pnpm install

# Generar Prisma Client
pnpm prisma generate
```

**Resultado esperado:**

```
✓ Dependencies installed
✓ Prisma Client generated
```

### 1.2 Verificar que Docker está corriendo

```powershell
docker --version
docker ps
```

**Resultado esperado:**

```
Docker version 24.x.x
CONTAINER ID   IMAGE   ...
```

---

## 🐳 Paso 2: Verificar Build de Docker (Railway)

### 2.1 Build de la Imagen

```powershell
pnpm docker:build
```

**Qué hace:** Construye la imagen Docker usando `Dockerfile.railway`

**Tiempo estimado:** 3-5 minutos (primera vez), 1-2 minutos (subsecuentes)

**Resultado esperado:**

```
[+] Building 180.5s (25/25) FINISHED
 => [internal] load build definition from Dockerfile.railway
 => => transferring dockerfile: 2.50kB
 => [internal] load .dockerignore
 ...
 => => naming to docker.io/library/aethermind-api:test
✅ Docker build successful
```

### 2.2 Verificar la Imagen Creada

```powershell
docker images | Select-String "aethermind-api"
```

**Resultado esperado:**

```
aethermind-api   test   abc123def456   2 minutes ago   500MB
```

### 2.3 Probar la Imagen (Opcional)

**IMPORTANTE:** Primero asegúrate de tener PostgreSQL y Redis corriendo:

```powershell
# Iniciar servicios con docker-compose
pnpm docker:up

# Esperar 10 segundos para que los servicios inicien
Start-Sleep -Seconds 10

# Probar la imagen
pnpm docker:test
```

**Resultado esperado:**

```
Aethermind API server running on port 3001
WebSocket server running on ws://localhost:3001/ws
Health check: http://localhost:3001/health
```

**Para detener:**

```powershell
# Ctrl+C para detener el contenedor
# Luego detener los servicios
pnpm docker:down
```

---

## 🎨 Paso 3: Verificar Build de Vercel (Dashboard)

### 3.1 Build del Dashboard

```powershell
pnpm vercel:build
```

**Qué hace:** Construye el dashboard de Next.js con Turbo

**Tiempo estimado:** 1-2 minutos

**Resultado esperado:**

```
• Packages in scope: @aethermind/dashboard
• Running build in 1 packages
@aethermind/dashboard:build: cache miss, executing...
@aethermind/dashboard:build:
@aethermind/dashboard:build: > @aethermind/dashboard@0.1.0 build
@aethermind/dashboard:build: > next build
@aethermind/dashboard:build:
@aethermind/dashboard:build:    ▲ Next.js 14.2.32
@aethermind/dashboard:build:
@aethermind/dashboard:build:    Creating an optimized production build ...
@aethermind/dashboard:build: ✓ Compiled successfully
@aethermind/dashboard:build: ✓ Linting and checking validity of types
@aethermind/dashboard:build: ✓ Collecting page data
@aethermind/dashboard:build: ✓ Generating static pages (5/5)
@aethermind/dashboard:build: ✓ Collecting build traces
@aethermind/dashboard:build: ✓ Finalizing page optimization
@aethermind/dashboard:build:
@aethermind/dashboard:build: Route (app)                              Size     First Load JS
@aethermind/dashboard:build: ┌ ○ /                                    ...
```

### 3.2 Verificar Archivos Generados

```powershell
# Verificar que .next existe
Test-Path "packages/dashboard/.next"

# Ver el tamaño del build
Get-ChildItem "packages/dashboard/.next" -Recurse | Measure-Object -Property Length -Sum | Select-Object @{Name="Size(MB)";Expression={[math]::Round($_.Sum / 1MB, 2)}}
```

**Resultado esperado:**

```
True

Size(MB)
--------
   45.23
```

---

## 🔐 Paso 4: Verificar Validación de JWT_SECRET

### 4.1 Test: Fallo Esperado sin JWT_SECRET

```powershell
pnpm verify:jwt
```

**Qué hace:** Intenta iniciar el API en modo producción sin JWT_SECRET

**Resultado ESPERADO (debe fallar):**

```
Error: JWT_SECRET must be set and at least 32 characters in production
    at Object.<anonymous> (c:\wamp64\www\Aethermind Agent os\apps\api\src\routes\auth.ts:13:11)
```

**✅ Si ves este error, la validación funciona correctamente!**

### 4.2 Test: JWT_SECRET muy corto

```powershell
cross-env NODE_ENV=production JWT_SECRET=short tsx apps/api/src/index.ts
```

**Resultado ESPERADO (debe fallar):**

```
Error: JWT_SECRET must be set and at least 32 characters in production
```

### 4.3 Test: JWT_SECRET válido

Primero, genera un JWT_SECRET válido:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia el resultado (ejemplo: `a1b2c3d4e5f6...`) y úsalo:

```powershell
# Reemplaza <tu-jwt-secret> con el valor generado
cross-env NODE_ENV=production JWT_SECRET=<tu-jwt-secret> DATABASE_URL=postgresql://test:test@localhost:5432/test tsx apps/api/src/index.ts
```

**Resultado esperado:**

```
Aethermind API server running on port 3001
...
```

**Ctrl+C para detener**

---

## ✅ Paso 5: Verificación Completa

### 5.1 Script de Verificación Automática

```powershell
pnpm verify:deployment
```

**Qué hace:** Ejecuta el build de Docker y verifica que sea exitoso

**Resultado esperado:**

```
[+] Building ...
✅ Docker build successful
```

### 5.2 Checklist Manual

Marca cada item cuando lo completes:

- [ ] `pnpm install` ejecutado sin errores
- [ ] `pnpm prisma generate` ejecutado sin errores
- [ ] `pnpm docker:build` completado exitosamente
- [ ] Imagen `aethermind-api:test` visible en `docker images`
- [ ] `pnpm vercel:build` completado exitosamente
- [ ] Directorio `packages/dashboard/.next` existe
- [ ] `pnpm verify:jwt` falla con el error esperado
- [ ] JWT_SECRET corto falla con el error esperado
- [ ] JWT_SECRET válido permite iniciar el servidor

---

## 🐛 Troubleshooting

### Error: "Docker daemon is not running"

**Solución:**

1. Abre Docker Desktop
2. Espera a que inicie completamente
3. Intenta de nuevo

### Error: "pnpm: command not found"

**Solución:**

```powershell
npm install -g pnpm@9
```

### Error: "turbo: command not found"

**Solución:**

```powershell
pnpm install
```

### Error en Docker Build: "failed to solve with frontend dockerfile.v0"

**Solución:**

```powershell
# Limpiar cache de Docker
docker builder prune -a

# Intentar de nuevo
pnpm docker:build
```

### Error en Vercel Build: "Module not found"

**Solución:**

```powershell
# Limpiar y reinstalar
pnpm clean
pnpm install
pnpm vercel:build
```

### Build de Docker muy lento

**Causa:** Primera vez que se construye la imagen

**Solución:**

- Es normal, tarda 3-5 minutos la primera vez
- Builds subsecuentes serán más rápidos (1-2 minutos) gracias al cache

---

## 📊 Resultados Esperados - Resumen

| Test         | Comando                    | Resultado Esperado  |
| ------------ | -------------------------- | ------------------- |
| Instalación  | `pnpm install`             | ✅ Sin errores      |
| Prisma       | `pnpm prisma generate`     | ✅ Client generado  |
| Docker Build | `pnpm docker:build`        | ✅ Imagen creada    |
| Vercel Build | `pnpm vercel:build`        | ✅ Build exitoso    |
| JWT Vacío    | `pnpm verify:jwt`          | ❌ Error (esperado) |
| JWT Corto    | `JWT_SECRET=short ...`     | ❌ Error (esperado) |
| JWT Válido   | `JWT_SECRET=<32chars> ...` | ✅ Servidor inicia  |

---

## 🚀 Siguiente Paso

Si **todos los tests pasaron**, estás listo para desplegar:

1. **Railway:** Sigue la guía en [docs/DEPLOYMENT.md](file:///c:/wamp64/www/Aethermind%20Agent%20os/docs/DEPLOYMENT.md) - Parte 1
2. **Vercel:** Sigue la guía en [docs/DEPLOYMENT.md](file:///c:/wamp64/www/Aethermind%20Agent%20os/docs/DEPLOYMENT.md) - Parte 2

---

## 📝 Comandos de Referencia Rápida

```powershell
# Verificación completa en orden
pnpm install
pnpm prisma generate
pnpm docker:build
pnpm vercel:build
pnpm verify:jwt

# Limpiar todo
pnpm clean
docker system prune -a

# Generar secretos
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
pnpm generate-api-key
```

---

¡Buena suerte con tu despliegue! 🎉
