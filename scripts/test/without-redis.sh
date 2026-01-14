#!/bin/bash

echo "🧪 Testing API without Redis..."
echo ""

cd "$(dirname "$0")/.."

echo "1. Building API..."
pnpm --filter @aethermind/api build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo ""
echo "2. Starting API without REDIS_URL..."
echo ""

unset REDIS_URL

timeout 10 pnpm --filter @aethermind/api start &
API_PID=$!

sleep 5

echo ""
echo "3. Testing health endpoint..."
curl -s http://localhost:3001/api/health | jq .

echo ""
echo "4. Stopping API..."
kill $API_PID 2>/dev/null

echo ""
echo "✅ Test completed - API should have started successfully"
echo "   Check logs above for 'Redis unavailable (using fallback)'"
