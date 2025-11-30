# Auth System Testing Guide

## Sistema implementado ✅

### 1. Modelo de datos
- **User model** con:
  - email, password hash, apiKey
  - plan (free/starter/pro/enterprise)
  - usageCount, usageLimit
  - stripeCustomerId, stripeSubscriptionId
  - Email verification tokens
  - Password reset tokens

### 2. Endpoints de autenticación
```bash
POST /api/auth/signup          # Registrar nuevo usuario
POST /api/auth/login           # Login y obtener JWT
POST /api/auth/verify-email    # Verificar email
POST /api/auth/reset-request   # Solicitar reset de contraseña
POST /api/auth/reset-password  # Resetear contraseña
```

### 3. Middleware
- `jwtAuthMiddleware`: Valida JWT o API Key
- `usageLimiter`: Enforcea límites por plan
- `incrementUsage`: Incrementa contador de uso

### 4. Integración con rutas existentes
- Todas las rutas `/api/agents/*` ahora requieren auth
- Los agentes están scoped por userId
- Las ejecuciones incrementan el usage counter

## Test manual

### 1. Signup
```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@aethermind.io",
    "password": "password123"
  }'
```

Respuesta esperada:
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "...",
    "email": "test@aethermind.io",
    "plan": "free",
    "apiKey": "aethermind_...",
    "emailVerified": false
  }
}
```

### 2. Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@aethermind.io",
    "password": "password123"
  }'
```

### 3. Crear agente (con JWT)
```bash
TOKEN="<tu_jwt_del_signup>"

curl -X POST http://localhost:3001/api/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "My First Agent",
    "model": "gpt-4",
    "provider": "openai"
  }'
```

### 4. Crear agente (con API Key)
```bash
API_KEY="<tu_api_key_del_signup>"

curl -X POST http://localhost:3001/api/agents \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "name": "My Second Agent",
    "model": "gpt-4",
    "provider": "openai"
  }'
```

### 5. Listar agentes (solo verás los tuyos)
```bash
curl http://localhost:3001/api/agents \
  -H "Authorization: Bearer $TOKEN"
```

### 6. Probar límites de uso
Ejecuta un agente 100 veces (límite free):
```bash
for i in {1..101}; do
  curl -X POST http://localhost:3001/api/agents/<agent_id>/execute \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"input": "test"}'
done
```

En la ejecución 101 deberías ver:
```json
{
  "error": "Usage limit exceeded",
  "message": "You have reached your free plan limit of 100 executions/month...",
  "current": 100,
  "limit": 100,
  "plan": "free"
}
```

## Límites por plan

| Plan | Executions/month | Precio |
|------|------------------|--------|
| free | 100 | $0 |
| starter | 10,000 | $49 |
| pro | 100,000 | $199 |
| enterprise | Ilimitado | Custom |

## Próximos pasos

1. **Integración Stripe** (Week 3)
   - Webhooks para subscripciones
   - Flows de upgrade/downgrade
   - Invoicing

2. **Email service** (Week 2-3)
   - Envío de emails de verificación
   - Reset password emails
   - Welcome emails

3. **Dashboard frontend** (Week 1-2)
   - Login/signup UI
   - Usage dashboard
   - Plan management

4. **Tests automatizados**
   - Unit tests para auth routes
   - Integration tests para flujo completo
   - E2E tests con usuarios reales
