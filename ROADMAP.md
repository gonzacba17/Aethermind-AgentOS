# Aethermind Roadmap

> AI Cost Control & Optimization Platform
>
> Posicionamiento: no solo medir costos LLM, sino **optimizarlos activamente**.

---

## Phase 0 — Foundation (COMPLETE)

Cerrar el loop de telemetria: SDK envia datos, API los guarda, Dashboard los muestra.

### 0.1 Fix SDK telemetry pipeline

- [x] `startOrchestrator({ apiKey, baseUrl })` debe usar esos parametros para enviar telemetria
- [x] Interceptar cada llamada LLM (OpenAI, Anthropic, Ollama) y capturar: tokens, costo, latencia, modelo, status
- [x] Enviar eventos via `POST /v1/ingest` con header `X-API-Key`
- [x] Hacer Redis opcional en el SDK (no fallar si no existe)
- [x] Batch events (buffer local, flush cada 5s o 50 eventos)

### 0.2 Fix ingestion auth

- [x] `/v1/ingest` debe aceptar `sdkApiKey` de la tabla `clients` (no solo org keys)
- [x] Validar key format: `aether_sdk_*`
- [x] Rate limiting por client

### 0.3 Dashboard shows real metrics

- [x] Endpoint `GET /api/client/metrics` — costos, tokens, requests por periodo
- [x] Endpoint `GET /api/client/metrics/by-model` — breakdown por modelo
- [x] Dashboard: grafico de costos en el tiempo
- [x] Dashboard: tabla de uso por modelo (tokens, costo, latencia promedio)
- [x] Dashboard: costo total del periodo actual

### 0.4 Publish SDK to npm

- [x] Cambiar `@aethermind/core` de workspace dependency a bundled/published
- [x] Configurar `publishConfig` en package.json
- [x] CI pipeline para publicar a npm en cada release tag
- [x] README con quickstart para clientes

**Exit criteria:** Un cliente puede hacer `npm install @aethermind/agent`, ejecutar agentes con sus keys, y ver metricas reales en el dashboard.

---

## Phase 1 — Cost Control (COMPLETE)

Diferenciador principal: control activo, no solo observacion.

### 1.1 Budgets & limits

- [x] Cliente define presupuesto mensual/diario desde el dashboard
- [x] SDK respeta limites — rechaza ejecuciones si se excede el budget
- [x] Alertas por email/webhook cuando se alcanza 80%, 90%, 100% del budget
- [ ] Alerta de anomalia: gasto inusual detectado (spike detection)

### 1.2 Usage analytics

- [x] Costo por agente individual
- [x] Costo por workflow/pipeline
- [x] Comparacion entre periodos (semana vs semana, mes vs mes)
- [x] Exportar reportes CSV

### 1.3 Cost forecasting

- [x] Proyeccion de gasto mensual basada en tendencia actual
- [x] Estimacion "si mantienes este ritmo, gastaras $X este mes"
- [x] Forecast por modelo individual

**Exit criteria:** Un cliente puede poner un limite de $100/mes y la plataforma lo respeta y le avisa antes de llegar.

---

## Phase 2 — Model Routing (Cost Optimization) (COMPLETE)

Ahorro automatico sin perder calidad.

### 2.1 Dynamic model routing

- [x] Clasificar complejidad del prompt (simple/medium/complex) — PromptClassifier heuristic
- [x] Routing rules: queries simples → modelo barato (GPT-4o-mini, Haiku), complejas → modelo potente (GPT-4o, Opus)
- [x] A/B testing automatico: comparar respuesta de modelo barato vs caro (ab-insights endpoint)
- [x] Metricas de calidad: el cliente puede marcar respuestas como buenas/malas (POST /telemetry/:id/rating)
- [x] Fallback automatico: si modelo barato falla o da baja calidad → retry con modelo potente

### 2.2 Provider routing

- [x] Si OpenAI tiene outage → fallback a Anthropic automaticamente (ProviderHealthService + SDK RouterService)
- [x] Routing por latencia: elegir el provider mas rapido disponible (health check con latencia)
- [ ] Routing por precio: misma capacidad, menor costo (pending: needs cross-provider price comparison)

### 2.3 Dashboard optimization view

- [x] "Podrias ahorrar $X/mes usando GPT-4o-mini para el 60% de tus queries" (optimization endpoint)
- [x] Recomendaciones automaticas basadas en patrones de uso (optimization data)
- [x] Boton para activar routing optimizado con un click (routing toggle in dashboard)

**Exit criteria:** Un cliente ahorra 30-50% en costos LLM sin cambiar su codigo, solo activando model routing.

---

## Phase 3 — Semantic Caching (COMPLETE)

Evitar llamadas LLM repetitivas.

### 3.1 Vector similarity cache

- [x] Embedding de cada prompt (modelo de embeddings barato) — EmbeddingService using text-embedding-3-small
- [x] Busqueda por similitud coseno: si un prompt similar ya se respondio, devolver respuesta cacheada — SemanticCacheService with cosine similarity
- [x] Threshold configurable por cliente (0.90 = estricto, 0.80 = agresivo) — cache_settings table
- [x] TTL configurable por tipo de query — ttlSeconds in cache_settings

### 3.2 Deterministic-first execution

- [x] Detectar queries que siempre dan la misma respuesta (ej: clasificacion, extraccion de datos) — DeterministicDetector cron
- [x] Cachear permanentemente queries deterministicas — isDeterministic flag, null TTL
- [x] Detectar automaticamente: si 5 ejecuciones identicas dan el mismo resultado → marcar como deterministica — hitCount >= 5 threshold

### 3.3 Cache analytics

- [x] Dashboard: cache hit rate, ahorro estimado por cache — CacheStatsCard component
- [x] "Este mes el cache te ahorro $X y Y llamadas" — totalSavedUsd in cache stats
- [x] Queries mas cacheadas (top patterns) — topCachedPrompts in stats endpoint

**Exit criteria:** Cache hit rate > 20% en uso tipico, ahorro visible en dashboard.

---

## Phase 4 — Prompt Optimization ✅

Reducir tokens sin perder calidad.

### 4.1 Prompt compression ✅

- [x] Analisis automatico de prompts: detectar redundancias y verbosidad (`PromptAnalyzer.ts`)
- [x] Sugerencias de compresion con 5 patrones: courtesy padding, verbose negation, repeated instructions, redundant list intros, context redundancy
- [x] Compresion automatica opcional (activable por cliente via `optimization_settings`)
- [x] SDK `CompressionService` integrado en interceptors (fail-open, 2s timeout)
- [x] Hook order: `checkCache → compress → checkBudget → resolveModelWithRouter → LLM → storeInCache`
- [x] Telemetry tracking: `compressionApplied`, `originalTokens`, `compressedTokens`, `tokensSaved`
- [x] Dashboard: Compression tab con toggle, stats, y Interactive Analyzer

### 4.2 System prompt optimization ✅

- [x] Detectar system prompts duplicados entre agentes via embeddings + cosine similarity
- [x] Sugerir templates optimizados por caso de uso (classification, extraction, summarization, qa)
- [x] Templates estaticos pre-optimizados (no LLM)
- [x] Dashboard: System Prompts tab con deteccion de duplicados y templates

**Exit criteria:** Reduccion promedio de 20-40% en tokens por request.

---

## Phase 5 — Learning Engine (COMPLETE)

Optimizacion basada en datos historicos.

### 5.1 Pattern detection ✅

- [x] Identificar patrones de uso recurrentes por hora/dia/semana — `UsagePatternService.detectPeakHours()` agrupa telemetry por hora (30 dias), retorna top 3 franjas de mayor costo
- [x] Detectar agentes sub-utilizados o sobre-utilizados — `detectUnderutilizedAgents()` (< 5 requests en 7 dias con actividad previa) + `detectOverloadedAgents()` (latencia promedio > 5000ms)
- [x] Sugerir consolidacion de agentes con funciones similares — `detectSimilarAgents()` compara system prompts via `EmbeddingService` + cosine similarity > 0.85
- [x] Tabla `client_insights` para almacenar todos los patrones detectados (tipos: `peak_hours`, `underutilized_agent`, `overloaded_agent`, `similar_agents`, `routing_suggestion`, `cache_suggestion`)
- [x] `PatternDetectionJob.ts` — cron cada domingo 00:00 UTC, procesa todos los clientes con actividad en los ultimos 7 dias
- [x] Endpoint `GET /api/client/insights/patterns` — retorna insights pendientes

### 5.2 Auto-tuning (sugerencias, nunca cambios automaticos) ✅

- [x] `CacheAutoTuner.ts`: analiza 14 dias de datos por cliente
  - Hit rate < 10% → sugerir bajar threshold a 0.85 (con ahorro estimado)
  - Hit rate > 40% + qualityRating 'bad' > 5% → sugerir subir threshold a 0.95
  - Guard: requiere >= 10% de respuestas con rating (evita sugerencias espurias con mayoria null)
- [x] `RoutingAutoTuner.ts`: analiza pares (originalModel, routedModel) con qualityRating
  - > 10% ratings 'bad' → sugerir revertir al modelo original
  - > 90% ratings 'good' + ahorro > $10/mes → sugerir extender al siguiente nivel de complejidad
  - Guard: requiere >= 10 rated + >= 10% rated ratio
- [x] Endpoints para aprobar/descartar: `POST /api/client/insights/:id/apply` (usa servicios existentes `cache_settings`, `routing_rules`) + `POST /api/client/insights/:id/dismiss`
- [x] Ambos tuners integrados en `PatternDetectionJob.ts` — mismo job, misma frecuencia

### 5.3 Benchmarking ✅

- [x] `BenchmarkService.ts`: metricas anonimas agregadas de todos los clientes con > 100 requests en el ultimo mes
- [x] Privacidad: si hay menos de 5 clientes en la muestra → retorna `null` (no calcula)
- [x] Metricas: `avgCostPerRequest`, `p50CostPerRequest`, `p90CostPerRequest`, `avgCacheHitRate`, `avgCompressionRatio`, `sampleSize`
- [x] Tabla `platform_benchmarks` con snapshots historicos
- [x] `BenchmarkJob.ts` — cron separado, cada lunes 02:00 UTC
- [x] Endpoint `GET /api/client/benchmarks` — retorna metricas del cliente vs benchmark + insights textuales generados programaticamente
- [x] Insights programaticos: "Tu costo por request es 2.5x el promedio — activa model routing."
- [x] Dashboard: pagina `/insights` — lista de sugerencias pendientes con impacto en USD, botones "Aplicar"/"Descartar", historial
- [x] Dashboard: card "Benchmark" en `/dashboard` — comparativa costo/cache/compresion vs plataforma (oculta si insufficient_data)
- [x] Dashboard: card "Insights de uso" en `/dashboard` — peak hours, agentes sub/sobreutilizados, badge "Nuevo" en no leidos

### Tests (54 passed)

- `UsagePatternService.test.ts` — 18 tests: peak hours, underutilized agents, overloaded agents, similar agents (con mock de embeddings), cosine similarity
- `CacheAutoTuner.test.ts` — 11 tests: hit rate bajo, hit rate alto con bad ratings, caso estable, mayoria qualityRating null
- `RoutingAutoTuner.test.ts` — 11 tests: routing con mala calidad, routing exitoso extensible, insufficient data, mayoria null
- `BenchmarkService.test.ts` — 14 tests: insights correctos para distintos escenarios, < 5 clientes, percentile calculation, zero values

**Exit criteria:** El sistema detecta patrones de uso, genera sugerencias de optimizacion basadas en qualityRating y metricas reales, y los clientes pueden compararse contra benchmarks anonimos de la plataforma. ✅

---

## Timeline estimado

| Phase   | Alcance                             | Dependencias                 |
| ------- | ----------------------------------- | ---------------------------- |
| Phase 0 | Foundation — telemetria funcionando | Ninguna                      |
| Phase 1 | Cost control — budgets y alertas    | Phase 0                      |
| Phase 2 | Model routing — ahorro automatico   | Phase 0 + datos de Phase 1   |
| Phase 3 | Semantic caching                    | Phase 0                      |
| Phase 4 | Prompt optimization                 | Phase 0 + datos acumulados   |
| Phase 5 | Learning engine                     | Phase 1-4 + datos historicos |

---

## Principios

1. **Sin datos no hay optimizacion** — Phase 0 es obligatoria antes de todo
2. **Ahorro visible** — cada feature debe mostrar cuanto dinero ahorra
3. **Zero friction** — el cliente instala el SDK, pone su key, y ya funciona
4. **No romper lo que funciona** — el SDK debe ser transparente, no cambiar el comportamiento del LLM
5. **Open metrics** — el cliente siempre ve exactamente que se mide y como
