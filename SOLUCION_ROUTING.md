# 🔧 Solución al Problema de Routing en Vercel

**Fecha**: 14 de Enero de 2026, 16:09  
**Estado**: ✅ CAUSA IDENTIFICADA - SOLUCIÓN EN PROGRESO

---

## 🎯 PROBLEMA IDENTIFICADO

### Síntoma Original

- Dashboard deployado en Vercel redirige a la landing page
- URLs de commits individuales dan 404
- URL principal del dashboard inaccesible

### Causa Raíz Encontrada

**PROBLEMA PRINCIPAL**: Conflicto de configuración en Vercel

1. **`vercel.json` en el root** usa configuración obsoleta (Vercel v2):

   ```json
   {
     "version": 2,
     "builds": [...],
     "routes": [...]
   }
   ```

2. **Root Directory en Vercel** está configurado como `packages/dashboard`

3. **Conflicto**: Vercel intenta aplicar AMBAS configuraciones:

   - La del `vercel.json` del root (obsoleta)
   - La del Root Directory setting (correcta)

4. **Variable de entorno problemática**:
   - `NEXT_PUBLIC_LANDING_URL=https://aethermind-page.vercel.app`
   - Esta variable hace que cualquier código que use `LANDING_PAGE_URL` redirija a la landing

---

## ✅ SOLUCIONES APLICADAS

### 1. Limpieza de `.env.local` en Dashboard

**Archivo**: `packages/dashboard/.env.local`

**Cambios**:

- ❌ Removida toda configuración de Sentry (obsoleta)
- ✅ Agregada configuración limpia para desarrollo
- ✅ Comentada `NEXT_PUBLIC_LANDING_URL` (no necesaria localmente)

**Resultado**: Archivo limpio y enfocado solo en desarrollo local

---

## 🔍 ANÁLISIS DE ARCHIVOS CON REDIRECTS

### Archivos que Redirijen a Landing Page

1. **`src/components/AuthGuard.tsx`** (línea 32)

   ```typescript
   window.location.href = LANDING_PAGE_URL;
   ```

   - ✅ **Estado**: DESHABILITADO en `layout.tsx`
   - ⚠️ **Riesgo**: Si se reactiva, causará redirects

2. **`src/lib/auth-utils.ts`** (línea 84)

   ```typescript
   window.location.href = `${LANDING_PAGE_URL}${returnParam}`;
   ```

   - ⚠️ **Riesgo**: Función `redirectToLogin()` aún activa
   - 📝 **Nota**: Solo se llama desde AuthGuard (deshabilitado)

3. **`src/lib/api.ts`** (línea 36)

   ```typescript
   window.location.href = LANDING_PAGE_URL;
   ```

   - ⚠️ **Riesgo**: Se ejecuta en errores 401/403 de API
   - 🔴 **CRÍTICO**: Este podría ejecutarse si el backend rechaza requests

4. **`src/app/auth/callback/page.tsx`** (múltiples líneas)
   ```typescript
   window.location.href = LANDING_PAGE_URL;
   ```
   - ✅ **Estado**: Solo en página de callback OAuth
   - 📝 **Nota**: Comportamiento esperado en errores de auth

---

## 🚨 PROBLEMA CRÍTICO DETECTADO

### `src/lib/api.ts` - Redirect en Errores de API

**Ubicación**: `packages/dashboard/src/lib/api.ts` línea 36

**Comportamiento actual**:

- Cuando la API retorna 401 o 403
- El cliente automáticamente redirige a `LANDING_PAGE_URL`

**Por qué es problemático**:

- Si `NEXT_PUBLIC_LANDING_URL` está configurada en Vercel
- Cualquier error de autenticación causará redirect a la landing
- Esto explica por qué el dashboard redirige incluso con AuthGuard deshabilitado

**Solución necesaria**: Ver sección "Acciones Requeridas" más abajo

---

## 📋 CONFIGURACIÓN ACTUAL DE VERCEL

### Environment Variables

| Variable                  | Valor                                | Uso                 |
| ------------------------- | ------------------------------------ | ------------------- |
| `NEXT_PUBLIC_LANDING_URL` | `https://aethermind-page.vercel.app` | ⚠️ **PROBLEMÁTICO** |
| `NEXT_PUBLIC_API_URL`     | (no informado)                       | ❓ Verificar        |

### Project Settings

- **Root Directory**: `packages/dashboard` ✅ Correcto
- **Framework**: Next.js ✅ Correcto
- **Build Command**: `pnpm build` ✅ Correcto

---

## 🔧 ACCIONES REQUERIDAS

### PRIORIDAD P0 - CRÍTICO

#### 1. Eliminar o Renombrar `vercel.json` del Root

**Opción A - Eliminar** (Recomendado si solo deployás el dashboard):

```bash
# En el root del proyecto
rm vercel.json
```

**Opción B - Renombrar** (Si necesitas guardarlo):

```bash
mv vercel.json vercel.json.backup
```

**Por qué**: La configuración de `builds` y `routes` de Vercel v2 está obsoleta y causa conflictos con el Root Directory setting.

---

#### 2. Eliminar Variable `NEXT_PUBLIC_LANDING_URL` de Vercel

**Pasos en Vercel Dashboard**:

1. Ve a tu proyecto: `aethermind-agent-os-dashboard`
2. **Settings** → **Environment Variables**
3. Busca `NEXT_PUBLIC_LANDING_URL`
4. Click en **⋮** (tres puntos) → **Remove**
5. Confirma la eliminación

**Por qué**: Esta variable hace que el dashboard redirija a la landing page en cualquier error de API.

---

#### 3. Modificar `src/lib/api.ts` - Eliminar Auto-Redirect

Este es el cambio de código más importante:

**Problema**: La función de API client redirige automáticamente en errores 401/403

**Solución**: En lugar de redirigir, debería:

- Lanzar un error que el componente maneje
- O mostrar un mensaje en el dashboard mismo
- O implementar login dentro del dashboard

¿Quieres que aplique este cambio? Te mostraré las opciones.

---

### PRIORIDAD P1 - RECOMENDADO

#### 4. Agregar `NEXT_PUBLIC_API_URL` en Vercel

Si aún no está configurada:

**En Vercel Dashboard**:

```
Settings → Environment Variables → Add New

Name: NEXT_PUBLIC_API_URL
Value: https://aethermindapi-production.up.railway.app
Environment: Production, Preview
```

**Por qué**: Sin esto, el dashboard no puede conectarse al backend.

---

#### 5. Actualizar `.gitignore` para `.env.local`

Asegurar que `.env.local` no se suba a Git:

```bash
# Ya debería estar, pero verificar
echo ".env.local" >> packages/dashboard/.gitignore
```

---

## 🎯 PLAN DE ACCIÓN PASO A PASO

### Ahora Mismo (Local)

- [x] ✅ Limpiar `packages/dashboard/.env.local`
- [ ] ⏳ Decidir qué hacer con `src/lib/api.ts` (ver opciones abajo)
- [ ] ⏳ Eliminar o renombrar `vercel.json` del root

### En Vercel Dashboard (Manual)

- [ ] ⏳ Eliminar variable `NEXT_PUBLIC_LANDING_URL`
- [ ] ⏳ Agregar variable `NEXT_PUBLIC_API_URL` (si falta)
- [ ] ⏳ Redeploy del proyecto

### Verificación

- [ ] ⏳ Esperar nuevo deployment (2-5 min)
- [ ] ⏳ Probar URL del dashboard
- [ ] ⏳ Verificar que NO redirige a landing
- [ ] ⏳ Probar navegación entre páginas
- [ ] ⏳ Verificar consola del navegador

---

## 🔀 OPCIONES PARA `src/lib/api.ts`

Te doy 3 opciones para manejar los errores de autenticación:

### Opción 1: Mostrar Error en Dashboard (Recomendado)

**Ventaja**: El usuario ve el error pero permanece en el dashboard
**Desventaja**: Requiere UI para mostrar errores

```typescript
// En lugar de:
window.location.href = LANDING_PAGE_URL;

// Hacer:
throw new Error("Unauthorized - Please login");
```

### Opción 2: Login Interno en Dashboard

**Ventaja**: Experiencia de usuario completa
**Desventaja**: Requiere implementar páginas de login en el dashboard

```typescript
// Redirigir a página de login DENTRO del dashboard
window.location.href = "/login";
```

### Opción 3: Comentar el Redirect (Temporal)

**Ventaja**: Rápido para testing
**Desventaja**: No hay manejo de errores de auth

```typescript
// Comentar el redirect
// window.location.href = LANDING_PAGE_URL;
console.error("API Error: Unauthorized");
```

**¿Cuál prefieres que implemente?**

---

## 📊 VERIFICACIÓN POST-FIX

### Checklist de Verificación

1. **Build exitoso en Vercel**

   - [ ] Sin errores en build logs
   - [ ] Sin warnings de configuración

2. **Dashboard carga correctamente**

   - [ ] URL principal funciona
   - [ ] No redirige a landing page
   - [ ] UI se muestra correctamente

3. **Navegación funciona**

   - [ ] `/dashboard` carga
   - [ ] `/settings` carga
   - [ ] Sidebar navigation funciona

4. **Sin errores en consola**
   - [ ] No hay errores de redirect
   - [ ] No hay errores 404
   - [ ] APIs pueden fallar (esperado sin backend) pero no causan redirect

### URLs para Probar

- Primary: `https://aethermind-agent-os-dashboard.vercel.app`
- Deployment specific: `https://aethermind-agent-os-dashboard-[hash].vercel.app`

---

## 📝 RESUMEN

### Causa del Problema

1. **`vercel.json` obsoleto** causando conflictos de configuración
2. **`NEXT_PUBLIC_LANDING_URL`** en Vercel redirecting en errores de API
3. **`src/lib/api.ts`** auto-redirige en errores 401/403

### Solución

1. ✅ Limpiar `.env.local` (HECHO)
2. ⏳ Eliminar `vercel.json` del root
3. ⏳ Eliminar `NEXT_PUBLIC_LANDING_URL` de Vercel
4. ⏳ Modificar `src/lib/api.ts` para no auto-redirigir
5. ⏳ Redeploy en Vercel

### Siguiente Acción

**Esperando tu decisión sobre**:

- ¿Elimino el `vercel.json` del root?
- ¿Qué opción prefieres para `src/lib/api.ts`? (1, 2, o 3)

Una vez que decidas, aplico los cambios y pusheamos a GitHub para que Vercel redeploy automáticamente.

---

**Tiempo estimado hasta dashboard funcional**: ~10 minutos después de aplicar cambios
