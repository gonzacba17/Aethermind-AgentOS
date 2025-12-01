# Checklist de Configuración de Vercel - Paso a Paso

Esta guía te llevará por la configuración EXACTA de Vercel para desplegar el dashboard de AethermindOS.

---

## 📋 PARTE 1: Importar Proyecto desde GitHub

### ✅ Paso 1.1: Crear Nuevo Proyecto

- [ ] Ve a https://vercel.com/dashboard
- [ ] Click en **"Add New..."** → **"Project"**
- [ ] Si es tu primera vez, click en **"Import Git Repository"**

### ✅ Paso 1.2: Conectar GitHub

- [ ] Click en **"Continue with GitHub"** (si no está conectado)
- [ ] Autoriza Vercel a acceder a tu GitHub
- [ ] En la lista de repositorios, busca: `Aethermind-AgentOS`
- [ ] Click en **"Import"** junto al repositorio

**Resultado:** Vercel te llevará a la página de configuración del proyecto

---

## 📋 PARTE 2: Configurar el Proyecto

### ✅ Paso 2.1: Framework Preset

- [ ] Vercel debería detectar automáticamente **"Next.js"**
- [ ] Si no lo detecta, selecciona manualmente: **Framework Preset** → **"Next.js"**

### ✅ Paso 2.2: Root Directory

**IMPORTANTE:** Vercel necesita saber que el dashboard está en `packages/dashboard`

- [ ] Click en **"Edit"** junto a **"Root Directory"**
- [ ] En el campo que aparece, escribe: `packages/dashboard`
- [ ] Vercel mostrará una vista previa de los archivos en ese directorio
- [ ] Verifica que veas `package.json`, `next.config.js`, etc.

### ✅ Paso 2.3: Build and Output Settings

#### Build Command

- [ ] Click en **"Override"** junto a **"Build Command"**
- [ ] En el campo que aparece, escribe:
  ```bash
  cd ../.. && pnpm turbo run build --filter=@aethermind/dashboard
  ```

**¿Por qué este comando?**

- `cd ../..` → Vuelve a la raíz del monorepo
- `pnpm turbo run build` → Usa Turbo para el build
- `--filter=@aethermind/dashboard` → Solo construye el dashboard

#### Output Directory

- [ ] **NO** hagas override del Output Directory
- [ ] Déjalo en el valor por defecto: `.next`
- [ ] Vercel lo detectará automáticamente

#### Install Command

- [ ] Click en **"Override"** junto a **"Install Command"**
- [ ] En el campo que aparece, escribe:
  ```bash
  cd ../.. && pnpm install --frozen-lockfile
  ```

**¿Por qué este comando?**

- Instala dependencias desde la raíz del monorepo
- `--frozen-lockfile` asegura que use exactamente las versiones del `pnpm-lock.yaml`

---

## 📋 PARTE 3: Configurar Variables de Entorno

### ✅ Paso 3.1: Agregar Variables de Entorno

**IMPORTANTE:** Necesitas la URL de tu API en Railway. Si aún no la tienes:

1. Ve a Railway → Tu aplicación → Settings → Domains
2. Copia la URL (ej: `https://your-app-production.up.railway.app`)

En Vercel:

- [ ] Scroll hasta la sección **"Environment Variables"**
- [ ] Click en el primer campo **"Key"** y escribe: `NEXT_PUBLIC_API_URL`
- [ ] En el campo **"Value"**, pega la URL de tu API de Railway:
  ```
  https://your-app-production.up.railway.app
  ```
  **O si configuraste dominio personalizado:**
  ```
  https://app.tudominio.com
  ```

### ✅ Paso 3.2: Seleccionar Ambientes

- [ ] Asegúrate de que estén seleccionados los 3 ambientes:
  - [x] Production
  - [x] Preview
  - [x] Development

### ✅ Paso 3.3: Agregar Variable (Confirmar)

- [ ] Click en **"Add"**

**Resultado:** Deberías ver la variable `NEXT_PUBLIC_API_URL` en la lista

---

## 📋 PARTE 4: Deploy Inicial

### ✅ Paso 4.1: Iniciar Deploy

- [ ] Revisa que todo esté configurado:

  - Framework: **Next.js** ✓
  - Root Directory: **packages/dashboard** ✓
  - Build Command: **cd ../.. && pnpm turbo run build --filter=@aethermind/dashboard** ✓
  - Install Command: **cd ../.. && pnpm install --frozen-lockfile** ✓
  - Environment Variables: **NEXT_PUBLIC_API_URL** configurada ✓

- [ ] Click en **"Deploy"**

### ✅ Paso 4.2: Esperar el Build

- [ ] Vercel comenzará a construir tu proyecto
- [ ] Puedes ver el progreso en tiempo real
- [ ] Tiempo estimado: **2-4 minutos**

**Fases del build que verás:**

1. ⏳ Cloning repository
2. ⏳ Installing dependencies (puede tardar 1-2 min)
3. ⏳ Building (1-2 min)
4. ⏳ Uploading build outputs
5. ✅ Deployment ready

### ✅ Paso 4.3: Verificar Deploy Exitoso

- [ ] Cuando termine, verás: **"Deployment Ready"** con confeti 🎉
- [ ] Vercel te mostrará una URL de preview (ej: `https://aethermind-agentos-xxx.vercel.app`)
- [ ] Click en **"Visit"** o en la imagen de preview

**Deberías ver:** Tu landing page cargando correctamente

---

## 📋 PARTE 5: Configurar Dominio Personalizado

### ✅ Paso 5.1: Acceder a Configuración de Dominios

- [ ] En el dashboard de Vercel, ve a tu proyecto
- [ ] Click en **"Settings"** (arriba)
- [ ] En el menú lateral, click en **"Domains"**

### ✅ Paso 5.2: Agregar Dominio Principal

**Si tienes un dominio propio:**

- [ ] En el campo "Domain", escribe: `tudominio.com`
- [ ] Click en **"Add"**
- [ ] Vercel te mostrará la configuración DNS necesaria

### ✅ Paso 5.3: Configurar DNS en tu Proveedor

**Opción A: Usar Nameservers de Vercel (Recomendado)**

Vercel te dará nameservers como:

```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

En tu proveedor de dominio (GoDaddy, Namecheap, etc.):

- [ ] Ve a configuración de DNS/Nameservers
- [ ] Cambia los nameservers a los que Vercel te proporcionó
- [ ] Guarda los cambios
- [ ] **Espera 24-48 horas** para propagación completa

**Opción B: Usar Registros A (Más rápido)**

Si prefieres no cambiar nameservers:

- [ ] En tu proveedor de DNS, agrega estos registros:

**Para el dominio raíz (`tudominio.com`):**

```
Type: A
Name: @
Value: 76.76.21.21
TTL: 3600
```

**Para www (`www.tudominio.com`):**

```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600
```

- [ ] Guarda los cambios
- [ ] **Espera 5-30 minutos** para propagación

### ✅ Paso 5.4: Agregar Subdominio www (Opcional)

De vuelta en Vercel:

- [ ] En la misma página de Domains, agrega: `www.tudominio.com`
- [ ] Click en **"Add"**
- [ ] Vercel configurará automáticamente el redirect de www → dominio principal

### ✅ Paso 5.5: Verificar Dominio

- [ ] En Vercel, espera a que los dominios muestren un ✅ verde
- [ ] Si ves "Invalid Configuration", espera unos minutos más
- [ ] Vercel verificará automáticamente la configuración DNS

**Resultado:** Deberías ver:

- ✅ `tudominio.com` - Valid Configuration
- ✅ `www.tudominio.com` - Valid Configuration (Redirect)

---

## 📋 PARTE 6: Configurar HTTPS y Certificados

### ✅ Paso 6.1: Verificar SSL

- [ ] Vercel genera certificados SSL automáticamente
- [ ] En Settings → Domains, verifica que veas un candado 🔒 junto a tus dominios
- [ ] Esto puede tardar 5-10 minutos después de configurar DNS

### ✅ Paso 6.2: Forzar HTTPS (Opcional pero Recomendado)

- [ ] En Settings → Domains, busca la opción **"Force HTTPS"**
- [ ] Actívala (toggle a ON)
- [ ] Esto redirigirá automáticamente HTTP → HTTPS

---

## 📋 PARTE 7: Actualizar CORS en Railway

**IMPORTANTE:** Ahora que tienes tu dominio de Vercel, necesitas actualizar Railway.

### ✅ Paso 7.1: Obtener URLs de Vercel

Anota todas tus URLs de Vercel:

- URL de producción: `https://tudominio.com`
- URL de Vercel: `https://aethermind-agentos-xxx.vercel.app`
- URL www: `https://www.tudominio.com`

### ✅ Paso 7.2: Actualizar Variables en Railway

- [ ] Ve a Railway → Tu aplicación → Variables
- [ ] Actualiza `CORS_ORIGINS`:
  ```
  CORS_ORIGINS=https://tudominio.com,https://www.tudominio.com,https://aethermind-agentos-xxx.vercel.app
  ```
- [ ] Actualiza `ALLOWED_ORIGINS` con los mismos valores
- [ ] Click en **"Update Variables"**
- [ ] Railway re-deployará automáticamente (1-2 minutos)

---

## 📋 PARTE 8: Verificar el Despliegue

### ✅ Paso 8.1: Verificar Landing Page

- [ ] Abre tu navegador
- [ ] Ve a: `https://tudominio.com` (o tu URL de Vercel)
- [ ] Verifica que la página cargue correctamente
- [ ] Verifica que no haya errores en la consola (F12 → Console)

### ✅ Paso 8.2: Verificar Conexión con API

- [ ] Abre la consola del navegador (F12)
- [ ] Ve a la pestaña **"Network"**
- [ ] Recarga la página
- [ ] Si tu dashboard hace llamadas al API, verifica que:
  - Las requests vayan a `https://app.tudominio.com` (tu API de Railway)
  - No haya errores CORS
  - Las responses sean exitosas (código 200)

### ✅ Paso 8.3: Verificar HTTPS

- [ ] Verifica que veas el candado 🔒 en la barra de direcciones
- [ ] Click en el candado → Debería decir "Connection is secure"

---

## 📋 PARTE 9: Configurar Auto-Deploy

### ✅ Paso 9.1: Verificar Git Integration

- [ ] Ve a Settings → Git
- [ ] Verifica que esté conectado a tu repositorio de GitHub
- [ ] Verifica la rama de producción: **main** (o **master**)

### ✅ Paso 9.2: Configurar Deploy Hooks (Opcional)

Por defecto, Vercel hace auto-deploy en cada push a `main`. Si quieres más control:

- [ ] Ve a Settings → Git → Deploy Hooks
- [ ] Puedes crear hooks personalizados si necesitas
- [ ] Para la mayoría de casos, la configuración por defecto es suficiente

---

## 📋 PARTE 10: Optimizaciones (Opcional)

### ✅ Paso 10.1: Configurar Analytics

- [ ] Ve a tu proyecto en Vercel
- [ ] Click en **"Analytics"** en el menú superior
- [ ] Click en **"Enable Analytics"**
- [ ] Esto te dará métricas de rendimiento y tráfico

### ✅ Paso 10.2: Configurar Speed Insights (Requiere Plan Pro)

- [ ] Ve a Settings → Speed Insights
- [ ] Click en **"Enable"**
- [ ] Esto te dará métricas de Core Web Vitals

---

## 📋 RESUMEN DE CONFIGURACIÓN

### Configuración del Proyecto

- [x] Framework: **Next.js**
- [x] Root Directory: **packages/dashboard**
- [x] Build Command: **cd ../.. && pnpm turbo run build --filter=@aethermind/dashboard**
- [x] Install Command: **cd ../.. && pnpm install --frozen-lockfile**
- [x] Output Directory: **.next** (por defecto)

### Variables de Entorno

- [x] `NEXT_PUBLIC_API_URL` = URL de Railway

### Dominios Configurados

- [x] Dominio principal: `tudominio.com`
- [x] Subdominio www: `www.tudominio.com`
- [x] SSL/HTTPS: Habilitado automáticamente
- [x] Force HTTPS: Activado

### Integraciones

- [x] GitHub: Conectado
- [x] Auto-deploy: Habilitado en `main`
- [x] CORS: Actualizado en Railway

---

## 🎯 Siguiente Paso

### Verificación Final

1. **Test de la Landing Page:**

   - [ ] Abre `https://tudominio.com`
   - [ ] Verifica que cargue sin errores
   - [ ] Verifica que HTTPS funcione

2. **Test de Conexión API:**

   - [ ] Si tu dashboard hace llamadas al API, verifica que funcionen
   - [ ] Abre la consola (F12) y verifica que no haya errores CORS

3. **Test de Auto-Deploy:**
   - [ ] Haz un cambio pequeño en el código
   - [ ] Push a `main`
   - [ ] Verifica que Vercel haga auto-deploy

---

## 🔧 Troubleshooting Vercel

### Error: "Build failed - Cannot find module"

**Causa:** Dependencias no instaladas correctamente

**Solución:**

- [ ] Verifica que el Install Command sea: `cd ../.. && pnpm install --frozen-lockfile`
- [ ] Verifica que `pnpm-lock.yaml` esté en el repositorio
- [ ] Re-deploya

### Error: "Build failed - Turbo not found"

**Causa:** Turbo no está instalado

**Solución:**

- [ ] Verifica que `turbo` esté en `devDependencies` del `package.json` raíz
- [ ] Verifica el Install Command
- [ ] Re-deploya

### Error: "404 - Page not found"

**Causa:** Root Directory incorrecto

**Solución:**

- [ ] Ve a Settings → General
- [ ] Verifica que Root Directory sea: `packages/dashboard`
- [ ] Re-deploya

### Error CORS en el navegador

**Causa:** Railway no tiene configurado el dominio de Vercel

**Solución:**

- [ ] Ve a Railway → Variables
- [ ] Actualiza `CORS_ORIGINS` con todas las URLs de Vercel
- [ ] Espera a que Railway re-deploye

### Dominio no se verifica

**Causa:** DNS no propagado o mal configurado

**Solución:**

- [ ] Verifica la configuración DNS en tu proveedor
- [ ] Usa https://dnschecker.org para verificar propagación
- [ ] Espera 5-30 minutos (o 24-48h si cambiaste nameservers)

### Build muy lento

**Causa:** Primera vez instalando dependencias

**Solución:**

- [ ] Es normal, puede tardar 3-5 minutos la primera vez
- [ ] Builds subsecuentes serán más rápidos (1-2 minutos)

---

## 📊 Valores de Configuración - Referencia Rápida

```yaml
Framework: Next.js
Root Directory: packages/dashboard
Build Command: cd ../.. && pnpm turbo run build --filter=@aethermind/dashboard
Install Command: cd ../.. && pnpm install --frozen-lockfile
Output Directory: .next (default)

Environment Variables:
  NEXT_PUBLIC_API_URL: https://app.tudominio.com

Domains:
  - tudominio.com (A → 76.76.21.21)
  - www.tudominio.com (CNAME → cname.vercel-dns.com)

Git:
  Branch: main
  Auto-deploy: Enabled
```

---

¡Configuración de Vercel completada! 🎉

Tu aplicación ahora está desplegada en:

- **Frontend (Vercel):** https://tudominio.com
- **Backend (Railway):** https://app.tudominio.com
