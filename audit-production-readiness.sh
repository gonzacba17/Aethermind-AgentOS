#!/bin/bash

echo "🔍 AETHERMIND AGENTOS - PRODUCTION READINESS AUDIT"
echo "=================================================="
echo ""

# Scoring
total_score=0
max_score=100

check_item() {
  local name=$1
  local points=$2
  local status=$3
  
  if [ "$status" = "pass" ]; then
    echo "✅ $name (+$points pts)"
    total_score=$((total_score + points))
  elif [ "$status" = "partial" ]; then
    local half=$((points / 2))
    echo "⚠️  $name (+$half pts - incomplete)"
    total_score=$((total_score + half))
  else
    echo "❌ $name (0 pts - missing)"
  fi
}

echo "📋 CORE FEATURES:"
echo "─────────────────"

# 1. API Endpoints
if grep -q "router.get\|app.get" apps/api/src/routes/*.ts 2>/dev/null; then
  check_item "REST API endpoints" 10 "pass"
else
  check_item "REST API endpoints" 10 "fail"
fi

# 2. Authentication
if [ -f "apps/api/src/middleware/auth.ts" ]; then
  check_item "API Authentication" 10 "pass"
else
  check_item "API Authentication" 10 "fail"
fi

# 3. Database models
models_count=$(grep -c "^model " prisma/schema.prisma 2>/dev/null || echo 0)
if [ $models_count -ge 6 ]; then
  check_item "Database models ($models_count)" 10 "pass"
else
  check_item "Database models ($models_count)" 10 "partial"
fi

# 4. Cost tracking
if grep -q "Cost\|cost" prisma/schema.prisma; then
  check_item "Cost tracking system" 15 "pass"
else
  check_item "Cost tracking system" 15 "fail"
fi

# 5. Multi-provider support
providers=$(grep -c "openai\|anthropic\|google" apps/api/src -r 2>/dev/null || echo 0)
if [ $providers -ge 3 ]; then
  check_item "Multi-LLM provider support" 10 "pass"
else
  check_item "Multi-LLM provider support" 10 "partial"
fi

echo ""
echo "🎨 USER EXPERIENCE:"
echo "───────────────────"

# 6. Dashboard
if [ -d "apps/dashboard" ] || [ -d "packages/dashboard" ]; then
  if [ -f "apps/dashboard/src/App.tsx" ] || [ -f "packages/dashboard/src/App.tsx" ]; then
    check_item "Dashboard UI" 15 "pass"
  else
    check_item "Dashboard UI" 15 "partial"
  fi
else
  check_item "Dashboard UI" 15 "fail"
fi

# 7. WebSocket support
if [ -f "apps/api/src/websocket/WebSocketManager.ts" ]; then
  check_item "Real-time updates (WebSocket)" 10 "pass"
else
  check_item "Real-time updates (WebSocket)" 10 "fail"
fi

echo ""
echo "🔒 PRODUCTION READY:"
echo "────────────────────"

# 8. Error handling
error_handling=$(grep -c "try\|catch\|throw" apps/api/src/index.ts 2>/dev/null || echo 0)
if [ $error_handling -ge 5 ]; then
  check_item "Error handling" 5 "pass"
else
  check_item "Error handling" 5 "partial"
fi

# 9. Environment variables
if [ -f ".env.example" ] || [ -f ".env" ]; then
  check_item "Environment config" 5 "pass"
else
  check_item "Environment config" 5 "fail"
fi

# 10. Tests
if [ -d "tests" ] || grep -q "jest\|test" package.json; then
  test_files=$(find . -name "*.test.ts" -o -name "*.spec.ts" 2>/dev/null | wc -l)
  if [ $test_files -ge 5 ]; then
    check_item "Test coverage ($test_files tests)" 10 "pass"
  else
    check_item "Test coverage ($test_files tests)" 10 "partial"
  fi
else
  check_item "Test coverage" 10 "fail"
fi

echo ""
echo "═══════════════════════════════════════════"
echo "📊 PRODUCTION READINESS SCORE: $total_score/100"
echo "═══════════════════════════════════════════"
echo ""

if [ $total_score -ge 80 ]; then
  echo "🎉 STATUS: READY FOR BETA LAUNCH"
  echo "   Next: Deploy to production, get first 10 users"
elif [ $total_score -ge 60 ]; then
  echo "⚠️  STATUS: ALMOST READY"
  echo "   Next: Fix critical missing items, then launch"
elif [ $total_score -ge 40 ]; then
  echo "🚧 STATUS: DEVELOPMENT STAGE"
  echo "   Next: Focus on core features first"
else
  echo "❌ STATUS: EARLY STAGE"
  echo "   Next: Build MVP features before launch"
fi

echo ""
echo "💡 RECOMMENDATIONS:"
echo ""

if [ $total_score -lt 80 ]; then
  echo "Priority fixes:"
  [ ! -d "apps/dashboard" ] && echo "  1. Build basic dashboard UI"
  [ $test_files -lt 5 ] && echo "  2. Add critical path tests"
  ! grep -q "Cost" prisma/schema.prisma && echo "  3. Implement cost tracking"
fi

echo ""
echo "Run this audit weekly to track progress!"