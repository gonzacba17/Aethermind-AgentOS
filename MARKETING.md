# Aethermind AgentOS — Descripción del Proyecto

## Qué es

Aethermind AgentOS es una plataforma B2B SaaS que permite a empresas monitorear, analizar y optimizar el uso de modelos de lenguaje (LLMs) en tiempo real. Funciona como una capa de observabilidad entre tu aplicación y los proveedores de IA — sin modificar tu código existente.

## El problema que resuelve

Las empresas que integran IA en sus productos enfrentan un problema invisible: **no saben cuánto gastan, qué modelos usan más, ni cuándo se disparan los costos.**

- Un endpoint que usa GPT-4o puede costar 10x más que uno con GPT-4o-mini, pero sin telemetría nadie lo nota.
- Los costos de LLMs escalan de forma impredecible — un spike de tráfico puede generar una factura inesperada de miles de dólares.
- No existe un estándar para medir latencia, tasa de errores o eficiencia por modelo o por agente.
- Equipos de desarrollo toman decisiones de modelo "a ciegas", sin datos de costo/rendimiento reales.

Aethermind resuelve esto dándole a cada equipo visibilidad completa sobre su consumo de IA desde el minuto uno.

## Cómo funciona

La integración toma 2 minutos y no requiere cambiar código:

```bash
npx @aethermind/setup
```

El CLI detecta tu proyecto, te pide la API key, instala el SDK y configura las variables de entorno automáticamente. A partir de ese momento, cada llamada a OpenAI, Anthropic, Gemini u Ollama se intercepta de forma transparente y envía telemetría al dashboard.

**Flujo técnico:**
1. El SDK intercepta las llamadas a los proveedores de IA mediante monkey-patching del SDK del proveedor.
2. Captura tokens, costos, latencia, modelo usado, estado (éxito/error) y metadata del agente.
3. Envía los eventos en batch al backend vía `POST /v1/ingest` con autenticación por API key.
4. El dashboard muestra las métricas en tiempo real vía WebSocket.

## Funcionalidades actuales

### Dashboard con métricas en tiempo real
- KPIs principales: costo total, tokens consumidos, requests totales, latencia promedio.
- Distribución de requests por modelo y proveedor.
- Breakdown de costos por modelo con gráficos de tendencia temporal.
- Actualización en tiempo real vía WebSocket.

### Soporte multi-proveedor
- **OpenAI** — intercepta `chat.completions.create()` incluyendo streaming.
- **Anthropic** — intercepta `messages.create()` incluyendo streaming.
- **Google Gemini** — intercepta llamadas al API de Gemini.
- **Ollama** — soporta Chat API, Generate API y modo OpenAI-compatible.

### Logs de cada llamada individual
- Registro detallado de cada request a un LLM.
- Streaming en vivo de logs vía WebSocket.
- Filtros por nivel (debug, info, warn, error), agente y búsqueda de texto.
- Exportación de logs.

### Budgets y alertas configurables
- Límites de presupuesto duros (bloquean ejecución al excederse).
- Alertas automáticas al 80% y 100% del presupuesto.
- Notificaciones por email vía SendGrid.
- Presupuestos configurables por usuario, agente o workflow.

### Forecasting de costos
- Predicciones de costos a 7, 14 y 30 días.
- Intervalos de confianza (límite superior e inferior).
- Detección de tendencias mediante regresión.
- Detección de patrones estacionales (horarios, diarios, semanales).

### Optimization recommendations
- Sugerencias de routing: usar modelos más baratos para tareas simples.
- Comparación de costos entre modelos con estimación de ahorro.
- Detección de redundancias en prompts (padding innecesario, instrucciones repetidas, negaciones verbosas).
- Recomendaciones de compresión de prompts con impacto estimado en USD.

### Smart Routing
- Clasificación automática de complejidad del prompt.
- Ruteo dinámico al modelo óptimo según complejidad (simple → GPT-4o-mini, complejo → GPT-4o).
- Fallback automático a otro proveedor si el primario falla.
- Monitoreo de salud de proveedores.

### Semantic Caching
- Cache de respuestas basado en similitud semántica (embeddings con text-embedding-3-small).
- Threshold de similitud configurable (0.80–0.95).
- Detección de queries determinísticas para cache permanente.
- TTL configurable por entrada.

### Prompt Compression
- Detección automática de redundancias en prompts.
- Compresión transparente con fail-open (si falla, usa el prompt original).
- Tracking de tokens ahorrados por compresión.

### Learning Engine
- Detección de patrones de uso: horas pico, agentes subutilizados, agentes similares.
- Auto-tuning de thresholds de cache y reglas de routing basado en feedback.
- Benchmarking anónimo contra la plataforma (privacy-preserving, mínimo 5 clientes).
- Panel de insights con impacto estimado en USD y acciones aplicables.

### Distributed Tracing
- Trazas compatibles con OpenTelemetry.
- Visualización de spans padre-hijo.
- Tracking de estado por span (ok, error).

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend / Dashboard | Next.js 16, React 19, TypeScript, Tailwind CSS, Recharts, Radix UI |
| Backend / API | Express.js 4, Node.js 20+, TypeScript |
| Base de datos | PostgreSQL 16 (Drizzle ORM), 24 tablas |
| Real-time | WebSocket (ws / Socket.io) |
| ML / Forecasting | Motor propio de regresión y detección de anomalías |
| Infraestructura | Railway (API), Vercel (Dashboard), npm (SDKs) |
| Monorepo | pnpm workspaces + Turborepo |

### Paquetes SDK publicados en npm

| Paquete | Versión | Descripción |
|---------|---------|-------------|
| `@aethermind/agent` | 0.1.5 | SDK core — interceptores, transporte, budget checker, cache, compresión |
| `@aethermind/providers` | 0.1.1 | Instancias plug-and-play de OpenAI, Anthropic y Gemini con telemetría integrada |
| `@aethermind/setup` | 0.1.2 | CLI de setup — configuración automática en 2 minutos |

## Público objetivo

- **Startups y scale-ups** que usan LLMs en producción y necesitan controlar costos antes de que escalen.
- **Empresas de desarrollo web y software** que integran IA en productos para sus clientes.
- **Equipos de ingeniería** que operan múltiples agentes de IA y necesitan observabilidad centralizada.
- **CTOs y engineering managers** que necesitan reportes de gasto en IA para tomar decisiones informadas.

## Propuesta de valor

> **"Instalás en 2 minutos, sin tocar tu código, y sabés exactamente cuánto te cuesta cada llamada a la IA."**

- **Zero-code integration**: `npx @aethermind/setup` configura todo automáticamente.
- **Multi-proveedor**: OpenAI, Anthropic, Gemini y Ollama en un solo dashboard.
- **Ahorro activo**: smart routing, semantic caching y prompt compression reducen costos sin intervención manual.
- **Predicción**: forecasting de costos para evitar sorpresas en la facturación.
- **Control**: budgets con límites duros y alertas automáticas.

## Estado actual

MVP funcional en fase de testing. La plataforma está desplegada en producción (API en Railway, Dashboard en Vercel, SDKs publicados en npm). Se está validando con usuarios early-adopter antes del lanzamiento público.
