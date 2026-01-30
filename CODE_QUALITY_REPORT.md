# Reporte de Calidad de Código - Aethermind AgentOS

**Fecha:** 2026-01-29
**Analizado por:** Claude Code
**Versión del proyecto:** 0.1.0

---

## Resumen Ejecutivo

| Categoría | Crítico | Medio | Bajo | Total |
|-----------|---------|-------|------|-------|
| Seguridad | 7 | 8 | 9 | 24 |
| Code Smells | 23 | 59 | 3 | 85 |
| Código Duplicado | 10 | 7 | 3 | 20 |
| Código Muerto | 3 | 6 | 5 | 14 |
| **TOTAL** | **43** | **80** | **20** | **143** |

**Estimación de código afectado:** ~5,000+ líneas
**Archivos críticos:** 15 archivos requieren atención inmediata

---

## HALLAZGOS CRÍTICOS (Prioridad 1 - Inmediato)

### 1. Seguridad: Open Redirect en OAuth
**Severidad:** CRÍTICO
**Archivo:** `apps/api/src/routes/oauth.ts:31-43, 71-74, 119-123`

```typescript
// VULNERABLE - No valida URL de redirect
const redirect = req.query.redirect as string;
res.redirect(redirect); // Atacante puede redirigir a sitio malicioso
```

**Impacto:** Token hijacking, phishing
**Solución:**
```typescript
const ALLOWED_REDIRECTS = [
  'https://aethermind-page.vercel.app',
  'https://aethermind-agent-os-dashboard.vercel.app',
  'http://localhost:3000'
];

const redirect = req.query.redirect as string;
if (!ALLOWED_REDIRECTS.some(url => redirect.startsWith(url))) {
  return res.status(400).json({ error: 'Invalid redirect URL' });
}
```

---

### 2. Seguridad: API Key Encryption con Fallback Inseguro
**Severidad:** CRÍTICO
**Archivo:** `apps/api/src/routes/user-api-keys.ts:10, 15-19`

```typescript
// VULNERABLE - Default key hardcodeado
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY || 'default-key-change-in-production!';
```

**Impacto:** Todas las API keys pueden ser desencriptadas si no se configura la variable
**Solución:**
```typescript
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  throw new Error('ENCRYPTION_KEY must be set in production');
}
```

---

### 3. Seguridad: Falta Rate Limiting en Verificación de Email
**Severidad:** CRÍTICO
**Archivo:** `apps/api/src/routes/auth.ts:175-208`

```typescript
// VULNERABLE - Sin rate limiting
router.post('/verify-email', async (req: Request, res: Response) => {
```

**Impacto:** Brute force de tokens de verificación
**Solución:** Añadir `authRateLimiter` al endpoint

---

### 4. Código: Uso Extensivo de `any` Type
**Severidad:** CRÍTICO
**Archivos afectados:** 15+ archivos, 50+ instancias

| Archivo | Líneas | Ejemplo |
|---------|--------|---------|
| `apps/api/src/index.ts` | 299, 303, 313, 466, 756 | `(event: any)`, `details: any` |
| `apps/api/src/routes/agents.ts` | 18 | `req.query as any` |
| `apps/api/src/middleware/auth.ts` | 126 | `jwt.verify() as any` |
| `apps/api/src/budget/guard.ts` | 225, 312, 416 | `budget: any` |
| `apps/api/src/utils/metrics.ts` | 5-16 | `{} as any` |

**Impacto:** Pérdida total de type safety, bugs en runtime
**Solución:** Crear interfaces específicas para cada caso

---

### 5. Código: Archivos Excesivamente Largos (>500 líneas)
**Severidad:** CRÍTICO

| Archivo | Líneas | Responsabilidades |
|---------|--------|-------------------|
| `apps/api/src/routes/auth.ts` | 1,057 | Signup, login, reset, OAuth, plans |
| `apps/api/src/routes/budgets.ts` | 901 | CRUD + Guards + Rules + Scheduler |
| `apps/api/src/ml/alerts.ts` | 776 | Predicciones + Anomalías + Patrones |
| `apps/api/src/index.ts` | 760 | Express, WebSocket, Servicios, Rutas |
| `apps/api/src/services/StripeService.ts` | 643 | Webhooks, suscripciones, sync |

**Impacto:** Imposible de testear, mantener y debuggear
**Solución:** Dividir en módulos especializados

---

### 6. Seguridad: Validación de Plan sin Verificar Stripe
**Severidad:** CRÍTICO
**Archivo:** `apps/api/src/routes/auth.ts:300-367`

```typescript
// VULNERABLE - Usuario puede auto-asignarse enterprise sin pagar
const validPlans = ['free', 'pro', 'enterprise'];
if (!plan || !validPlans.includes(plan)) {
  return res.status(400).json(...);
}
// Falta verificar subscription de Stripe
```

**Impacto:** Escalación de privilegios sin pago
**Solución:** Verificar con Stripe antes de cambiar plan

---

### 7. Código Duplicado: JWT Token Extraction (4+ lugares)
**Severidad:** CRÍTICO

**Ubicaciones:**
- `apps/api/src/routes/auth.ts:303-304, 472-473, 852-853, 985-986`
- `apps/api/src/middleware/jwt-auth.ts:35-36`
- `apps/api/src/middleware/auth.ts:91-93`

```typescript
// Patrón repetido 4+ veces
const authHeader = req.headers.authorization;
const token = authHeader?.replace('Bearer ', '');
if (!token) {
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Missing authentication token'
  });
}
```

**Solución:** Crear `utils/auth-helpers.ts`:
```typescript
export function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  return authHeader?.replace('Bearer ', '') || null;
}
```

---

## HALLAZGOS DE PRIORIDAD MEDIA (Prioridad 2)

### 8. Código Muerto: 1,400+ Líneas Sin Usar

| Archivo | Líneas | Estado |
|---------|--------|--------|
| `apps/api/src/services/RedisService.ts` | 216 | Duplicado de RedisCache.ts |
| `apps/api/src/routes/optimization.routes.ts` | 417 | Endpoints sin UI |
| `apps/api/src/routes/forecasting.routes.ts` | 516 | Endpoints sin UI |
| `apps/api/src/middleware/jwt-auth.ts` | 100 | Middleware no usado |
| `apps/api/src/utils/random.ts` | 30 | Funciones no importadas |
| `apps/api/src/utils/metrics.ts` | 18 | 100% stubs |

**Acción:** Eliminar o implementar

---

### 9. Manejo de Errores Inconsistente (161+ ocurrencias)

**Patrón 1:** `console.error` vs `logger.error`
```typescript
// auth.ts - usa console
console.error('Signup error:', error);

// AlertService.ts - usa logger
logger.error('Failed to check budget alerts', { error });
```

**Patrón 2:** Try-catch genérico repetido
```typescript
// Aparece en 161 endpoints
try {
  // lógica
} catch (error) {
  res.status(500).json({ error: (error as Error).message });
}
```

**Solución:** Middleware centralizado:
```typescript
export function asyncHandler(fn: Function) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
```

---

### 10. Magic Numbers (20+ instancias)

| Archivo | Número | Significado |
|---------|--------|-------------|
| `auth.ts:34` | `'7d'` | JWT expiration |
| `auth.ts:64` | `8` | Min password length |
| `auth.ts:76` | `24 * 60 * 60 * 1000` | Email verification TTL |
| `index.ts:375` | `30 * 24 * 60 * 60 * 1000` | Session max age |
| `index.ts:264` | `5 * 60 * 1000` | Alert check interval |

**Solución:** Mover a `config/constants.ts`

---

### 11. N+1 Queries Potenciales
**Archivo:** `apps/api/src/routes/budgets.ts:283-320`

```typescript
// Para cada budget, llamada separada
const circuitStatus = budgetCircuitBreaker.getStatus(budget.id, budget.name);
```

---

### 12. Race Condition en OAuth User Creation
**Archivo:** `apps/api/src/services/OAuthService.ts:175-284`

```typescript
if (!existingUser) {        // Check
  const [newUser] = await db.insert(users)... // Create - race condition!
}
```

**Solución:** Usar upsert: `INSERT ... ON CONFLICT DO UPDATE`

---

### 13. Hooks de React Query Duplicados (21 archivos)

Patrón repetido en todos los hooks:
```typescript
export const entityKeys = {
  all: ['entity'] as const,
  lists: () => [...entityKeys.all, 'list'] as const,
  list: (filters) => [...entityKeys.lists(), filters] as const,
  // ...
};
```

**Solución:** Crear factory:
```typescript
export const createQueryKeyFactory = (resource: string) => ({
  all: [resource] as const,
  lists: () => [[...this.all, 'list'] as const,
  // ...
});
```

---

### 14. TODOs Abandonados (8+ instancias)

| Archivo | TODO |
|---------|------|
| `utils/metrics.ts:1` | `// TODO: Install prom-client package` |
| `index.ts:425` | `// TODO: Fix metrics module initialization` |
| `OnboardingWizard.tsx:96` | `// TODO: Call API to save onboarding` |
| `useCosts.ts:263` | `// TODO: Implement when backend ready` |
| `useAlerts.ts:115` | `// TODO: Replace with real API call` |

---

## HALLAZGOS DE PRIORIDAD BAJA (Prioridad 3)

### 15. Memory Leaks en setInterval
**Archivo:** `apps/api/src/index.ts:250-264, 268-282`

Los intervals no se limpian en shutdown.

---

### 16. Falta de Límites en Queries
**Archivo:** `apps/api/src/routes/costs.ts`

Sin validación de `limit` máximo - permite DoS.

---

### 17. Componentes React Sin Usar

- `CostRecommendations.tsx` - Definido pero no renderizado
- `OnboardingWizard.tsx` - Sin ruta `/onboarding`

---

### 18. Inconsistencia en Nomenclatura

- DB: `snake_case` (`password_hash`, `created_at`)
- TypeScript: `camelCase` (`passwordHash`, `createdAt`)
- Config: `UPPER_CASE` (`DB_POOL_MAX`, `JWT_SECRET`)

---

## PLAN DE ACCIÓN RECOMENDADO

### Fase 1: Crítico (1-2 semanas)

| # | Tarea | Archivos | Esfuerzo |
|---|-------|----------|----------|
| 1 | Implementar whitelist de redirect URLs | `oauth.ts` | 2h |
| 2 | Hacer `ENCRYPTION_KEY` obligatorio | `user-api-keys.ts` | 1h |
| 3 | Añadir rate limiting a `/verify-email` | `auth.ts` | 1h |
| 4 | Verificar Stripe en cambio de plan | `auth.ts` | 4h |
| 5 | Eliminar `any` types críticos | 15 archivos | 8h |
| 6 | Crear `utils/auth-helpers.ts` | Nuevo archivo | 4h |

### Fase 2: Medio (2-4 semanas)

| # | Tarea | Archivos | Esfuerzo |
|---|-------|----------|----------|
| 7 | Dividir `auth.ts` (1057 líneas) | Crear módulos | 8h |
| 8 | Dividir `budgets.ts` (901 líneas) | Crear módulos | 6h |
| 9 | Eliminar código muerto (~1400 líneas) | 9 archivos | 4h |
| 10 | Centralizar error handling | Middleware | 4h |
| 11 | Extraer magic numbers | `constants.ts` | 2h |
| 12 | Usar upsert en OAuth | `OAuthService.ts` | 2h |

### Fase 3: Bajo (4-6 semanas)

| # | Tarea | Archivos | Esfuerzo |
|---|-------|----------|----------|
| 13 | Limpiar intervals en shutdown | `index.ts` | 1h |
| 14 | Añadir límites a queries | Rutas | 2h |
| 15 | Implementar o eliminar TODOs | Varios | 8h |
| 16 | Normalizar nomenclatura | Proyecto | 4h |

---

## MÉTRICAS DE MEJORA ESPERADA

| Métrica | Actual | Después de Fase 1 | Después de Fase 3 |
|---------|--------|-------------------|-------------------|
| Vulnerabilidades críticas | 7 | 0 | 0 |
| Tipos `any` | 50+ | 30 | 0 |
| Código duplicado | 20 patrones | 10 | 3 |
| Código muerto | 1,400 líneas | 500 | 0 |
| Archivos >500 líneas | 7 | 3 | 0 |
| Cobertura de tests | ~0% | 20% | 60% |

---

## ARCHIVOS MÁS CRÍTICOS (Requieren Atención Inmediata)

1. `apps/api/src/routes/auth.ts` - 1,057 líneas, 5 vulnerabilidades
2. `apps/api/src/routes/oauth.ts` - Open redirect, secrets en URLs
3. `apps/api/src/routes/user-api-keys.ts` - Encryption key débil
4. `apps/api/src/routes/budgets.ts` - 901 líneas, god object
5. `apps/api/src/index.ts` - 760 líneas, debug output
6. `apps/api/src/middleware/auth.ts` - Duplicación de JWT logic
7. `apps/api/src/services/OAuthService.ts` - Race condition

---

*Reporte generado automáticamente por Claude Code*
