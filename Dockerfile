# Multi-stage Dockerfile for Aethermind AgentOS
# Stages: base → deps → builder → api | dashboard

FROM node:20-alpine AS base
RUN npm install -g pnpm@9

# ── Install dependencies ─────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml ./
RUN pnpm fetch
COPY package.json pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/dashboard/package.json ./packages/dashboard/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

# ── Build all packages ───────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/dashboard/node_modules ./packages/dashboard/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .

# Install types needed for API build
RUN pnpm add -D @types/jsonwebtoken --filter=@aethermind/api

# Build everything via turbo
RUN pnpm turbo run build

# ── API production image ─────────────────────────────────────────────
FROM base AS api
WORKDIR /app

RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy compiled API + workspace dependencies
COPY --from=builder --chown=nodejs:nodejs /app/packages/core/dist ./packages/core/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/core/package.json ./packages/core/
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/startup.js ./apps/api/startup.js
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/drizzle.config.ts ./apps/api/drizzle.config.ts
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/src/db ./apps/api/src/db
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/node_modules ./apps/api/node_modules

# Create log directory
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app/logs

USER nodejs
WORKDIR /app/apps/api
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3001) + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start using startup.js which syncs DB schema and starts app
CMD ["dumb-init", "node", "startup.js"]

# ── Dashboard production image ───────────────────────────────────────
FROM base AS dashboard
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY --from=builder --chown=nodejs:nodejs /app/packages/dashboard/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/packages/dashboard/.next/static ./packages/dashboard/.next/static
COPY --from=builder --chown=nodejs:nodejs /app/packages/dashboard/public ./packages/dashboard/public

USER nodejs

WORKDIR /app/packages/dashboard
EXPOSE 3000
CMD ["node", "server.js"]
