# Aethermind API - Deployment Guide

## Environment Variables

### Required

| Variable         | Description                               | Example                                                                                   |
| ---------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection string              | `postgresql://user:pass@host:5432/db`                                                     |
| `SESSION_SECRET` | Secret for session encryption (32+ chars) | Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_SECRET`     | Secret for JWT tokens (32+ chars)         | Same generation method as above                                                           |
| `API_KEY_HASH`   | Hashed API key for auth (production only) | Generate with: `pnpm generate-api-key`                                                    |

### Optional

| Variable            | Description                    | Default       |
| ------------------- | ------------------------------ | ------------- |
| `NODE_ENV`          | Environment mode               | `development` |
| `PORT`              | Server port                    | `3001`        |
| `REDIS_URL`         | Redis connection (for caching) | None          |
| `CORS_ORIGINS`      | Allowed CORS origins           | `*`           |
| `SENDGRID_API_KEY`  | SendGrid for email alerts      | None          |
| `SLACK_WEBHOOK_URL` | Slack integration              | None          |

## Session Storage

Sessions are stored in PostgreSQL using the `user_sessions` table, which is created automatically on startup if it doesn't exist.

### Session Configuration

- **Duration**: 30 days
- **Cookie Flags**: `httpOnly`, `sameSite: lax`, `secure` (production only)
- **Table**: `user_sessions`

## Verification Steps

### 1. Check Startup Logs

Look for these success messages:

```
✅ PostgreSQL session store initialized (table: user_sessions)
✅ Database pool connection established
```

### 2. Verify No MemoryStore Warning

You should **NOT** see:

```
Warning: connect.session() MemoryStore is not designed for a production environment
```

### 3. Check Database Table

```sql
SELECT * FROM user_sessions LIMIT 5;
```

## Troubleshooting

### "SESSION_SECRET or JWT_SECRET must be configured"

Set at least one of these environment variables. `SESSION_SECRET` is preferred.

### "Database pool error" or connection timeouts

- Check `DATABASE_URL` is correct
- Verify PostgreSQL is accessible from Railway
- Check connection pool limits (default: 10)

### Sessions not persisting

- Verify `user_sessions` table exists
- Check for session store errors in logs
- Ensure cookies are being sent (check `sameSite` and `secure` flags)

## Health Check

```bash
curl https://your-api.railway.app/health
```

Expected response includes:

```json
{
  "status": "healthy",
  "details": {
    "database": "connected",
    "storage": "drizzle"
  }
}
```
