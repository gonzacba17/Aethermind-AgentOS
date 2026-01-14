# Quick Start - Aethermind SaaS Deployment

## 🚀 Deploy in 15 Minutes

### Prerequisites

- Railway account
- NPM account
- Vercel account (dashboard already there)
- OpenAI API key

---

## Step 1: Deploy API (5 min)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize
cd /path/to/aethermind-agentos
railway init

# Add PostgreSQL
railway add postgresql

# Deploy
railway up

# Set environment variables
railway variables set DATABASE_URL=$(railway variables get DATABASE_URL)
railway variables set OPENAI_API_KEY=sk-...
railway variables set ANTHROPIC_API_KEY=sk-ant-...
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=$(openssl rand -base64 32)

# Run migrations
railway run npx prisma migrate deploy

# Get your API URL
railway domain
```

Save the URL: `https://your-api.railway.app`

---

## Step 2: Publish SDK (2 min)

```bash
cd packages/agent

# Login to NPM
npm login

# Publish
npm publish --access public

# Verify
npm info @aethermind/agent
```

---

## Step 3: Update Dashboard (3 min)

```bash
# Add environment variables to Vercel
vercel env add NEXT_PUBLIC_API_URL
# Paste: https://your-api.railway.app

vercel env add DATABASE_URL
# Paste: Same DATABASE_URL from Railway

# Redeploy
vercel --prod
```

---

## Step 4: Create Test Organization (2 min)

```bash
# Connect to database
railway run npx prisma studio

# Or use SQL:
railway run psql $DATABASE_URL
```

```sql
INSERT INTO organizations (id, name, slug, api_key_hash, plan, rate_limit_per_min)
VALUES (
  gen_random_uuid(),
  'Test Organization',
  'test-org',
  '$2a$10$...',  -- Hash of 'test_key_123'
  'FREE',
  100
);
```

To generate bcrypt hash:

```bash
node -e "console.log(require('bcryptjs').hashSync('your_api_key', 10))"
```

---

## Step 5: Test End-to-End (3 min)

```bash
# Set environment variables
export AETHERMIND_API_KEY=your_api_key
export OPENAI_API_KEY=sk-...
export DATABASE_URL=postgresql://...

# Run E2E test
pnpm test:e2e
```

Expected output:

```
✅ Created organization
✅ OpenAI call successful
✅ Found events in database
✅ END-TO-END TEST PASSED
```

---

## Step 6: Use in Your App

```bash
npm install @aethermind/agent
```

```typescript
import { initAethermind } from "@aethermind/agent";

initAethermind({
  apiKey: process.env.AETHERMIND_API_KEY,
});

// Use OpenAI normally - that's it!
```

---

## Verify Deployment

1. API health: `curl https://your-api.railway.app/health`
2. Dashboard: `https://your-dashboard.vercel.app/telemetry?orgId=...`
3. Make test OpenAI call
4. Check dashboard for event

---

## Troubleshooting

**API not responding:**

```bash
railway logs --follow
```

**Database issues:**

```bash
railway run npx prisma studio
```

**SDK not sending events:**

- Check API key format: `aether_...`
- Check endpoint URL
- Check network/firewall

---

## Next Steps

1. ✅ Deploy complete
2. Create production organizations
3. Invite beta users
4. Set up monitoring
5. Configure alerts

**You're live!** 🎉
