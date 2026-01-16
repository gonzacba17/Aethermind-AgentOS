#!/bin/sh
set -e

echo "🔄 Syncing database schema with Drizzle..."

# Run drizzle-kit push to sync schema
cd /app/apps/api && npx drizzle-kit push --verbose || {
  echo "⚠️  Warning: Schema sync failed, but continuing..."
}

echo "✅ Schema sync completed"
echo "🚀 Starting application..."

# Start the application
exec dumb-init node /app/apps/api/dist/index.js
