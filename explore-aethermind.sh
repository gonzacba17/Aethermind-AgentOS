#!/bin/bash

echo "🔍 EXPLORANDO AETHERMIND AGENTOS"
echo "================================"
echo ""

# 1. Estructura del proyecto
echo "📁 1. ESTRUCTURA DEL PROYECTO:"
echo "-------------------------------"
tree apps/api/src -L 2 2>/dev/null || find apps/api/src -type f -name "*.ts" | head -20
echo ""

# 2. Variables de entorno de auth
echo "🔐 2. VARIABLES DE AUTENTICACIÓN EN .ENV:"
echo "-----------------------------------------"
cat .env | grep -iE "key|secret|token|auth|jwt|password" | sed 's/=.*/=***/'
echo ""

# 3. Archivos relacionados con auth
echo "🛡️  3. ARCHIVOS DE AUTENTICACIÓN:"
echo "--------------------------------"
find apps/api/src -type f -name "*auth*" -o -name "*middleware*" | while read file; do
  echo "  📄 $file"
done
echo ""

# 4. Rutas de la API
echo "🛤️  4. RUTAS DEFINIDAS EN LA API:"
echo "--------------------------------"
grep -rh "router\.\|app\." apps/api/src --include="*.ts" | \
  grep -E "(get|post|put|delete|patch)" | \
  grep -oE "'[^']+'" | sort -u | head -20
echo ""

# 5. Modelos de Prisma
echo "🗄️  5. MODELOS DE BASE DE DATOS (Prisma):"
echo "-----------------------------------------"
grep "^model " prisma/schema.prisma | sed 's/model /  📊 /'
echo ""

# 6. Tablas en PostgreSQL
echo "🐘 6. TABLAS EN POSTGRESQL:"
echo "---------------------------"
docker exec aethermindagentos-postgres-1 psql -U aethermind -d aethermind -c "\dt" 2>/dev/null | grep "public" || echo "  (ejecuta el script desde WSL)"
echo ""

# 7. Keys en Redis
echo "🔴 7. KEYS EN REDIS:"
echo "-------------------"
docker exec aethermindagentos-redis-1 redis-cli KEYS "*" | head -10
echo ""

# 8. Package.json scripts
echo "📦 8. SCRIPTS DISPONIBLES:"
echo "--------------------------"
cat package.json | grep -A 30 '"scripts"' | grep '"' | head -15
echo ""

# 9. README o docs
echo "📖 9. DOCUMENTACIÓN:"
echo "--------------------"
if [ -f "README.md" ]; then
  echo "  ✅ README.md existe"
  head -20 README.md
else
  echo "  ❌ No se encontró README.md"
fi
echo ""

# 10. Primer endpoint del index.ts
echo "🎯 10. CÓDIGO PRINCIPAL DE LA API:"
echo "-----------------------------------"
head -100 apps/api/src/index.ts | grep -A 5 "app\.\|router\."
echo ""

echo "✅ Exploración completada!"
echo ""
echo "💡 PRÓXIMOS PASOS:"
echo "  1. Revisar la salida de 'RUTAS DEFINIDAS'"
echo "  2. Verificar 'VARIABLES DE AUTENTICACIÓN'"
echo "  3. Leer apps/api/src/index.ts completo"
echo "  4. Explorar los modelos de Prisma"