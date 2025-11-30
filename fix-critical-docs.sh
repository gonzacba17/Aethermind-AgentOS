#!/bin/bash

echo "🔧 CORRECCIONES CRÍTICAS DE DOCUMENTACIÓN"
echo "=========================================="
echo ""

# Backup
echo "📦 Creando backup de documentación..."
mkdir -p docs-backup-$(date +%Y%m%d)
cp -r docs/ docs-backup-$(date +%Y%m%d)/
cp README.md docs-backup-$(date +%Y%m%d)/
cp .env.example docs-backup-$(date +%Y%m%d)/
echo "✅ Backup creado en docs-backup-$(date +%Y%m%d)/"
echo ""

# Fix 1: README.md - Hot Reload
echo "1️⃣ Actualizando README.md (Hot Reload → Task Queue)..."
if grep -q "Hot Reload" README.md; then
  sed -i.bak 's/⚡ \*\*Hot Reload\*\* - Automatic configuration reload during development/⚡ **Task Queue** - BullMQ with Redis for reliable job processing/' README.md
  echo "✅ README.md actualizado"
else
  echo "⚠️  'Hot Reload' no encontrado en README.md"
fi
echo ""

# Fix 2: PostgreSQL version
echo "2️⃣ Actualizando versión de PostgreSQL (15 → 16)..."
find docs/ -type f -name "*.md" -exec sed -i.bak 's/PostgreSQL 15/PostgreSQL 16/g' {} \;
echo "✅ PostgreSQL version actualizada en docs/"
echo ""

# Fix 3: .env.example - Limpiar variables obsoletas
echo "3️⃣ Limpiando .env.example..."
if [ -f ".env.example" ]; then
  # Remover líneas obsoletas
  sed -i.bak '/ENABLE_HOT_RELOAD/d' .env.example
  sed -i.bak '/DASHBOARD_PORT/d' .env.example
  
  # Agregar JWT_SECRET si no existe
  if ! grep -q "JWT_SECRET" .env.example; then
    echo "" >> .env.example
    echo "# JWT Secret for authentication tokens (change in production)" >> .env.example
    echo "JWT_SECRET=your-jwt-secret-change-in-production-min-32-chars" >> .env.example
  fi
  
  echo "✅ .env.example limpiado"
else
  echo "⚠️  .env.example no encontrado"
fi
echo ""

# Fix 4: Crear archivo de JWT Auth documentation
echo "4️⃣ Creando documentación de JWT Authentication..."
cat > docs/JWT_AUTH.md << 'EOF'
# JWT Authentication

AethermindOS now supports JWT-based authentication in addition to API Keys.

## Overview

- **API Keys**: Legacy method, still supported for backward compatibility
- **JWT Tokens**: New method, recommended for user accounts

## Endpoints

### Sign Up

```http
POST /api/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe" // optional
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "clx123...",
    "email": "user@example.com",
    "name": "John Doe",
    "plan": "free",
    "apiKey": "aethermind_abc123...",
    "emailVerified": false,
    "usageCount": 0,
    "usageLimit": 100
  }
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "clx123...",
    "email": "user@example.com",
    "plan": "free",
    "usageCount": 5,
    "usageLimit": 100
  }
}
```

### Email Verification

```http
POST /api/auth/verify-email
Content-Type: application/json

{
  "token": "verification-token-from-email"
}
```

### Password Reset

**Request Reset:**
```http
POST /api/auth/reset-request
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Reset Password:**
```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "reset-token-from-email",
  "password": "newSecurePassword123"
}
```

**Note:** Reset tokens expire after 1 hour.

## Using JWT Tokens

Include the token in the Authorization header:

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
     http://localhost:3001/api/agents
```

## Token Details

- **Algorithm**: HS256
- **Expiration**: 7 days
- **Secret**: Configured via `JWT_SECRET` environment variable
- **Claims**: `{ userId, email, iat, exp }`

## Migration from API Keys

Both methods work simultaneously. You can:
1. Continue using API Keys: `X-API-Key: aethermind_xxx`
2. Switch to JWT: `Authorization: Bearer xxx`

Users created via signup get both an API Key (for scripts/automation) and can use JWT (for web apps).

EOF

echo "✅ docs/JWT_AUTH.md creado"
echo ""

# Fix 5: Crear archivo de Usage Limits documentation
echo "5️⃣ Creando documentación de Usage Limits..."
cat > docs/USAGE_LIMITS.md << 'EOF'
# Usage Limits

AethermindOS enforces execution limits based on subscription plans.

## Plans

| Plan       | Executions/Month | Agents | Workflows | Price     |
|------------|------------------|--------|-----------|-----------|
| Free       | 100              | 3      | 1         | $0        |
| Starter    | 10,000           | 20     | 10        | $49/mo    |
| Pro        | 100,000          | ∞      | ∞         | $199/mo   |
| Enterprise | Unlimited        | ∞      | ∞         | Custom    |

## How It Works

1. **Tracking**: Every successful agent execution increments `usageCount`
2. **Reset**: Usage count resets to 0 on the 1st of each month
3. **Enforcement**: Checked before execution on:
   - `POST /api/agents/:id/execute`
   - `POST /api/workflows/:name/execute`

## 429 Response

When limit is exceeded:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "error": "Usage limit exceeded",
  "message": "You have reached your free plan limit of 100 executions/month. Upgrade your plan to continue.",
  "current": 100,
  "limit": 100,
  "plan": "free"
}
```

## Checking Your Usage

```bash
# Get current user info (includes usageCount and usageLimit)
curl -H "Authorization: Bearer YOUR_JWT" \
     http://localhost:3001/api/auth/me
```

Response:
```json
{
  "id": "clx123...",
  "email": "user@example.com",
  "plan": "free",
  "usageCount": 45,
  "usageLimit": 100,
  "percentUsed": 45
}
```

## Upgrading Your Plan

```bash
# Coming soon: Stripe integration
POST /api/billing/upgrade
{
  "plan": "starter" | "pro"
}
```

## Admin: Manually Reset Usage

```bash
# Reset specific user (admin only)
POST /api/admin/users/:userId/reset-usage
```

EOF

echo "✅ docs/USAGE_LIMITS.md creado"
echo ""

# Summary
echo "📊 RESUMEN DE CAMBIOS:"
echo "─────────────────────"
echo "✅ README.md: Hot Reload → Task Queue"
echo "✅ PostgreSQL 15 → 16 en todos los docs"
echo "✅ .env.example limpiado (ENABLE_HOT_RELOAD, DASHBOARD_PORT removidos)"
echo "✅ JWT_SECRET agregado a .env.example"
echo "✅ docs/JWT_AUTH.md creado"
echo "✅ docs/USAGE_LIMITS.md creado"
echo ""

echo "🔍 PRÓXIMOS PASOS MANUALES:"
echo "───────────────────────────"
echo "1. Editar docs/API.md:"
echo "   - Agregar link a JWT_AUTH.md en sección Authentication"
echo "   - Agregar link a USAGE_LIMITS.md después de Rate Limiting"
echo "   - Remover líneas 245-283 (endpoint /chat)"
echo "   - Remover líneas 803-814 (config:change event)"
echo "   - Remover línea 841 (agent:reloaded event)"
echo ""
echo "2. Revisar y commitear cambios:"
echo "   git add docs/ README.md .env.example"
echo "   git commit -m 'docs: fix critical inconsistencies from audit'"
echo ""
echo "3. Opcional: Actualizar badges en README.md"
echo ""

echo "✨ ¡Correcciones críticas completadas!"