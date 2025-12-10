#!/bin/bash

# Aethermind AgentOS - Unified Production Health Check
# Comprehensive health check script with multiple modes
# Usage: ./production-health-check.sh [--quick|--full|--auth]

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default mode
MODE="quick"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --quick)
      MODE="quick"
      shift
      ;;
    --full)
      MODE="full"
      shift
      ;;
    --auth)
      MODE="auth"
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--quick|--full|--auth]"
      echo ""
      echo "Modes:"
      echo "  --quick  Basic endpoint checks (default)"
      echo "  --full   All checks including performance, CORS, and SSL/TLS"
      echo "  --auth   Full checks + authentication testing (requires API_KEY)"
      echo ""
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# URLs (configure these with your production URLs)
DASHBOARD_URL="${DASHBOARD_URL:-https://aethermind-agent-os-dashboard.vercel.app}"
API_URL="${API_URL:-https://your-api.railway.app}"
LANDING_URL="${LANDING_URL:-https://aethermind-page.vercel.app}"
API_KEY="${API_KEY:-}"

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Print header
print_header() {
  echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Check functions
check_pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((PASSED++))
}

check_fail() {
  echo -e "${RED}✗${NC} $1"
  ((FAILED++))
}

check_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
  ((WARNINGS++))
}

# Function to check URL endpoint
check_endpoint() {
  local name=$1
  local url=$2
  local expected_code=${3:-200}
  
  echo -n "[$name] "
  
  # Perform curl with timeout
  response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  
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

# Function to check response time
check_response_time() {
  local url=$1
  local name=$2
  local max_time=${3:-2000}
  
  echo -n "[$name] "
  
  # Measure response time
  if command -v date >/dev/null 2>&1; then
    start_time=$(date +%s%N 2>/dev/null || echo "0")
    curl -s -o /dev/null "$url" 2>/dev/null
    end_time=$(date +%s%N 2>/dev/null || echo "0")
    
    if [ "$start_time" != "0" ] && [ "$end_time" != "0" ]; then
      duration=$(( (end_time - start_time) / 1000000 ))
    else
      # Fallback for systems without nanosecond support
      duration=0
    fi
  else
    duration=0
  fi
  
  if [ $duration -eq 0 ]; then
    check_warn "Response time check skipped (date command not available)"
    return 0
  elif [ $duration -lt 500 ]; then
    echo -e "${GREEN}✅ FAST${NC} (${duration}ms)"
    ((PASSED++))
    return 0
  elif [ $duration -lt $max_time ]; then
    echo -e "${YELLOW}⚠️  ACCEPTABLE${NC} (${duration}ms)"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌ SLOW${NC} (${duration}ms, expected < ${max_time}ms)"
    ((FAILED++))
    return 1
  fi
}

# Banner
echo -e "${BLUE}"
cat << "EOF"
   ___       __  __                      _           __
  / _ | ___ / /_/ /  ___ ______ _  (_)__  ___/ /
 / __ |/ -_) __/ _ \/ -_) __/  ' \/ / _ \/ _  / 
/_/ |_|\__/\__/_//_/\__/_/ /_/_/_/_/_//_/\_,_/  
                                                 
Production Health Check - Mode: 
EOF
echo -e "${CYAN}${MODE}${BLUE}"
echo "=================================================="
echo -e "${NC}\n"

# ============================================
# QUICK MODE CHECKS (Always run)
# ============================================

print_header "📱 Frontend Health Checks"

check_endpoint "Landing Page" "$LANDING_URL"
check_endpoint "Dashboard Home" "$DASHBOARD_URL"
check_endpoint "Dashboard Agents" "$DASHBOARD_URL/dashboard/agents"
check_endpoint "Dashboard Logs" "$DASHBOARD_URL/dashboard/logs"

if [ "$MODE" = "full" ] || [ "$MODE" = "auth" ]; then
  check_endpoint "Dashboard Traces" "$DASHBOARD_URL/dashboard/traces"
  check_endpoint "Dashboard Costs" "$DASHBOARD_URL/dashboard/costs"
  check_endpoint "Sentry Test Page" "$DASHBOARD_URL/sentry-example-page"
fi

print_header "🔧 Backend API Health Checks"

check_endpoint "API Root" "$API_URL/"
check_endpoint "API Health Endpoint" "$API_URL/api/health"
check_endpoint "API Agents Route" "$API_URL/api/agents"
check_endpoint "API Logs Route" "$API_URL/api/logs"

if [ "$MODE" = "full" ] || [ "$MODE" = "auth" ]; then
  check_endpoint "API Traces Route" "$API_URL/api/traces"
  check_endpoint "API Costs Route" "$API_URL/api/costs"
  check_endpoint "API Workflows Route" "$API_URL/api/workflows"
  check_endpoint "API Executions Route" "$API_URL/api/executions"
fi

# ============================================
# FULL MODE CHECKS
# ============================================

if [ "$MODE" = "full" ] || [ "$MODE" = "auth" ]; then
  
  print_header "🌐 External Services"
  
  check_endpoint "Sentry.io" "https://sentry.io"
  check_endpoint "Vercel Status" "https://www.vercel-status.com"
  check_endpoint "Railway Status" "https://railway.app"
  
  print_header "⚡ Performance Checks"
  
  check_response_time "$API_URL/api/health" "API Response Time" 1000
  check_response_time "$DASHBOARD_URL" "Dashboard Load Time" 3000
  
  print_header "🔒 Security & Headers"
  
  echo "Checking CORS headers..."
  headers=$(curl -s -I "$API_URL/api/health" 2>/dev/null)
  
  if echo "$headers" | grep -qi "access-control-allow-origin"; then
    check_pass "CORS headers present"
  else
    check_warn "CORS headers not found (may need configuration)"
  fi
  
  if echo "$headers" | grep -qi "x-powered-by"; then
    check_warn "X-Powered-By header exposed (security: consider removing)"
  else
    check_pass "X-Powered-By header not exposed"
  fi
  
  print_header "🔐 SSL/TLS Verification"
  
  if [[ "$API_URL" == https://* ]]; then
    check_pass "Backend uses HTTPS"
  else
    check_fail "Backend not using HTTPS"
  fi
  
  if [[ "$DASHBOARD_URL" == https://* ]]; then
    check_pass "Frontend uses HTTPS"
  else
    check_fail "Frontend not using HTTPS"
  fi
  
fi

# ============================================
# AUTH MODE CHECKS
# ============================================

if [ "$MODE" = "auth" ]; then
  
  print_header "🔑 Authentication Testing"
  
  if [ -n "$API_KEY" ]; then
    echo "Testing with API Key..."
    
    # Test authenticated request
    auth_response=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "X-API-Key: $API_KEY" \
      "$API_URL/api/agents" 2>/dev/null || echo "000")
    
    if [ "$auth_response" = "200" ]; then
      check_pass "Authenticated request: HTTP $auth_response"
    else
      check_fail "Authenticated request: HTTP $auth_response"
    fi
    
    # Test unauthenticated request (should be blocked)
    unauth_response=$(curl -s -o /dev/null -w "%{http_code}" \
      "$API_URL/api/agents" 2>/dev/null || echo "000")
    
    if [ "$unauth_response" = "401" ] || [ "$unauth_response" = "403" ]; then
      check_pass "Unauthorized request blocked: HTTP $unauth_response"
    else
      check_warn "Unauthorized request not blocked: HTTP $unauth_response"
    fi
  else
    check_warn "API_KEY not set, skipping auth tests"
    echo "  Set API_KEY environment variable to test authentication"
  fi
  
fi

# ============================================
# SUMMARY
# ============================================

echo ""
echo "=================================================="
echo -e "${BLUE}📊 Health Check Summary${NC}"
echo "=================================================="

total=$((PASSED + FAILED + WARNINGS))
pass_rate=0
if [ "$total" -gt 0 ]; then
  pass_rate=$((PASSED * 100 / total))
fi

echo -e "Mode:     ${CYAN}${MODE}${NC}"
echo -e "Passed:   ${GREEN}$PASSED${NC}"
echo -e "Failed:   ${RED}$FAILED${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo -e "Total:    $total"
echo -e "Pass Rate: ${pass_rate}%"
echo ""

# Exit with appropriate status
if [ "$FAILED" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  echo -e "${GREEN}✅ ALL CHECKS PASSED! Production is healthy.${NC}"
  echo ""
  exit 0
elif [ "$FAILED" -eq 0 ]; then
  echo -e "${YELLOW}⚠️  Checks passed with warnings${NC}"
  echo -e "${YELLOW}⚠️  Review warnings before production deployment${NC}"
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
