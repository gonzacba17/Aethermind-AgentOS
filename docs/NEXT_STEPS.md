# 🚀 Próximos Pasos - Quick Start

> **Objetivo:** Comenzar la implementación de la Fase 1 del Dashboard

---

## Documentos Creados

| Documento                  | Ubicación                               | Propósito                          |
| -------------------------- | --------------------------------------- | ---------------------------------- |
| **Plan de Implementación** | `docs/DASHBOARD_IMPLEMENTATION_PLAN.md` | Roadmap completo de 6 semanas      |
| **Checklist**              | `docs/DASHBOARD_CHECKLIST.md`           | Seguimiento de tareas              |
| **API Specification**      | `docs/api/DASHBOARD_API_SPEC.md`        | Endpoints disponibles y necesarios |

---

## Comenzar Implementación

### Paso 1: Instalar Dependencias

```powershell
cd packages/dashboard
pnpm add @tanstack/react-query@^5 zustand@^4 @tanstack/react-virtual@^3 date-fns@^3
pnpm add -D @tanstack/react-query-devtools@^5
```

### Paso 2: Crear Estructura de Carpetas

```powershell
# Crear directorios necesarios
mkdir -p src/store
mkdir -p src/hooks/api
mkdir -p src/providers
mkdir -p src/components/ui/skeleton
mkdir -p src/components/agents
mkdir -p src/components/traces
mkdir -p src/components/logs
mkdir -p src/components/costs
```

### Paso 3: Primera Tarea - React Query Provider

Crear archivo `src/lib/query-client.ts`:

```typescript
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 segundos
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

Crear archivo `src/providers/QueryProvider.tsx`:

```typescript
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/query-client';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
```

Actualizar `src/app/layout.tsx` para incluir el provider.

---

## Orden de Implementación Recomendado

### Esta Semana (Fase 1.1 - 1.4)

1. ✅ **Documentación creada**
2. ⏳ Instalar dependencias
3. ⏳ Configurar React Query Provider
4. ⏳ Crear Zustand stores básicos
5. ⏳ Crear hooks de API (`useAgents`, `useCosts`, etc.)

### Próxima Semana (Fase 1.5 - 1.8)

6. ⏳ Implementar WebSocket hook
7. ⏳ Crear componentes Skeleton
8. ⏳ Conectar Dashboard a datos reales
9. ⏳ Testing e integración

---

## Comandos Útiles

```powershell
# Desarrollo del dashboard
cd packages/dashboard
pnpm dev

# Desarrollo de la API
cd apps/api
pnpm dev

# Ejecutar ambos (desde raíz)
pnpm dev

# Tests
pnpm test

# Build
pnpm build
```

---

## URLs de Desarrollo

| Servicio  | URL                               |
| --------- | --------------------------------- |
| Dashboard | http://localhost:3000             |
| API       | http://localhost:3001             |
| WebSocket | ws://localhost:3001/ws            |
| API Docs  | http://localhost:3001/api/openapi |
| Health    | http://localhost:3001/health      |

---

## ¿Listo para empezar?

Dime **"Comenzar Fase 1"** y empezaré a implementar las dependencias y la infraestructura base, o indica si prefieres empezar por una tarea específica del checklist.

También puedes preguntar:

- "Mostrar detalle de la Tarea X"
- "Implementar useAgents hook"
- "Crear el Zustand store"
- "Conectar el Dashboard"
