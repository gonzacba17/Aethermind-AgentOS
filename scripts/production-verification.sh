#!/bin/bash

set -e

BACKEND_URL="${BACKEND_URL:-https://aethermind-agentos-production.up.railway.app}"
FRONTEND_URL="${FRONTEND_URL:-https://aethermind-dashboard.vercel.app}"
API_KEY="${API_KEY:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

passed=0
failed=0
warnings=0

print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((passed++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((failed++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((warnings++))
}

check_url() {
    local url=$1
    local name=$2
    local expected_code=${3:-200}
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$response" -eq "$expected_code" ]; then
        check_pass "$name: HTTP $response"
        return 0
    else
        check_fail "$name: HTTP $response (expected $expected_code)"
        return 1
    fi
}

check_response_time() {
    local url=$1
    local name=$2
    local max_time=${3:-2000}
    
    time_ms=$(curl -s -o /dev/null -w "%{time_total}" "$url" 2>/dev/null | awk '{print int($1*1000)}')
    
    if [ "$time_ms" -lt "$max_time" ]; then
        check_pass "$name: ${time_ms}ms (< ${max_time}ms)"
        return 0
    else
        check_warn "$name: ${time_ms}ms (> ${max_time}ms)"
        return 1
    fi
}

echo -e "${BLUE}"
cat << "EOF"
   ___       __  __                      _           __
  / _ | ___ / /_/ /  ___ ______ _  (_)__  ___/ /
 / __ |/ -_) __/ _ \/ -_) __/  ' \/ / _ \/ _  / 
/_/ |_|\__/\__/_//_/\__/_/ /_/_/_/_/_//_/\_,_/  
                                                 
Production Verification Script v1.0
EOF
echo -e "${NC}\n"

print_header "1. VERIFICACIÓN DE URLS Y CONECTIVIDAD"

echo "Backend API:"
check_url "$BACKEND_URL/api/health" "Health endpoint"
check_response_time "$BACKEND_URL/api/health" "API response time" 1000

echo -e "\nFrontend Dashboard:"
check_url "$FRONTEND_URL" "Dashboard homepage"
check_response_time "$FRONTEND_URL" "Dashboard load time" 3000

print_header "2. VERIFICACIÓN DE ENDPOINTS DE API"

endpoints=(
    "/api/health:200"
    "/api/agents:200,401"
    "/api/workflows:200,401"
    "/api/executions:200,401"
    "/api/logs:200,401"
    "/api/traces:200,401"
    "/api/costs:200,401"
)

for endpoint_spec in "${endpoints[@]}"; do
    IFS=':' read -r endpoint codes <<< "$endpoint_spec"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL$endpoint" 2>/dev/null || echo "000")
    
    if [[ ",$codes," == *",$response,"* ]]; then
        check_pass "Endpoint $endpoint: HTTP $response"
    else
        check_fail "Endpoint $endpoint: HTTP $response (expected one of: $codes)"
    fi
done

print_header "3. VERIFICACIÓN DE CORS Y HEADERS"

echo "Checking CORS headers..."
headers=$(curl -s -I "$BACKEND_URL/api/health" 2>/dev/null)

if echo "$headers" | grep -qi "access-control-allow-origin"; then
    check_pass "CORS headers present"
else
    check_warn "CORS headers not found (may need configuration)"
fi

if echo "$headers" | grep -qi "x-powered-by"; then
    check_warn "X-Powered-By header present (security: consider removing)"
else
    check_pass "X-Powered-By header not exposed"
fi

print_header "4. VERIFICACIÓN DE AUTENTICACIÓN"

if [ -n "$API_KEY" ]; then
    echo "Testing with API Key..."
    
    auth_response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "X-API-Key: $API_KEY" \
        "$BACKEND_URL/api/agents" 2>/dev/null || echo "000")
    
    if [ "$auth_response" = "200" ]; then
        check_pass "Authenticated request: HTTP $auth_response"
    else
        check_fail "Authenticated request: HTTP $auth_response"
    fi
    
    unauth_response=$(curl -s -o /dev/null -w "%{http_code}" \
        "$BACKEND_URL/api/agents" 2>/dev/null || echo "000")
    
    if [ "$unauth_response" = "401" ] || [ "$unauth_response" = "403" ]; then
        check_pass "Unauthorized request blocked: HTTP $unauth_response"
    else
        check_warn "Unauthorized request not blocked: HTTP $unauth_response"
    fi
else
    check_warn "API_KEY not set, skipping auth tests"
    echo "  Set API_KEY environment variable to test authentication"
fi

print_header "5. VERIFICACIÓN DE VARIABLES DE ENTORNO"

required_vars=(
    "BACKEND_URL"
    "FRONTEND_URL"
)

for var in "${required_vars[@]}"; do
    if [ -n "${!var}" ]; then
        check_pass "$var is set"
    else
        check_warn "$var is not set"
    fi
done

print_header "6. VERIFICACIÓN DE SSL/TLS"

if [[ "$BACKEND_URL" == https://* ]]; then
    check_pass "Backend uses HTTPS"
else
    check_fail "Backend not using HTTPS"
fi

if [[ "$FRONTEND_URL" == https://* ]]; then
    check_pass "Frontend uses HTTPS"
else
    check_fail "Frontend not using HTTPS"
fi

print_header "7. VERIFICACIÓN DE CONECTIVIDAD A SERVICIOS"

echo "Checking external services..."

sentry_check=$(curl -s -o /dev/null -w "%{http_code}" "https://sentry.io" 2>/dev/null || echo "000")
if [ "$sentry_check" = "200" ] || [ "$sentry_check" = "301" ] || [ "$sentry_check" = "302" ]; then
    check_pass "Sentry.io reachable"
else
    check_warn "Sentry.io not reachable (may affect error tracking)"
fi

print_header "📊 RESUMEN DE VERIFICACIÓN"

total=$((passed + failed + warnings))
pass_rate=0
if [ "$total" -gt 0 ]; then
    pass_rate=$((passed * 100 / total))
fi

echo -e "\n${GREEN}Passed:   $passed${NC}"
echo -e "${RED}Failed:   $failed${NC}"
echo -e "${YELLOW}Warnings: $warnings${NC}"
echo -e "Total:    $total"
echo -e "\nPass Rate: ${pass_rate}%\n"

if [ "$failed" -eq 0 ] && [ "$warnings" -eq 0 ]; then
    echo -e "${GREEN}✓ ¡TODAS LAS VERIFICACIONES PASARON!${NC}"
    echo -e "${GREEN}✓ Tu aplicación está lista para producción${NC}\n"
    exit 0
elif [ "$failed" -eq 0 ]; then
    echo -e "${YELLOW}⚠ Verificaciones pasaron con advertencias${NC}"
    echo -e "${YELLOW}⚠ Revisa los warnings antes de producción${NC}\n"
    exit 0
else
    echo -e "${RED}✗ ALGUNAS VERIFICACIONES FALLARON${NC}"
    echo -e "${RED}✗ Corrige los errores antes de continuar${NC}\n"
    exit 1
fi
