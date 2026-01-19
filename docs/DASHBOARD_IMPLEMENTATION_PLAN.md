# 🚀 Aethermind AgentOS Dashboard - Plan de Implementación Completo

> **Versión:** 1.0.0  
> **Fecha:** 2026-01-19  
> **Estado:** En Progreso - Fase 1  
> **Estimación Total:** 6 semanas

---

## 📋 Índice

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Estado Actual del Proyecto](#estado-actual-del-proyecto)
3. [Arquitectura del Sistema](#arquitectura-del-sistema)
4. [Fase 1: MVP - Sistema de Datos Reales](#fase-1-mvp---sistema-de-datos-reales)
5. [Fase 2: Features Core](#fase-2-features-core)
6. [Fase 3: Funcionalidades Avanzadas](#fase-3-funcionalidades-avanzadas)
7. [Especificaciones Técnicas por Sección](#especificaciones-técnicas-por-sección)
8. [Criterios de Aceptación](#criterios-de-aceptación)
9. [Dependencias y Riesgos](#dependencias-y-riesgos)

---

## Resumen Ejecutivo

### Objetivo Principal

Transformar el dashboard de Aethermind AgentOS de una demo con datos ficticios a una plataforma FinOps completamente funcional que permita a empresas monitorear, controlar y optimizar sus gastos en APIs de IA (OpenAI, Anthropic, etc.) en tiempo real.

### Métricas de Éxito

| Métrica                              | Objetivo                 |
| ------------------------------------ | ------------------------ |
| Tiempo de carga inicial              | < 2 segundos             |
| Tiempo de respuesta de interacciones | < 200ms                  |
| Tasa de errores                      | < 0.1%                   |
| Cobertura de tests                   | > 80%                    |
| Datos actualizados en tiempo real    | < 5 segundos de latencia |

---

## Estado Actual del Proyecto

### ✅ Componentes Existentes y Funcionales

#### Backend (apps/api)

```
✅ Express.js server con endpoints REST
✅ PostgreSQL + Drizzle ORM
✅ WebSocket (Socket.io) para tiempo real
✅ Autenticación JWT + Google OAuth
✅ Sistema de roles y permisos
✅ Rate limiting y seguridad
✅ Redis cache (opcional)
✅ Stripe integration
```

#### Endpoints API Disponibles

| Endpoint                        | Método    | Descripción             | Estado |
| ------------------------------- | --------- | ----------------------- | ------ |
| `/api/agents`                   | GET       | Lista de agentes        | ✅     |
| `/api/agents`                   | POST      | Crear agente            | ✅     |
| `/api/agents/:id`               | GET       | Detalle de agente       | ✅     |
| `/api/agents/:id`               | DELETE    | Eliminar agente         | ✅     |
| `/api/agents/:id/execute`       | POST      | Ejecutar agente         | ✅     |
| `/api/agents/:id/logs`          | GET       | Logs del agente         | ✅     |
| `/api/traces`                   | GET       | Lista de traces         | ✅     |
| `/api/traces/:id`               | GET       | Detalle de trace        | ✅     |
| `/api/logs`                     | GET       | Sistema de logs         | ✅     |
| `/api/costs`                    | GET       | Historial de costos     | ✅     |
| `/api/costs/summary`            | GET       | Resumen de costos       | ✅     |
| `/api/costs/budget`             | GET       | Estado del presupuesto  | ✅     |
| `/api/budgets`                  | GET/POST  | Gestión de presupuestos | ✅     |
| `/api/workflows`                | GET/POST  | Workflows               | ✅     |
| `/api/workflows/:name/estimate` | POST      | Estimación de costos    | ✅     |
| `/health`                       | GET       | Estado del sistema      | ✅     |
| `/ws`                           | WebSocket | Eventos en tiempo real  | ✅     |

#### Frontend (packages/dashboard)

```
✅ Next.js 14+ con App Router
✅ Tailwind CSS + shadcn/ui components
✅ Páginas UI creadas (Home, Dashboard, Agents, Traces, Logs, Costs)
✅ API client básico (lib/api.ts)
✅ Sistema de autenticación (AuthGuard)
✅ Tema oscuro/claro
```

### ⚠️ Brechas Identificadas

| Área                       | Problema                                            | Prioridad  |
| -------------------------- | --------------------------------------------------- | ---------- |
| **Datos Mock**             | Todas las páginas usan datos ficticios hardcodeados | 🔴 Crítica |
| **Sin Fetching**           | No hay hooks para obtener datos de la API           | 🔴 Crítica |
| **Sin WebSocket**          | Dashboard no escucha eventos en tiempo real         | 🔴 Crítica |
| **Botones No Funcionales** | Acciones muestran toast pero no llaman API          | 🟡 Alta    |
| **Sin Loading States**     | No hay indicadores de carga                         | 🟡 Alta    |
| **Sin Error Handling**     | No hay manejo de errores en UI                      | 🟡 Alta    |
| **Modales Incompletos**    | Forms no envían datos al backend                    | 🟡 Alta    |
| **Sin Paginación**         | Listas no tienen paginación                         | 🟢 Media   |
| **Sin Virtualización**     | Listas largas pueden causar lag                     | 🟢 Media   |

---

## Arquitectura del Sistema

### Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Pages     │  │ Components  │  │    State Management     │  │
│  │             │  │             │  │ ┌─────────┐ ┌─────────┐ │  │
│  │ /home       │  │ StatsCards  │  │ │ Zustand │ │ React   │ │  │
│  │ /dashboard  │  │ ActiveAgents│  │ │ Store   │ │ Query   │ │  │
│  │ /agents     │  │ LogsPanel   │  │ └─────────┘ └─────────┘ │  │
│  │ /traces     │  │ TracesChart │  └─────────────────────────┘  │
│  │ /logs       │  │ CostsBreak  │         │           │         │
│  │ /costs      │  │ + Modals    │         ▼           ▼         │
│  └─────────────┘  └─────────────┘  ┌─────────────────────────┐  │
│                                     │      Hooks Layer        │  │
│                                     │ useAgents, useCosts,    │  │
│                                     │ useTraces, useLogs,     │  │
│                                     │ useWebSocket            │  │
│                                     └───────────┬─────────────┘  │
│                                                 │                │
│                                     ┌───────────▼─────────────┐  │
│                                     │     API Client          │  │
│                                     │     lib/api.ts          │  │
│                                     └───────────┬─────────────┘  │
└─────────────────────────────────────────────────┼────────────────┘
                                                  │
                          ┌───────────────────────┴────────────────┐
                          │              NETWORK                    │
                          │    HTTP REST + WebSocket (wss://)      │
                          └───────────────────────┬────────────────┘
                                                  │
┌─────────────────────────────────────────────────┼────────────────┐
│                        BACKEND (Express)         │                │
├─────────────────────────────────────────────────┼────────────────┤
│  ┌─────────────────────────────────────────────▼──────────────┐  │
│  │                    API Routes Layer                         │  │
│  │   /agents  /traces  /logs  /costs  /budgets  /workflows    │  │
│  └─────────────────────────────────────────────┬──────────────┘  │
│                                                 │                │
│  ┌─────────────────────────────────────────────▼──────────────┐  │
│  │                    Services Layer                           │  │
│  │  AgentService  BudgetService  AlertService  CostService    │  │
│  └─────────────────────────────────────────────┬──────────────┘  │
│                                                 │                │
│  ┌─────────────────────────────────────────────▼──────────────┐  │
│  │                    Data Layer                               │  │
│  │            Drizzle ORM + PostgreSQL                        │  │
│  │            Redis Cache (optional)                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                 External Integrations                       │  │
│  │   OpenAI API  │  Anthropic API  │  Stripe  │  SendGrid    │  │
│  └────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### Stack Tecnológico Final

| Capa                   | Tecnología            | Justificación                   |
| ---------------------- | --------------------- | ------------------------------- |
| **Frontend Framework** | Next.js 14+           | App Router, SSR, optimizaciones |
| **State Management**   | Zustand + React Query | Simple, performante, caching    |
| **UI Components**      | shadcn/ui + Radix     | Accesible, personalizable       |
| **Styling**            | Tailwind CSS          | Utility-first, rápido           |
| **Charts**             | Recharts              | Declarativo, responsive         |
| **Backend Framework**  | Express.js            | Maduro, extensible              |
| **ORM**                | Drizzle               | Type-safe, performante          |
| **Database**           | PostgreSQL            | Confiable, escalable            |
| **Cache**              | Redis                 | Sesiones, rate limiting         |
| **Real-time**          | WebSocket (ws)        | Nativo, eficiente               |

---

## Fase 1: MVP - Sistema de Datos Reales

**Duración estimada:** 2 semanas  
**Objetivo:** Conectar el dashboard con datos reales del backend

### Semana 1: Infraestructura de Estado y Datos

#### Tarea 1.1: Instalar Dependencias

```bash
# En packages/dashboard
pnpm add @tanstack/react-query zustand
pnpm add -D @tanstack/react-query-devtools
```

**Archivos a crear/modificar:**

- `packages/dashboard/src/lib/query-client.ts` - Configuración de React Query
- `packages/dashboard/src/providers/QueryProvider.tsx` - Provider wrapper
- `packages/dashboard/src/app/layout.tsx` - Agregar provider

#### Tarea 1.2: Crear Store Global con Zustand

```
packages/dashboard/src/store/
├── index.ts                 # Export central
├── useAuthStore.ts          # Estado de autenticación
├── useUIStore.ts            # Estado de UI (sidebar, theme, modals)
└── useNotificationStore.ts  # Sistema de notificaciones
```

**Funcionalidades del Store:**

```typescript
// useAuthStore
interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

// useUIStore
interface UIStore {
  sidebarCollapsed: boolean;
  activeModal: string | null;
  toggleSidebar: () => void;
  openModal: (id: string, data?: any) => void;
  closeModal: () => void;
}
```

#### Tarea 1.3: Crear Hooks de Datos con React Query

```
packages/dashboard/src/hooks/
├── api/
│   ├── useAgents.ts         # CRUD de agentes
│   ├── useAgent.ts          # Detalle de un agente
│   ├── useTraces.ts         # Lista de traces
│   ├── useTrace.ts          # Detalle de trace
│   ├── useLogs.ts           # Sistema de logs
│   ├── useCosts.ts          # Costos y resumen
│   ├── useBudget.ts         # Presupuesto
│   └── useMetrics.ts        # Métricas del dashboard
├── useWebSocket.ts          # Conexión WebSocket
└── index.ts                 # Exports
```

**Ejemplo de Hook:**

```typescript
// hooks/api/useAgents.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAgents, createAgent, deleteAgent } from "@/lib/api";

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: fetchAgents,
    staleTime: 30 * 1000, // 30 segundos
    refetchInterval: 60 * 1000, // Refetch cada minuto
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}
```

#### Tarea 1.4: Implementar WebSocket Hook

```typescript
// hooks/useWebSocket.ts
export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<any>(null);
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLastEvent(data);

      // Invalidar queries según el tipo de evento
      switch (data.type) {
        case "agent:event":
          queryClient.invalidateQueries({ queryKey: ["agents"] });
          break;
        case "log":
          queryClient.invalidateQueries({ queryKey: ["logs"] });
          break;
        case "cost:update":
          queryClient.invalidateQueries({ queryKey: ["costs"] });
          break;
      }
    };

    return () => ws.close();
  }, []);

  return { isConnected, lastEvent };
}
```

### Semana 2: Conectar Páginas a Datos Reales

#### Tarea 1.5: Actualizar Dashboard Principal

**Archivo:** `packages/dashboard/src/app/(dashboard)/dashboard/page.tsx`

**Cambios:**

1. Reemplazar componentes con versiones conectadas a API
2. Agregar loading states con Skeleton
3. Agregar error handling
4. Conectar WebSocket para actualizaciones

```typescript
// Antes (actual)
<StatsCards />
<TracesChart />
<CostsBreakdown />
<ActiveAgents />
<LogsPanel />

// Después (objetivo)
<Suspense fallback={<StatsCardsSkeleton />}>
  <StatsCards />  // Usa useMetrics() internamente
</Suspense>
<Suspense fallback={<TracesChartSkeleton />}>
  <TracesChart />  // Usa useTraces() internamente
</Suspense>
// ...etc
```

#### Tarea 1.6: Actualizar Componentes del Dashboard

```
packages/dashboard/src/components/dashboard/
├── stats-cards.tsx          # Conectar a useMetrics()
├── active-agents.tsx        # Conectar a useAgents()
├── logs-panel.tsx           # Conectar a useLogs()
├── traces-chart.tsx         # Conectar a useTraces()
├── costs-breakdown.tsx      # Conectar a useCosts()
└── skeletons/
    ├── StatsCardsSkeleton.tsx
    ├── AgentsSkeleton.tsx
    └── ChartSkeleton.tsx
```

#### Tarea 1.7: Crear Componentes de Estado

```
packages/dashboard/src/components/ui/
├── loading-spinner.tsx
├── error-boundary.tsx
├── empty-state.tsx
├── connection-status.tsx    # Indicador WebSocket
└── skeleton/
    ├── card-skeleton.tsx
    ├── table-skeleton.tsx
    └── chart-skeleton.tsx
```

#### Tarea 1.8: Actualizar API Client

**Archivo:** `packages/dashboard/src/lib/api.ts`

**Mejoras:**

1. Agregar tipos más específicos
2. Implementar retry logic
3. Agregar interceptors para refresh token
4. Mejorar error handling

```typescript
// Nuevo: Request wrapper con retry
async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit,
  retries = 3,
): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: getHeaders(options?.headers as Record<string, string>),
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Intentar refresh token
        await refreshAuthToken();
        return apiRequest(endpoint, options, retries - 1);
      }
      await handleApiError(response, endpoint);
    }

    return response.json();
  } catch (error) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 1000));
      return apiRequest(endpoint, options, retries - 1);
    }
    throw error;
  }
}
```

### Entregables Fase 1

- [ ] React Query configurado y funcionando
- [ ] Zustand stores creados
- [ ] Hooks de API para todas las entidades
- [ ] WebSocket hook con reconexión automática
- [ ] Dashboard mostrando datos reales
- [ ] Loading states en todos los componentes
- [ ] Error boundaries implementados
- [ ] Indicador de conexión WebSocket en UI

---

## Fase 2: Features Core

**Duración estimada:** 2 semanas  
**Objetivo:** Hacer funcionales todas las secciones principales

### Semana 3: Agents y Traces

#### Tarea 2.1: Página de Agents Completamente Funcional

**Archivo:** `packages/dashboard/src/app/(dashboard)/agents/page.tsx`

**Funcionalidades:**

##### 2.1.1 Búsqueda en Tiempo Real

```typescript
const [searchQuery, setSearchQuery] = useState("");
const debouncedSearch = useDebounce(searchQuery, 300);

const { data: agents } = useAgents({
  search: debouncedSearch,
  status: statusFilters,
  model: modelFilters,
});
```

##### 2.1.2 Modal de Crear Agente

```
packages/dashboard/src/components/agents/
├── CreateAgentModal.tsx
├── EditAgentModal.tsx
├── AgentCard.tsx
├── AgentDetails.tsx
└── AgentActions.tsx
```

**CreateAgentModal - Campos:**

```typescript
interface CreateAgentForm {
  name: string; // Requerido
  model: string; // Select: GPT-4, Claude 3, etc.
  provider: string; // OpenAI, Anthropic
  systemPrompt: string; // Textarea
  temperature: number; // Slider 0-2
  maxTokens: number; // Input numérico
  costLimit: number; // Límite de costo por ejecución
  description: string; // Opcional
  tags: string[]; // Multi-select
}
```

##### 2.1.3 Menú de Acciones por Agente

```typescript
const agentActions = [
  { label: "View Details", action: () => router.push(`/agents/${agent.id}`) },
  { label: "Edit Configuration", action: () => openModal("edit-agent", agent) },
  { label: "View Logs", action: () => router.push(`/agents/${agent.id}/logs`) },
  {
    label: "Pause Agent",
    action: () => pauseAgent(agent.id),
    variant: "warning",
  },
  {
    label: "Delete Agent",
    action: () => deleteAgent(agent.id),
    variant: "destructive",
  },
];
```

##### 2.1.4 Vista de Detalle de Agente

**Ruta:** `/agents/[id]/page.tsx`

**Contenido:**

- Información general del agente
- Configuración actual
- Estadísticas de uso
- Gráfico de ejecuciones recientes
- Logs del agente
- Historial de costos
- Acciones (editar, pausar, eliminar)

#### Tarea 2.2: Página de Traces Completamente Funcional

**Archivo:** `packages/dashboard/src/app/(dashboard)/traces/page.tsx`

**Funcionalidades:**

##### 2.2.1 Vista de Lista con Filtros

```typescript
const traceFilters = {
  status: ["success", "running", "error"],
  agent: agents.map((a) => a.id),
  dateRange: { from: Date, to: Date },
  durationMin: number,
  durationMax: number,
};
```

##### 2.2.2 Vista de Detalle de Trace

**Ruta:** `/traces/[id]/page.tsx`

**Componentes:**

```
packages/dashboard/src/components/traces/
├── TraceTimeline.tsx        # Timeline visual de la ejecución
├── TraceStepCard.tsx        # Card para cada step
├── TraceInputOutput.tsx     # Visualizador de I/O
├── TraceCostBreakdown.tsx   # Desglose de costos por step
└── TraceLogViewer.tsx       # Logs asociados
```

**TraceTimeline - Visualización:**

```
┌─────────────────────────────────────────────────────────────┐
│ Trace: Customer inquiry processing                          │
│ Duration: 1.2s | Steps: 5 | Cost: $0.0234                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ●──────────●──────────●──────────●──────────●              │
│  │          │          │          │          │              │
│  Start    Parse     Process    Generate   Complete          │
│  0ms      150ms     450ms      850ms      1200ms            │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Step 1: Input Parsing                              │     │
│  │ Duration: 150ms | Tokens: 234 | Cost: $0.0012      │     │
│  │ Input: { message: "Help with billing..." }         │     │
│  │ Output: { intent: "billing_inquiry", ... }         │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

##### 2.2.3 Export de Traces

```typescript
const exportFormats = ["csv", "json", "pdf"];

async function exportTraces(format: string, filters: TraceFilters) {
  const response = await fetch(`/api/traces/export?format=${format}`, {
    method: "POST",
    body: JSON.stringify(filters),
  });
  const blob = await response.blob();
  downloadBlob(blob, `traces-${Date.now()}.${format}`);
}
```

### Semana 4: Logs y Costs

#### Tarea 2.3: Página de Logs Avanzada

**Archivo:** `packages/dashboard/src/app/(dashboard)/logs/page.tsx`

**Funcionalidades Requeridas:**

##### 2.3.1 Stream en Tiempo Real

```typescript
function useLogStream() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  useWebSocketEvent("log", (newLog) => {
    if (!isPaused) {
      setLogs((prev) => [newLog, ...prev].slice(0, 1000)); // Mantener últimos 1000
    }
  });

  return { logs, isPaused, setIsPaused };
}
```

##### 2.3.2 Filtros Avanzados

```typescript
interface LogFilters {
  levels: ("debug" | "info" | "warning" | "error" | "critical")[];
  sources: string[];
  agentId: string | null;
  traceId: string | null;
  search: string;
  dateRange: { from: Date; to: Date };
}
```

##### 2.3.3 Vistas Múltiples

```
packages/dashboard/src/components/logs/
├── LogStreamView.tsx        # Vista de stream (default)
├── LogTableView.tsx         # Vista de tabla
├── LogJsonView.tsx          # Vista JSON raw
├── LogEntry.tsx             # Componente de log individual
├── LogFilters.tsx           # Panel de filtros
└── LogSearch.tsx            # Búsqueda avanzada
```

**LogEntry - Diseño:**

```
┌─────────────────────────────────────────────────────────────┐
│ 🔵 INFO  │ 2026-01-19 13:45:23.456 │ agent-service          │
├─────────────────────────────────────────────────────────────┤
│ Agent 'Customer Support' started processing new request     │
├─────────────────────────────────────────────────────────────┤
│ ▼ Metadata (click to expand)                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ {                                                       │ │
│ │   "agentId": "agent-001",                               │ │
│ │   "traceId": "trace-xyz",                               │ │
│ │   "requestId": "req-123",                               │ │
│ │   "userId": "user-456"                                  │ │
│ │ }                                                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                           [View Trace →]    │
└─────────────────────────────────────────────────────────────┘
```

##### 2.3.4 Virtual Scrolling

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function LogList({ logs }: { logs: Log[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <LogEntry key={logs[virtualRow.index].id} log={logs[virtualRow.index]} />
        ))}
      </div>
    </div>
  );
}
```

#### Tarea 2.4: Página de Costs Completamente Funcional

**Archivo:** `packages/dashboard/src/app/(dashboard)/costs/page.tsx`

**Funcionalidades:**

##### 2.4.1 Selector de Período

```typescript
const periods = [
  { id: "today", label: "Today", query: { from: startOfDay(new Date()) } },
  {
    id: "yesterday",
    label: "Yesterday",
    query: { from: subDays(new Date(), 1), to: startOfDay(new Date()) },
  },
  { id: "week", label: "This Week", query: { from: startOfWeek(new Date()) } },
  {
    id: "month",
    label: "This Month",
    query: { from: startOfMonth(new Date()) },
  },
  {
    id: "quarter",
    label: "This Quarter",
    query: { from: startOfQuarter(new Date()) },
  },
  { id: "year", label: "This Year", query: { from: startOfYear(new Date()) } },
  { id: "custom", label: "Custom Range", query: null }, // Abre date picker
];
```

##### 2.4.2 Gráfico de Costos por Modelo (Interactivo)

```typescript
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={costsByModel}>
    <Bar
      dataKey="cost"
      onClick={(data) => handleModelClick(data.model)}
      onMouseEnter={(data) => setHoveredModel(data.model)}
    />
    <Tooltip
      content={({ payload }) => (
        <CostTooltip
          model={payload[0]?.payload.model}
          cost={payload[0]?.payload.cost}
          tokens={payload[0]?.payload.tokens}
          percentage={payload[0]?.payload.percentage}
        />
      )}
    />
  </BarChart>
</ResponsiveContainer>
```

##### 2.4.3 Desglose Diario Interactivo

```typescript
function DailyBreakdown({ dailyCosts }: { dailyCosts: DailyCost[] }) {
  return (
    <div className="space-y-2">
      {dailyCosts.map(day => (
        <div
          key={day.date}
          onClick={() => showDayDetails(day)}
          className="cursor-pointer hover:bg-muted/50 transition-colors"
        >
          <div className="flex justify-between p-3 rounded-lg border">
            <div>
              <p className="font-medium">{formatDate(day.date)}</p>
              <p className="text-sm text-muted-foreground">{day.tokens} tokens</p>
            </div>
            <div className="text-right">
              <p className="font-medium">${day.cost.toFixed(2)}</p>
              <Badge variant={day.change >= 0 ? 'success' : 'destructive'}>
                {day.change >= 0 ? '+' : ''}{day.change}%
              </Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

##### 2.4.4 Export de Reportes

```typescript
const exportOptions = [
  {
    format: "csv",
    label: "Export CSV",
    description: "Raw data in spreadsheet format",
  },
  {
    format: "pdf",
    label: "Export PDF Report",
    description: "Formatted report with charts",
  },
  {
    format: "json",
    label: "Export JSON",
    description: "Machine-readable format",
  },
];

async function exportCostReport(format: string, period: Period) {
  setIsExporting(true);
  try {
    const response = await fetch(`/api/costs/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, ...period.query }),
    });

    if (format === "pdf") {
      // El backend genera el PDF
      const blob = await response.blob();
      downloadBlob(blob, `cost-report-${period.id}.pdf`);
    } else {
      // CSV/JSON generado en cliente
      const data = await response.json();
      const content =
        format === "csv" ? convertToCSV(data) : JSON.stringify(data, null, 2);
      downloadText(content, `costs-${period.id}.${format}`);
    }

    toast.success(`Report exported as ${format.toUpperCase()}`);
  } catch (error) {
    toast.error("Failed to export report");
  } finally {
    setIsExporting(false);
  }
}
```

### Entregables Fase 2

- [ ] Agents: CRUD completo funcional
- [ ] Agents: Búsqueda y filtros en tiempo real
- [ ] Agents: Modal de creación/edición
- [ ] Agents: Vista de detalle con estadísticas
- [ ] Traces: Lista con filtros avanzados
- [ ] Traces: Vista de detalle con timeline
- [ ] Traces: Export funcional
- [ ] Logs: Stream en tiempo real
- [ ] Logs: Filtros y búsqueda avanzada
- [ ] Logs: Virtual scrolling para performance
- [ ] Logs: Múltiples vistas (stream, table, JSON)
- [ ] Costs: Selección de períodos
- [ ] Costs: Gráficos interactivos
- [ ] Costs: Export de reportes

---

## Fase 3: Funcionalidades Avanzadas

**Duración estimada:** 2 semanas  
**Objetivo:** Implementar features de alto valor

### Semana 5: Alertas y Predicciones

#### Tarea 3.1: Sistema de Alertas

```
packages/dashboard/src/app/(dashboard)/settings/alerts/
├── page.tsx                 # Lista de alertas configuradas
├── create/page.tsx          # Crear nueva alerta
└── [id]/page.tsx            # Editar alerta
```

**Tipos de Alertas:**

```typescript
interface AlertConfig {
  id: string;
  name: string;
  type: "cost_threshold" | "error_rate" | "agent_down" | "rate_limit";
  condition: {
    metric: string;
    operator: "gt" | "gte" | "lt" | "lte" | "eq";
    value: number;
    period: "hourly" | "daily" | "weekly";
  };
  notifications: {
    email: boolean;
    slack: boolean;
    webhook: string | null;
  };
  enabled: boolean;
}
```

**UI de Alertas:**

```
┌─────────────────────────────────────────────────────────────┐
│ 🔔 Alerts                                        [+ New]    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ 💰 Daily Cost Threshold                          🟢 ON │  │
│ │ Trigger when: Daily cost > $50                         │  │
│ │ Notify via: Email, Slack                               │  │
│ │ Last triggered: 3 days ago                             │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ ⚠️ Error Rate Alert                              🟢 ON │  │
│ │ Trigger when: Error rate > 5% (hourly)                 │  │
│ │ Notify via: Slack, Webhook                             │  │
│ │ Last triggered: Never                                  │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Tarea 3.2: Predicción de Costos (ML)

```
packages/dashboard/src/components/costs/
├── CostPrediction.tsx       # Widget de predicción
├── PredictionChart.tsx      # Gráfico con proyección
└── PredictionDetails.tsx    # Detalles del modelo
```

**Backend - Endpoint de Predicción:**

```typescript
// apps/api/src/routes/costs.ts
router.get("/prediction", async (req, res) => {
  const userId = req.userId;

  // Obtener historial de los últimos 30 días
  const history = await getCostHistory(userId, 30);

  // Calcular tendencia lineal simple
  const prediction = calculateLinearPrediction(history);

  // Calcular intervalo de confianza
  const confidence = calculateConfidenceInterval(history);

  res.json({
    projectedMonthEnd: prediction.total,
    confidence: confidence.percentage,
    confidenceRange: {
      low: confidence.low,
      high: confidence.high,
    },
    trend: prediction.trend, // 'increasing' | 'decreasing' | 'stable'
    trendPercentage: prediction.trendPercentage,
    basedOnDays: history.length,
  });
});
```

**UI de Predicción:**

```
┌─────────────────────────────────────────────────────────────┐
│ 📈 Cost Projection                                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Projected Month-End Cost                                  │
│   ┌─────────────────────────────────────┐                   │
│   │         $847.50 (±12%)              │                   │
│   │    ▲ +15.3% vs last month           │                   │
│   └─────────────────────────────────────┘                   │
│                                                              │
│   [Chart showing actual + projected line]                   │
│                                                              │
│   ⚠️ Warning: Projected to exceed budget ($1,000) by 15%   │
│                                                              │
│   Confidence: High (based on 30 days of data)              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Tarea 3.3: Recomendaciones de Optimización

```typescript
interface OptimizationRecommendation {
  id: string;
  type: "model_switch" | "prompt_optimization" | "caching" | "batching";
  title: string;
  description: string;
  estimatedSavings: {
    monthly: number;
    percentage: number;
  };
  effort: "low" | "medium" | "high";
  affectedAgents: string[];
  actionable: boolean;
  action?: {
    type: "auto" | "manual";
    endpoint?: string;
    instructions?: string;
  };
}
```

**Backend - Análisis de Optimización:**

```typescript
// apps/api/src/services/OptimizationService.ts
class OptimizationService {
  async analyzeOptimizations(
    userId: string,
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // 1. Analizar agentes usando GPT-4 que podrían usar GPT-3.5
    const gpt4Agents = await this.getAgentsByModel(userId, "gpt-4");
    for (const agent of gpt4Agents) {
      const avgComplexity = await this.calculateTaskComplexity(agent.id);
      if (avgComplexity < 0.3) {
        // Tareas simples
        recommendations.push({
          id: `switch-${agent.id}`,
          type: "model_switch",
          title: `Consider GPT-3.5 for "${agent.name}"`,
          description: `This agent handles mostly simple tasks that don't require GPT-4 capabilities.`,
          estimatedSavings: {
            monthly: await this.calculateSwitchSavings(agent.id),
            percentage: 85,
          },
          effort: "low",
          affectedAgents: [agent.id],
          actionable: true,
        });
      }
    }

    // 2. Detectar prompts excesivamente largos
    // 3. Identificar patrones de caching
    // 4. Sugerir batching para llamadas similares

    return recommendations;
  }
}
```

### Semana 6: Multi-tenancy y Pulido Final

#### Tarea 3.4: Multi-tenancy (Organizaciones)

```
packages/dashboard/src/app/(dashboard)/settings/organization/
├── page.tsx                 # Configuración de organización
├── members/page.tsx         # Gestión de miembros
├── billing/page.tsx         # Facturación
└── projects/page.tsx        # Proyectos/equipos
```

**Modelo de Datos:**

```typescript
interface Organization {
  id: string;
  name: string;
  plan: "free" | "pro" | "enterprise";
  members: OrganizationMember[];
  projects: Project[];
  billingInfo: BillingInfo;
}

interface OrganizationMember {
  userId: string;
  role: "owner" | "admin" | "developer" | "viewer";
  invitedAt: Date;
  acceptedAt: Date | null;
}

interface Project {
  id: string;
  name: string;
  organizationId: string;
  budget: number;
  members: string[]; // User IDs with access
}
```

#### Tarea 3.5: Onboarding Mejorado

```
packages/dashboard/src/components/onboarding/
├── OnboardingWizard.tsx     # Wizard principal
├── steps/
│   ├── WelcomeStep.tsx
│   ├── ConnectApiStep.tsx   # Conectar API keys
│   ├── CreateFirstAgentStep.tsx
│   ├── SetBudgetStep.tsx
│   └── CompleteStep.tsx
└── OnboardingProgress.tsx   # Indicador de progreso
```

#### Tarea 3.6: Testing y Quality Assurance

```
packages/dashboard/__tests__/
├── components/
│   ├── dashboard/
│   │   ├── StatsCards.test.tsx
│   │   ├── ActiveAgents.test.tsx
│   │   └── LogsPanel.test.tsx
│   ├── agents/
│   │   ├── AgentCard.test.tsx
│   │   └── CreateAgentModal.test.tsx
│   └── costs/
│       └── CostChart.test.tsx
├── hooks/
│   ├── useAgents.test.ts
│   ├── useCosts.test.ts
│   └── useWebSocket.test.ts
├── pages/
│   ├── dashboard.test.tsx
│   ├── agents.test.tsx
│   └── costs.test.tsx
└── e2e/
    ├── auth.spec.ts
    ├── agents-crud.spec.ts
    └── cost-tracking.spec.ts
```

#### Tarea 3.7: Documentación Final

```
docs/
├── DASHBOARD_GUIDE.md       # Guía de usuario
├── API_INTEGRATION.md       # Cómo integrar APIs
├── TROUBLESHOOTING.md       # Solución de problemas
└── DEPLOYMENT.md            # Ya existe, actualizar
```

### Entregables Fase 3

- [ ] Sistema de alertas configurables
- [ ] Predicción de costos con ML
- [ ] Panel de recomendaciones de optimización
- [ ] Multi-tenancy básico (organizaciones)
- [ ] Wizard de onboarding
- [ ] Tests unitarios (>80% coverage)
- [ ] Tests E2E para flujos críticos
- [ ] Documentación completa

---

## Especificaciones Técnicas por Sección

### Home (`/home`)

| Elemento               | Funcionalidad Requerida   | Prioridad |
| ---------------------- | ------------------------- | --------- |
| "Go to Dashboard"      | Navegación con animación  | Fase 1    |
| "Manage Agents"        | Navegación a /agents      | Fase 1    |
| Quick Navigation Cards | Navegación a secciones    | Fase 1    |
| Getting Started        | Expandible con tutoriales | Fase 2    |

### Dashboard (`/dashboard`)

| Componente     | Datos                       | WebSocket           | Prioridad |
| -------------- | --------------------------- | ------------------- | --------- |
| StatsCards     | `/api/metrics/current`      | ✅ `metrics:update` | Fase 1    |
| TracesChart    | `/api/traces?period=24h`    | ✅ `trace:new`      | Fase 1    |
| CostsBreakdown | `/api/costs/summary`        | ✅ `cost:update`    | Fase 1    |
| ActiveAgents   | `/api/agents?status=active` | ✅ `agent:event`    | Fase 1    |
| LogsPanel      | `/api/logs?limit=10`        | ✅ `log`            | Fase 1    |

### Agents (`/agents`)

| Funcionalidad      | Endpoint                 | Método | Prioridad |
| ------------------ | ------------------------ | ------ | --------- |
| Listar agentes     | `/api/agents`            | GET    | Fase 1    |
| Buscar agentes     | `/api/agents?search=X`   | GET    | Fase 2    |
| Filtrar por estado | `/api/agents?status=X`   | GET    | Fase 2    |
| Crear agente       | `/api/agents`            | POST   | Fase 2    |
| Editar agente      | `/api/agents/:id`        | PATCH  | Fase 2    |
| Eliminar agente    | `/api/agents/:id`        | DELETE | Fase 2    |
| Ver detalle        | `/api/agents/:id`        | GET    | Fase 2    |
| Pausar/Reanudar    | `/api/agents/:id/status` | PATCH  | Fase 2    |

### Traces (`/traces`)

| Funcionalidad  | Endpoint                       | Método | Prioridad |
| -------------- | ------------------------------ | ------ | --------- |
| Listar traces  | `/api/traces`                  | GET    | Fase 1    |
| Filtrar traces | `/api/traces?status=X&agent=Y` | GET    | Fase 2    |
| Ver detalle    | `/api/traces/:id`              | GET    | Fase 2    |
| Exportar       | `/api/traces/export`           | POST   | Fase 2    |

### Logs (`/logs`)

| Funcionalidad      | Endpoint/Evento             | Tipo      | Prioridad |
| ------------------ | --------------------------- | --------- | --------- |
| Listar logs        | `/api/logs`                 | REST      | Fase 1    |
| Stream tiempo real | `ws: log`                   | WebSocket | Fase 1    |
| Filtrar logs       | `/api/logs?level=X&agent=Y` | REST      | Fase 2    |
| Buscar texto       | `/api/logs?search=X`        | REST      | Fase 2    |
| Exportar           | `/api/logs/export`          | REST      | Fase 2    |

### Costs (`/costs`)

| Funcionalidad   | Endpoint                 | Método | Prioridad |
| --------------- | ------------------------ | ------ | --------- |
| Resumen         | `/api/costs/summary`     | GET    | Fase 1    |
| Por período     | `/api/costs?from=X&to=Y` | GET    | Fase 2    |
| Por modelo      | `/api/costs/by-model`    | GET    | Fase 2    |
| Desglose diario | `/api/costs/daily`       | GET    | Fase 2    |
| Presupuesto     | `/api/costs/budget`      | GET    | Fase 1    |
| Exportar        | `/api/costs/export`      | POST   | Fase 2    |
| Predicción      | `/api/costs/prediction`  | GET    | Fase 3    |

---

## Criterios de Aceptación

### Criterios Globales

- [ ] Todos los botones ejecutan acciones reales o navegan
- [ ] Todos los datos provienen de la API (no hay mock data)
- [ ] Loading states visibles durante fetching
- [ ] Error handling con mensajes claros
- [ ] Responsive en mobile, tablet y desktop
- [ ] Accesibilidad WCAG 2.1 AA
- [ ] Performance: LCP < 2.5s, FID < 100ms, CLS < 0.1

### Por Sección

#### Dashboard

- [ ] Stats se actualizan automáticamente cada 30 segundos
- [ ] Gráficos reflejan datos reales de las últimas 24h
- [ ] WebSocket conectado y mostrando indicador
- [ ] Click en "View All" navega a sección correspondiente

#### Agents

- [ ] Lista muestra agentes del usuario autenticado
- [ ] Búsqueda filtra en tiempo real (debounce 300ms)
- [ ] Modal de crear agente valida y envía a API
- [ ] Acciones del menú (editar, pausar, eliminar) funcionan
- [ ] Vista de detalle muestra información completa

#### Traces

- [ ] Lista paginada (20 items por página)
- [ ] Filtros funcionan correctamente
- [ ] Click en trace abre vista detallada
- [ ] Timeline muestra todos los steps
- [ ] Export genera archivo válido

#### Logs

- [ ] Stream en tiempo real muestra logs nuevos
- [ ] Botón "Pause" detiene el stream
- [ ] Filtros se aplican inmediatamente
- [ ] Virtual scroll funciona sin lag (>1000 logs)
- [ ] Click en log expande metadata

#### Costs

- [ ] Selector de período cambia datos mostrados
- [ ] Gráficos son interactivos (hover, click)
- [ ] Export genera CSV/PDF válido
- [ ] Predicción muestra proyección mensual

---

## Dependencias y Riesgos

### Dependencias Técnicas

| Dependencia   | Impacto si Falla            | Mitigación              |
| ------------- | --------------------------- | ----------------------- |
| PostgreSQL    | Crítico - Sin datos         | Health check + failover |
| Redis         | Alto - Sin cache/rate limit | Fallback a memory       |
| OpenAI API    | Medio - Sin ejecuciones     | Queue + retry           |
| Anthropic API | Medio - Sin ejecuciones     | Fallback a OpenAI       |
| Stripe        | Bajo - Sin pagos            | Grace period            |

### Riesgos Identificados

| Riesgo                 | Probabilidad | Impacto | Mitigación                                |
| ---------------------- | ------------ | ------- | ----------------------------------------- |
| API rate limiting      | Media        | Alto    | Implementar backoff exponencial           |
| WebSocket disconnect   | Alta         | Medio   | Reconexión automática con backoff         |
| Datos inconsistentes   | Baja         | Alto    | Validación tanto en cliente como servidor |
| Performance degradada  | Media        | Medio   | Virtual scrolling, paginación, caching    |
| Autenticación expirada | Alta         | Medio   | Refresh token automático                  |

### Dependencias de Paquetes

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.x",
    "@tanstack/react-virtual": "^3.x",
    "zustand": "^4.x",
    "date-fns": "^3.x",
    "recharts": "^2.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "@tanstack/react-query-devtools": "^5.x",
    "@testing-library/react": "^14.x",
    "vitest": "^1.x",
    "playwright": "^1.x"
  }
}
```

---

## Cronograma Detallado

```
Semana 1 (Fase 1)
├── Lun: Setup React Query + Zustand
├── Mar: Crear hooks base (useAgents, useCosts, etc.)
├── Mié: Implementar useWebSocket
├── Jue: Actualizar API client
└── Vie: Crear componentes de loading/error

Semana 2 (Fase 1)
├── Lun: Conectar StatsCards + ActiveAgents
├── Mar: Conectar TracesChart + CostsBreakdown
├── Mié: Conectar LogsPanel
├── Jue: Testing + bugfixes
└── Vie: Demo Fase 1 + retrospectiva

Semana 3 (Fase 2)
├── Lun: Agents - búsqueda y filtros
├── Mar: Agents - modal crear/editar
├── Mié: Agents - acciones (pausar, eliminar)
├── Jue: Agents - vista de detalle
└── Vie: Traces - filtros y lista

Semana 4 (Fase 2)
├── Lun: Traces - vista de detalle con timeline
├── Mar: Logs - stream tiempo real
├── Mié: Logs - filtros y virtual scroll
├── Jue: Costs - períodos y gráficos interactivos
└── Vie: Costs - export + Demo Fase 2

Semana 5 (Fase 3)
├── Lun: Sistema de alertas - backend
├── Mar: Sistema de alertas - frontend
├── Mié: Predicción de costos
├── Jue: Recomendaciones de optimización
└── Vie: Testing + bugfixes

Semana 6 (Fase 3)
├── Lun: Multi-tenancy básico
├── Mar: Onboarding wizard
├── Mié: Tests E2E
├── Jue: Documentación
└── Vie: Demo final + deployment
```

---

## Próximos Pasos

Para comenzar la implementación, ejecutar en orden:

1. **Instalar dependencias**

   ```bash
   cd packages/dashboard
   pnpm add @tanstack/react-query zustand @tanstack/react-virtual date-fns
   pnpm add -D @tanstack/react-query-devtools
   ```

2. **Crear estructura de carpetas**

   ```bash
   mkdir -p src/store src/hooks/api src/components/ui/skeleton
   ```

3. **Comenzar con Tarea 1.1**: Configurar React Query Provider

---

> **Nota:** Este plan es un documento vivo. Se actualizará según avance la implementación y surjan nuevos requisitos o cambios.
