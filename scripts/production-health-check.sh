#!/bin/bash

echo "🔍 Aethermind AgentOS - Production Health Check"
echo "=============================================="
echo ""

DASHBOARD_URL="${DASHBOARD_URL:-https://aethermind-agent-os-dashboard.vercel.app}"
API_URL="${API_URL:-https://your-backend.railway.app}"

check_endpoint() {
  local name=$1
  local url=$2
  local expected_code=${3:-200}
  
  echo -n "[$name] "
  
  response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null)
  
  if [ "$response" = "$expected_code" ]; then
    echo "✅ OK ($response)"
    return 0
  else
    echo "❌ FAILED ($response, expected $expected_code)"
    return 1
  fi
}

failures=0

echo "Frontend Checks:"
echo "----------------"
check_endpoint "Dashboard Home" "$DASHBOARD_URL" || ((failures++))
check_endpoint "Dashboard Agents" "$DASHBOARD_URL/dashboard/agents" || ((failures++))
check_endpoint "Dashboard Logs" "$DASHBOARD_URL/dashboard/logs" || ((failures++))
check_endpoint "Sentry Test Page" "$DASHBOARD_URL/sentry-example-page" || ((failures++))
echo ""

echo "Backend API Checks:"
echo "-------------------"
check_endpoint "API Health" "$API_URL/api/health" || ((failures++))
check_endpoint "API Root" "$API_URL/" || ((failures++))
echo ""

echo "External Services:"
echo "------------------"
check_endpoint "Sentry.io" "https://sentry.io" || ((failures++))
echo ""

echo "=============================================="
if [ $failures -eq 0 ]; then
  echo "✅ All checks passed! Production is healthy."
  exit 0
else
  echo "❌ $failures check(s) failed. Please investigate."
  exit 1
fi
