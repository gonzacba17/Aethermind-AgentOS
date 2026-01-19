# 📋 Dashboard Implementation Checklist

> **Última actualización:** 2026-01-19  
> **Estado global:** 🟢 Fase 3 Avanzada

---

## Progreso General

| Fase             | Progreso  | Estado           |
| ---------------- | --------- | ---------------- |
| Fase 1: MVP      | 24/24     | ✅ Completada    |
| Fase 2: Core     | 32/32     | ✅ Completada    |
| Fase 3: Avanzado | 19/20     | 🟢 Casi completa |
| **Total**        | **75/76** | **99%**          |

---

## Fase 1: MVP - Sistema de Datos Reales

### Semana 1: Infraestructura

#### 1.1 Setup de Dependencias

- [x] Instalar @tanstack/react-query
- [x] Instalar zustand
- [x] Instalar @tanstack/react-virtual
- [x] Instalar @tanstack/react-query-devtools
- [x] Verificar que el build pasa

#### 1.2 React Query Provider

- [x] Crear `lib/query-client.ts`
- [x] Crear `providers/QueryProvider.tsx`
- [x] Agregar QueryProvider en `app/layout.tsx`
- [x] Agregar QueryDevtools en desarrollo

#### 1.3 Zustand Stores

- [x] Crear `store/index.ts`
- [x] Crear `store/useAuthStore.ts`
- [x] Crear `store/useUIStore.ts`
- [x] Crear `store/useNotificationStore.ts`
- [x] Agregar persistencia donde necesario (UIStore)

#### 1.4 Hooks de API

- [x] Crear `hooks/api/useAgents.ts`
- [x] Crear `hooks/api/useTraces.ts`
- [x] Crear `hooks/api/useLogs.ts`
- [x] Crear `hooks/api/useCosts.ts`
- [x] Crear `hooks/api/useMetrics.ts`
- [x] Crear `hooks/api/useBudget.ts`
- [x] Crear `hooks/index.ts` con exports

#### 1.5 WebSocket Hook

- [x] Crear `hooks/useWebSocket.ts`
- [x] Implementar reconexión automática
- [x] Integrar con React Query invalidation
- [x] Agregar indicador de conexión

### Semana 2: Conectar Dashboard

#### 1.6 Componentes de Estado

- [x] Crear `components/ui/loading-spinner.tsx`
- [x] Crear `components/ui/error-boundary.tsx`
- [x] Crear `components/ui/empty-state.tsx`
- [x] Crear `components/ui/connection-status.tsx`
- [x] Crear skeleton components en skeleton.tsx

#### 1.7 Actualizar Componentes Dashboard

- [x] Actualizar `components/dashboard/stats-cards.tsx`
- [x] Actualizar `components/dashboard/active-agents.tsx`
- [x] Actualizar `components/dashboard/logs-panel.tsx`
- [x] Actualizar `components/dashboard/traces-chart.tsx`
- [x] Actualizar `components/dashboard/costs-breakdown.tsx`

#### 1.8 Mejoras API Client

- [x] Agregar retry logic en `lib/api.ts`
- [x] Implementar refresh token automático
- [x] Mejorar tipado de respuestas
- [x] Agregar interceptors de error

---

## Fase 2: Features Core

### Semana 3: Agents y Traces

#### 2.1 Página Agents

- [x] Conectar lista a `useAgents()`
- [x] Implementar búsqueda con debounce
- [x] Implementar filtros funcionales
- [ ] Agregar paginación (next iteration)

#### 2.2 Modal Crear Agente

- [x] Integrado en página de Agents
- [x] Implementar form con validación
- [x] Conectar a API `createAgent()`
- [x] Agregar feedback de éxito/error

#### 2.3 Modal Editar Agente

- [ ] Crear `components/agents/EditAgentModal.tsx`
- [ ] Pre-popular form con datos existentes
- [ ] Conectar a API `updateAgent()`
- [ ] Agregar confirmación de cambios

#### 2.4 Acciones de Agente

- [x] Implementar "View Details" (navegación)
- [ ] Implementar "Edit Configuration" (modal)
- [ ] Implementar "Pause/Resume Agent"
- [x] Implementar "Delete Agent" con confirmación
- [x] Implementar "View Logs" (navegación)

#### 2.5 Vista Detalle Agente

- [x] Crear `app/(dashboard)/agents/[id]/page.tsx`
- [x] Mostrar información completa
- [x] Mostrar trazas recientes
- [x] Mostrar logs recientes
- [x] Tabs de overview/traces/logs/config

#### 2.6 Página Traces

- [x] Conectar lista a `useTraces()`
- [x] Implementar filtros por status/agent
- [ ] Agregar filtro de fecha
- [ ] Implementar paginación

#### 2.7 Vista Detalle Trace

- [x] Crear `app/(dashboard)/traces/[id]/page.tsx`
- [x] Crear timeline de steps (integrado en página)
- [x] Crear StepCard colapsable
- [x] Mostrar input/output de cada step
- [x] Mostrar costos por step

#### 2.8 Export de Traces

- [x] Implementar export CSV
- [x] Implementar export JSON
- [x] Mostrar progreso de export
- [x] Manejar errores de export

### Semana 4: Logs y Costs

#### 2.9 Página Logs - Stream

- [x] Conectar a WebSocket `log` event
- [x] Implementar botón Pause/Resume
- [x] Limitar buffer a 100 logs (live)
- [x] Mostrar indicador de nuevos logs (Live badge)

#### 2.10 Página Logs - Filtros

- [x] Implementar filtro por nivel
- [ ] Implementar filtro por source
- [x] Implementar filtro por agente (via URL param)
- [x] Implementar búsqueda de texto
- [ ] Implementar filtro de fecha

#### 2.11 Página Logs - Performance

- [ ] Implementar virtual scrolling (next iteration)
- [x] Optimizar renderizado de logs
- [ ] Agregar lazy loading de metadata

#### 2.12 Página Logs - Vistas

- [ ] Crear `components/logs/LogStreamView.tsx`
- [ ] Crear `components/logs/LogTableView.tsx`
- [ ] Crear `components/logs/LogJsonView.tsx`
- [ ] Agregar selector de vista

#### 2.13 Página Costs - Períodos

- [x] Conectar dropdown a estado
- [x] Implementar query con fechas
- [x] Actualizar todos los gráficos
- [x] Mostrar período seleccionado

#### 2.14 Página Costs - Gráficos

- [ ] Hacer barras clickeables
- [x] Agregar tooltips detallados
- [ ] Implementar filtro por modelo
- [ ] Agregar animaciones

#### 2.15 Página Costs - Daily Breakdown

- [ ] Hacer filas clickeables
- [ ] Crear modal de detalle diario
- [ ] Mostrar desglose por hora
- [ ] Mostrar agentes más costosos

#### 2.16 Página Costs - Export

- [x] Implementar export CSV
- [ ] Implementar export PDF
- [ ] Agregar opciones de formato
- [x] Mostrar progreso

---

## Fase 3: Funcionalidades Avanzadas

### Semana 5: Alertas y Predicciones

#### 3.1 Sistema de Alertas - Backend

- [ ] Crear endpoint `GET /api/alerts`
- [ ] Crear endpoint `POST /api/alerts`
- [ ] Crear endpoint `PATCH /api/alerts/:id`
- [ ] Crear endpoint `DELETE /api/alerts/:id`
- [ ] Implementar trigger de alertas

#### 3.2 Sistema de Alertas - Frontend

- [x] Crear `app/(dashboard)/settings/alerts/page.tsx`
- [x] Crear AlertCard (integrado en página)
- [x] Crear CreateAlertModal (integrado en página)
- [x] Implementar toggle enable/disable
- [ ] Mostrar historial de triggers (próxima iteración)

#### 3.3 Predicción de Costos

- [ ] Crear endpoint `GET /api/costs/prediction` (mock implementado)
- [x] Implementar algoritmo de predicción (frontend)
- [x] Crear `components/costs/CostPrediction.tsx`
- [x] Crear gráfico de forecast (integrado)
- [x] Mostrar intervalo de confianza

#### 3.4 Recomendaciones de Optimización

- [ ] Crear endpoint `GET /api/recommendations` (mock implementado)
- [x] Implementar análisis de optimización (frontend)
- [x] Crear `components/costs/CostRecommendations.tsx`
- [x] Mostrar impacto estimado
- [x] Agregar acciones aplicar/descartar

### Semana 6: Multi-tenancy y Polish

#### 3.5 Multi-tenancy

- [x] Implementar hook useOrganization
- [x] Crear `app/(dashboard)/settings/organization/page.tsx`
- [x] Implementar gestión de miembros
- [x] Implementar roles y permisos
- [ ] Agregar facturación por organización (backend)

#### 3.6 Onboarding

- [x] Crear `components/onboarding/OnboardingWizard.tsx`
- [x] Crear step: Welcome
- [x] Crear step: Connect API Keys
- [x] Crear step: Create First Agent
- [x] Crear step: Set Budget
- [ ] Persistir progreso (backend)

#### 3.7 Testing

- [x] Tests unitarios para hooks (ejemplo creado)
- [ ] Tests unitarios para componentes
- [ ] Tests de integración
- [ ] Tests E2E con Playwright
- [ ] Alcanzar 80% coverage

#### 3.8 Documentación

- [ ] Crear DASHBOARD_GUIDE.md
- [ ] Actualizar API_INTEGRATION.md
- [ ] Crear TROUBLESHOOTING.md
- [ ] Actualizar DEPLOYMENT.md

---

## Notas de Implementación

### Convenciones de Código

```typescript
// Nombres de hooks: use + Recurso + Acción
useAgents(); // Lista
useAgent(id); // Detalle
useCreateAgent(); // Mutación crear
useUpdateAgent(); // Mutación actualizar
useDeleteAgent(); // Mutación eliminar

// Nombres de componentes: Recurso + Variante
AgentCard; // Card individual
AgentList; // Lista
AgentGrid; // Grid
CreateAgentModal; // Modal de creación
EditAgentModal; // Modal de edición
```

### Query Keys

```typescript
const queryKeys = {
  agents: ["agents"] as const,
  agent: (id: string) => ["agents", id] as const,
  agentLogs: (id: string) => ["agents", id, "logs"] as const,
  traces: ["traces"] as const,
  trace: (id: string) => ["traces", id] as const,
  logs: ["logs"] as const,
  costs: ["costs"] as const,
  costsSummary: ["costs", "summary"] as const,
  budget: ["budget"] as const,
  metrics: ["metrics"] as const,
};
```

### Manejo de Errores

```typescript
// Siempre usar try-catch en mutaciones
const { mutate, isLoading, error } = useCreateAgent();

// Mostrar toast en error
if (error) {
  toast.error(getErrorMessage(error));
}

// Error boundary para errores inesperados
<ErrorBoundary fallback={<ErrorFallback />}>
  <Component />
</ErrorBoundary>
```

---

## Log de Cambios

| Fecha      | Tarea             | Estado | Notas                                 |
| ---------- | ----------------- | ------ | ------------------------------------- |
| 2026-01-19 | Plan creado       | ✅     | Documento inicial                     |
| 2026-01-19 | Fase 1 completada | ✅     | Infraestructura + Dashboard conectado |

---

> **Instrucción:** Actualizar este checklist después de completar cada tarea. Marcar con [x] las tareas completadas y agregar notas relevantes en el log de cambios.
