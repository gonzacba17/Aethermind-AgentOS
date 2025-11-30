# Guía de Testing - Aethermind AgentOS

## Setup Rápido

```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar entorno
cp .env.example .env
# Editar .env con tus credenciales

# 3. Iniciar servicios
pnpm docker:up
pnpm db:migrate
pnpm prisma:generate
```

## Comandos de Testing

```bash
# Tests básicos
pnpm test                  # Tests unitarios
pnpm test:integration      # Tests de integración
pnpm test:e2e             # Tests E2E
pnpm test:api             # Tests de API
pnpm test:all             # Todos los tests

# Utilidades
pnpm test:watch           # Modo watch
pnpm test:coverage        # Con cobertura
pnpm test:smoke          # Smoke tests
pnpm validate            # Validar sistema
```

## Tipos de Tests

### Tests Unitarios (`tests/unit/` y `apps/api/tests/unit/`)

**Ejecutar**: `pnpm test`

**Archivos de test**:

- `tests/unit/OpenAIProvider.test.ts` - 33 tests (costos, reintentos, timeouts, tool calls)
- `tests/unit/PrismaStore.test.ts` - 58 tests (CRUD, paginación, traces, costs)
- `tests/unit/sanitizer.test.ts` - Sanitización de datos sensibles
- `apps/api/tests/unit/auth.test.ts` - Autenticación y middleware
- `apps/api/tests/unit/sanitizer.test.ts` - Sanitización en API

**Total**: ~100+ tests unitarios

### Tests de Integración (`tests/integration/`)

**Ejecutar**: `pnpm test:integration`

**Requisitos**: Redis corriendo

**Archivos de test**:

- `orchestrator.test.ts` - 37 tests (workflows multi-agente, costos, traces, cola Bull)

**Cobertura**:

- Workflows lineales y DAG
- Manejo de fallos y timeouts
- Queue management (Bull)
- Traces tree structure
- Cost accumulation

### Tests E2E (`tests/e2e/`)

**Ejecutar**: `pnpm test:e2e`

**Requisitos**: API corriendo en `http://localhost:3001`

**Archivos de test**:

- `full-workflow.test.ts` - Flujos completos del sistema end-to-end

### Tests de API (`tests/api/`)

**Ejecutar**: `pnpm test:api`

**Requisitos**: API corriendo

```bash
# En otra terminal
cd apps/api && pnpm dev
```

**Archivos de test**:

- `endpoints.test.ts` - Tests de endpoints principales
- `routes/agents.test.ts` - 32 tests (CRUD, validación Zod, auth middleware)

**Endpoints testeados**:

- `GET /health` - Health check
- `POST /api/agents` - Crear agente
- `GET /api/agents/:id` - Obtener agente
- `POST /api/agents/:id/execute` - Ejecutar agente
- `DELETE /api/agents/:id` - Eliminar agente
- `GET /api/logs` - Obtener logs
- `GET /api/traces/:id` - Obtener traces
- `GET /api/costs` - Obtener costos
- `POST /api/workflows` - Crear workflow

### Tests de WebSocket (`tests/websocket/`)

**Ejecutar**: `pnpm test:e2e` (incluidos)

**Requisitos**: API corriendo + API_KEY configurada

```bash
# Generar API key
pnpm generate-api-key
```

**Archivos de test**:

- `realtime.test.ts` - Conexión WebSocket, autenticación, mensajes en tiempo real

**Variables de entorno**:

```bash
WS_URL=ws://localhost:3001/ws
API_KEY=your-api-key
```

**Funcionalidades testeadas**:

- Autenticación via header y query parameter
- Subscripción a canales
- Mensajes en tiempo real (logs, agent events, workflow events)
- Ping/pong keepalive

## Smoke Tests

**Ejecutar**: `pnpm test:smoke`

**Requisitos**: API y Dashboard corriendo

Valida en 30 segundos:

1. ✅ API health check
2. ✅ Crear/obtener/eliminar agente
3. ✅ Ejecutar tarea
4. ✅ Logs y costos
5. ✅ Dashboard accesible

## Validación del Sistema

**Ejecutar**: `pnpm validate`

Verifica:

- ✅ Docker corriendo
- ✅ PostgreSQL y Redis activos
- ✅ API y Dashboard respondiendo
- ✅ Conexiones a base de datos
- ✅ Variables de entorno configuradas

## Configuraciones Jest

| Archivo                      | Timeout | Tests                                                |
| ---------------------------- | ------- | ---------------------------------------------------- |
| `jest.config.js`             | 10s     | Tests generales                                      |
| `jest.unit.config.js`        | 10s     | `tests/unit/**`, `apps/api/tests/unit/**`            |
| `jest.integration.config.js` | 30s     | `tests/integration/**`                               |
| `jest.e2e.config.js`         | 60s     | `tests/e2e/**`, `tests/api/**`, `tests/websocket/**` |

## Cobertura de Tests

**Estado actual**: 146+ tests implementados

**Coverage baseline**: 20% (lines, functions, branches, statements)

**Ejecutar coverage**:

```bash
pnpm test:coverage
# Ver reporte: coverage/index.html
```

**Distribución de tests**:

- Unit tests: ~100+ tests
- Integration tests: 37 tests
- E2E tests: ~10+ tests
- API tests: 32+ tests
- WebSocket tests: ~5+ tests

## Solución de Problemas

### Error: "Cannot find module '@prisma/client'"

```bash
pnpm prisma:generate
pnpm install
```

### Error: "ECONNREFUSED" (API/WebSocket)

```bash
cd apps/api && pnpm dev
```

### Error: "Redis connection failed"

```bash
pnpm docker:up
docker exec -i redis redis-cli ping  # Debe responder PONG
```

### Error: "Database connection failed"

```bash
pnpm docker:up
pnpm db:migrate
```

### Tests lentos

```bash
# Solo para unit tests
pnpm test -- --maxWorkers=4
```

### Timeout en E2E

```bash
# Aumentar timeout
JEST_TIMEOUT=90000 pnpm test:e2e
```

## Flujo de Trabajo

### Desarrollo

```bash
pnpm docker:up
pnpm test:watch
# Antes de commit:
pnpm test:all
```

### CI/CD

```bash
pnpm validate:deps
pnpm lint
pnpm typecheck
pnpm test:all
pnpm test:coverage
```

### Pre-Deploy

```bash
pnpm validate
pnpm test:smoke
pnpm test:e2e
pnpm build
```

## Estructura de Tests

```
tests/
├── unit/                    # Tests unitarios
│   ├── OpenAIProvider.test.ts (33 tests)
│   ├── PrismaStore.test.ts (58 tests)
│   └── sanitizer.test.ts
├── integration/             # Tests de integración
│   └── orchestrator.test.ts (37 tests)
├── e2e/                     # Tests end-to-end
│   └── full-workflow.test.ts
├── api/                     # Tests de API
│   ├── endpoints.test.ts
│   └── routes/
│       └── agents.test.ts (32 tests)
├── websocket/               # Tests de WebSocket
│   └── realtime.test.ts
└── setup/                   # Configuración de tests
    ├── globalSetup.ts
    ├── globalTeardown.ts
    └── testUtils.ts

apps/api/tests/
└── unit/                    # Tests unitarios de API
    ├── auth.test.ts
    └── sanitizer.test.ts
```

---

**Versión**: 0.1.0 | **Actualizado**: 2025-11-28
