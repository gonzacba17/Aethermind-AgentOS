# Usage Limits

> ⚠️ **PLANNED FEATURE** - Not yet implemented. This feature is planned for Q1 2026.  
> See [../roadmap.md](../roadmap.md) for implementation timeline.

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

