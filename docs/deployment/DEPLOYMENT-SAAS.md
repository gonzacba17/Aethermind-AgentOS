# Deployment Guide - SaaS Hybrid Architecture

## Overview

This guide covers deploying the Aethermind SaaS hybrid architecture with:

- **SDK**: Distributed via NPM
- **API**: Deployed on Railway/Render/AWS
- **Database**: PostgreSQL (managed)
- **Dashboard**: Already deployed on Vercel

---

## Architecture Components

```
┌─────────────┐
│ Client Apps │  npm install @aethermind/agent
│  (Anywhere) │  initAethermind({ apiKey: '...' })
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Cloud API  │  POST /v1/ingest
│ (Railway)   │  Authentication + Rate Limiting
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ PostgreSQL  │  telemetry_events table
│  (Managed)  │  Multi-tenant isolation
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Dashboard  │  Query metrics
│  (Vercel)   │  Real-time charts
└─────────────┘
```

---

## 1. Database Setup

### Option A: Railway PostgreSQL

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and create project
railway login
railway init

# Add PostgreSQL
railway add postgresql

# Get connection string
railway variables
# Copy DATABASE_URL
```

### Option B: Supabase

```bash
# Create project at https://supabase.com
# Get connection string from Settings → Database
# Format: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
```

### Run Migrations

```bash
# Set DATABASE_URL
export DATABASE_URL="postgresql://..."

# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Verify schema
npx prisma studio
```

---

## 2. API Deployment (Railway)

### Prepare for Deployment

```bash
# Build API
pnpm build --filter=@aethermind/api

# Test locally
cd apps/api
pnpm start
```

### Deploy to Railway

```bash
# Create railway.json
cat > railway.json << EOF
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install && pnpm build --filter=@aethermind/api"
  },
  "deploy": {
    "startCommand": "node apps/api/dist/index.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
EOF

# Deploy
railway up

# Set environment variables
railway variables set OPENAI_API_KEY=sk-...
railway variables set ANTHROPIC_API_KEY=sk-...
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=$(openssl rand -base64 32)

# Get deployment URL
railway domain
```

### Environment Variables Required

```env
# Database
DATABASE_URL=postgresql://...

# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Security
JWT_SECRET=your-secret-here
API_KEY_HASH=your-hash-here

# Optional
REDIS_URL=redis://...
SENDGRID_API_KEY=SG....
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

---

## 3. SDK Distribution (NPM)

### Prepare Package

```bash
cd packages/agent

# Update version
npm version 0.1.0

# Build
pnpm build

# Test locally
npm link
```

### Publish to NPM

```bash
# Login to NPM
npm login

# Publish (initially scoped/private)
npm publish --access public

# Or publish as beta
npm publish --tag beta
```

### Installation

Users install via:

```bash
npm install @aethermind/agent
# or
pnpm add @aethermind/agent
```

---

## 4. Dashboard Integration

Your dashboard is already on Vercel. Update it to query the new API:

### Add Environment Variables to Vercel

```bash
# Via Vercel Dashboard or CLI
vercel env add NEXT_PUBLIC_API_URL
# Value: https://your-api.railway.app

vercel env add DATABASE_URL
# Value: Same as API database
```

### Update API Endpoints

Create `/api/metrics` endpoint in dashboard:

```typescript
// pages/api/metrics.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req, res) {
  const { organizationId } = req.query;

  // Get metrics for last 30 days
  const events = await prisma.telemetryEvent.groupBy({
    by: ["provider", "model"],
    where: {
      organizationId,
      timestamp: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
    _sum: {
      cost: true,
      totalTokens: true,
    },
    _count: {
      id: true,
    },
  });

  res.json({ events });
}
```

---

## 5. Testing Deployment

### Create Test Organization

```sql
-- Run in Prisma Studio or psql
INSERT INTO organizations (id, name, slug, api_key_hash, plan, rate_limit_per_min)
VALUES (
  gen_random_uuid(),
  'Test Org',
  'test-org',
  '$2a$10$[bcrypt-hash-here]',  -- Hash of 'test_key_123'
  'FREE',
  100
);
```

### Test SDK → API → DB

```typescript
// test-integration.ts
import { initAethermind } from "@aethermind/agent";
import OpenAI from "openai";

initAethermind({
  apiKey: "aether_test_key_123",
  endpoint: "https://your-api.railway.app",
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const response = await openai.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [{ role: "user", content: "Hello!" }],
});

console.log("✅ Test successful");
```

Run and verify event in database via Prisma Studio.

---

## 6. Monitoring & Logging

### API Logs (Railway)

```bash
# View logs
railway logs

# Follow logs
railway logs --follow
```

### Database Monitoring

```sql
-- Check recent events
SELECT
  organization_id,
  COUNT(*) as event_count,
  SUM(cost) as total_cost,
  MAX(timestamp) as last_event
FROM telemetry_events
WHERE timestamp > NOW() - INTERVAL '1 day'
GROUP BY organization_id;

-- Check rate limits
SELECT
  o.name,
  o.plan,
  COUNT(t.id) as events_last_hour
FROM organizations o
LEFT JOIN telemetry_events t
  ON t.organization_id = o.id
  AND t.timestamp > NOW() - INTERVAL '1 hour'
GROUP BY o.id, o.name, o.plan;
```

### Metrics Endpoint

```bash
curl https://your-api.railway.app/metrics
```

---

## 7. Security Checklist

- [ ] DATABASE_URL uses SSL
- [ ] API keys are bcrypt hashed
- [ ] CORS configured for production domains
- [ ] Rate limiting enabled
- [ ] HTTPS enforced
- [ ] Secrets in environment variables (not code)
- [ ] Prisma Client generated in production

---

## 8. Scaling Considerations

### API Horizontal Scaling

Railway auto-scales. For manual:

```bash
# Scale to 3 instances
railway scale --replicas 3
```

### Database Optimization

```sql
-- Add indexes if query performance degrades
CREATE INDEX CONCURRENTLY idx_telemetry_recent
ON telemetry_events(organization_id, timestamp DESC)
WHERE timestamp > NOW() - INTERVAL '30 days';

-- Partition table by month (for large datasets)
-- See: https://www.postgresql.org/docs/current/ddl-partitioning.html
```

### Redis for Caching

```bash
# Add Redis to Railway
railway add redis

# Update API to use Redis for:
# - API key lookup caching
# - Rate limit counters
```

---

## Summary

**Deployment Stack:**

- SDK: NPM Registry
- API: Railway (or Render/AWS)
- Database: Railway PostgreSQL (or Supabase)
- Dashboard: Vercel (existing)

**Testing:**

```bash
pnpm test:e2e
```

**Go Live:**

1. ✅ Deploy API to Railway
2. ✅ Set environment variables
3. ✅ Run migrations
4. ✅ Publish SDK to NPM
5. ✅ Update dashboard env vars
6. ✅ Test end-to-end
7. ✅ Monitor logs & metrics

**Support:** See main README for troubleshooting.
