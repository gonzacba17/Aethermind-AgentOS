# ============================================================================
# Script de Diagnostico y Reparacion de Prisma + PostgreSQL
# Aethermind AgentOS - Database Connection Fix
# ============================================================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Aethermind AgentOS - Prisma Fix Script" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot | Split-Path -Parent

# ============================================================================
# PASO 1: Verificar variables de entorno
# ============================================================================
Write-Host "[PASO 1] Verificando variables de entorno..." -ForegroundColor Yellow

if (-not (Test-Path "$projectRoot\.env")) {
    Write-Host "ERROR: Archivo .env no encontrado" -ForegroundColor Red
    exit 1
}

$envContent = Get-Content "$projectRoot\.env" -Raw
if ($envContent -match 'DATABASE_URL=(.+)') {
    $databaseUrl = $matches[1].Trim()
    Write-Host "  DATABASE_URL encontrada: $databaseUrl" -ForegroundColor Green
    
    # Validar formato de la URL
    if ($databaseUrl -notmatch '^postgresql://') {
        Write-Host "  ERROR: DATABASE_URL no tiene formato PostgreSQL valido" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  ERROR: DATABASE_URL no esta definida en .env" -ForegroundColor Red
    exit 1
}

Write-Host "  Variables de entorno: OK`n" -ForegroundColor Green

# ============================================================================
# PASO 2: Verificar estado de PostgreSQL
# ============================================================================
Write-Host "[PASO 2] Verificando estado de PostgreSQL..." -ForegroundColor Yellow

$postgresRunning = docker ps --filter "name=postgres" --filter "status=running" --format "{{.Names}}"
if ($postgresRunning -like "*postgres*") {
    Write-Host "  PostgreSQL container: RUNNING" -ForegroundColor Green
} else {
    Write-Host "  WARNING: PostgreSQL no esta corriendo" -ForegroundColor Yellow
    Write-Host "  Iniciando PostgreSQL..." -ForegroundColor Yellow
    docker-compose up -d postgres
    Write-Host "  Esperando 10 segundos para que PostgreSQL inicie..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}

# Test de conexion directa
Write-Host "  Probando conexion directa con psql..." -ForegroundColor Cyan

# Detectar nombre del contenedor de PostgreSQL
$postgresContainer = docker ps --filter "name=postgres" --format "{{.Names}}" | Select-Object -First 1
if ([string]::IsNullOrEmpty($postgresContainer)) {
    Write-Host "  ERROR: No se encontro contenedor de PostgreSQL" -ForegroundColor Red
    exit 1
}

Write-Host "  Contenedor PostgreSQL: $postgresContainer" -ForegroundColor Cyan
$testConnection = docker exec $postgresContainer psql -U aethermind -d aethermind -c "SELECT 1;" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Conexion PostgreSQL: OK`n" -ForegroundColor Green
} else {
    Write-Host "  ERROR: No se puede conectar a PostgreSQL" -ForegroundColor Red
    Write-Host "  $testConnection" -ForegroundColor Red
    exit 1
}

# ============================================================================
# PASO 3: Limpiar cache de Prisma
# ============================================================================
Write-Host "[PASO 3] Limpiando cache de Prisma..." -ForegroundColor Yellow

# Eliminar cliente generado anterior
$prismaClientPaths = @(
    "$projectRoot\node_modules\.prisma",
    "$projectRoot\apps\api\node_modules\.prisma",
    "$projectRoot\node_modules\@prisma\client"
)

foreach ($path in $prismaClientPaths) {
    if (Test-Path $path) {
        Write-Host "  Eliminando: $path" -ForegroundColor Cyan
        Remove-Item -Path $path -Recurse -Force
    }
}

Write-Host "  Cache de Prisma limpiado: OK`n" -ForegroundColor Green

# ============================================================================
# PASO 4: Verificar ubicacion de schema.prisma
# ============================================================================
Write-Host "[PASO 4] Verificando ubicacion de schema.prisma..." -ForegroundColor Yellow

$schemaPath = "$projectRoot\prisma\schema.prisma"
if (Test-Path $schemaPath) {
    Write-Host "  Schema encontrado: $schemaPath" -ForegroundColor Green
} else {
    Write-Host "  ERROR: schema.prisma no encontrado en $schemaPath" -ForegroundColor Red
    exit 1
}

# Verificar que el schema tenga la URL correcta
$schemaContent = Get-Content $schemaPath -Raw
if ($schemaContent -match 'url\s*=\s*env\("DATABASE_URL"\)') {
    Write-Host "  Schema usa env(DATABASE_URL): OK`n" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Schema no esta configurado para usar DATABASE_URL" -ForegroundColor Red
    exit 1
}

# ============================================================================
# PASO 5: Sincronizar versiones de Prisma
# ============================================================================
Write-Host "[PASO 5] Sincronizando versiones de Prisma..." -ForegroundColor Yellow

Set-Location $projectRoot

# Detectar version de Prisma CLI de forma mas simple
Write-Host "  Detectando version de Prisma CLI..." -ForegroundColor Cyan
$ErrorActionPreference = "SilentlyContinue"
$prismaVersionOutput = & npx prisma --version 2>&1 | Out-String
$ErrorActionPreference = "Stop"

$prismaVersionMatch = [regex]::Match($prismaVersionOutput, 'prisma\s+:\s+(\d+\.\d+\.\d+)')
if ($prismaVersionMatch.Success) {
    $prismaVersion = $prismaVersionMatch.Groups[1].Value
    Write-Host "  Prisma CLI version: $prismaVersion" -ForegroundColor Green
    
    # Actualizar @prisma/client a la misma version (en workspace root)
    Write-Host "  Actualizando @prisma/client@$prismaVersion..." -ForegroundColor Cyan
    $null = pnpm add "@prisma/client@$prismaVersion" -w 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  @prisma/client actualizado: OK`n" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: Actualizacion fallo, continuando...`n" -ForegroundColor Yellow
    }
} else {
    Write-Host "  WARNING: No se pudo detectar version, continuando...`n" -ForegroundColor Yellow
}

# ============================================================================
# PASO 6: Detener procesos Node.js que puedan bloquear archivos
# ============================================================================
Write-Host "`n[PASO 6] Deteniendo procesos Node.js..." -ForegroundColor Yellow

# Detener cualquier proceso node.exe que pueda estar bloqueando archivos
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "  Encontrados $($nodeProcesses.Count) procesos Node.js corriendo" -ForegroundColor Cyan
    Write-Host "  Deteniendo procesos Node.js..." -ForegroundColor Cyan
    Stop-Process -Name node -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "  Procesos Node.js detenidos: OK`n" -ForegroundColor Green
} else {
    Write-Host "  No hay procesos Node.js corriendo`n" -ForegroundColor Green
}

# ============================================================================
# PASO 7: Regenerar Prisma Client
# ============================================================================
Write-Host "[PASO 7] Regenerando Prisma Client..." -ForegroundColor Yellow

# Cargar variables de entorno explicitamente para Prisma
$env:DATABASE_URL = $databaseUrl

Write-Host "  Ejecutando: pnpm prisma generate" -ForegroundColor Cyan

# Intentar generar el cliente (con retry si falla por bloqueo de archivo)
$maxRetries = 3
$retryCount = 0
$generated = $false

while (-not $generated -and $retryCount -lt $maxRetries) {
    if ($retryCount -gt 0) {
        Write-Host "  Reintentando ($retryCount/$maxRetries)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
    
    # Ejecutar y capturar salida
    $output = & pnpm prisma generate 2>&1
    $exitCode = $LASTEXITCODE
    
    # Buscar errores reales (no mensajes informativos)
    $hasError = $false
    foreach ($line in $output) {
        $lineStr = $line.ToString()
        if ($lineStr -match "Error:" -and $lineStr -notmatch "Environment variables") {
            $hasError = $true
            if ($retryCount -eq 0) {
                Write-Host "  Error detectado: $lineStr" -ForegroundColor Red
            }
        }
    }
    
    # Verificar si el cliente fue generado exitosamente
    $clientExists = Test-Path "$projectRoot\node_modules\.prisma\client\index.js"
    
    if ($clientExists -and -not $hasError) {
        $generated = $true
    } else {
        $retryCount++
        if ($retryCount -lt $maxRetries) {
            # Limpiar archivos .tmp que puedan estar causando problemas
            Get-ChildItem "$projectRoot\node_modules" -Recurse -Filter "*.tmp*" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
        }
    }
}

if ($generated) {
    Write-Host "  Prisma Client generado: OK`n" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Fallo la generacion del cliente Prisma despues de $maxRetries intentos" -ForegroundColor Red
    Write-Host "  SOLUCION MANUAL:" -ForegroundColor Yellow
    Write-Host "    1. Cierra todos los procesos Node.js y VSCode" -ForegroundColor Cyan
    Write-Host "    2. Ejecuta: pnpm prisma generate" -ForegroundColor Cyan
    Write-Host "    3. Vuelve a ejecutar este script`n" -ForegroundColor Cyan
    exit 1
}

# ============================================================================
# PASO 8: Verificar cliente generado
# ============================================================================
Write-Host "[PASO 8] Verificando cliente Prisma generado..." -ForegroundColor Yellow

$generatedClientPath = "$projectRoot\node_modules\.prisma\client"
if (Test-Path $generatedClientPath) {
    Write-Host "  Cliente Prisma encontrado en: $generatedClientPath" -ForegroundColor Green
    
    # Listar archivos generados
    $generatedFiles = Get-ChildItem $generatedClientPath -File | Select-Object -First 5 -ExpandProperty Name
    Write-Host "  Archivos generados: $($generatedFiles -join ', ')..." -ForegroundColor Cyan
} else {
    Write-Host "  ERROR: Cliente Prisma no se genero correctamente" -ForegroundColor Red
    exit 1
}

Write-Host "  Verificacion de cliente: OK`n" -ForegroundColor Green

# ============================================================================
# PASO 9: Aplicar migraciones pendientes
# ============================================================================
Write-Host "[PASO 9] Aplicando migraciones de base de datos..." -ForegroundColor Yellow

Write-Host "  Ejecutando: pnpm prisma migrate deploy" -ForegroundColor Cyan
pnpm prisma migrate deploy

if ($LASTEXITCODE -ne 0) {
    Write-Host "  WARNING: Migraciones fallaron o no hay migraciones pendientes" -ForegroundColor Yellow
    Write-Host "  Si es primera vez, ejecuta: pnpm db:migrate:dev" -ForegroundColor Yellow
} else {
    Write-Host "  Migraciones aplicadas: OK`n" -ForegroundColor Green
}

# ============================================================================
# PASO 10: Test de conexion de Prisma
# ============================================================================
Write-Host "[PASO 10] Probando conexion de Prisma..." -ForegroundColor Yellow

# Crear script de prueba temporal
$testScript = @"
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function testConnection() {
  try {
    await prisma.\`$connect`();
    console.log('[OK] Prisma conectado exitosamente');
    
    const result = await prisma.\`$queryRaw`\`SELECT 1 as test\`;
    console.log('[OK] Query ejecutada:', result);
    
    await prisma.\`$disconnect`();
    process.exit(0);
  } catch (error) {
    console.error('[ERROR] Error de conexion:', error.message);
    process.exit(1);
  }
}

testConnection();
"@

$testFilePath = "$projectRoot\test-prisma-connection.mjs"
Set-Content -Path $testFilePath -Value $testScript

Write-Host "  Ejecutando test de conexion..." -ForegroundColor Cyan
$env:DATABASE_URL = $databaseUrl
node $testFilePath

$testResult = $LASTEXITCODE
Remove-Item $testFilePath -Force

if ($testResult -eq 0) {
    Write-Host "  Test de conexion Prisma: OK`n" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Prisma no puede conectarse a PostgreSQL" -ForegroundColor Red
    Write-Host "`n  PASOS DE DIAGNOSTICO ADICIONALES:" -ForegroundColor Yellow
    Write-Host "  1. Verifica que Docker este corriendo: docker ps" -ForegroundColor Cyan
    Write-Host "  2. Verifica logs de PostgreSQL: docker logs $postgresContainer" -ForegroundColor Cyan
    Write-Host "  3. Verifica .env tenga la contrasena correcta" -ForegroundColor Cyan
    Write-Host "  4. Reinicia PostgreSQL: docker-compose restart postgres`n" -ForegroundColor Cyan
    exit 1
}

# ============================================================================
# PASO 11: Reiniciar aplicacion (si esta corriendo)
# ============================================================================
Write-Host "[PASO 11] Reiniciando aplicacion..." -ForegroundColor Yellow

# Detener contenedores de la app
docker-compose stop api dashboard

Write-Host "  Contenedores detenidos" -ForegroundColor Cyan
Write-Host "  Para reiniciar la aplicacion, ejecuta:" -ForegroundColor Yellow
Write-Host "    docker-compose up -d" -ForegroundColor Cyan
Write-Host "  O para desarrollo:" -ForegroundColor Yellow
Write-Host "    pnpm dev`n" -ForegroundColor Cyan

# ============================================================================
# PASO 12: Verificacion final
# ============================================================================
Write-Host "[PASO 12] Verificacion final..." -ForegroundColor Yellow

$checks = @{
    "Variables de entorno" = (Test-Path "$projectRoot\.env")
    "PostgreSQL corriendo" = ($postgresRunning -like "*postgres*")
    "Schema Prisma" = (Test-Path $schemaPath)
    "Cliente Prisma generado" = (Test-Path $generatedClientPath)
}

Write-Host "`n  RESUMEN DE VERIFICACIONES:" -ForegroundColor Cyan
foreach ($check in $checks.GetEnumerator()) {
    $status = if ($check.Value) { "[OK]" } else { "[FAIL]" }
    $color = if ($check.Value) { "Green" } else { "Red" }
    Write-Host "    $status $($check.Key)" -ForegroundColor $color
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "CORRECCION COMPLETADA EXITOSAMENTE" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "PROXIMOS PASOS:" -ForegroundColor Yellow
Write-Host "1. Reinicia la aplicacion: docker-compose up -d" -ForegroundColor Cyan
Write-Host "2. Verifica logs: docker-compose logs -f api" -ForegroundColor Cyan
Write-Host "3. Verifica endpoint: curl http://localhost:3001/health" -ForegroundColor Cyan
Write-Host "4. Deberias ver 'storage: prisma' en la respuesta`n" -ForegroundColor Cyan
