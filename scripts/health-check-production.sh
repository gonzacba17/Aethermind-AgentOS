#!/bin/bash

# Aethermind AgentOS - Production Health Check
# Comprehensive health check script with color output and detailed diagnostics

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# URLs (configure these with your production URLs)
DASHBOARD_URL="${DASHBOARD_URL:-https://aethermind-agent-os-dashboard.vercel.app}"
API_URL="${API_URL:-https://your-api.railway.app}"
LANDING_URL="${LANDING_URL:-https://aethermind-page.vercel.app}"

echo -e "${BLUE}🔍 Aethermind AgentOS - Production Health Check${NC}"
echo "=================================================="
echo ""

# Counter for failed checks
FAILED=0
PASSED=0

# Function to check URL endpoint
check_endpoint() {
  local name=$1
  local url=$2
  local expected_code=${3:-200}
  
  echo -n "[$name] "
  
  # Perform curl with timeout
  response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null)
  
  if [ "$response" = "$expected_code" ] || [ "$response" = "200" ] || [ "$response" = "301" ] || [ "$response" = "302" ]; then
    echo -e "${GREEN}✅ OK${NC} (HTTP $response)"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌ FAILED${NC} (HTTP $response, expected $expected_code)"
    ((FAILED++))
    return 1
  fi
}

# Frontend Health Checks
echo -e "${YELLOW}📱 Frontend Health Checks:${NC}"
echo "----------------------------"
check_endpoint "Landing Page" "$LANDING_URL"
check_endpoint "Dashboard Home" "$DASHBOARD_URL"
check_endpoint "Dashboard Agents" "$DASHBOARD_URL/dashboard/agents"
check_endpoint "Dashboard Logs" "$DASHBOARD_URL/dashboard/logs"
check_endpoint "Dashboard Traces" "$DASHBOARD_URL/dashboard/traces"
check_endpoint "Dashboard Costs" "$DASHBOARD_URL/dashboard/costs"
check_endpoint "Sentry Test Page" "$DASHBOARD_URL/sentry-example-page"
echo ""

# Backend API Health Checks
echo -e "${YELLOW}🔧 Backend API Health Checks:${NC}"
echo "------------------------------"
check_endpoint "API Root" "$API_URL/"
check_endpoint "API Health Endpoint" "$API_URL/api/health"
check_endpoint "API Agents Route" "$API_URL/api/agents"
check_endpoint "API Logs Route" "$API_URL/api/logs"
check_endpoint "API Traces Route" "$API_URL/api/traces"
check_endpoint "API Costs Route" "$API_URL/api/costs"
echo ""

# External Services
echo -e "${YELLOW}🌐 External Services:${NC}"
echo "----------------------"
check_endpoint "Sentry.io" "https://sentry.io"
check_endpoint "Vercel Status" "https://www.vercel-status.com"
check_endpoint "Railway Status" "https://railway.app"
echo ""

# Performance Check
echo -e "${YELLOW}⚡ Performance Check:${NC}"
echo "----------------------"
echo -n "[Response Time Test] "
start_time=$(date +%s%N)
curl -s -o /dev/null "$API_URL/api/health"
end_time=$(date +%s%N)
duration=$(( (end_time - start_time) / 1000000 ))

if [ $duration -lt 500 ]; then
  echo -e "${GREEN}✅ FAST${NC} (${duration}ms)"
  ((PASSED++))
elif [ $duration -lt 2000 ]; then
  echo -e "${YELLOW}⚠️  SLOW${NC} (${duration}ms)"
  ((PASSED++))
else
  echo -e "${RED}❌ VERY SLOW${NC} (${duration}ms)"
  ((FAILED++))
fi
echo ""

# Summary
echo "=================================================="
echo -e "${BLUE}📊 Health Check Summary:${NC}"
echo "=================================================="
echo -e "Passed:  ${GREEN}$PASSED${NC}"
echo -e "Failed:  ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ ALL CHECKS PASSED! Production is healthy.${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}❌ $FAILED CHECK(S) FAILED!${NC}"
  echo -e "${YELLOW}⚠️  Please investigate the failed endpoints.${NC}"
  echo ""
  echo "Troubleshooting steps:"
  echo "1. Check Railway logs: https://railway.app/dashboard"
  echo "2. Check Vercel deployments: https://vercel.com/dashboard"
  echo "3. Check Sentry errors: https://sentry.io/issues/"
  echo ""
  exit 1
fi
