#!/bin/bash

echo "🔐 Testing AethermindOS API Authentication Methods..."
echo ""

API_URL="http://localhost:3001"

# Test 1: Sin autenticación (baseline)
echo "1️⃣ Sin autenticación:"
curl -s -w "\n  Status: %{http_code}\n" "$API_URL/api/agents" | head -n 3

# Test 2: Bearer Token (JWT común)
echo -e "\n2️⃣ Con Bearer Token (JWT):"
curl -s -w "\n  Status: %{http_code}\n" \
  -H "Authorization: Bearer test-token-123" \
  "$API_URL/api/agents" | head -n 3

# Test 3: API Key en header
echo -e "\n3️⃣ Con API Key en header:"
curl -s -w "\n  Status: %{http_code}\n" \
  -H "X-API-Key: test-key-123" \
  "$API_URL/api/agents" | head -n 3

# Test 4: Basic Auth
echo -e "\n4️⃣ Con Basic Auth:"
curl -s -w "\n  Status: %{http_code}\n" \
  -u "admin:admin" \
  "$API_URL/api/agents" | head -n 3

# Test 5: Verificar si hay endpoint de login/auth
echo -e "\n5️⃣ Buscando endpoint de autenticación:"
auth_endpoints=(
  "/auth/login"
  "/api/auth/login"
  "/login"
  "/api/login"
  "/auth/token"
  "/api/auth/token"
)

for endpoint in "${auth_endpoints[@]}"; do
  response=$(curl -s -w "%{http_code}" -o /dev/null "$API_URL$endpoint")
  if [ "$response" != "404" ]; then
    echo "  ✅ Found: $endpoint (HTTP $response)"
  fi
done

echo -e "\n6️⃣ Información de la estructura de auth:"
echo "  Verificando archivos de autenticación..."

# Ver si hay archivos de auth
if [ -f "apps/api/src/middleware/auth.ts" ]; then
  echo "  ✅ Encontrado: apps/api/src/middleware/auth.ts"
fi

if [ -f "apps/api/src/routes/auth.ts" ]; then
  echo "  ✅ Encontrado: apps/api/src/routes/auth.ts"
fi

echo -e "\n📝 Recomendaciones:"
echo "  1. Revisar apps/api/src/index.ts para ver la configuración de auth"
echo "  2. Buscar en .env variables como API_KEY, JWT_SECRET, etc."
echo "  3. Verificar la documentación del proyecto"

echo -e "\n✅ Tests de autenticación completados!"