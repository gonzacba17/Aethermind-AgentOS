# 🔧 Fix: Redirect Loop del Dashboard a Landing Page

**Fecha**: 14 de Enero de 2026  
**Issue**: Dashboard redirige a `aethermind-page.vercel.app` en lugar de mostrar el contenido  
**Commit Fix**: `7de3ee8` - Disable AuthGuard temporarily

---

## 🔴 Problema Identificado

### Síntomas

1. Al acceder a `aethermind-agent-os-dashboard.vercel.app`
2. La página redirige automáticamente a `aethermind-page.vercel.app`
3. La landing page muestra error `404 NOT_FOUND` con código `DEPLOYMENT_NOT_FOUND`

### Causa Raíz

**AuthGuard** (`packages/dashboard/src/components/AuthGuard.tsx`) está configurado para:

```typescript
// Line 29-33
if (!authenticated) {
  console.log("[AuthGuard] No token found - redirecting to landing page");
  // Redirect to landing page (login page is in the frontend repo)
  window.location.href = LANDING_PAGE_URL; // ⬅️ AQUÍ ESTÁ EL PROBLEMA
  return;
}
```

**Flujo del problema**:

1. Usuario visita el dashboard
2. AuthGuard ejecuta en el cliente (`'use client'`)
3. Verifica si hay token JWT en `localStorage`
4. **No encuentra token** (primera visita)
5. Lee `LANDING_PAGE_URL` de `process.env.NEXT_PUBLIC_LANDING_URL`
6. Si la variable no está configurada, usa default: `http://localhost:3000`
7. Si la variable está configurada en Vercel: `https://aethermind-page.vercel.app`
8. **Redirige con `window.location.href`**
9. La landing page no existe o no está deployada → 404

---

## ✅ Solución Aplicada (Temporal)

### Commit: `7de3ee8`

**Cambio en `packages/dashboard/src/app/layout.tsx`**:

```diff
  return (
    <html lang="en">
      <body className={inter.className}>
-        <AuthGuard>
+        {/* AuthGuard temporarily disabled for testing - ENABLE BEFORE PRODUCTION */}
+        {/* <AuthGuard> */}
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-y-auto bg-muted/30">
              {children}
            </main>
          </div>
-        </AuthGuard>
+        {/* </AuthGuard> */}
      </body>
    </html>
  );
```

**Resultado**:

- ✅ El dashboard ahora carga sin redirigir
- ✅ Se puede acceder a todas las rutas del dashboard
- ⚠️ **NO HAY AUTENTICACIÓN** (temporal para testing)

---

## 🎯 Soluciones Permanentes

### Opción 1: Sistema de Autenticación Integrado (RECOMENDADA)

**Problema actual**: La autenticación depende de 2 repos separados (landing + dashboard)

**Solución**: Integrar el login en el mismo dashboard

**Implementación**:

1. **Crear página de login en el dashboard**

   ```bash
   # Crear archivo: packages/dashboard/src/app/login/page.tsx
   ```

2. **Modificar AuthGuard para redirigir internamente**

   ```typescript
   // packages/dashboard/src/components/AuthGuard.tsx
   if (!authenticated && pathname !== "/login") {
     router.push("/login"); // ⬅️ Redirect interno
     return;
   }
   ```

3. **Ventajas**:
   - ✅ Todo en un solo deploy
   - ✅ No hay cross-domain redirects
   - ✅ Más simple de mantener
   - ✅ Mejor UX (sin recargas completas)

**Archivos a crear**:

```
packages/dashboard/src/app/
├── login/
│   └── page.tsx          # Nueva página de login
└── signup/
    └── page.tsx          # Nueva página de registro
```

---

### Opción 2: Arquitectura de 2 Repos (Actual)

**Si quieres mantener landing y dashboard separados**:

#### Paso 1: Asegurar que la Landing Page esté deployada

1. Verificar en Vercel Dashboard que el proyecto `aethermind-page` existe
2. Si no existe, deplóyalo desde el repo de landing
3. Verificar que `https://aethermind-page.vercel.app` carga correctamente

#### Paso 2: Configurar variables de entorno en Vercel

**En el proyecto del Dashboard** (`aethermind-agent-os-dashboard`):

```bash
# Vercel Dashboard → Settings → Environment Variables

# Production
NEXT_PUBLIC_LANDING_URL=https://aethermind-page.vercel.app

# Preview (para branches)
NEXT_PUBLIC_LANDING_URL=https://preview-landing.vercel.app

# Development
NEXT_PUBLIC_LANDING_URL=http://localhost:3000
```

#### Paso 3: Modificar Landing Page para aceptar redirects

**En el repo de la landing page**, asegurarse de:

1. Tener página `/login` que funcione
2. Tener página `/signup` que funcione
3. Después del login exitoso, redirigir de vuelta al dashboard:
   ```typescript
   // En la landing, después de login exitoso:
   const dashboardUrl =
     process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001";
   window.location.href = `${dashboardUrl}?token=${jwt}`;
   ```

#### Paso 4: Configurar callback en el Dashboard

**El dashboard debe capturar el token del query param**:

```typescript
// packages/dashboard/src/app/auth/callback/page.tsx (ya existe)
// Captura ?token=xxx y lo guarda en localStorage
```

**Desventajas de esta opción**:

- ⚠️ Más complejo de mantener (2 repos)
- ⚠️ Cross-domain redirects (peor UX)
- ⚠️ Requiere coordinar deploys de 2 proyectos
- ⚠️ Problemas de CORS potenciales

---

### Opción 3: Modo Sin Autenticación (Solo para Testing/Demo)

**Si el dashboard es solo para demos o testing**:

1. Mantener AuthGuard deshabilitado (como está ahora)
2. Agregar advertencia en la UI:

   ```typescript
   // En el layout o navbar
   {
     process.env.NODE_ENV === "production" && (
       <div className="bg-yellow-500 text-black p-2 text-center">
         ⚠️ Demo Mode - No Authentication
       </div>
     );
   }
   ```

3. Limitar acceso con Vercel Access Control
   - Vercel → Settings → Security → Access Control
   - Configurar password protection

**Ventajas**:

- ✅ Muy simple
- ✅ Perfecto para demos

**Desventajas**:

- ❌ No hay autenticación real
- ❌ Cualquiera con el URL puede acceder

---

## 📋 Recomendación Final

### Para PRODUCCIÓN → **Opción 1: Sistema de Autenticación Integrado**

**Plan de implementación**:

1. **Semana 1**: Crear páginas de login/signup en el dashboard
2. **Semana 2**: Migrar lógica de autenticación del backend
3. **Semana 3**: Modificar AuthGuard para usar rutas internas
4. **Semana 4**: Testing y deploy

**Beneficios**:

- ✅ UX superior (no hay redirects cross-domain)
- ✅ Más fácil de mantener
- ✅ Mejor performance
- ✅ Más seguro (no expone tokens en URLs)

### Para TESTING INMEDIATO → **Opción 3: Sin Autenticación**

**Ya implementado** ✅ (commit `7de3ee8`)

**Siguiente paso**:

1. Esperar que Vercel re-deploye automáticamente
2. Verificar que `aethermind-agent-os-dashboard.vercel.app` ahora carga
3. Si funciona, el dashboard será accesible sin autenticación

---

## 🔄 Rollback (Si es necesario)

Si necesitas volver a habilitar AuthGuard:

```bash
git revert 7de3ee8
git push origin main
```

O manualmente en `packages/dashboard/src/app/layout.tsx`:

```typescript
<AuthGuard>  {/* ⬅️ Descomentar */}
  <div className="flex h-screen">
    <Sidebar />
    <main className="flex-1 overflow-y-auto bg-muted/30">
      {children}
    </main>
  </div>
</AuthGuard>  {/* ⬅️ Descomentar */}
```

---

## 🧪 Testing

### Verificar que el fix funcionó:

1. **Esperar que Vercel deploye** (2-5 minutos)

   - Ve a Vercel Dashboard → Deployments
   - Espera que aparezca el commit `7de3ee8`
   - Espera que el estado sea "Ready"

2. **Probar el dashboard**:

   ```
   https://aethermind-agent-os-dashboard.vercel.app
   ```

   **Expected**: ✅ El dashboard carga sin redirigir

3. **Verificar rutas**:

   - `/dashboard` - Debería cargar
   - `/settings` - Debería cargar
   - `/telemetry` - Debería cargar

4. **Verificar consola del navegador**:
   - ✅ No debería haber errores de redirect
   - ✅ No debería aparecer "[AuthGuard] No token found"

---

## 📊 Estado Actual

| Componente          | Estado      | Notas                    |
| ------------------- | ----------- | ------------------------ |
| Dashboard Deploy    | ✅ Working  | Sin AuthGuard            |
| Landing Page        | ❌ 404      | Deployment no encontrado |
| Autenticación       | ⚠️ Disabled | Temporal para testing    |
| API Backend         | ✅ Working  | En Railway               |
| Build del Dashboard | ✅ Passing  | TypeCheck OK             |

---

## 🎯 Próximos Pasos

### Corto Plazo (Esta semana)

1. ✅ **Verificar que el dashboard carga** después del deploy
2. ⚠️ **Decidir estrategia de autenticación**:
   - Opción 1: Integrar login en dashboard (recomendado)
   - Opción 2: Arreglar landing page deployment
   - Opción 3: Mantener sin auth (solo para demos)

### Mediano Plazo (Próximas 2 semanas)

1. **Implementar autenticación permanente** (según opción elegida)
2. **Resolver vulnerabilidades de seguridad** (`pnpm audit fix`)
3. **Agregar SEO básico** (sitemap, robots.txt)
4. **Configurar Sentry** para error tracking

### Largo Plazo (Próximo mes)

1. **Optimizar bundle size** (lazy loading)
2. **Implementar tests E2E** (Playwright/Cypress)
3. **Configurar CI/CD completo**
4. **Documentación de deployment**

---

## ⚠️ IMPORTANTE: Antes de Producción

Cuando estés listo para habilitar autenticación en producción:

```bash
# 1. Descomentar AuthGuard en layout.tsx
# 2. Configurar NEXT_PUBLIC_LANDING_URL en Vercel
# 3. Asegurar que la landing page esté deployada
# 4. Probar flujo completo de login

# O implementar Opción 1 (login integrado)
```

---

**Commit relacionados**:

- `7de3ee8` - Fix: Disable AuthGuard temporarily
- `ca4256d` - Previous state

**Referencias**:

- [AuthGuard.tsx](packages/dashboard/src/components/AuthGuard.tsx)
- [config.ts](packages/dashboard/src/lib/config.ts)
- [layout.tsx](packages/dashboard/src/app/layout.tsx)
