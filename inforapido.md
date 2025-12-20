# Informe Rápido - Aethermind AgentOS

> **Generado el:** 2025-12-18
> **Proyecto:** Aethermind AgentOS v0.1.0
> **Propósito:** Plataforma FinOps para control de costos de IA

---

## 📋 RESUMEN DEL PROYECTO

**Aethermind AgentOS** es una **plataforma FinOps (Financial Operations) para Inteligencia Artificial** diseñada para empresas que necesitan controlar y prevenir costos excesivos de LLMs (Large Language Models) antes de que sucedan.

La plataforma ofrece:

- 💰 **Imposición de presupuestos** - Límites estrictos por equipo, agente o workflow con bloqueo automático
- 🚨 **Alertas inteligentes** - Notificaciones por email y Slack antes de exceder presupuestos
- 📊 **Pronóstico de costos** - Predicción de gastos de fin de mes con análisis histórico
- 👥 **Seguimiento por equipos** - Asignación de costos a departamentos y centros de costo
- 🤖 **Orquestación multi-agente** - Coordinación de agentes IA con visibilidad completa de costos
- 📈 **Monitoreo en tiempo real** - Dashboard en vivo con logs, trazas y visualización de ejecuciones
- 💸 **Transparencia de costos** - Seguimiento y estimación de costos de APIs de LLM antes de ejecutar
- 🔌 **Soporte multi-LLM** - OpenAI, Anthropic, Google y modelos locales (Ollama)

---

## 🏗️ ARQUITECTURA DEL PROYECTO

El proyecto es un **monorepo TypeScript** gestionado con **pnpm workspaces** y **Turborepo**, organizado en 3 áreas principales:

```
aethermind-agentos/
├── apps/           # Aplicaciones ejecutables
├── packages/       # Paquetes reutilizables
├── examples/       # Ejemplos de uso
├── tests/          # Suite de pruebas
├── docs/           # Documentación
├── scripts/        # Utilidades y automatización
└── prisma/         # Esquema de base de datos
```

---

## 📁 ESTRUCTURA DETALLADA - ARCHIVO POR ARCHIVO

### 📂 ROOT (Raíz del Proyecto)

#### Archivos de Configuración Principal

| Archivo                 | Propósito                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| **package.json**        | Configuración del monorepo principal, scripts globales (dev, build, test, docker), dependencias compartidas |
| **pnpm-workspace.yaml** | Define los workspaces del monorepo (packages/_, apps/_, examples/\*)                                        |
| **turbo.json**          | Configuración de Turborepo para builds y caching optimizado                                                 |
| **tsconfig.base.json**  | Configuración base de TypeScript compartida por todos los paquetes                                          |

#### Archivos de Entorno y Secretos

| Archivo                      | Propósito                                                      |
| ---------------------------- | -------------------------------------------------------------- |
| **.env**                     | Variables de entorno locales (no versionado, contiene secrets) |
| **.env.example**             | Plantilla de variables de entorno sin valores sensibles        |
| **.env.local**               | Variables específicas del entorno local                        |
| **.env.production.example**  | Plantilla para producción con todas las variables necesarias   |
| **.env.sentry-build-plugin** | Configuración específica para Sentry y build plugins           |

#### Docker y Despliegue

| Archivo                | Propósito                                                                       |
| ---------------------- | ------------------------------------------------------------------------------- |
| **docker-compose.yml** | Orquestación de servicios Docker (PostgreSQL, Redis, API) para desarrollo local |
| **Dockerfile**         | Imagen Docker principal para el API                                             |
| **Dockerfile.railway** | Imagen optimizada para despliegue en Railway                                    |
| **Dockerfile.prisma**  | Imagen específica para ejecutar migraciones Prisma                              |
| **railway.json**       | Configuración de despliegue para Railway                                        |
| **vercel.json**        | Configuración de despliegue para Vercel (dashboard)                             |
| **.vercelignore**      | Archivos ignorados en builds de Vercel                                          |
| **.dockerignore**      | Archivos excluidos de las imágenes Docker                                       |

#### Git y Control de Versiones

| Archivo        | Propósito                                              |
| -------------- | ------------------------------------------------------ |
| **.gitignore** | Archivos y carpetas ignorados por Git                  |
| **.github/**   | Workflows de CI/CD y configuraciones de GitHub Actions |
| **.husky/**    | Git hooks para validación pre-commit (linting, tests)  |

#### Testing

| Archivo                        | Propósito                                 |
| ------------------------------ | ----------------------------------------- |
| **jest.config.js**             | Configuración principal de Jest           |
| **jest.unit.config.js**        | Tests unitarios específicos               |
| **jest.integration.config.js** | Tests de integración                      |
| **jest.e2e.config.js**         | Tests end-to-end                          |
| **jest.simple.config.js**      | Configuración simplificada para debugging |

#### Scripts de Utilidad

| Archivo                           | Propósito                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------- |
| **setup-aethermind.ps1**          | Script PowerShell para configuración inicial automática del proyecto en Windows |
| **run-migration.ps1**             | Ejecuta migraciones de Prisma en PowerShell                                     |
| **test-aethermind-api.sh**        | Script bash para probar el API                                                  |
| **test-with-auth.sh**             | Prueba endpoints con autenticación                                              |
| **test-budget-enforcement.js**    | Valida que el sistema de presupuestos funcione correctamente                    |
| **audit-production-readiness.sh** | Auditoría de preparación para producción                                        |
| **verify-prisma.mjs**             | Verifica que Prisma esté correctamente configurado                              |

#### Documentación del Proyecto

| Archivo                | Propósito                                                   |
| ---------------------- | ----------------------------------------------------------- |
| **README.md**          | Documentación principal del proyecto, quick start, features |
| **CLEANUP_PLAN.md**    | Plan de limpieza y refactorización del código               |
| **MIGRATION_GUIDE.md** | Guía de migración entre versiones                           |
| **CONTRIBUTING.md**    | Guías para contribuidores                                   |
| **LICENSE**            | Licencia MIT del proyecto                                   |

#### Archivos Misceláneos

| Archivo            | Propósito                                                                  |
| ------------------ | -------------------------------------------------------------------------- |
| **renovate.json**  | Configuración de Renovate para actualizaciones automáticas de dependencias |
| **.nvmrc**         | Versión de Node.js requerida (para `nvm`)                                  |
| **Claude.bat**     | Script batch para ejecutar Claude AI en Windows                            |
| **pnpm-lock.yaml** | Lock file de dependencias de pnpm (garantiza instalaciones reproducibles)  |

---

### 📂 apps/ - Aplicaciones Ejecutables

#### apps/api/ - Servidor API REST + WebSocket

**Propósito:** Backend principal que expone la API REST para gestión de agentes, ejecuciones, costos, workflows, presupuestos y autenticación.

**Estructura:**

```
apps/api/
├── src/
│   ├── index.ts              # Punto de entrada, inicializa Express, WebSocket, middleware, rutas
│   ├── config/               # Configuraciones (database, Redis, providers)
│   ├── middleware/           # Auth, rate limiting, validación, sanitización
│   ├── routes/               # Endpoints REST (agents, executions, costs, workflows, budgets, auth, traces)
│   ├── services/             # Lógica de negocio (BudgetService, AlertService, CostEstimationService)
│   ├── lib/                  # Utilidades de base de datos y Redis
│   ├── websocket/            # Gestión de conexiones WebSocket para logs en tiempo real
│   └── utils/                # Helpers y utilitarios
├── tests/                    # Tests específicos del API
├── package.json              # Dependencias: express, prisma, bcryptjs, jsonwebtoken, ws, cors, helmet
└── tsconfig.json             # Configuración TypeScript para el API
```

**Archivos clave:**

| Archivo                                   | Funcionalidad                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **src/index.ts**                          | Configura Express, middleware de seguridad (helmet, cors, rate-limit), rutas, WebSocket, conexión a DB/Redis, manejo de errores |
| **src/middleware/auth.ts**                | Autenticación mediante API keys, validación de JWT (Google OAuth)                                                               |
| **src/middleware/validator.ts**           | Validación de requests con Zod schemas                                                                                          |
| **src/middleware/sanitizer.ts**           | Sanitización de inputs para prevenir XSS/injection                                                                              |
| **src/routes/agents.ts**                  | CRUD de agentes IA                                                                                                              |
| **src/routes/executions.ts**              | CRUD de ejecuciones y gestión de estados                                                                                        |
| **src/routes/costs.ts**                   | Endpoints para tracking de costos y presupuestos                                                                                |
| **src/routes/workflows.ts**               | CRUD de workflows (definiciones de flujos multi-agente)                                                                         |
| **src/routes/budgets.ts**                 | Gestión de presupuestos, alertas y enforcement                                                                                  |
| **src/routes/auth.ts**                    | Login, registro, Google OAuth, verificación de email                                                                            |
| **src/routes/traces.ts**                  | Visualización de trazas de ejecución                                                                                            |
| **src/services/BudgetService.ts**         | Lógica de enforcement de presupuestos, bloqueo de ejecuciones                                                                   |
| **src/services/AlertService.ts**          | Envío de alertas por email y Slack cuando se alcanzan umbrales                                                                  |
| **src/services/CostEstimationService.ts** | Estimación de costos antes de ejecutar (basado en modelos y prompts)                                                            |
| **src/websocket/websocket.ts**            | Streaming de logs en tiempo real al dashboard                                                                                   |

---

### 📂 packages/ - Paquetes Reutilizables

#### packages/core/ - Framework de Orquestación de Agentes

**Propósito:** Librería principal que contiene la lógica de orquestación de agentes, proveedores de LLM, gestión de estado, workflows y validaciones.

**Estructura:**

```
packages/core/
├── src/
│   ├── agent/                # Definición y gestión de agentes
│   ├── orchestrator/         # Motor de orquestación multi-agente
│   ├── providers/            # Proveedores LLM (OpenAI, Anthropic, Ollama, Google)
│   ├── workflow/             # Ejecución de workflows (DAG de agentes)
│   ├── queue/                # Sistema de colas con BullMQ y Redis
│   ├── services/             # Servicios core (CostTrackingService)
│   ├── state/                # Gestión de estado compartido entre agentes
│   ├── logger/               # Sistema de logging estructurado
│   ├── errors/               # Errores personalizados del framework
│   ├── validation/           # Schemas Zod para validación
│   ├── types/                # Tipos TypeScript compartidos
│   └── utils/                # Utilidades generales
├── tests/                    # Tests unitarios de core
└── package.json              # Dependencias: zod, bullmq, ioredis, eventemitter3
```

**Archivos clave:**

| Archivo                                 | Funcionalidad                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| **src/agent/Agent.ts**                  | Clase base para agentes, definición de configuración y métodos de ejecución          |
| **src/orchestrator/Orchestrator.ts**    | Motor que coordina la ejecución de múltiples agentes, gestiona dependencias y flujo  |
| **src/providers/OpenAIProvider.ts**     | Integración con OpenAI (GPT-3.5, GPT-4, embeddings)                                  |
| **src/providers/AnthropicProvider.ts**  | Integración con Anthropic Claude (v3, v3.5)                                          |
| **src/providers/OllamaProvider.ts**     | Integración con Ollama (modelos locales)                                             |
| **src/providers/GoogleProvider.ts**     | Integración con Google Gemini                                                        |
| **src/workflow/WorkflowEngine.ts**      | Ejecuta workflows definidos como DAG (Directed Acyclic Graph)                        |
| **src/queue/TaskQueue.ts**              | Sistema de colas para ejecuciones asíncronas con reintentos                          |
| **src/services/CostTrackingService.ts** | Tracking en memoria de costos y tokens consumidos                                    |
| **src/state/StateManager.ts**           | Gestión de estado compartido entre agentes de un workflow                            |
| **src/logger/Logger.ts**                | Logger estructurado con niveles (debug, info, warn, error)                           |
| **src/validation/schemas.ts**           | Schemas Zod para validar configuraciones de agentes y workflows                      |
| **src/types/index.ts**                  | Tipos TypeScript exportados (AgentConfig, WorkflowDefinition, ExecutionResult, etc.) |

#### packages/sdk/ - SDK para Desarrolladores

**Propósito:** SDK simplificado que expone funciones de alto nivel para que los desarrolladores creen agentes y workflows fácilmente.

**Estructura:**

```
packages/sdk/
├── src/
│   └── index.ts              # Exporta createAgent, startOrchestrator, executeWorkflow
└── package.json
```

**Funcionalidad:** Wrapper sobre `@aethermind/core` con APIs amigables para developers.

#### packages/dashboard/ - Dashboard Next.js

**Propósito:** Aplicación web Next.js 16 que proporciona la interfaz visual para monitoreo de agentes, logs, costos, workflows y presupuestos.

**Estructura:**

```
packages/dashboard/
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── page.tsx          # Landing page (marketing)
│   │   ├── dashboard/        # Dashboard protegido
│   │   ├── login/            # Página de login
│   │   └── api/              # API routes de Next.js (Sentry test, OAuth callbacks)
│   ├── components/           # Componentes React (AgentList, CostChart, LogViewer, etc.)
│   ├── lib/                  # Utilities (API client, formatters)
│   └── styles/               # CSS global y Tailwind
├── public/                   # Assets estáticos (logo, imágenes)
├── next.config.js            # Configuración Next.js + Sentry
├── tailwind.config.js        # Configuración Tailwind CSS
├── instrumentation.ts        # Sentry instrumentation
└── package.json              # Dependencias: next, react, tailwindcss, recharts, sentry
```

**Archivos clave:**

| Archivo                              | Funcionalidad                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| **src/app/page.tsx**                 | Landing page con features, pricing, quick start                              |
| **src/app/dashboard/page.tsx**       | Dashboard principal con lista de agentes, gráficos de costos, logs recientes |
| **src/app/login/page.tsx**           | Login con email/password y Google OAuth                                      |
| **src/components/AgentList.tsx**     | Lista de agentes con estado, modelo, última ejecución                        |
| **src/components/CostChart.tsx**     | Gráfico de costos (Recharts) con breakdown por modelo y periodo              |
| **src/components/LogViewer.tsx**     | Visualización de logs en tiempo real con WebSocket                           |
| **src/components/BudgetManager.tsx** | Gestión visual de presupuestos, alertas y enforcement                        |
| **src/lib/api-client.ts**            | Cliente HTTP para comunicarse con el API backend                             |
| **sentry.client.config.ts**          | Configuración Sentry para frontend                                           |
| **sentry.server.config.ts**          | Configuración Sentry para serverside                                         |

#### packages/types/ - Tipos Compartidos

**Propósito:** Tipos TypeScript compartidos entre todos los paquetes para garantizar consistencia.

#### packages/api-client/ - Cliente API

**Propósito:** Cliente HTTP tipado para consumir el API desde el dashboard u otros clientes.

#### packages/create-aethermind-app/ - CLI Scaffolding

**Propósito:** Herramienta CLI para generar nuevos proyectos con Aethermind (similar a `create-react-app`).

#### packages/vscode-extension/ - Extensión VSCode

**Propósito:** Extensión de Visual Studio Code para debugging y desarrollo de agentes (en desarrollo).

---

### 📂 prisma/ - Base de Datos

**Propósito:** Esquema Prisma ORM que define los modelos de base de datos PostgreSQL.

| Archivo           | Funcionalidad                                                  |
| ----------------- | -------------------------------------------------------------- |
| **schema.prisma** | Definición completa del esquema de base de datos con 9 modelos |

**Modelos de Base de Datos:**

| Modelo        | Descripción                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------- |
| **User**      | Usuarios del sistema con autenticación, planes de suscripción, límites de uso, integración Stripe |
| **Agent**     | Agentes IA creados por usuarios (nombre, modelo, configuración JSON)                              |
| **Execution** | Ejecuciones de agentes con input/output, estado, tiempos, errores                                 |
| **Log**       | Logs de ejecuciones con niveles (info, error, debug) y metadata                                   |
| **Trace**     | Trazas de flujo de ejecución (árbol de llamadas) para debugging                                   |
| **Cost**      | Registro de costos por ejecución (tokens prompt/completion, costo en USD, modelo)                 |
| **Workflow**  | Workflows guardados (definiciones JSON de flujos multi-agente)                                    |
| **Budget**    | Presupuestos con límites, periodos (daily, monthly), scopes (global, agent, workflow), alertas    |
| **AlertLog**  | Histórico de alertas enviadas (email, Slack) con éxito/error                                      |

---

### 📂 docs/ - Documentación

**Documentación completa del proyecto:**

| Archivo                    | Contenido                                             |
| -------------------------- | ----------------------------------------------------- |
| **README.md**              | Índice de la documentación                            |
| **INSTALLATION.md**        | Guía de instalación paso a paso                       |
| **API.md**                 | Referencia completa del API REST con ejemplos         |
| **ARCHITECTURE.md**        | Arquitectura técnica, diagramas, decisiones de diseño |
| **DEVELOPMENT.md**         | Guía para desarrolladores y contribuidores            |
| **DEPLOYMENT.md**          | Instrucciones de despliegue (Railway, Vercel, Docker) |
| **TESTING.md**             | Guía de testing, coverage, mejores prácticas          |
| **SECURITY.md**            | Políticas de seguridad, reporte de vulnerabilidades   |
| **FAQ.md**                 | Preguntas frecuentes                                  |
| **ROADMAP.md**             | Roadmap de features futuras                           |
| **CHANGELOG.md**           | Historial de cambios por versión                      |
| **RAILWAY-CHECKLIST.md**   | Checklist de despliegue en Railway                    |
| **VERCEL-CHECKLIST.md**    | Checklist de despliegue en Vercel                     |
| **VERIFICATION.md**        | Guía de verificación post-deployment                  |
| **AUDITORIA_TECNICA.md**   | Auditoría técnica de seguridad, performance, calidad  |
| **ESTRUCTURA.md**          | Documentación detallada de la estructura del proyecto |
| **openapi.yaml**           | Especificación OpenAPI 3.0 del API                    |
| **docs/archive/**          | Documentos históricos de decisiones técnicas          |
| **docs/audits/**           | Reportes de auditorías                                |
| **docs/planned-features/** | Features planificadas para versiones futuras          |

---

### 📂 scripts/ - Scripts de Automatización

**Utilidades para validación, testing, diagnostico y mantenimiento:**

| Script                             | Funcionalidad                                               |
| ---------------------------------- | ----------------------------------------------------------- |
| **validate-mvp.js**                | Valida que el MVP esté completo y funcional                 |
| **validate-and-run.ts**            | Validación exhaustiva + ejecución del sistema               |
| **diagnose.ts**                    | Diagnóstico completo del sistema (DB, Redis, API, env vars) |
| **generate-api-key.ts**            | Genera API keys hasheadas para usuarios                     |
| **generate-production-secrets.ts** | Genera secrets seguros para producción (JWT, cookies)       |
| **smoke-test.js**                  | Smoke tests rápidos de endpoints críticos                   |
| **production-health-check.sh**     | Health check para entornos de producción                    |
| **run-all-tests.ps1**              | Ejecuta toda la suite de tests en PowerShell                |
| **test-sanitizer.js**              | Tests del middleware de sanitización                        |
| **test-without-redis.sh**          | Tests sin Redis (para verificar graceful fallback)          |
| **migrate-db.js**                  | Ejecuta migraciones de Prisma                               |
| **init.sql**                       | Script SQL de inicialización de base de datos               |
| **scripts/archive/**               | Scripts históricos deprecados                               |

---

### 📂 tests/ - Suite de Pruebas

**Tests organizados por tipo:**

```
tests/
├── unit/                     # Tests unitarios de funciones aisladas
├── integration/              # Tests de integración entre componentes
├── e2e/                      # Tests end-to-end del flujo completo
├── api/                      # Tests específicos de endpoints API
├── websocket/                # Tests de WebSocket
└── setup/                    # Setup global de Jest, fixtures, mocks
```

**Cobertura:** ~60% global

- Routes API: ~70%
- Providers LLM: ~75%
- Services: ~50%
- Validation: ~90%
- Middleware: ~80%

---

### 📂 examples/ - Ejemplos de Uso

#### examples/basic-agent/

**Ejemplos de implementación para developers:**

| Archivo                 | Propósito                                         |
| ----------------------- | ------------------------------------------------- |
| **full-demo.ts**        | Demo completa del sistema con agente investigador |
| **simple-agent.ts**     | Ejemplo minimalista de creación de agente         |
| **workflow-example.ts** | Ejemplo de workflow multi-agente                  |
| **README.md**           | Documentación de ejemplos                         |

---

## 🔧 TECNOLOGÍAS UTILIZADAS

### Backend (apps/api)

- **Node.js** v20+ - Runtime
- **Express** - Framework web
- **TypeScript** - Type safety
- **Prisma** v6.19.0 - ORM
- **PostgreSQL** - Base de datos principal
- **Redis** (opcional) - Caching y pub/sub con graceful fallback
- **bcryptjs** - Hashing de passwords
- **jsonwebtoken** - Autenticación JWT
- **ws** - WebSocket server
- **helmet** - Security headers
- **cors** - CORS middleware
- **express-rate-limit** - Rate limiting

### Core (packages/core)

- **TypeScript** - Type safety
- **Zod** - Schema validation
- **BullMQ** - Task queues
- **ioredis** - Redis client
- **eventemitter3** - Event emitters
- **chokidar** - File watching

### Frontend (packages/dashboard)

- **Next.js** 16 - Framework React
- **React** 19 - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Recharts** - Gráficos
- **Sentry** - Error tracking
- **Radix UI** - Componentes accesibles

### DevOps

- **Turborepo** - Monorepo build system
- **pnpm** v9 - Package manager
- **Docker** - Containerización
- **Railway** - Deployment API
- **Vercel** - Deployment dashboard
- **Husky** - Git hooks
- **Jest** - Testing framework
- **GitHub Actions** - CI/CD

---

## 🚀 FLUJO DE TRABAJO PRINCIPAL

1. **Usuario crea un agente** → Dashboard envía POST /agents al API
2. **API valida y guarda en PostgreSQL** → Prisma ORM
3. **Usuario ejecuta el agente** → POST /executions
4. **API verifica presupuesto** → BudgetService chequea límites
5. **Si hay presupuesto:**
   - Crea ejecución en DB con estado "running"
   - Core Orchestrator ejecuta el agente
   - Provider (OpenAI/Anthropic) hace la llamada al LLM
   - Se trackean tokens y costos
   - Se actualizan costos en DB
   - Se envían logs en tiempo real vía WebSocket
6. **Si se alcanza umbral de presupuesto:**
   - AlertService envía email/Slack
   - Si es hard limit, se bloquean nuevas ejecuciones
7. **Dashboard muestra resultados** → Streaming de logs, costos, estado

---

## 📊 MÉTRICAS DEL PROYECTO

- **Lenguajes:** TypeScript (99%), JavaScript (1%)
- **Archivos de código:** ~150+
- **Líneas de código:** ~15,000+
- **Paquetes:** 7 workspaces
- **Tests:** 254+ casos de prueba
- **Cobertura de tests:** ~60%
- **Endpoints API:** ~30+
- **Modelos de base de datos:** 9
- **Dependencias principales:** 50+

---

## 🎯 CARACTERÍSTICAS DE SEGURIDAD

- ✅ Autenticación con API keys (bcrypt)
- ✅ JWT para Google OAuth
- ✅ Rate limiting en todos los endpoints
- ✅ CORS configurado
- ✅ Helmet para security headers
- ✅ Sanitización de inputs
- ✅ Validación con Zod schemas
- ✅ WebSocket authentication
- ✅ Manejo seguro de credenciales
- ✅ Sentry para error tracking

---

## 📦 COMANDOS PRINCIPALES

```bash
# Desarrollo
pnpm install              # Instalar dependencias
pnpm dev                  # Iniciar todo en modo dev
pnpm dev:api              # Solo el API
pnpm dev:dashboard        # Solo el dashboard

# Testing
pnpm test                 # Tests unitarios
pnpm test:integration     # Tests de integración
pnpm test:e2e             # Tests end-to-end
pnpm test:coverage        # Tests con coverage

# Build
pnpm build                # Build de producción
pnpm typecheck            # Verificar tipos TypeScript

# Database
pnpm db:migrate           # Ejecutar migraciones
pnpm db:migrate:dev       # Migraciones en dev
pnpm db:studio            # Abrir Prisma Studio
pnpm db:seed              # Seed inicial de DB

# Docker
pnpm docker:up            # Iniciar servicios Docker
pnpm docker:down          # Detener servicios
pnpm docker:logs          # Ver logs de Docker

# Utilidades
pnpm validate             # Validar MVP
pnpm diagnose             # Diagnosticar sistema
pnpm generate-api-key     # Generar API key
pnpm demo                 # Ejecutar demo
```

---

## 🔗 INTEGRACIONES EXTERNAS

### Proveedores LLM

- **OpenAI** - GPT-3.5, GPT-4
- **Anthropic** - Claude v3, v3.5
- **Google** - Gemini
- **Ollama** - Modelos locales

### Servicios de Alertas

- **Email** - SMTP para notificaciones
- **Slack** - Webhooks para alertas en tiempo real

### Monitoring

- **Sentry** - Error tracking y performance monitoring

### Pagos (preparado)

- **Stripe** - Billing y suscripciones (campos en User model)

---

## 📝 PRÓXIMOS PASOS / ROADMAP

Según `docs/ROADMAP.md`:

**Fase 1 - FinOps Core** ✅ (Completado)

- Presupuestos con enforcement
- Alertas email/Slack
- Dashboard de costos

**Fase 2 - Enterprise Features** (En progreso)

- Multi-tenancy
- RBAC (Role-Based Access Control)
- SSO/SAML
- Advanced analytics

**Fase 3 - Optimización IA**

- Prompt caching
- Model routing automático
- Cost optimization suggestions

**Fase 4 - Scale**

- Multi-region support
- Advanced observability
- Custom integrations

---

## 📞 SOPORTE Y CONTACTO

- **Issues:** GitHub Issues
- **Documentación:** `/docs`
- **Email:** (configurar en vars de entorno)
- **Slack:** (webhook en vars de entorno)

---

**Última actualización:** 2025-12-18
**Versión del informe:** 1.0
**Generado por:** Antigravity AI Assistant
