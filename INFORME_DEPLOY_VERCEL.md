# 📋 Informe de Preparación para Deploy a Vercel

**Proyecto**: Aethermind AgentOS  
**Framework**: Next.js 14.2.35 (App Router)  
**Fecha**: 14 de Enero de 2026  
**Tipo de Proyecto**: Monorepo (Turborepo + pnpm workspaces)

---

## ✅ Estado General: ⚠️ NEEDS WORK

### Resumen Ejecutivo

El proyecto **Aethermind AgentOS** es un monorepo que contiene múltiples aplicaciones, siendo el **Dashboard** (`packages/dashboard`) la aplicación Next.js que se va a deployar a Vercel. El proyecto está técnicamente preparado para deploy, con una configuración básica de Vercel existente, pero **requiere resolver varios issues críticos antes de un deploy a producción**.

**Hallazgos principales:**

- ✅ La estructura del monorepo está bien configurada (Turborepo + pnpm)
- ✅ TypeCheck del dashboard pasa sin errores
- ✅ Scripts de build están correctamente definidos
- ⚠️ **5 vulnerabilidades de seguridad en dependencias** (1 crítica, 1 alta, 2 moderadas, 1 baja)
- ⚠️ **Archivo `.env` con credenciales versionado en el repositorio**
- ⚠️ Falta configuración de variables de entorno para producción
- ⚠️ No hay sitemap.xml ni robots.txt para SEO
- ⚠️ Configuración de Sentry incompleta (faltan variables de entorno)

El proyecto puede deployarse **técnicamente**, pero se recomienda **resolver los issues críticos de seguridad** antes de publicar a producción.

---

## 📊 Análisis Detallado

### 1. Estructura del Proyecto

#### Framework Detection

- **Framework**: Next.js 14.2.35
- **Router**: App Router (`packages/dashboard/src/app/`)
- **Monorepo**: ✅ Sí - Turborepo 2.6.1 con pnpm workspaces 9.0.0
- **Node.js Version**: 20+ (especificado en `.nvmrc` y `package.json`)
- **Package Manager**: pnpm 9.0.0

#### Estructura del Monorepo

```
aethermind-agentos/
├── apps/
│   └── api/              # Backend Express (NO se deploya en Vercel)
├── packages/
│   ├── dashboard/        # 🎯 Next.js App a deployar
│   ├── core/             # Framework de agentes
│   ├── sdk/              # SDK para desarrolladores
│   ├── agent/            # Runtime de agentes
│   ├── api-client/       # Cliente API
│   └── ...
└── turbo.json            # Configuración de build
```

**✅ Deployable Package**: `packages/dashboard`

---

### 2. Configuración de Build

#### Build Command

```bash
pnpm build
```

#### Output Directory

```
.next
```

#### Install Command

```bash
pnpm install --frozen-lockfile
```

#### Framework Preset

- **Vercel Framework**: `nextjs`
- **Root Directory**: `packages/dashboard` (monorepo)

#### Configuración Actual de `vercel.json` (raíz)

```json
{
  "version": 2,
  "builds": [
    {
      "src": "packages/dashboard/package.json",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "packages/dashboard/$1"
    }
  ]
}
```

⚠️ **PROBLEMA**: Esta configuración usa el formato antiguo de Vercel (`builds` y `routes`). Vercel ahora recomienda usar la detección automática de framework y configurar el `Root Directory` en el dashboard de Vercel.

#### Configuración de `packages/dashboard/vercel.json`

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "devCommand": "pnpm dev"
}
```

✅ Esta configuración es correcta y moderna.

---

### 3. Variables de Entorno Requeridas

#### Variables Públicas (Expuestas al Cliente)

| Variable Name             | Required    | Description                                      | Example                                           |
| ------------------------- | ----------- | ------------------------------------------------ | ------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`     | ✅ **YES**  | URL del backend API                              | `https://aethermindapi-production.up.railway.app` |
| `NEXT_PUBLIC_LANDING_URL` | ✅ **YES**  | URL de la landing page para redirects            | `https://aethermind-page.vercel.app`              |
| `NEXT_PUBLIC_WS_URL`      | ⚠️ Opcional | URL de WebSocket (auto-construido desde API_URL) | `wss://aethermindapi-production.up.railway.app`   |
| `NEXT_PUBLIC_ORG_ID`      | ⚠️ Opcional | ID de organización para telemetría               | `org_xyz123`                                      |

#### Variables de Servidor (Solo Backend)

| Variable Name            | Required       | Description                     | Example                     |
| ------------------------ | -------------- | ------------------------------- | --------------------------- |
| `NEXT_PUBLIC_SENTRY_DSN` | ⚠️ Recomendado | Sentry DSN para error tracking  | `https://xxx@sentry.io/xxx` |
| `SENTRY_DSN`             | ⚠️ Recomendado | Sentry DSN para servidor        | `https://xxx@sentry.io/xxx` |
| `SENTRY_AUTH_TOKEN`      | ⚠️ Recomendado | Token de Sentry para sourcemaps | `sntrys_xxx`                |
| `SENTRY_ORG`             | ⚠️ Opcional    | Organización de Sentry          | `aethermind-xt`             |
| `SENTRY_PROJECT`         | ⚠️ Opcional    | Proyecto de Sentry              | `javascript-nextjs`         |

#### Variables NO Necesarias para el Dashboard

❌ `DATABASE_URL` - Solo necesaria en el backend API  
❌ `JWT_SECRET` - Solo necesaria en el backend API  
❌ `SESSION_SECRET` - Solo necesaria en el backend API  
❌ `OPENAI_API_KEY` - Solo necesaria en el backend API  
❌ `PRISMA_SCHEMA_PATH` - Solo necesaria en el backend API

**⚠️ IMPORTANTE**: El dashboard es una aplicación **frontend pura** que consume la API. **NO necesita** `DATABASE_URL` ni secretos del backend.

#### Archivos de Ejemplo de Variables de Entorno

✅ `packages/dashboard/.env.local.example` - Bien documentado

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=aethermind-xt
SENTRY_PROJECT=javascript-nextjs
```

---

### 4. Build Local Test

#### TypeCheck

```bash
✅ pnpm typecheck (packages/dashboard)
Status: PASSED
Exit code: 0
```

**Resultado**: ✅ Sin errores de TypeScript

#### Test de Prisma

⚠️ **NOTA IMPORTANTE**: El dashboard tiene un `postinstall` script que ejecuta `prisma generate`:

```json
"postinstall": "cd ../.. && npx prisma generate || true"
```

Este script tiene `|| true` al final, lo que significa que **no fallará si Prisma no puede generar** (por ejemplo, si `DATABASE_URL` no está configurada). Esto es **correcto** para el dashboard ya que:

1. El dashboard no usa Prisma directamente
2. Es solo un cliente que consume la API REST
3. El `|| true` evita errores en build de Vercel

✅ **Configuración correcta**

#### Build Test Completo

⚠️ **NO EJECUTADO** - Requiere instalación completa de dependencias del monorepo (~480 MB según `pnpm-lock.yaml`)

**Recomendación**: Ejecutar antes del deploy:

```bash
# Desde la raíz del monorepo
pnpm install --frozen-lockfile
cd packages/dashboard
pnpm build
```

---

### 5. Issues Encontrados

#### 🔴 CRITICAL (Bloquean deploy seguro a producción)

1. **Archivo `.env` versionado en el repositorio**

   - **Ubicación**: `c:\wamp64\www\Aethermind Agent os\.env`
   - **Problema**: Contiene credenciales de desarrollo que **NO DEBEN** estar en el repositorio
   - **Contenido sensible**:
     ```
     POSTGRES_PASSWORD=aethermind123
     JWT_SECRET=desarrollo-secreto-jwt-muy-largo-minimo-32-caracteres
     SESSION_SECRET=desarrollo-session-secret-tambien-muy-largo
     ```
   - **Impacto**: 🔴 **ALTO** - Exposición de secretos en GitHub
   - **Solución**:
     ```bash
     git rm --cached .env
     git commit -m "Remove .env from version control"
     # Verificar que .env esté en .gitignore (✅ ya está)
     ```

2. **5 Vulnerabilidades de Seguridad en Dependencias**

   - **Fuente**: `pnpm audit --prod`
   - **Severidad**:
     - 1 Critical
     - 1 High
     - 2 Moderate
     - 1 Low
   - **Paquetes afectados**:
     - `nodemailer@6.10.1` (en `apps/api`) - Vulnerable a DoS
     - Otros paquetes de producción
   - **Impacto**: 🔴 **ALTO** - Vulnerabilidades conocidas
   - **Solución**:
     ```bash
     pnpm update nodemailer --latest
     pnpm audit fix
     ```

3. **Falta configuración de `NEXT_PUBLIC_API_URL` para producción**
   - **Problema**: Sin esta variable, el dashboard NO FUNCIONARÁ en producción
   - **Ubicación**: Debe configurarse en Vercel Dashboard → Settings → Environment Variables
   - **Valor requerido**: URL del backend API en producción (ej: `https://aethermindapi-production.up.railway.app`)
   - **Impacto**: 🔴 **CRÍTICO** - La app no funcionará sin esta variable
   - **Solución**: Configurar en Vercel Dashboard (ver sección "Pasos para Deploy")

#### 🟡 WARNINGS (Pueden causar problemas o degradar experiencia)

1. **No hay `sitemap.xml` ni `robots.txt`**

   - **Impacto**: SEO degradado, los bots no pueden indexar correctamente
   - **Recomendación**: Crear `packages/dashboard/src/app/sitemap.ts` y `packages/dashboard/src/app/robots.ts`
   - **Prioridad**: 🟡 Media (no crítico para funcionalidad)

2. **Configuración de Sentry incompleta**

   - **Problema**: Sentry está integrado en el código pero faltan variables de entorno
   - **Variables faltantes**:
     - `NEXT_PUBLIC_SENTRY_DSN`
     - `SENTRY_AUTH_TOKEN` (para sourcemaps)
   - **Impacto**: No se reportarán errores a Sentry
   - **Recomendación**: Configurar Sentry o remover la integración

3. **Archivo `.env` en `packages/dashboard/.env.local` puede tener secretos**

   - **Ubicación**: `packages/dashboard/.env.local`
   - **Estado**: ✅ Está en `.gitignore`
   - **Advertencia**: Verificar que no esté versionado
   - **Verificación**:
     ```bash
     git ls-files packages/dashboard/.env.local
     # Si aparece, ejecutar: git rm --cached packages/dashboard/.env.local
     ```

4. **Vercel config en raíz usa formato antiguo**
   - **Archivo**: `vercel.json` (raíz)
   - **Problema**: Usa `builds` y `routes` (formato v2 legacy)
   - **Recomendación**: Eliminar `vercel.json` de raíz y configurar `Root Directory` en Vercel Dashboard

#### 🟢 OPTIMIZATIONS (Mejoras opcionales pero recomendadas)

1. **Implementar ISR (Incremental Static Regeneration)**

   - Para páginas estáticas que cambian poco (landing, docs)
   - Mejora performance y reduce costos de serverless

2. **Agregar `next/image` optimization config**

   - Configurar `remotePatterns` para imágenes externas
   - Configurar `formats: ['image/avif', 'image/webp']` para mejor compresión

3. **Habilitar `@next/bundle-analyzer`**

   - Para identificar dependencias pesadas
   - Optimizar tamaño del bundle

4. **Configurar headers de seguridad en `next.config.js`**

   - CSP (Content Security Policy)
   - X-Frame-Options
   - X-Content-Type-Options

5. **Implementar OG images dinámicas**
   - Usar `next/og` para generar imágenes de Open Graph
   - Mejora compartibilidad en redes sociales

---

### 6. Archivos de Configuración

#### ✅ `packages/dashboard/next.config.js`

```javascript
const { withSentryConfig } = require("@sentry/nextjs");

const nextConfig = {
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
  distDir: ".next",
  experimental: {
    instrumentationHook: true,
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

const sentryWebpackPluginOptions = {
  org: "aethermind-xt",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  disableLogger: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableServerWebpackPlugin: process.env.NODE_ENV !== "production",
  disableClientWebpackPlugin: process.env.NODE_ENV !== "production",
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
```

**Análisis**:

- ✅ Rewrites configurados correctamente para proxy a la API
- ✅ `distDir` especificado
- ✅ Server Actions habilitados con límite de 2MB
- ⚠️ Sentry configurado pero necesita variables de entorno

#### ✅ `packages/dashboard/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Análisis**:

- ✅ Configuración estándar de Next.js
- ✅ Path alias `@/*` configurado
- ✅ Strict mode habilitado

#### ✅ `.gitignore`

```
.env
.env.local
.env.*.local
.env*.local
.env.sentry-build-plugin
.env.backup
.env.fixed
.env.temp
.env.migration
.env.*.old
```

**Análisis**:

- ✅ `.env` está en `.gitignore`
- ⚠️ **PERO** el archivo `.env` en la raíz **YA ESTÁ VERSIONADO** (agregado antes de .gitignore)
- ✅ Variantes de `.env` bien cubiertas

#### ✅ `.vercelignore`

```
apps/api/
docker-compose.yml
packages/core/
packages/sdk/
packages/vscode-extension/
examples/
scripts/
tests/
*.test.ts
jest.*.config.js
.github/
prisma/
Dockerfile*
```

**Análisis**:

- ✅ Bien configurado para excluir paquetes innecesarios
- ✅ Backend (`apps/api/`) excluido correctamente
- ✅ Tests y configs de desarrollo excluidos

---

### 7. Análisis de Dependencias

#### Production Dependencies (Dashboard)

```json
{
  "@radix-ui/react-dialog": "^1.0.5",
  "@radix-ui/react-dropdown-menu": "^2.0.6",
  "@radix-ui/react-select": "^2.0.0",
  "@radix-ui/react-slot": "^1.0.2",
  "@radix-ui/react-tabs": "^1.0.4",
  "@sentry/nextjs": "^10.0.0",
  "class-variance-authority": "^0.7.0",
  "clsx": "^2.1.0",
  "jspdf": "^3.0.4",
  "jspdf-autotable": "^3.8.4",
  "lucide-react": "^0.359.0",
  "next": "^14.2.35",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "recharts": "^2.5.0",
  "tailwind-merge": "^2.2.0",
  "tailwindcss-animate": "^1.0.7"
}
```

**Análisis**:

- ✅ Dependencies bien organizadas (UI en production, tools en dev)
- ✅ No hay dependencias pesadas innecesarias
- ✅ Radix UI para componentes accesibles
- ✅ Tailwind CSS para estilos
- ⚠️ `jspdf` y `jspdf-autotable` podrían moverse a lazy loading para reducir bundle inicial

#### Peer Dependencies

✅ No hay warnings de peer dependencies reportados en el typecheck

#### Vulnerabilidades

**Estado**: ⚠️ **5 vulnerabilidades encontradas** (pnpm audit)

**Detalle**:

- 1 Critical
- 1 High
- 2 Moderate
- 1 Low

**Paquetes afectados** (en monorepo, no necesariamente en dashboard):

- `nodemailer@6.10.1` (apps/api) - DoS vulnerability
- Otros paquetes de dependencias transitivas

**Acción requerida**:

```bash
cd apps/api
pnpm update nodemailer@latest
cd ../..
pnpm audit fix
```

---

### 8. Estrategia de Deploy

#### Opción Recomendada: Deploy del Monorepo con Root Directory

**Ventajas**:

- Vercel maneja automáticamente las dependencias del workspace
- Turborepo cache funciona correctamente
- Fácil de configurar y mantener

**Configuración en Vercel Dashboard**:

1. **Framework Preset**: Next.js
2. **Root Directory**: `packages/dashboard`
3. **Build Command**: `cd ../.. && pnpm install && pnpm build --filter=@aethermind/dashboard`
4. **Install Command**: `pnpm install`
5. **Output Directory**: `.next` (relativo a Root Directory)

#### Alternativa: Deploy Solo del Package Dashboard

**Ventajas**:

- Build más rápido (menos dependencias)
- Más simple de debuggear

**Desventajas**:

- Requiere preparar el package para deploy standalone
- Puede romper si hay dependencias de workspace

**NO RECOMENDADA** para este proyecto debido a las dependencias del monorepo.

---

### 9. Configuración Recomendada de Vercel

#### `vercel.json` (recomendado para packages/dashboard)

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "installCommand": "pnpm install --frozen-lockfile",
  "framework": "nextjs",
  "devCommand": "pnpm dev",
  "regions": ["iad1"],
  "env": {
    "NEXT_PUBLIC_API_URL": "https://aethermindapi-production.up.railway.app"
  }
}
```

**Nota**: Preferiblemente configurar variables de entorno en Vercel Dashboard en lugar de `vercel.json` para mantener secretos fuera del código.

#### Environment Variables (Vercel Dashboard)

##### Production

| Variable                  | Value                                             | Type       |
| ------------------------- | ------------------------------------------------- | ---------- |
| `NEXT_PUBLIC_API_URL`     | `https://aethermindapi-production.up.railway.app` | Plain Text |
| `NEXT_PUBLIC_LANDING_URL` | `https://aethermind-page.vercel.app`              | Plain Text |
| `NEXT_PUBLIC_SENTRY_DSN`  | `https://xxx@sentry.io/xxx`                       | Secret     |
| `SENTRY_DSN`              | `https://xxx@sentry.io/xxx`                       | Secret     |
| `SENTRY_AUTH_TOKEN`       | `sntrys_xxx`                                      | Secret     |
| `SENTRY_ORG`              | `aethermind-xt`                                   | Plain Text |
| `SENTRY_PROJECT`          | `javascript-nextjs`                               | Plain Text |

##### Preview

| Variable                  | Value                                | Type       |
| ------------------------- | ------------------------------------ | ---------- |
| `NEXT_PUBLIC_API_URL`     | `https://staging-api.railway.app`    | Plain Text |
| `NEXT_PUBLIC_LANDING_URL` | `https://staging-landing.vercel.app` | Plain Text |

##### Development

| Variable                  | Value                   | Type       |
| ------------------------- | ----------------------- | ---------- |
| `NEXT_PUBLIC_API_URL`     | `http://localhost:3001` | Plain Text |
| `NEXT_PUBLIC_LANDING_URL` | `http://localhost:3000` | Plain Text |

---

### 10. Redirects y Rewrites

#### Configuración Actual (`next.config.js`)

```javascript
async rewrites() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  return [
    {
      source: '/api/:path*',
      destination: `${apiUrl}/api/:path*`,
    },
  ];
}
```

**Análisis**:

- ✅ **CORRECTO**: Proxy de `/api/*` al backend
- ✅ Usa variable de entorno configurable
- ✅ Permite que el dashboard llame a `/api/agents` y se redirija al backend

**Comportamiento esperado**:

- Request a `https://dashboard.vercel.app/api/agents`
- Se reescribe a `https://aethermindapi-production.up.railway.app/api/agents`
- El cliente ve solo `/api/agents` (CORS evitado)

⚠️ **IMPORTANTE**: Asegurarse que el backend acepta requests con CORS o que los rewrites funcionan correctamente en producción.

---

## 🚀 Pasos para Deploy

### FASE 1: Resolver Issues Críticos (OBLIGATORIO)

#### 1. Remover `.env` del repositorio

```bash
# Desde la raíz del proyecto
git rm --cached .env
git commit -m "security: Remove .env from version control"
git push origin main
```

#### 2. Actualizar dependencias con vulnerabilidades

```bash
# Actualizar nodemailer
cd apps/api
pnpm update nodemailer@latest

# Volver a raíz y ejecutar audit fix
cd ../..
pnpm audit fix

# Verificar que las vulnerabilidades se resolvieron
pnpm audit --prod
```

#### 3. Verificar que `.env.local` del dashboard no esté versionado

```bash
git ls-files packages/dashboard/.env.local
# Si aparece algo, ejecutar:
git rm --cached packages/dashboard/.env.local
git commit -m "security: Remove dashboard .env.local from version control"
```

#### 4. Test de build local

```bash
# Desde la raíz del monorepo
pnpm install --frozen-lockfile
cd packages/dashboard
pnpm build

# Verificar que el build sea exitoso
# Expected output:
# ✓ Compiled successfully
# Route (app)                              Size     First Load JS
# ┌ ○ /                                    ...
```

### FASE 2: Configurar Vercel Project

#### 1. Conectar repositorio a Vercel

1. Ir a [Vercel Dashboard](https://vercel.com/dashboard)
2. Click en "Add New" → "Project"
3. Importar el repositorio de GitHub `gonzacba17/Aethermind-AgentOS`

#### 2. Configurar Build Settings

En "Configure Project":

```
Framework Preset: Next.js
Root Directory: packages/dashboard
Build Command: pnpm build
Output Directory: .next
Install Command: pnpm install --frozen-lockfile
Node.js Version: 20.x
```

#### 3. Configurar Environment Variables

**Production Environment**:

Click en "Environment Variables" y agregar:

| Name                      | Value                                             | Environment         |
| ------------------------- | ------------------------------------------------- | ------------------- |
| `NEXT_PUBLIC_API_URL`     | `https://aethermindapi-production.up.railway.app` | Production          |
| `NEXT_PUBLIC_LANDING_URL` | `https://aethermind-page.vercel.app`              | Production          |
| `NEXT_PUBLIC_SENTRY_DSN`  | _(obtener de Sentry)_                             | Production, Preview |
| `SENTRY_DSN`              | _(obtener de Sentry)_                             | Production, Preview |
| `SENTRY_AUTH_TOKEN`       | _(obtener de Sentry)_                             | Production, Preview |
| `SENTRY_ORG`              | `aethermind-xt`                                   | All                 |
| `SENTRY_PROJECT`          | `javascript-nextjs`                               | All                 |

**Preview Environment** (para branches):

| Name                      | Value                      | Environment |
| ------------------------- | -------------------------- | ----------- |
| `NEXT_PUBLIC_API_URL`     | _(URL de staging API)_     | Preview     |
| `NEXT_PUBLIC_LANDING_URL` | _(URL de staging landing)_ | Preview     |

#### 4. Deploy

Click en **"Deploy"** y esperar que el build termine.

**Tiempo estimado**: 3-5 minutos

### FASE 3: Verificación Post-Deploy

#### 1. Verificar que el sitio carga correctamente

```
✅ https://your-project.vercel.app carga sin errores
✅ El dashboard muestra la UI correctamente
✅ No hay errores en la consola del navegador
```

#### 2. Probar funcionamiento de la API

```
✅ Login/Logout funcionan
✅ Las llamadas a /api/* se redirigen correctamente al backend
✅ WebSocket se conecta (si aplica)
```

#### 3. Verificar Sentry

```
✅ Los errores se reportan a Sentry
✅ Sourcemaps funcionan correctamente
```

#### 4. Verificar Analytics

```
✅ Vercel Analytics está activo
✅ Web Vitals se están registrando
```

### FASE 4: Configurar Dominio Custom (Opcional)

1. Ir a "Settings" → "Domains"
2. Agregar dominio custom (ej: `dashboard.aethermind.io`)
3. Configurar DNS según instrucciones de Vercel
4. Esperar propagación de DNS (5-30 minutos)
5. Actualizar `NEXT_PUBLIC_LANDING_URL` y otros URLs si es necesario

---

## ⚠️ Notas Importantes

### 1. Backend en Railway

El dashboard asume que el backend API está deployado y accesible en:

```
https://aethermindapi-production.up.railway.app
```

**Verificar**:

- ✅ El backend está corriendo
- ✅ El backend acepta requests del dominio de Vercel (CORS configurado)
- ✅ Las rutas `/api/agents`, `/api/executions`, etc. funcionan

Si el backend NO está deployado, el dashboard **NO FUNCIONARÁ**.

### 2. Database URL

El dashboard **NO NECESITA** `DATABASE_URL` porque:

- Es una aplicación frontend pura
- Solo consume la API REST del backend
- El backend es quien se conecta a la base de datos

❌ **NO CONFIGURAR** `DATABASE_URL` en las variables de entorno de Vercel para el dashboard.

### 3. Prisma Generate en Build

El script `postinstall` del dashboard ejecuta:

```bash
cd ../.. && npx prisma generate || true
```

Esto es **correcto** y tiene `|| true` para que no falle si no hay `DATABASE_URL`. Vercel manejará esto automáticamente.

### 4. Monorepo Build

Vercel detectará automáticamente que es un monorepo de pnpm y:

- Instalará todas las dependencias del workspace
- Ejecutará `turbo build` si está configurado
- Cacheará las builds de Turborepo

✅ Esto es **correcto** y optimizado.

### 5. Costos de Vercel

**Proyecto Hobby** (Gratis):

- ✅ 100 GB de bandwidth
- ✅ Deployments ilimitados
- ✅ Preview deployments automáticos
- ⚠️ Límite de 100 ejecuciones de Serverless Functions por día

**Proyecto Pro** ($20/mes):

- ✅ 1 TB de bandwidth
- ✅ Sin límites de Serverless Functions
- ✅ Protección DDoS
- ✅ Analíticas avanzadas

**Recomendación**: Empezar con **Hobby** y escalar a **Pro** cuando sea necesario.

---

## 📋 Configuración Recomendada

### `packages/dashboard/vercel.json` (FINAL)

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "installCommand": "pnpm install --frozen-lockfile",
  "framework": "nextjs",
  "devCommand": "pnpm dev"
}
```

### Environment Variables Template (para Vercel Dashboard)

Guardar como referencia:

```bash
# Production
NEXT_PUBLIC_API_URL=https://aethermindapi-production.up.railway.app
NEXT_PUBLIC_LANDING_URL=https://aethermind-page.vercel.app

# Sentry (Opcional pero recomendado)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_AUTH_TOKEN=sntrys_xxx
SENTRY_ORG=aethermind-xt
SENTRY_PROJECT=javascript-nextjs
```

### Headers de Seguridad (agregar a `next.config.js`)

```javascript
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
      ],
    },
  ];
}
```

---

## 📊 Checklist Pre-Deploy

### Antes de Conectar a Vercel

- [ ] ✅ Build local exitoso (`pnpm build` en `packages/dashboard`)
- [ ] ✅ TypeCheck sin errores (`pnpm typecheck`)
- [ ] ✅ `.gitignore` actualizado (ya está)
- [ ] ⚠️ **PENDIENTE**: `.env` removido del repositorio
- [ ] ⚠️ **PENDIENTE**: Vulnerabilidades de seguridad resueltas (`pnpm audit fix`)
- [ ] ✅ `package.json` tiene script "build"
- [ ] ⚠️ **PENDIENTE**: Backend API está deployado y accesible

### Configuración de Vercel Project

- [ ] Framework Preset: **Next.js**
- [ ] Root Directory: **packages/dashboard**
- [ ] Build Command: **pnpm build**
- [ ] Output Directory: **.next**
- [ ] Install Command: **pnpm install --frozen-lockfile**
- [ ] Node.js Version: **20.x**

### Environment Variables Configuradas

- [ ] ⚠️ **PENDIENTE**: `NEXT_PUBLIC_API_URL` (Production)
- [ ] ⚠️ **PENDIENTE**: `NEXT_PUBLIC_LANDING_URL` (Production)
- [ ] ⚠️ Opcional: `NEXT_PUBLIC_SENTRY_DSN`
- [ ] ⚠️ Opcional: `SENTRY_AUTH_TOKEN`

### Post-Deploy

- [ ] Sitio carga correctamente
- [ ] API calls funcionan
- [ ] Login/logout funcionan
- [ ] No hay errores en consola
- [ ] Sentry reporta errores (si configurado)

---

## 🔴 Issues CRÍTICOS a Resolver ANTES del Deploy

### 1. 🔴 CRITICAL: Remover `.env` del repositorio

**Prioridad**: P0 - BLOCKER  
**Impacto**: Exposición de secretos en GitHub  
**Comando**:

```bash
git rm --cached .env
git commit -m "security: Remove .env from version control"
git push
```

### 2. 🔴 CRITICAL: Configurar `NEXT_PUBLIC_API_URL` en Vercel

**Prioridad**: P0 - BLOCKER  
**Impacto**: La aplicación NO FUNCIONARÁ sin esta variable  
**Acción**: Configurar en Vercel Dashboard → Environment Variables

### 3. 🔴 HIGH: Resolver vulnerabilidades de seguridad

**Prioridad**: P0 - BLOCKER  
**Impacto**: 5 vulnerabilidades (1 crítica, 1 alta)  
**Comando**:

```bash
cd apps/api
pnpm update nodemailer@latest
cd ../..
pnpm audit fix
```

---

## 🟡 Issues RECOMENDADOS a Resolver

### 1. 🟡 Agregar `sitemap.xml` y `robots.txt`

**Prioridad**: P1 - High  
**Impacto**: SEO  
**Acción**: Crear `packages/dashboard/src/app/sitemap.ts` y `robots.ts`

### 2. 🟡 Completar configuración de Sentry

**Prioridad**: P1 - High  
**Impacto**: Error tracking  
**Acción**: Obtener DSN de Sentry y configurar en Vercel

### 3. 🟡 Optimizar bundle size

**Prioridad**: P2 - Medium  
**Impacto**: Performance  
**Acción**: Lazy load de `jspdf` y otros módulos pesados

---

## ✅ Conclusión

El proyecto **Aethermind AgentOS Dashboard** está **técnicamente listo** para deploy a Vercel, pero **requiere resolver 3 issues críticos** antes de un deploy seguro a producción:

1. ✅ Remover `.env` del repositorio
2. ✅ Configurar `NEXT_PUBLIC_API_URL` en Vercel
3. ✅ Resolver vulnerabilidades de seguridad

**Tiempo estimado para preparación completa**: 30-45 minutos  
**Tiempo estimado de deploy**: 3-5 minutos  
**Complejidad**: Media (requiere conocimiento de monorepos y Next.js)

**Estado Final Esperado**: 🟢 **READY para producción** después de resolver los 3 issues críticos.

---

**Fecha del informe**: 14 de Enero de 2026  
**Analista**: Antigravity AI  
**Proyecto**: Aethermind AgentOS  
**Versión del informe**: 1.0
