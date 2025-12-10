FROM node:20-alpine AS base
RUN npm install -g pnpm@9

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml ./
RUN pnpm fetch
COPY package.json pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/dashboard/package.json ./packages/dashboard/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --offline --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/sdk/node_modules ./packages/sdk/node_modules
COPY --from=deps /app/packages/dashboard/node_modules ./packages/dashboard/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm run build

FROM base AS api
WORKDIR /app

RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY --from=builder --chown=nodejs:nodejs /app/packages/core/dist ./packages/core/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/core/package.json ./packages/core/
COPY --from=builder --chown=nodejs:nodejs /app/packages/sdk/dist ./packages/sdk/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/sdk/package.json ./packages/sdk/
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/apps/api/node_modules ./apps/api/node_modules

USER nodejs

WORKDIR /app/apps/api
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\\n  CMD node -e \"require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })\"\n\nCMD ["dumb-init", "node", "dist/index.js"]

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
