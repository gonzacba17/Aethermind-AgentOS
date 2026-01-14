# Script mejorado para ejecutar todos los tests de Aethermind AgentOS
# Incluye auto-inicio de servicios y mejor manejo de errores

param(
    [switch]$SkipValidation,
    [switch]$SkipSmoke,
    [switch]$Verbose,
    [switch]$AutoStart
)

$ErrorActionPreference = "Continue"
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logDir = "logs"
$logFile = "$logDir/test-run-$timestamp.log"

# Crear directorio de logs
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

# Funcion para escribir en log y consola
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Add-Content -Path $logFile -Value $logMessage
    
    switch ($Level) {
        "SUCCESS" { Write-Host $logMessage -ForegroundColor Green }
        "ERROR" { Write-Host $logMessage -ForegroundColor Red }
        "WARNING" { Write-Host $logMessage -ForegroundColor Yellow }
        "INFO" { Write-Host $logMessage -ForegroundColor Cyan }
        default { Write-Host $logMessage }
    }
}

# Funcion para ejecutar comando
function Invoke-TestCommand {
    param([string]$Command, [string]$Description, [int]$TimeoutMinutes = 10)
    
    Write-Log "Iniciando: $Description" "INFO"
    Write-Log "Comando: $Command" "INFO"
    
    $startTime = Get-Date
    
    try {
        $output = Invoke-Expression $Command 2>&1
        $exitCode = $LASTEXITCODE
        $duration = (Get-Date) - $startTime
        
        if ($Verbose -or $exitCode -ne 0) {
            $output | ForEach-Object { Add-Content -Path $logFile -Value $_ }
        }
        
        if ($exitCode -eq 0) {
            Write-Log "[OK] $Description completado en $($duration.TotalSeconds.ToString('F2'))s" "SUCCESS"
            return $true
        }
        else {
            Write-Log "[ERROR] $Description fallo (codigo: $exitCode)" "ERROR"
            return $false
        }
    }
    catch {
        Write-Log "[ERROR] $Description fallo: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Funcion para verificar servicio
function Test-Service {
    param([string]$Url, [string]$Name, [int]$MaxRetries = 3)
    
    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Log "[OK] $Name esta disponible" "SUCCESS"
                return $true
            }
        }
        catch {
            if ($i -lt $MaxRetries) {
                Write-Log "[RETRY] Reintento $i/$MaxRetries para $Name..." "WARNING"
                Start-Sleep -Seconds 2
            }
        }
    }
    
    Write-Log "[ERROR] $Name no disponible en $Url" "WARNING"
    return $false
}

# Funcion para iniciar servicios Docker
function Start-DockerServices {
    Write-Log "Iniciando servicios Docker..." "INFO"
    
    try {
        $output = pnpm docker:up 2>&1
        Start-Sleep -Seconds 5
        
        $containers = docker ps --format "{{.Names}}"
        $servicesOk = ($containers -match "postgres") -and ($containers -match "redis")
        
        if ($servicesOk) {
            Write-Log "[OK] Servicios Docker iniciados correctamente" "SUCCESS"
            return $true
        }
        else {
            Write-Log "[ERROR] Error al iniciar algunos servicios Docker" "ERROR"
            return $false
        }
    }
    catch {
        Write-Log "[ERROR] Error iniciando Docker: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Banner
Write-Log "========================================" "INFO"
Write-Log "  AETHERMIND AGENTOS - TEST RUNNER v2" "INFO"
Write-Log "========================================" "INFO"
Write-Log "Log: $logFile" "INFO"
Write-Log "" "INFO"

$totalTests = 0
$passedTests = 0
$failedTests = 0

# 1. VALIDACION DEL SISTEMA
if (-not $SkipValidation) {
    Write-Log "=== FASE 1: VALIDACION DEL SISTEMA ===" "INFO"
    
    Write-Log "Verificando Docker..." "INFO"
    try {
        docker ps | Out-Null
        Write-Log "[OK] Docker corriendo" "SUCCESS"
        
        $containers = docker ps --format "{{.Names}}"
        $postgresRunning = $containers -match "postgres"
        $redisRunning = $containers -match "redis"
        
        if (-not $postgresRunning -or -not $redisRunning) {
            if ($AutoStart) {
                Write-Log "Auto-iniciando servicios faltantes..." "WARNING"
                Start-DockerServices | Out-Null
            }
            else {
                Write-Log "[WARNING] Servicios Docker no corriendo. Usa -AutoStart para iniciarlos" "WARNING"
                Write-Log "O ejecuta manualmente: pnpm docker:up" "INFO"
            }
        }
        else {
            Write-Log "[OK] PostgreSQL corriendo" "SUCCESS"
            Write-Log "[OK] Redis corriendo" "SUCCESS"
        }
    }
    catch {
        Write-Log "[ERROR] Docker no esta corriendo. Inicia Docker Desktop." "ERROR"
        exit 1
    }
    
    Write-Log "" "INFO"
}

# 2. SMOKE TESTS
if (-not $SkipSmoke) {
    Write-Log "=== FASE 2: SMOKE TESTS ===" "INFO"
    $totalTests++
    
    if (Invoke-TestCommand "pnpm test:smoke" "Smoke Tests" 5) {
        $passedTests++
    }
    else {
        $failedTests++
        Write-Log "[WARNING] Verifica que API y Dashboard esten corriendo" "WARNING"
    }
    Write-Log "" "INFO"
}

# 3. TESTS UNITARIOS
Write-Log "=== FASE 3: TESTS UNITARIOS ===" "INFO"
$totalTests++

if (Invoke-TestCommand "pnpm test" "Tests Unitarios" 10) {
    $passedTests++
}
else {
    $failedTests++
}
Write-Log "" "INFO"

# 4. TESTS DE INTEGRACION
Write-Log "=== FASE 4: TESTS DE INTEGRACION ===" "INFO"
$totalTests++

$redisOk = Test-Service "http://localhost:6379" "Redis"

if (Invoke-TestCommand "pnpm test:integration" "Tests de Integracion" 15) {
    $passedTests++
}
else {
    $failedTests++
}
Write-Log "" "INFO"

# 5. TESTS E2E
Write-Log "=== FASE 5: TESTS E2E ===" "INFO"
$totalTests++

$apiOk = Test-Service "http://localhost:3001/health" "API"

if ($apiOk) {
    if (Invoke-TestCommand "pnpm test:e2e" "Tests E2E" 20) {
        $passedTests++
    }
    else {
        $failedTests++
    }
}
else {
    Write-Log "[SKIP] Tests E2E omitidos (API no disponible)" "WARNING"
    Write-Log "Inicia con: cd apps/api; pnpm dev" "INFO"
    $failedTests++
}
Write-Log "" "INFO"

# 6. TESTS DE API
Write-Log "=== FASE 6: TESTS DE API ===" "INFO"
$totalTests++

if ($apiOk) {
    if (Invoke-TestCommand "pnpm test:api" "Tests de API" 15) {
        $passedTests++
    }
    else {
        $failedTests++
    }
}
else {
    Write-Log "[SKIP] Tests de API omitidos" "WARNING"
    $failedTests++
}
Write-Log "" "INFO"

# 7. COBERTURA
Write-Log "=== FASE 7: COBERTURA DE CODIGO ===" "INFO"
$totalTests++

if (Invoke-TestCommand "pnpm test:coverage" "Cobertura" 15) {
    $passedTests++
    Write-Log "Reporte: coverage/index.html" "INFO"
}
else {
    $failedTests++
}
Write-Log "" "INFO"

# RESUMEN
Write-Log "========================================" "INFO"
Write-Log "  RESUMEN DE EJECUCION" "INFO"
Write-Log "========================================" "INFO"
Write-Log "Total: $totalTests | Exitosos: $passedTests | Fallidos: $failedTests" "INFO"

$successRate = if ($totalTests -gt 0) { ($passedTests / $totalTests * 100).ToString("F1") } else { "0.0" }
Write-Log "Tasa de exito: $successRate%" "INFO"
Write-Log "Log completo: $logFile" "INFO"

if ($failedTests -eq 0) {
    Write-Log "[SUCCESS] TODOS LOS TESTS PASARON" "SUCCESS"
    exit 0
}
else {
    Write-Log "[FAILED] ALGUNOS TESTS FALLARON" "ERROR"
    exit 1
}