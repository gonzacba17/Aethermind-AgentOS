#!/bin/bash
# Script para aplicar migraciones de Prisma en Railway
# Este script se ejecuta automáticamente durante el build en Railway

set -e  # Exit on error

echo "================================="
echo "Aplicando Migraciones de Prisma"
echo "================================="
echo ""

# Verificar que DATABASE_URL esté configurada
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL no está configurada"
    exit 1
fi

echo "✓ DATABASE_URL encontrada"
echo ""

# Paso 1: Aplicar migraciones
echo "[1/3] Aplicando migraciones..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "✓ Migraciones aplicadas correctamente"
echo ""

# Paso 2: Generar cliente de Prisma
echo "[2/3] Generando cliente de Prisma..."
npx prisma generate --schema=./prisma/schema.prisma

echo "✓ Cliente de Prisma generado correctamente"
echo ""

# Paso 3: Mostrar estado de migraciones
echo "[3/3] Verificando estado de migraciones..."
npx prisma migrate status --schema=./prisma/schema.prisma || true

echo ""
echo "================================="
echo "Migraciones completadas exitosamente"
echo "================================="
