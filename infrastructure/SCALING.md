# Horizontal Scaling Guide

This document describes how to scale Aethermind for production workloads.

## Architecture Overview

```
                                    ┌─────────────────┐
                                    │   Cloudflare    │
                                    │   (WAF + CDN)   │
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │  Load Balancer  │
                                    │  (Nginx/HAProxy)│
                                    └────────┬────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
           ┌────────▼────────┐     ┌────────▼────────┐     ┌────────▼────────┐
           │   API Server 1  │     │   API Server 2  │     │   API Server N  │
           │   (Express)     │     │   (Express)     │     │   (Express)     │
           └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
                    │                        │                        │
                    └────────────────────────┼────────────────────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
           ┌────────▼────────┐     ┌────────▼────────┐     ┌────────▼────────┐
           │  Redis Cluster  │     │ PostgreSQL      │     │  Message Queue  │
           │  (Cache + Pub)  │     │ (Primary+Replica│     │  (Redis/Kafka)  │
           └─────────────────┘     └─────────────────┘     └─────────────────┘
```

## 1. API Server Scaling

### Docker Compose (Development/Staging)

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: infrastructure/docker/Dockerfile.api
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - aethermind-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./infrastructure/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./infrastructure/nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
    networks:
      - aethermind-network

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data
    networks:
      - aethermind-network

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: aethermind
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - aethermind-network

networks:
  aethermind-network:
    driver: bridge

volumes:
  redis-data:
  postgres-data:
```

### Kubernetes (Production)

```yaml
# infrastructure/kubernetes/api/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aethermind-api
  labels:
    app: aethermind-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: aethermind-api
  template:
    metadata:
      labels:
        app: aethermind-api
    spec:
      containers:
        - name: api
          image: aethermind/api:latest
          ports:
            - containerPort: 5000
          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: aethermind-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: aethermind-secrets
                  key: redis-url
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
          livenessProbe:
            httpGet:
              path: /health
              port: 5000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 5000
            initialDelaySeconds: 5
            periodSeconds: 5
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app: aethermind-api
                topologyKey: kubernetes.io/hostname
---
apiVersion: v1
kind: Service
metadata:
  name: aethermind-api
spec:
  selector:
    app: aethermind-api
  ports:
    - port: 80
      targetPort: 5000
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: aethermind-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: aethermind-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

## 2. Load Balancer Configuration

### Nginx Configuration

```nginx
# infrastructure/nginx/nginx.conf

upstream aethermind_api {
    least_conn;
    server api1:5000 weight=1 max_fails=3 fail_timeout=30s;
    server api2:5000 weight=1 max_fails=3 fail_timeout=30s;
    server api3:5000 weight=1 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

upstream aethermind_websocket {
    ip_hash;  # Sticky sessions for WebSocket
    server api1:5000;
    server api2:5000;
    server api3:5000;
}

server {
    listen 80;
    server_name api.aethermind.io;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.aethermind.io;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
    limit_req zone=api_limit burst=200 nodelay;

    # API routes
    location /api/ {
        proxy_pass http://aethermind_api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # WebSocket routes
    location /ws {
        proxy_pass http://aethermind_websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Ingestion endpoint (higher limits)
    location /v1/ingest {
        limit_req zone=api_limit burst=1000 nodelay;
        proxy_pass http://aethermind_api/v1/ingest;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 10M;
    }

    # Health check (no rate limit)
    location /health {
        proxy_pass http://aethermind_api/health;
        access_log off;
    }
}
```

## 3. Database Scaling

### PostgreSQL Read Replicas

```yaml
# docker-compose.db.yml
version: '3.8'

services:
  postgres-primary:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: aethermind
      POSTGRES_USER: aethermind
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_REPLICATION_USER: replicator
      POSTGRES_REPLICATION_PASSWORD: ${REPLICATION_PASSWORD}
    volumes:
      - ./infrastructure/postgres/primary.conf:/etc/postgresql/postgresql.conf
      - ./infrastructure/postgres/pg_hba.conf:/etc/postgresql/pg_hba.conf
      - postgres-primary-data:/var/lib/postgresql/data
    command: postgres -c config_file=/etc/postgresql/postgresql.conf

  postgres-replica:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: aethermind
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      PGDATA: /var/lib/postgresql/data
    volumes:
      - ./infrastructure/postgres/replica.conf:/etc/postgresql/postgresql.conf
      - postgres-replica-data:/var/lib/postgresql/data
    depends_on:
      - postgres-primary
    command: |
      bash -c "
        until pg_basebackup -h postgres-primary -D /var/lib/postgresql/data -U replicator -vP -W
        do
          echo 'Waiting for primary...'
          sleep 5
        done
        postgres -c config_file=/etc/postgresql/postgresql.conf
      "

volumes:
  postgres-primary-data:
  postgres-replica-data:
```

### Connection Pooling with PgBouncer

```ini
# infrastructure/pgbouncer/pgbouncer.ini
[databases]
aethermind = host=postgres-primary port=5432 dbname=aethermind
aethermind_readonly = host=postgres-replica port=5432 dbname=aethermind

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 3
server_lifetime = 3600
server_idle_timeout = 600
```

## 4. Redis Cluster

```yaml
# infrastructure/redis/redis-cluster.yml
version: '3.8'

services:
  redis-node-1:
    image: redis:7-alpine
    command: redis-server /etc/redis/redis.conf
    volumes:
      - ./redis-cluster.conf:/etc/redis/redis.conf
      - redis-1-data:/data
    ports:
      - "7001:6379"

  redis-node-2:
    image: redis:7-alpine
    command: redis-server /etc/redis/redis.conf
    volumes:
      - ./redis-cluster.conf:/etc/redis/redis.conf
      - redis-2-data:/data
    ports:
      - "7002:6379"

  redis-node-3:
    image: redis:7-alpine
    command: redis-server /etc/redis/redis.conf
    volumes:
      - ./redis-cluster.conf:/etc/redis/redis.conf
      - redis-3-data:/data
    ports:
      - "7003:6379"

volumes:
  redis-1-data:
  redis-2-data:
  redis-3-data:
```

## 5. Environment Variables for Scaling

```bash
# .env.production

# Database
DATABASE_URL=postgresql://user:pass@pgbouncer:6432/aethermind
DATABASE_REPLICA_URL=postgresql://user:pass@pgbouncer:6432/aethermind_readonly
DATABASE_POOL_SIZE=25

# Redis
REDIS_URL=redis://redis-cluster:6379
REDIS_CLUSTER_MODE=true

# API Server
NODE_ENV=production
PORT=5000
API_WORKERS=4
TRUST_PROXY=true

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_STORE=redis

# Session
SESSION_STORE=redis
SESSION_SECRET=${SESSION_SECRET}

# Scaling
MAX_CONNECTIONS=1000
REQUEST_TIMEOUT=60000
BODY_LIMIT=10mb

# Observability
LOG_LEVEL=info
TRACING_ENABLED=true
TRACING_ENDPOINT=http://jaeger:14268/api/traces
METRICS_ENABLED=true
METRICS_PORT=9090
```

## 6. Scaling Checklist

### Pre-Scaling
- [ ] Enable connection pooling (PgBouncer)
- [ ] Configure Redis cluster/sentinel
- [ ] Set up read replicas for database
- [ ] Configure sticky sessions for WebSocket
- [ ] Set up distributed rate limiting

### During Scaling
- [ ] Monitor CPU/memory usage
- [ ] Watch database connection count
- [ ] Check Redis memory usage
- [ ] Monitor request latency P95/P99
- [ ] Track error rates

### Post-Scaling
- [ ] Verify all instances are healthy
- [ ] Test failover scenarios
- [ ] Update monitoring dashboards
- [ ] Document new capacity limits

## 7. Capacity Planning

| Users | API Instances | DB Connections | Redis Memory |
|-------|---------------|----------------|--------------|
| 1K    | 2             | 50             | 256MB        |
| 10K   | 4             | 100            | 1GB          |
| 100K  | 10            | 250            | 4GB          |
| 1M    | 25            | 500            | 16GB         |

## 8. Monitoring

### Prometheus Metrics Endpoint

```typescript
// apps/api/src/routes/metrics.ts
import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client';

const register = new Registry();
collectDefaultMetrics({ register });

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

export const metricsRouter = Router();
metricsRouter.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

## 9. Graceful Shutdown

```typescript
// apps/api/src/utils/shutdown.ts
export function setupGracefulShutdown(server: Server, db: Pool) {
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`Received ${signal}, starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(() => {
      console.log('HTTP server closed');
    });

    // Wait for existing requests (max 30s)
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Close database connections
    await db.end();
    console.log('Database connections closed');

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
```
