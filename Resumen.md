Resumen: Optimización Aethermind AgentOS
Monorepo: 2 apps + 8 packages | Branch: optimization/phase-3-refactoring | 8 commits, -1,548 líneas netas

Estructura actual
Componente Ubicación Stack Estado
API Server apps/api Express + Drizzle + PostgreSQL Producción
Landing apps/landing Next.js 15 Producción
Dashboard packages/dashboard Next.js 16 + React Query Producción
Core Engine packages/core TS — agentes, orquestador, workflows Activo
SDK Agent packages/agent TS — interceptores, telemetría Activo
Core Shared packages/core-shared TS — pricing canónico, costos Activo
SDK Legacy packages/sdk ⚠️ Redundante (wrapper sobre core)
API Client packages/api-client ⚠️ Duplicado con dashboard
Types packages/types Interfaces compartidas Activo
CLI Scaffold packages/create-aethermind-app Templates Activo
Lo que se hizo (Phases 1-4)
16 archivos eliminados: auth.ts.deprecated, configs Jest redundantes, scripts debug, backups/, vscode-extension, pricing duplicada en agent, RedisCache.ts stub, Dockerfile.railway, docker-entrypoint.sh
index.ts (API): 889 → 512 líneas (-42%). Se extrajo: health endpoints a server/health.ts (factory pattern con DI), hashForCache() a utils/crypto.ts, gracefulShutdown(), logStartupBanner()
Redis: Eliminado RedisCache.ts (stub no-op). RedisService.ts extendido con API compatible: set(key,val,ttl?), isConnected(), has(), invalidatePattern(), clear()
Docker: Unificados Dockerfile + Dockerfile.railway en multi-stage. Eliminados Prometheus + Grafana (eran stubs sin datos)
Jest: 5 configs → 1 con projects: [unit, integration, e2e]
Pricing: 3 copias → 2. Agent ahora importa de @aethermind/core-shared
Código B2B Beta: ~150 líneas comentadas eliminadas, preservadas en docs/b2b-beta-migration.md
Utility: useQueryWithFallback<T>() creada para DRY mock-data en hooks (~15 líneas menos por hook)
Decisiones de diseño clave
Health router: Factory pattern createHealthRouter(deps) con DI para evitar singletons/circular deps
RedisService: \_isConnected (privado) + isConnected() (público). set() con TTL opcional que delega a setex()
3ra tabla pricing NO unificada: cost-calculator.ts usa ModelPricing (8 campos) vs core-shared (2 campos). Requiere adapter
Pendientes por prioridad
Alta:

Unificar 3ra pricing table (cost-calculator.ts → core-shared) — 3h, riesgo medio
Importar tipos desde @aethermind/types en dashboard (106 líneas duplicadas) — 2h
Adoptar useQueryWithFallback en 13 hooks — 2h
Media: 4. Unificar dashboard/lib/api.ts + api-client — 4h 5. Evaluar eliminación packages/sdk — 2h 6. Implementar prom-client real o eliminar utils/metrics.ts — 2h

Baja: 7-10. Extraer middleware/routes/events de index.ts a módulos + mover verifyApiKey a WebSocketManager

Issues pre-existentes (no tocados)
TypeScript errors en routes/oauth.ts
utils/metrics.ts es 100% stubs pero endpoint /metrics sigue activo
