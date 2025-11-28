# Deployment Guide

## Prerequisites

- Docker & Docker Compose
- PostgreSQL 16+
- Redis 7+
- Node.js 20+ (for local development)

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/aethermind
REDIS_URL=redis://host:6379
API_KEY_HASH=<generated_hash>

# LLM Providers (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Optional
NODE_ENV=production
PORT=3001
CORS_ORIGINS=https://app.example.com
```

## Docker Deployment

### Build Image

```bash
docker build -t aethermind-api:latest --target api .
```

### Run Container

```bash
docker run -d \
  --name aethermind-api \
  -p 3001:3001 \
  -e DATABASE_URL="postgresql://user:pass@postgres:5432/aethermind" \
  -e REDIS_URL="redis://redis:6379" \
  -e API_KEY_HASH="$API_KEY_HASH" \
  -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  --restart unless-stopped \
  aethermind-api:latest
```

### Docker Compose

```yaml
version: '3.8'

services:
  api:
    image: aethermind-api:latest
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/aethermind
      REDIS_URL: redis://redis:6379
      API_KEY_HASH: ${API_KEY_HASH}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 3s
      retries: 3

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: aethermind
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## Database Migrations

```bash
# Development
pnpm prisma migrate dev

# Production
pnpm prisma migrate deploy
```

## Rollback Strategy

### 1. Identify Last Stable Version

```bash
docker images aethermind-api --format "{{.Tag}} {{.CreatedAt}}" | head -5
```

### 2. Tag Current Deployment

```bash
docker tag aethermind-api:latest aethermind-api:$(date +%Y%m%d-%H%M%S)
docker push aethermind-api:$(date +%Y%m%d-%H%M%S)
```

### 3. Perform Rollback

```bash
# Stop current containers
docker-compose down

# Update image tag in docker-compose.yml
sed -i 's/aethermind-api:latest/aethermind-api:20250115-143000/' docker-compose.yml

# Start with previous version
docker-compose up -d
```

### 4. Health Check Verification

```bash
# Check container health
docker ps --filter "name=aethermind-api" --format "table {{.Names}}\t{{.Status}}"

# Verify API endpoint
curl -f http://localhost:3001/health || echo "Health check failed"

# Check logs
docker-compose logs -f --tail=100 api
```

### 5. Database Rollback (if needed)

```bash
# Restore from backup
psql -U postgres -d aethermind < backups/aethermind_20250115_143000.sql

# Or revert specific migration
pnpm prisma migrate resolve --rolled-back "20250115143000_migration_name"
```

## Monitoring

### Health Checks

```bash
# Basic health
curl http://localhost:3001/health

# Authenticated health (with more details)
curl -H "X-API-Key: your-key" http://localhost:3001/api/health
```

### Logs

```bash
# Application logs
docker logs -f aethermind-api

# With timestamps
docker logs -f --timestamps aethermind-api

# Last 100 lines
docker logs --tail 100 aethermind-api
```

### Metrics

```bash
# Container stats
docker stats aethermind-api

# Database connections
docker exec postgres psql -U postgres -d aethermind -c "SELECT count(*) FROM pg_stat_activity;"

# Redis memory
docker exec redis redis-cli INFO memory | grep used_memory_human
```

## Backup Strategy

### Automated Daily Backups

```bash
#!/bin/bash
# backup.sh
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"

# Database backup
docker exec postgres pg_dump -U postgres aethermind > "$BACKUP_DIR/db_$TIMESTAMP.sql"

# Compress and retain last 7 days
gzip "$BACKUP_DIR/db_$TIMESTAMP.sql"
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +7 -delete
```

### Cron Schedule

```cron
0 2 * * * /path/to/backup.sh
```

## Scaling

### Horizontal Scaling

```bash
# Scale API instances
docker-compose up -d --scale api=3

# Add load balancer (nginx/traefik)
```

### Vertical Scaling

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

## Troubleshooting

### API won't start

```bash
# Check environment variables
docker exec aethermind-api env | grep -E "DATABASE_URL|REDIS_URL"

# Verify database connectivity
docker exec aethermind-api node -e "require('@prisma/client').PrismaClient.$connect()"

# Check Redis
docker exec redis redis-cli PING
```

### Slow queries

```bash
# Enable query logging (development)
DATABASE_URL="postgresql://...?log=query" pnpm dev

# Check Prisma slow query logs
docker logs aethermind-api | grep "Slow Query"
```

### High memory usage

```bash
# Node.js heap snapshot
docker exec aethermind-api node --expose-gc --inspect dist/index.js

# Restart with memory limit
docker run --memory=2g aethermind-api:latest
```

## Security Checklist

- [ ] API_KEY_HASH configured in production
- [ ] DATABASE_URL uses strong password
- [ ] Redis password enabled (if exposed)
- [ ] CORS_ORIGINS restricted to allowed domains
- [ ] HTTPS/TLS terminated at load balancer
- [ ] Container runs as non-root user
- [ ] Sensitive env vars not in docker-compose.yml
- [ ] Regular security audits: `pnpm audit`

## Production Checklist

- [ ] Environment variables configured
- [ ] Database migrated to latest schema
- [ ] Backups automated and tested
- [ ] Health checks responding
- [ ] Logs centralized (e.g., CloudWatch, Datadog)
- [ ] Monitoring alerts configured
- [ ] Rollback procedure documented and tested
- [ ] Load testing completed
- [ ] Security audit passed
