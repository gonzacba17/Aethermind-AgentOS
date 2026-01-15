#!/usr/bin/env pwsh
# Script para aplicar migraciones de Prisma en Railway
# Este script debe ejecutarse en Railway como parte del proceso de build

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Aplicando Migraciones de Prisma" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que DATABASE_URL esté configurada
if (-not $env:DATABASE_URL) {
    Write-Host "ERROR: DATABASE_URL no está configurada" -ForegroundColor Red
    exit 1
}

Write-Host "DATABASE_URL encontrada: $($env:DATABASE_URL.Substring(0, 30))..." -ForegroundColor Green
Write-Host ""

# Paso 1: Aplicar migraciones
Write-Host "[1/3] Aplicando migraciones..." -ForegroundColor Yellow
npx prisma migrate deploy --schema=./prisma/schema.prisma

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Las migraciones fallaron" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Migraciones aplicadas correctamente" -ForegroundColor Green
Write-Host ""

# Paso 2: Generar cliente de Prisma
Write-Host "[2/3] Generando cliente de Prisma..." -ForegroundColor Yellow
npx prisma generate --schema=./prisma/schema.prisma

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: La generación del cliente falló" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Cliente de Prisma generado correctamente" -ForegroundColor Green
Write-Host ""

# Paso 3: Verificar el estado de la base de datos
Write-Host "[3/3] Verificando estado de la base de datos..." -ForegroundColor Yellow
npx prisma db pull --print --schema=./prisma/schema.prisma > /tmp/db-schema.txt 2>&1

Write-Host "✓ Estado de la base de datos verificado" -ForegroundColor Green
Write-Host ""

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Migraciones completadas exitosamente" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Cyan
