# 🔄 Plan de Migración del Dashboard

**Fecha**: 14 de Enero de 2026  
**Fuente**: `Nuevo dash/` (generado con v0)  
**Destino**: `packages/dashboard/`

---

## 📊 Análisis del Nuevo Dashboard

### Estructura Detectada

```
Nuevo dash/
├── app/
│   ├── dashboard/
│   │   └── page.tsx          # Página principal del dashboard
│   ├── globals.css            # Estilos globales (Tailwind v4)
│   ├── layout.tsx             # Layout raíz con Analytics
│   └── page.tsx               # Home que redirige a /dashboard
├── components/
│   ├── dashboard/             # 7 componentes específicos
│   │   ├── active-agents.tsx
│   │   ├── costs-breakdown.tsx
│   │   ├── header.tsx
│   │   ├── logs-panel.tsx
│   │   ├── sidebar.tsx
│   │   ├── stats-cards.tsx
│   │   └── traces-chart.tsx
│   ├── ui/                    # ~57 componentes de shadcn/ui
│   └── theme-provider.tsx
├── hooks/
│   ├── use-mobile.ts
│   └── use-toast.ts
├── lib/
│   └── utils.ts               # Utilities (cn, etc.)
├── public/                    # Imágenes y assets
├── package.json               # Next.js 16 + React 19
├── next.config.mjs            # Config básica
└── tsconfig.json
```

### Características del Nuevo Dashboard

✅ **Next.js 16.0.10** + React 19  
✅ **Tailwind CSS v4** (más moderno)  
✅ **shadcn/ui** completo (~57 componentes)  
✅ **Vercel Analytics** integrado  
✅ **Dark mode** con next-themes  
✅ **Recharts** para gráficos  
✅ **Lucide icons**  
✅ **TypeScript** configurado

---

## ⚠️ Diferencias con el Dashboard Actual

### Dashboard Actual (packages/dashboard)

- Next.js 14.2.35
- React 18.3.1
- Tailwind CSS v3
- Usa API client personalizado (`lib/api.ts`)
- AuthGuard implementation
- Integración con backend Railway

### Nuevo Dashboard (Nuevo dash)

- Next.js 16 + React 19
- Tailwind v4
- **NO tiene integración con API** (mock data)
- **NO tiene AuthGuard**
- **NO tiene config.ts**

---

## 🎯 Estrategia de Migración

### Opción 1: Reemplazo Total (Recomendado)

1. Copiar toda la estructura del nuevo dashboard
2. **Mantener/Agregar** del viejo:
   - `lib/api.ts` (API client)
   - `lib/config.ts` (configuración)
   - `lib/auth-utils.ts` (autenticación)
3. Adaptar componentes del dashboard nuevo para usar la API real
4. Actualizar `package.json` con dependencias necesarias
5. Migrar `next.config.js` a `.mjs` con rewrites de API

### Opción 2: Migración Gradual

1. Mantener estructura actual
2. Copiar solo componentes UI necesarios
3. Adaptar estilos gradualmente

---

## ✅ RECOMENDACIÓN: Opción 1

**Por qué**:

- Dashboard nuevo es más moderno y completo
- Mejor UX y diseño
- Más componentes reutilizables
- Next.js 16 tiene mejor performance
- Tailwind v4 más eficiente

---

## 📋 Plan de Ejecución

### Fase 1: Preparación

1. ✅ Crear backup del dashboard actual (packages/dashboard-old)
2. ✅ Analizar estructura del nuevo dashboard
3. ⏳ Identificar archivos a preservar del viejo

### Fase 2: Copia Base

1. Copiar toda la estructura de `Nuevo dash/` → `packages/dashboard/src/`
2. Mantener archivos de configuración del monorepo:
   - `packages/dashboard/package.json` (actualizar deps)
   - `packages/dashboard/tsconfig.json` (mantener references)
   - `packages/dashboard/vercel.json` (actual)

### Fase 3: Integración con Backend

1. Copiar del dashboard viejo:

   - `lib/api.ts` → Mantener API client
   - `lib/config.ts` → Variables de entorno
   - `lib/auth-utils.ts` → Funciones de auth

2. Adaptar componentes del nuevo dashboard:

   - `components/dashboard/active-agents.tsx` → Usar `fetchAgents()`
   - `components/dashboard/logs-panel.tsx` → Usar `fetchLogs()`
   - `components/dashboard/stats-cards.tsx` → Usar API real
   - `components/dashboard/costs-breakdown.tsx` → Usar `fetchCostSummary()`
   - `components/dashboard/traces-chart.tsx` → Usar `fetchTraces()`

3. Actualizar `next.config.mjs` → Agregar API rewrites

### Fase 4: Configuración

1. Actualizar `package.json`:

   - Mantener nombre: `@aethermind/dashboard`
   - Actualizar scripts de build
   - Mergear dependencias

2. Crear `.env.local.example`:

   ```bash
   NEXT_PUBLIC_API_URL=
   ```

3. Configurar `next.config.mjs`:
   ```js
   rewrites() {
     return [
       {
         source: '/api/:path*',
         destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`
       }
     ]
   }
   ```

### Fase 5: Testing

1. Verificar build: `pnpm build`
2. Probar localmente: `pnpm dev`
3. Verificar API integration
4. Test de navegación

### Fase 6: Deploy

1. Commit cambios
2. Push a GitHub
3. Vercel auto-deploy
4. Verificar en producción

---

## 🔧 Archivos a Preservar del Dashboard Viejo

**CRÍTICO - No perder**:

- `src/lib/api.ts` - API client completo
- `src/lib/config.ts` - Variables de entorno
- `src/lib/auth-utils.ts` - Funciones de autenticación
- `.env.local` - Configuración local

**Opcional - Evaluar**:

- `src/components/AuthGuard.tsx` - Si queremos auth
- Algunos componentes específicos que puedan servir

---

## 📝 Checklist de Migración

### Pre-migración

- [ ] Backup del dashboard actual creado
- [ ] Análisis de estructura completado
- [ ] Plan de migración aprobado

### Migración

- [ ] Estructura base copiada
- [ ] API integration files copiados
- [ ] Componentes adaptados para usar API
- [ ] next.config actualizado
- [ ] package.json actualizado
- [ ] .env.local configurado

### Post-migración

- [ ] Build exitoso
- [ ] Dev server funciona
- [ ] API calls funcionan
- [ ] Navegación OK
- [ ] Estilos correctos
- [ ] Deploy a Vercel OK

---

## ⏭️ SIGUIENTE PASO

**¿Procedo con la migración Opción 1?**

Esto implicará:

1. Renombrar `packages/dashboard` → `packages/dashboard-old`
2. Copiar `Nuevo dash/` → `packages/dashboard/src/`
3. Adaptar configuraciones
4. Integrar con API backend
5. Testing
6. Deploy

**Tiempo estimado**: 20-30 minutos

**¿Empezamos?** 🚀
