# Manual Database Migration Guide

## Quick Start

Si tienes acceso a PostgreSQL, ejecuta este comando:

```bash
# Opción 1: Usando psql
psql -U postgres -d aethermind -f prisma/migrations/manual_add_budgets_and_alerts.sql

# Opción 2: Usando Docker (si usas docker-compose)
docker exec -i aethermind-postgres psql -U postgres -d aethermind < prisma/migrations/manual_add_budgets_and_alerts.sql

# Opción 3: Copiar y pegar en pgAdmin o cualquier cliente SQL
# Abrir: prisma/migrations/manual_add_budgets_and_alerts.sql
# Copiar todo el contenido y ejecutarlo en tu cliente SQL
```

## Verificación

Después de ejecutar la migración, verifica que las tablas se crearon:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('budgets', 'alert_logs');
```

Deberías ver:

```
 table_name
-------------
 alert_logs
 budgets
```

## Generar Cliente Prisma

Después de crear las tablas, genera el cliente de Prisma:

```bash
cd c:\wamp64\www\Aethermind Agent os
pnpm prisma:generate
```

## Probar Budget Enforcement

Una vez completada la migración, puedes probar el sistema:

### 1. Crear un Budget de Prueba

```bash
curl -X POST http://localhost:3001/api/budgets \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "name": "Test Budget",
    "limitAmount": 1.00,
    "period": "monthly",
    "scope": "user",
    "hardLimit": true,
    "alertAt": 80
  }'
```

### 2. Verificar el Budget

```bash
curl http://localhost:3001/api/budgets \
  -H "X-API-Key: YOUR_API_KEY"
```

### 3. Ver Uso del Budget

```bash
curl http://localhost:3001/api/budgets/{BUDGET_ID}/usage \
  -H "X-API-Key: YOUR_API_KEY"
```

## Configurar Alertas (Opcional)

Para habilitar alertas por email y Slack, agrega a tu `.env`:

```bash
# Email alerts via SendGrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
ALERT_FROM_EMAIL=alerts@aethermind.ai

# Slack alerts via webhook
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxxxxxxxxxxxx
```

Reinicia el servidor API después de agregar las variables:

```bash
pnpm dev:api
```

Las alertas se enviarán automáticamente:

- **80% del budget**: Warning alert
- **100% del budget**: Critical alert

## Troubleshooting

### Error: relation "budgets" does not exist

Significa que la migración no se ejecutó. Verifica:

1. Que el archivo SQL se ejecutó correctamente
2. Que estás conectado a la base de datos correcta
3. Que no hubo errores en la ejecución del SQL

### Error: Cannot find module '@prisma/client'

Ejecuta:

```bash
pnpm install
pnpm prisma:generate
```

### Las alertas no se envían

Verifica:

1. Que `SENDGRID_API_KEY` o `SLACK_WEBHOOK_URL` estén configurados
2. Que el servidor API esté corriendo
3. Los logs del servidor para ver errores de envío

## Siguiente Paso: Integrar en Orchestrator

Para completar el 100% del P1, necesitas integrar la validación de budget en el Orchestrator. Ver `implementation_plan.md` sección "Orchestrator Changes" para el código exacto.

La integración básica es:

```typescript
// En Orchestrator.executeTask() o executeWorkflow()
// ANTES de ejecutar el agente:

if (budgetService && userId) {
  const estimate = await costService.estimateAgentCost(agent, input);
  const validation = await budgetService.validateBudget(
    userId,
    "agent",
    agentId,
    estimate.totalCost
  );

  if (!validation.allowed && validation.budget) {
    throw new BudgetExceededError({
      budgetId: validation.budget.id,
      budgetName: validation.budget.name,
      limitAmount: Number(validation.budget.limitAmount),
      currentSpend: Number(validation.budget.currentSpend),
      estimatedCost: estimate.totalCost,
    });
  }
}

// Ejecutar agente...

// DESPUÉS de ejecución exitosa:
if (budgetService && userId && result.cost) {
  const budget = await budgetService.getActiveBudget(userId, "agent", agentId);
  if (budget) {
    await budgetService.incrementSpend(budget.id, result.cost);
  }
}
```

Esto bloqueará automáticamente ejecuciones que excedan el budget.
