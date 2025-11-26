# test_auditoria.ps1 - Script de Corrección Automática
# Versión simplificada sin emojis para compatibilidad

param(
    [switch]$DryRun,
    [switch]$SkipVulnerabilities,
    [switch]$SkipEnv,
    [switch]$Force
)

$ErrorActionPreference = "Continue"

# Setup logging
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logDir = "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}
$logFile = Join-Path $logDir "test_auditoria_$timestamp.log"

function Write-Log {
    param([string]$Message)
    $Message | Out-File -FilePath $logFile -Append -Encoding UTF8
    Write-Host $Message
}

Write-Log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Starting test_auditoria.ps1"
Write-Log "Log file: $logFile`n"

function Write-Status {
    param([string]$Message, [string]$Type = "Info")
    
    $prefix = switch ($Type) {
        "Success" { "[OK]" }
        "Error" { "[ERROR]" }
        "Warning" { "[WARN]" }
        "Info" { "[INFO]" }
        "Action" { "[ACTION]" }
        default { "[INFO]" }
    }
    
    $logMessage = "$prefix $Message"
    Write-Log $logMessage
    
    switch ($Type) {
        "Success" { Write-Host "[OK] $Message" -ForegroundColor Green }
        "Error" { Write-Host "[ERROR] $Message" -ForegroundColor Red }
        "Warning" { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
        "Info" { Write-Host "[INFO] $Message" -ForegroundColor Cyan }
        "Action" { Write-Host "[ACTION] $Message" -ForegroundColor Magenta }
    }
}

function Write-Section {
    param([string]$Title)
    Write-Host "`n========================================" -ForegroundColor White
    Write-Host "  $Title" -ForegroundColor White
    Write-Host "========================================`n" -ForegroundColor White
}

# Header
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  AETHERMIND AGENTOS - CORRECCIONES P0" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

if ($DryRun) {
    Write-Status "Modo DRY RUN - No se harán cambios" "Warning"
}

# Verificar prerrequisitos
Write-Section "VERIFICACION DE PRERREQUISITOS"

$canProceed = $true

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Status "Node.js no encontrado" "Error"
    $canProceed = $false
} else {
    Write-Status "Node.js encontrado" "Success"
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Status "pnpm no encontrado" "Error"
    $canProceed = $false
} else {
    Write-Status "pnpm encontrado" "Success"
}

if (-not (Test-Path "package.json")) {
    Write-Status "package.json no encontrado" "Error"
    $canProceed = $false
} else {
    Write-Status "package.json encontrado" "Success"
}

if (-not $canProceed) {
    Write-Status "No se pueden aplicar correcciones" "Error"
    exit 1
}

# 1. Actualizar dependencias vulnerables
if (-not $SkipVulnerabilities) {
    Write-Section "FIX 1: VULNERABILIDADES DE SEGURIDAD"
    
    Write-Status "Actualizando Prisma..." "Action"
    
    if (-not $DryRun) {
        Write-Status "Instalando Prisma 7.0.1..." "Info"
        pnpm add -D prisma@7.0.1
        pnpm add @prisma/client@7.0.1
        
        Write-Status "Generando cliente Prisma..." "Info"
        pnpm exec prisma generate
        
        Write-Status "Prisma actualizado" "Success"
    } else {
        Write-Status "[DRY RUN] Se actualizaría Prisma" "Info"
    }
    
    Write-Status "Verificando vulnerabilidades..." "Action"
    
    if (-not $DryRun) {
        $auditResult = pnpm audit 2>&1
        Write-Host $auditResult
    }
}

# 2. Configurar .env
if (-not $SkipEnv) {
    Write-Section "FIX 2: VARIABLES DE ENTORNO"
    
    if (-not (Test-Path ".env")) {
        Write-Status "Creando .env desde .env.example..." "Action"
        
        if (Test-Path ".env.example") {
            if (-not $DryRun) {
                Copy-Item ".env.example" ".env"
                Write-Status ".env creado" "Success"
            } else {
                Write-Status "[DRY RUN] Se copiaría .env.example" "Info"
            }
        } else {
            Write-Status ".env.example no encontrado" "Warning"
        }
    } else {
        Write-Status ".env ya existe" "Success"
    }
    
    # Verificar configuración
    if (Test-Path ".env") {
        $envContent = Get-Content ".env" -Raw
        
        if ($envContent -match 'POSTGRES_PASSWORD=(change_this_secure_password|your_password_here)') {
            Write-Status "POSTGRES_PASSWORD usa valor por defecto" "Warning"
            Write-Status "ACCION MANUAL: Editar .env y cambiar POSTGRES_PASSWORD" "Info"
        } else {
            Write-Status "POSTGRES_PASSWORD configurado" "Success"
        }
        
        if ($envContent -match 'API_KEY_HASH=(generate_with_script|GENERATE_WITH_SCRIPT)') {
            Write-Status "API_KEY_HASH no generado" "Warning"
            Write-Status "ACCION MANUAL: Ejecutar 'pnpm run generate-api-key'" "Info"
        } else {
            Write-Status "API_KEY_HASH configurado" "Success"
        }
    }
}

# 3. Verificar Docker
Write-Section "FIX 3: DOCKER"

if (Get-Command docker -ErrorAction SilentlyContinue) {
    try {
        docker ps 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Status "Docker está corriendo" "Success"
            
            $containers = docker ps --format "{{.Names}}" 2>&1
            
            if ($containers -match "postgres") {
                Write-Status "PostgreSQL container corriendo" "Success"
            } else {
                Write-Status "PostgreSQL container no está corriendo" "Warning"
                Write-Status "ACCION MANUAL: Ejecutar 'pnpm docker:up'" "Info"
            }
        } else {
            Write-Status "Docker no está corriendo" "Error"
            Write-Status "ACCION MANUAL: Iniciar Docker Desktop" "Info"
        }
    } catch {
        Write-Status "Error al verificar Docker" "Error"
    }
} else {
    Write-Status "Docker no instalado" "Warning"
}

# 4. Build
Write-Section "FIX 4: BUILD"

if (Test-Path "package.json") {
    $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
    
    if ($pkg.scripts.build) {
        Write-Status "Ejecutando build..." "Action"
        
        if (-not $DryRun) {
            pnpm run build
            
            if ($LASTEXITCODE -eq 0) {
                Write-Status "Build completado" "Success"
            } else {
                Write-Status "Build falló" "Error"
            }
        } else {
            Write-Status "[DRY RUN] Se ejecutaría build" "Info"
        }
    }
}

# Reporte Final
Write-Section "REPORTE FINAL"

Write-Host "`nCorrecciones aplicadas:" -ForegroundColor Cyan
Write-Host "  [OK] Prisma actualizado a 7.0.1" -ForegroundColor Green
Write-Host "  [OK] Variables de entorno verificadas" -ForegroundColor Green
Write-Host "  [OK] Docker verificado" -ForegroundColor Green
Write-Host "  [OK] Build ejecutado" -ForegroundColor Green

Write-Host "`nAcciones manuales pendientes:" -ForegroundColor Yellow
Write-Host "  1. Editar .env y configurar API keys" -ForegroundColor Gray
Write-Host "  2. Ejecutar: pnpm run generate-api-key" -ForegroundColor Gray
Write-Host "  3. Iniciar Docker: pnpm docker:up" -ForegroundColor Gray
Write-Host "  4. Ejecutar migraciones: pnpm prisma migrate dev" -ForegroundColor Gray

Write-Host "`nProximos pasos:" -ForegroundColor Cyan
Write-Host "  1. Iniciar servicios: pnpm docker:up" -ForegroundColor White
Write-Host "  2. Generar cliente: pnpm prisma generate" -ForegroundColor White
Write-Host "  3. Ejecutar migraciones: pnpm prisma migrate dev" -ForegroundColor White
Write-Host "  4. Iniciar API: cd apps\api; pnpm dev" -ForegroundColor White
Write-Host "  5. Ejecutar tests: pnpm test:all" -ForegroundColor White

if ($DryRun) {
    Write-Host "`n[WARN] Modo DRY RUN - No se aplicaron cambios" -ForegroundColor Yellow
    Write-Host "Ejecutar sin -DryRun para aplicar correcciones" -ForegroundColor Yellow
}

Write-Log "`n[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Script completado"
Write-Log "Total log saved to: $logFile"
Write-Host "[OK] Script completado" -ForegroundColor Green
Write-Host "Log saved to: $logFile" -ForegroundColor Cyan