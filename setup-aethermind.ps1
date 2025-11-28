#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Script de Setup Automatizado para Aethermind AgentOS v0.1.0
.DESCRIPTION
    Este script realiza la instalación completa, configuración y validación
    del sistema Aethermind AgentOS, incluyendo tests exhaustivos y logging.
#>

param(
    [switch]$SkipDocker,
    [switch]$SkipValidation,
    [switch]$SkipDemo,
    [switch]$Production,
    [string]$EnvFile = ".env"
)

# ============================================================================
# CONFIGURACIÓN Y CONSTANTES
# ============================================================================

$ErrorActionPreference = "Continue"
$SCRIPT_VERSION = "2.0.0"
$PROJECT_NAME = "Aethermind AgentOS"
$MIN_NODE_VERSION = "18.0.0"
$MIN_PNPM_VERSION = "8.0.0"
$LOG_DIR = "logs"
$LOG_FILE = "$LOG_DIR/setup-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$ERROR_LOG = "$LOG_DIR/errors.log"

# Crear directorio de logs
if (-not (Test-Path $LOG_DIR)) {
    New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null
}

# Array para trackear errores
$script:errors = @()
$script:warnings = @()
$script:testResults = @{
    passed = @()
    failed = @()
}

# ============================================================================
# FUNCIONES DE LOGGING
# ============================================================================

function Write-Log {
    param($Message, $Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Add-Content -Path $LOG_FILE -Value $logMessage
    
    if ($Level -eq "ERROR") {
        Add-Content -Path $ERROR_LOG -Value $logMessage
    }
}

function Write-Success { 
    param($Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
    Write-Log $Message "SUCCESS"
}

function Write-Info { 
    param($Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
    Write-Log $Message "INFO"
}

function Write-Warning { 
    param($Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
    Write-Log $Message "WARNING"
    $script:warnings += $Message
}

function Write-Error { 
    param($Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    Write-Log $Message "ERROR"
    $script:errors += $Message
}

function Write-Step { 
    param($Message)
    Write-Host "`n==> $Message" -ForegroundColor Magenta
    Write-Log $Message "STEP"
}

# ============================================================================
# FUNCIONES DE TESTING
# ============================================================================

function Test-Component {
    param(
        [string]$Name,
        [scriptblock]$TestScript
    )
    
    Write-Info "Testing: $Name"
    try {
        $result = & $TestScript
        if ($result) {
            Write-Success "${Name}: PASSED"
            $script:testResults.passed += $Name
            return $true
        } else {
            Write-Error "${Name}: FAILED"
            $script:testResults.failed += $Name
            return $false
        }
    } catch {
        Write-Error "${Name}: FAILED - $_"
        $script:testResults.failed += "$Name ($_)"
        return $false
    }
}

# ============================================================================
# TESTS DE PRERREQUISITOS
# ============================================================================

function Test-Prerequisites {
    Write-Step "Verificando prerrequisitos del sistema"
    
    # Test Node.js
    Test-Component "Node.js Installation" {
        if (Get-Command node -ErrorAction SilentlyContinue) {
            $version = node --version
            Write-Log "Node.js version: $version"
            return $true
        }
        return $false
    }
    
    # Test pnpm
    Test-Component "pnpm Installation" {
        if (Get-Command pnpm -ErrorAction SilentlyContinue) {
            $version = pnpm --version
            Write-Log "pnpm version: $version"
            return $true
        } else {
            Write-Info "Installing pnpm..."
            npm install -g pnpm 2>&1 | Out-Null
            return (Get-Command pnpm -ErrorAction SilentlyContinue) -ne $null
        }
    }
    
    # Test Docker
    if (-not $SkipDocker) {
        Test-Component "Docker Installation" {
            if (Get-Command docker -ErrorAction SilentlyContinue) {
                $result = docker info 2>&1
                return $LASTEXITCODE -eq 0
            }
            return $false
        }
    }
    
    # Test Git
    Test-Component "Git Installation" {
        return (Get-Command git -ErrorAction SilentlyContinue) -ne $null
    }
}

# ============================================================================
# INSTALACIÓN DE DEPENDENCIAS
# ============================================================================

function Install-Dependencies {
    Write-Step "Instalando dependencias del proyecto"
    
    Test-Component "pnpm install" {
        Write-Info "Running pnpm install..."
        $output = pnpm install 2>&1
        Write-Log "pnpm install output: $output"
        return $LASTEXITCODE -eq 0
    }
}

# ============================================================================
# CONFIGURACIÓN DE ENTORNO
# ============================================================================

function Initialize-Environment {
    Write-Step "Configurando variables de entorno"
    
    Test-Component "Environment File Exists" {
        if (Test-Path $EnvFile) {
            Write-Info "Using existing $EnvFile"
            return $true
        } elseif (Test-Path ".env.example") {
            Copy-Item ".env.example" $EnvFile
            Write-Success "Created $EnvFile from .env.example"
            return $true
        } else {
            Write-Warning "No .env.example found"
            return $false
        }
    }
}

# ============================================================================
# DOCKER SERVICES
# ============================================================================

function Start-DockerServices {
    if ($SkipDocker) {
        Write-Info "Skipping Docker services"
        return
    }
    
    Write-Step "Iniciando servicios Docker (PostgreSQL, Redis)"
    
    # Detener servicios existentes
    Test-Component "Stop existing Docker services" {
        docker-compose down 2>&1 | Out-Null
        return $true
    }
    
    # Iniciar PostgreSQL y Redis
    Test-Component "Start PostgreSQL" {
        docker-compose up -d postgres 2>&1 | Out-Null
        Start-Sleep -Seconds 5
        $container = docker ps --filter "name=postgres" --format "{{.Names}}" | Select-Object -First 1
        return $container -ne $null
    }
    
    Test-Component "Start Redis" {
        docker-compose up -d redis 2>&1 | Out-Null
        Start-Sleep -Seconds 3
        $container = docker ps --filter "name=redis" --format "{{.Names}}" | Select-Object -First 1
        return $container -ne $null
    }
    
    # Esperar a que PostgreSQL esté listo
    Write-Info "Waiting for PostgreSQL to be ready..."
    $maxAttempts = 15
    $attempt = 0
    $ready = $false
    
    while ($attempt -lt $maxAttempts -and -not $ready) {
        $attempt++
        $container = docker ps --filter "name=postgres" --format "{{.Names}}" | Select-Object -First 1
        if ($container) {
            $result = docker exec $container pg_isready -U aethermind 2>&1
            if ($LASTEXITCODE -eq 0) {
                $ready = $true
            }
        }
        if (-not $ready) {
            Start-Sleep -Seconds 2
        }
    }
    
    if ($ready) {
        Write-Success "PostgreSQL is ready"
    } else {
        Write-Error "PostgreSQL failed to become ready"
    }
}

# ============================================================================
# CONFIGURACIÓN DE BASE DE DATOS
# ============================================================================

function Initialize-Database {
    Write-Step "Configurando PostgreSQL y Prisma"
    
    # Obtener contenedor de PostgreSQL
    $container = docker ps --filter "name=postgres" --format "{{.Names}}" | Select-Object -First 1
    
    if (-not $container) {
        Write-Error "PostgreSQL container not found"
        return
    }
    
    # Leer contraseña del .env
    $password = "testpass123"  # Default
    if (Test-Path $EnvFile) {
        $envContent = Get-Content $EnvFile -Raw
        if ($envContent -match 'POSTGRES_PASSWORD=(.+)') {
            $password = $matches[1].Trim()
        }
    }
    
    # Resetear contraseña de PostgreSQL
    Test-Component "Reset PostgreSQL Password" {
        docker exec $container psql -U aethermind -d aethermind -c "ALTER USER aethermind WITH PASSWORD '$password';" 2>&1 | Out-Null
        return $LASTEXITCODE -eq 0
    }
    
    # Modificar pg_hba.conf para usar md5
    Test-Component "Configure PostgreSQL Authentication" {
        $hbaConfig = @"
local   all             all                                     trust
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
host    all             all             0.0.0.0/0               md5
local   replication     all                                     trust
host    replication     all             127.0.0.1/32            trust
host    replication     all             ::1/128                 trust
"@
        $hbaConfig | docker exec -i $container sh -c "cat > /var/lib/postgresql/data/pg_hba.conf"
        docker exec $container psql -U aethermind -d postgres -c "SELECT pg_reload_conf();" 2>&1 | Out-Null
        return $LASTEXITCODE -eq 0
    }
    
    # Generar Prisma Client
    Test-Component "Generate Prisma Client" {
        Write-Info "Running pnpm prisma generate..."
        pnpm prisma generate 2>&1 | Out-Null
        return $LASTEXITCODE -eq 0
    }
    
    # Aplicar migraciones
    Test-Component "Apply Prisma Migrations" {
        Write-Info "Running prisma db push..."
        pnpm prisma db push --skip-generate 2>&1 | Out-Null
        return $LASTEXITCODE -eq 0
    }
}

# ============================================================================
# TESTS DE CONEXIÓN
# ============================================================================

function Test-DatabaseConnection {
    Write-Step "Testing Database Connection"
    
    Test-Component "Prisma Connection Test" {
        $testScript = @'
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
try {
  await prisma.$connect();
  const result = await prisma.$queryRaw`SELECT current_user, current_database()`;
  console.log('Connected:', result[0]);
  await prisma.$disconnect();
  process.exit(0);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
'@
        Set-Content -Path "test-db-conn.mjs" -Value $testScript
        node test-db-conn.mjs 2>&1 | Out-Null
        $result = $LASTEXITCODE -eq 0
        Remove-Item "test-db-conn.mjs" -Force -ErrorAction SilentlyContinue
        return $result
    }
    
    Test-Component "Redis Connection Test" {
        docker exec (docker ps --filter "name=redis" --format "{{.Names}}" | Select-Object -First 1) redis-cli ping 2>&1 | Out-Null
        return $LASTEXITCODE -eq 0
    }
}

# ============================================================================
# BUILD Y VALIDACIÓN
# ============================================================================

function Build-Project {
    Write-Step "Building Project"
    
    if ($Production) {
        Test-Component "Production Build" {
            pnpm build 2>&1 | Out-Null
            return $LASTEXITCODE -eq 0
        }
    } else {
        Write-Info "Skipping build in development mode"
    }
}

function Test-SystemValidation {
    if ($SkipValidation) {
        return
    }
    
    Write-Step "Running System Validation"
    
    Test-Component "Validate MVP Configuration" {
        if (Test-Path "scripts/validate-mvp.ps1") {
            & "./scripts/validate-mvp.ps1" 2>&1 | Out-Null
            return $LASTEXITCODE -eq 0
        }
        return $false
    }
}

# ============================================================================
# GENERAR REPORTE
# ============================================================================

function Write-TestReport {
    Write-Step "Generando Reporte de Tests"
    
    $reportFile = "$LOG_DIR/test-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').md"
    
    $report = @"
# Aethermind AgentOS - Setup Test Report
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

## Summary
- **Passed Tests**: $($script:testResults.passed.Count)
- **Failed Tests**: $($script:testResults.failed.Count)
- **Warnings**: $($script:warnings.Count)
- **Errors**: $($script:errors.Count)

## Passed Tests
$($script:testResults.passed | ForEach-Object { "- [PASS] $_" } | Out-String)

## Failed Tests
$($script:testResults.failed | ForEach-Object { "- [FAIL] $_" } | Out-String)

## Warnings
$($script:warnings | ForEach-Object { "- [WARN] $_" } | Out-String)

## Errors
$($script:errors | ForEach-Object { "- [ERROR] $_" } | Out-String)

## Log Files
- Main Log: $LOG_FILE
- Error Log: $ERROR_LOG
- Test Report: $reportFile

"@
    
    Set-Content -Path $reportFile -Value $report
    Write-Success "Test report saved to: $reportFile"
    
    # Mostrar resumen en consola
    Write-Host "`n" -NoNewline
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "          TEST SUMMARY                          " -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    
    $passedCount = $script:testResults.passed.Count
    $failedCount = $script:testResults.failed.Count
    $warningCount = $script:warnings.Count
    
    Write-Host "Passed:   $passedCount tests" -ForegroundColor Green
    
    $failColor = if ($failedCount -gt 0) { "Red" } else { "Green" }
    Write-Host "Failed:   $failedCount tests" -ForegroundColor $failColor
    
    Write-Host "Warnings: $warningCount" -ForegroundColor Yellow
    Write-Host "================================================" -ForegroundColor Cyan
    
    if ($failedCount -gt 0) {
        Write-Host "`nFailed tests logged to: $ERROR_LOG" -ForegroundColor Red
    }
}

# ============================================================================
# FUNCIÓN PRINCIPAL
# ============================================================================

function Main {
    Clear-Host
    
    Write-Host @"
    
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║          🤖 AETHERMIND AGENTOS - SETUP WIZARD 🤖             ║
║                                                               ║
║                   Version: $SCRIPT_VERSION                          ║
║                   Full Setup & Test Suite                     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Magenta
    
    Write-Log "Setup started" "INFO"
    Write-Info "Log file: $LOG_FILE`n"
    
    try {
        # 1. Prerrequisitos
        Test-Prerequisites
        
        # 2. Dependencias
        Install-Dependencies
        
        # 3. Entorno
        Initialize-Environment
        
        # 4. Docker Services
        Start-DockerServices
        
        # 5. Base de Datos
        Initialize-Database
        
        # 6. Test Conexiones
        Test-DatabaseConnection
        
        # 7. Build
        Build-Project
        
        # 8. Validación
        Test-SystemValidation
        
        # 9. Reporte
        Write-TestReport
        
        # 10. Próximos pasos
        if ($script:testResults.failed.Count -eq 0) {
            Write-Host "`n✨ Setup completed successfully!" -ForegroundColor Green
            Write-Host "`nNext steps:" -ForegroundColor Cyan
            Write-Host "  1. pnpm dev          # Start development servers" -ForegroundColor White
            Write-Host "  2. Open http://localhost:3000  # Dashboard" -ForegroundColor White
            Write-Host "  3. Open http://localhost:3001/health  # API Health" -ForegroundColor White
        } else {
            Write-Host "`n⚠️ Setup completed with errors" -ForegroundColor Yellow
            Write-Host "Check error log: $ERROR_LOG" -ForegroundColor Red
        }
        
    } catch {
        Write-Error "Fatal error during setup: $_"
        Write-Log "Fatal error: $_" "ERROR"
        Write-TestReport
        exit 1
    }
}

# ============================================================================
# PUNTO DE ENTRADA
# ============================================================================

Main
