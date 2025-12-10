# JWT Authentication

> ⚠️ **PARTIALLY IMPLEMENTED** - Basic API Key authentication is currently working.  
> JWT authentication endpoints are documented here but not fully implemented yet.  
> Current status: API Key auth via `X-API-Key` header is the recommended method.

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

