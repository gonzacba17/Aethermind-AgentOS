#!/bin/bash

echo "🧪 Testing AethermindOS API..."
echo ""

# Test 1: Health Check
echo "1️⃣ Health Check:"
curl -s http://localhost:3001/health | jq '.' 2>/dev/null || curl -s http://localhost:3001/health
echo -e "\n"

# Test 2: Root endpoint
echo "2️⃣ Root endpoint (puede fallar - normal):"
curl -s -w "\nHTTP Status: %{http_code}\n" http://localhost:3001/
echo ""

# Test 3: Common API endpoints (puede que no existan todos)
echo "3️⃣ Testing common endpoints:"
endpoints=(
  "/api/agents"
  "/api/tasks"
  "/api/workflows"
  "/api/status"
  "/version"
  "/docs"
)

for endpoint in "${endpoints[@]}"; do
  echo "   Testing $endpoint..."
  response=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:3001$endpoint)
  if [ "$response" = "404" ]; then
    echo "   ❌ $endpoint - Not Found"
  elif [ "$response" = "200" ]; then
    echo "   ✅ $endpoint - OK"
  else
    echo "   ⚠️  $endpoint - HTTP $response"
  fi
done

echo ""
echo "4️⃣ PostgreSQL Connection:"
docker exec aethermindagentos-postgres-1 psql -U aethermind -d aethermind -c "SELECT version();" 2>&1 | head -n 3

echo ""
echo "5️⃣ Redis Connection:"
docker exec aethermindagentos-redis-1 redis-cli PING

echo ""
echo "✅ Tests completed!"