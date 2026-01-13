#!/bin/sh
set -e

echo "🔄 Running database migrations..."
cd /app/apps/api
pnpm db:migrate:deploy

echo "✅ Migrations completed successfully!"
echo "🚀 Starting application..."

exec "$@"
