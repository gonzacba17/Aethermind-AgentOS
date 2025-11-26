# setup-aethermind.ps1 - Script Maestro Todo-en-Uno
# Version: 2.2 - Fixed Encoding Issues
# Descripcion: Setup completo automatizado de Aethermind AgentOS

param(
    [switch]$SkipBuild,
    [switch]$SkipTests,
    [switch]$AutoStart,
    [switch]$Verbose,
    [switch]$QuickMode
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# ============================================
# CONFIGURACION Y LOGGING
# ============================================

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logDir = "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}
$logFile = Join-Path $logDir "setup_master_$timestamp.log"

# Inicializar log
"=" * 80 | Out-File -FilePath $logFile -Encoding UTF8
"AETHERMIND AGENTOS - SETUP MAESTRO v2.2" | Out-File -FilePath $logFile -Append -Encoding UTF8
"Inicio: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File -FilePath $logFile -Append -Encoding UTF8
"Directorio: $PWD" | Out-File -FilePath $logFile -Append -Encoding UTF8
"=" * 80 | Out-File -FilePath $logFile -Append -Encoding UTF8
"" | Out-File -FilePath $logFile -Append -Encoding UTF8

# Colores
$Colors = @{
    Title   = "Cyan"
    Success = "Green"
    Error   = "Red"
    Warning = "Yellow"
    Info    = "White"
    Action  = "Magenta"
    Gray    = "Gray"
}

function Write-Log {
    param(
        [string]$Message,
        [string]$Type = "Info",
        [switch]$NoConsole
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Type] $Message"
    
    try {
        $logMessage | Out-File -FilePath $script:logFile -Append -Encoding UTF8 -ErrorAction SilentlyContinue
    }
    catch {
        # Si falla el log, continuar
    }
    
    if (-not $NoConsole) {
        $color = switch ($Type) {
            "Success" { $Colors.Success }
            "Error" { $Colors.Error }
            "Warning" { $Colors.Warning }
            "Action" { $Colors.Action }
            default { $Colors.Info }
        }
        
        $prefix = switch ($Type) {
            "Success" { "[OK]" }
            "Error" { "[ERROR]" }
            "Warning" { "[WARN]" }
            "Action" { "[->]" }
            "Info" { "[i]" }
            default { "   " }
        }
        
        Write-Host "$prefix $Message" -ForegroundColor $color
    }
}

function Write-Section {
    param([string]$Title)
    $separator = "=" * 70
    
    "" | Out-File -FilePath $script:logFile -Append -Encoding UTF8
    $separator | Out-File -FilePath $script:logFile -Append -Encoding UTF8
    "  $Title" | Out-File -FilePath $script:logFile -Append -Encoding UTF8
    $separator | Out-File -FilePath $script:logFile -Append -Encoding UTF8
    "" | Out-File -FilePath $script:logFile -Append -Encoding UTF8
    
    Write-Host ""
    Write-Host $separator -ForegroundColor $Colors.Title
    Write-Host "  $Title" -ForegroundColor $Colors.Title
    Write-Host $separator -ForegroundColor $Colors.Title
    Write-Host ""
}

function Test-CommandExists {
    param([string]$Command)
    try {
        $null = Get-Command $Command -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

function Get-ExecutionTime {
    param([DateTime]$StartTime)
    $elapsed = (Get-Date) - $StartTime
    return "{0:N2}" -f $elapsed.TotalSeconds
}

# ============================================
# HEADER
# ============================================

Clear-Host
Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "                                                                     " -ForegroundColor Cyan
Write-Host "          AETHERMIND AGENTOS - SETUP MAESTRO v2.2                   " -ForegroundColor Cyan
Write-Host "                Script Todo-en-Uno Automatizado                     " -ForegroundColor Cyan
Write-Host "                                                                     " -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Log: $logFile" -ForegroundColor Gray
Write-Host ""

$globalStartTime = Get-Date
$stepResults = @()

# ============================================
# PASO 1: VERIFICAR PRERREQUISITOS
# ============================================

Write-Section "PASO 1/10: Verificar Prerrequisitos"
$stepStartTime = Get-Date

$prerequisites = @(
    @{Name = "Node.js"; Command = "node"; Required = $true },
    @{Name = "pnpm"; Command = "pnpm"; Required = $true },
    @{Name = "Docker"; Command = "docker"; Required = $true },
    @{Name = "npm"; Command = "npm"; Required = $true },
    @{Name = "Git"; Command = "git"; Required = $false }
)

$allPrereqsMet = $true
foreach ($prereq in $prerequisites) {
    if (Test-CommandExists $prereq.Command) {
        try {
            $version = & $prereq.Command --version 2>&1 | Select-Object -First 1
            Write-Log "$($prereq.Name) [OK] $version" "Success"
        }
        catch {
            Write-Log "$($prereq.Name) [OK] (instalado)" "Success"
        }
    }
    else {
        if ($prereq.Required) {
            Write-Log "$($prereq.Name) NO encontrado (requerido)" "Error"
            $allPrereqsMet = $false
        }
        else {
            Write-Log "$($prereq.Name) no encontrado (opcional)" "Warning"
        }
    }
}

# Verificar package.json
if (Test-Path "package.json") {
    Write-Log "package.json encontrado" "Success"
}
else {
    Write-Log "package.json NO encontrado - Directorio correcto?" "Error"
    $allPrereqsMet = $false
}

$stepTime = Get-ExecutionTime $stepStartTime
$stepResults += @{
    Step    = 1
    Name    = "Prerrequisitos"
    Success = $allPrereqsMet
    Time    = $stepTime
}

if (-not $allPrereqsMet) {
    Write-Log "Faltan prerrequisitos criticos. Abortando." "Error"
    Write-Log "Tiempo total: $(Get-ExecutionTime $globalStartTime)s" "Info"
    exit 1
}

# ============================================
# PASO 2: VERIFICAR/INSTALAR TURBO
# ============================================

Write-Section "PASO 2/10: Verificar e Instalar Turbo"
$stepStartTime = Get-Date
$turboSuccess = $false

if (Test-CommandExists "turbo") {
    try {
        $turboVersion = turbo --version 2>&1
        Write-Log "Turbo ya instalado: $turboVersion" "Success"
        $turboSuccess = $true
    }
    catch {
        Write-Log "Turbo encontrado pero con error al verificar version" "Warning"
    }
}

if (-not $turboSuccess) {
    Write-Log "Instalando Turbo globalmente..." "Action"
    try {
        $installOutput = npm install -g turbo 2>&1
        $installOutput | Out-File -FilePath $logFile -Append -Encoding UTF8
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Turbo instalado exitosamente" "Success"
            $turboSuccess = $true
            
            # Actualizar PATH de forma segura
            $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
            $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
            if ($machinePath -and $userPath) {
                $env:Path = $machinePath + ";" + $userPath
            }
        }
        else {
            Write-Log "Instalacion con advertencias (continuando...)" "Warning"
            $turboSuccess = $true
        }
    }
    catch {
        Write-Log "Error instalando Turbo: $($_.Exception.Message)" "Error"
    }
}

$stepTime = Get-ExecutionTime $stepStartTime
$stepResults += @{
    Step    = 2
    Name    = "Turbo"
    Success = $turboSuccess
    Time    = $stepTime
}

# ============================================
# PASO 3: INSTALAR DEPENDENCIAS
# ============================================

Write-Section "PASO 3/10: Instalar Dependencias"
$stepStartTime = Get-Date
$depsSuccess = $false

Write-Log "Ejecutando: pnpm install" "Action"
Write-Log "Esto puede tomar varios minutos..." "Info"

try {
    $installOutput = pnpm install 2>&1
    $installOutput | Out-File -FilePath $logFile -Append -Encoding UTF8
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Dependencias instaladas exitosamente" "Success"
        $depsSuccess = $true
    }
    else {
        # pnpm a veces retorna codigos no-zero con warnings
        if ($installOutput -match "ERR!") {
            Write-Log "Errores durante instalacion" "Error"
        }
        else {
            Write-Log "Instalacion completada con advertencias" "Warning"
            $depsSuccess = $true
        }
    }
}
catch {
    Write-Log "Error: $($_.Exception.Message)" "Error"
}

$stepTime = Get-ExecutionTime $stepStartTime
$stepResults += @{
    Step    = 3
    Name    = "Dependencias"
    Success = $depsSuccess
    Time    = $stepTime
}

# ============================================
# PASO 4: VERIFICAR DOCKER Y SERVICIOS
# ============================================

Write-Section "PASO 4/10: Verificar Docker y Servicios"
$stepStartTime = Get-Date
$dockerSuccess = $false

try {
    $null = docker ps 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Docker esta corriendo" "Success"
        
        # PostgreSQL
        $pgContainer = docker ps --filter "name=postgres" --format "{{.Names}}" 2>&1
        if ($pgContainer -match "postgres") {
            Write-Log "PostgreSQL container corriendo" "Success"
        }
        else {
            Write-Log "PostgreSQL no esta corriendo. Intentando iniciar..." "Action"
            
            if (Test-Path "docker-compose.yml") {
                Write-Log "Ejecutando: pnpm docker:up" "Action"
                $dockerUpOutput = pnpm docker:up 2>&1
                $dockerUpOutput | Out-File -FilePath $logFile -Append -Encoding UTF8
                Start-Sleep -Seconds 8
                
                $pgContainer = docker ps --filter "name=postgres" --format "{{.Names}}" 2>&1
                if ($pgContainer -match "postgres") {
                    Write-Log "PostgreSQL iniciado exitosamente" "Success"
                }
            }
            else {
                Write-Log "docker-compose.yml no encontrado" "Warning"
            }
        }
        
        # Redis
        $redisContainer = docker ps --filter "name=redis" --format "{{.Names}}" 2>&1
        if ($redisContainer -match "redis") {
            Write-Log "Redis container corriendo" "Success"
        }
        else {
            Write-Log "Redis no esta corriendo (opcional)" "Warning"
        }
        
        $dockerSuccess = $true
    }
    else {
        Write-Log "Docker no esta corriendo. Inicia Docker Desktop" "Error"
        Write-Log "Despues ejecuta: pnpm docker:up" "Info"
    }
}
catch {
    Write-Log "Error verificando Docker: $($_.Exception.Message)" "Error"
}

$stepTime = Get-ExecutionTime $stepStartTime
$stepResults += @{
    Step    = 4
    Name    = "Docker"
    Success = $dockerSuccess
    Time    = $stepTime
}

# ============================================
# PASO 5: CONFIGURAR .ENV
# ============================================

Write-Section "PASO 5/10: Configurar Variables de Entorno"
$stepStartTime = Get-Date
$envSuccess = $false

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Write-Log "Copiando .env.example -> .env" "Action"
        Copy-Item ".env.example" ".env" -Force
        Write-Log ".env creado desde template" "Success"
        Write-Log "RECUERDA: Cambiar contrasenas en produccion" "Warning"
        $envSuccess = $true
    }
    else {
        Write-Log ".env.example no encontrado" "Error"
    }
}
else {
    Write-Log ".env ya existe" "Success"
    
    $envContent = Get-Content ".env" -Raw -ErrorAction SilentlyContinue
    
    # Verificaciones
    if ($envContent -match 'DATABASE_URL.*postgresql') {
        Write-Log "DATABASE_URL configurado" "Success"
        $envSuccess = $true
    }
    else {
        Write-Log "DATABASE_URL no configurado correctamente" "Warning"
        $envSuccess = $true
    }
    
    if ($envContent -match 'POSTGRES_PASSWORD=(change_this|your_password_here)') {
        Write-Log "WARNING: PASSWORD usa valor por defecto" "Warning"
    }
}

$stepTime = Get-ExecutionTime $stepStartTime
$stepResults += @{
    Step    = 5
    Name    = "Variables ENV"
    Success = $envSuccess
    Time    = $stepTime
}

# ============================================
# PASO 6: PRISMA SETUP
# ============================================

Write-Section "PASO 6/10: Configurar Prisma"
$stepStartTime = Get-Date
$prismaSuccess = $false

Write-Log "Generando cliente Prisma..." "Action"
try {
    $prismaGenOutput = pnpm exec prisma generate 2>&1
    $prismaGenOutput | Out-File -FilePath $logFile -Append -Encoding UTF8
    
    if ($LASTEXITCODE -eq 0 -or $prismaGenOutput -match "Generated Prisma Client") {
        Write-Log "Cliente Prisma generado" "Success"
        
        Write-Log "Aplicando migraciones..." "Action"
        $migrationOutput = pnpm exec prisma migrate dev --name "automated_setup" 2>&1
        $migrationOutput | Out-File -FilePath $logFile -Append -Encoding UTF8
        
        if ($LASTEXITCODE -eq 0 -or $migrationOutput -match "migration(s) applied") {
            Write-Log "Migraciones aplicadas" "Success"
            $prismaSuccess = $true
        }
        elseif ($migrationOutput -match "already applied") {
            Write-Log "Migraciones ya estaban aplicadas" "Success"
            $prismaSuccess = $true
        }
        else {
            Write-Log "Advertencia en migraciones" "Warning"
            $prismaSuccess = $true
        }
    }
    else {
        Write-Log "Error generando cliente Prisma" "Error"
    }
}
catch {
    Write-Log "Error en Prisma: $($_.Exception.Message)" "Error"
}

$stepTime = Get-ExecutionTime $stepStartTime
$stepResults += @{
    Step    = 6
    Name    = "Prisma"
    Success = $prismaSuccess
    Time    = $stepTime
}

# ============================================
# PASO 7: AUDIT DE SEGURIDAD
# ============================================

Write-Section "PASO 7/10: Audit de Seguridad"
$stepStartTime = Get-Date

Write-Log "Ejecutando pnpm audit..." "Action"
try {
    $auditOutput = pnpm audit 2>&1
    $auditOutput | Out-File -FilePath $logFile -Append -Encoding UTF8
    
    # Contar vulnerabilidades
    if ($auditOutput -match "(\d+) vulnerabilities") {
        $vulnCount = $matches[1]
        if ($vulnCount -eq "0") {
            Write-Log "No se encontraron vulnerabilidades" "Success"
        }
        else {
            Write-Log "$vulnCount vulnerabilidades encontradas (ver log)" "Warning"
        }
    }
    else {
        Write-Log "Audit completado" "Success"
    }
}
catch {
    Write-Log "Audit completado con advertencias" "Warning"
}

$stepTime = Get-ExecutionTime $stepStartTime
$stepResults += @{
    Step    = 7
    Name    = "Security Audit"
    Success = $true
    Time    = $stepTime
}

# ============================================
# PASO 8: BUILD
# ============================================

if (-not $SkipBuild -and -not $QuickMode) {
    Write-Section "PASO 8/10: Build del Proyecto"
    $stepStartTime = Get-Date
    $buildSuccess = $false
    
    Write-Log "Ejecutando: pnpm run build" "Action"
    Write-Log "Esto puede tomar varios minutos..." "Info"
    
    try {
        $buildOutput = pnpm run build 2>&1
        $buildOutput | Out-File -FilePath $logFile -Append -Encoding UTF8
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Build completado exitosamente" "Success"
            $buildSuccess = $true
        }
        else {
            Write-Log "Build fallo (ver log para detalles)" "Error"
        }
    }
    catch {
        Write-Log "Error durante build: $($_.Exception.Message)" "Error"
    }
    
    $stepTime = Get-ExecutionTime $stepStartTime
    $stepResults += @{
        Step    = 8
        Name    = "Build"
        Success = $buildSuccess
        Time    = $stepTime
    }
}
else {
    $reason = if ($QuickMode) { "QuickMode" } else { "-SkipBuild" }
    Write-Log "Build saltado ($reason)" "Info"
    $stepResults += @{
        Step    = 8
        Name    = "Build (saltado)"
        Success = $true
        Time    = "0.00"
    }
}

# ============================================
# PASO 9: PREPARAR TESTS
# ============================================

Write-Section "PASO 9/10: Preparar Tests"
$stepStartTime = Get-Date

if (-not $SkipTests) {
    Write-Log "Tests configurados para ejecucion manual" "Info"
    Write-Log "Ejecuta: .\scripts\smoke-test.ps1" "Info"
    Write-Log "Ejecuta: .\scripts\validate-mvp.ps1" "Info"
}
else {
    Write-Log "Tests saltados por parametro" "Info"
}

$stepTime = Get-ExecutionTime $stepStartTime
$stepResults += @{
    Step    = 9
    Name    = "Tests"
    Success = $true
    Time    = $stepTime
}

# ============================================
# PASO 10: RESUMEN FINAL
# ============================================

Write-Section "PASO 10/10: Resumen Final"

$totalTime = Get-ExecutionTime $globalStartTime
$successCount = ($stepResults | Where-Object { $_.Success }).Count
$totalCount = $stepResults.Count
$allSuccess = $successCount -eq $totalCount

# Tabla de resultados
Write-Host ""
Write-Host "Resultados por Paso:" -ForegroundColor Cyan
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host ("{0,-6} {1,-30} {2,-12} {3,10}" -f "Paso", "Nombre", "Estado", "Tiempo") -ForegroundColor White
Write-Host ("-" * 70) -ForegroundColor Gray

"Resultados por Paso:" | Out-File -FilePath $logFile -Append -Encoding UTF8
"=" * 70 | Out-File -FilePath $logFile -Append -Encoding UTF8

foreach ($result in $stepResults) {
    $status = if ($result.Success) { "[OK]" } else { "[FAIL]" }
    $color = if ($result.Success) { $Colors.Success } else { $Colors.Error }
    
    $line = "{0,-6} {1,-30} {2,-12} {3,10}s" -f $result.Step, $result.Name, $status, $result.Time
    Write-Host $line -ForegroundColor $(if ($result.Success) { "Green" } else { "Red" })
    $line | Out-File -FilePath $logFile -Append -Encoding UTF8
}

Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host ("Total: {0}s | Exitosos: {1}/{2}" -f $totalTime, $successCount, $totalCount) -ForegroundColor Cyan

"=" * 70 | Out-File -FilePath $logFile -Append -Encoding UTF8
"Total: $($totalTime)s | Exitosos: $successCount/$totalCount" | Out-File -FilePath $logFile -Append -Encoding UTF8

# Estado de servicios
Write-Host ""
Write-Host ""
Write-Host "Estado de Servicios:" -ForegroundColor Cyan
Write-Host ("=" * 70) -ForegroundColor Cyan

"" | Out-File -FilePath $logFile -Append -Encoding UTF8
"Estado de Servicios:" | Out-File -FilePath $logFile -Append -Encoding UTF8
"=" * 70 | Out-File -FilePath $logFile -Append -Encoding UTF8

$services = @(
    @{Name = "Docker"; Check = { try { docker ps 2>&1 | Out-Null; $LASTEXITCODE -eq 0 } catch { $false } } },
    @{Name = "PostgreSQL"; Check = { try { (docker ps --filter "name=postgres" 2>&1) -match "postgres" } catch { $false } } },
    @{Name = "Redis"; Check = { try { (docker ps --filter "name=redis" 2>&1) -match "redis" } catch { $false } } }
)

foreach ($service in $services) {
    $isRunning = & $service.Check
    $statusText = if ($isRunning) { "Corriendo" } else { "Detenido" }
    $color = if ($isRunning) { $Colors.Success } else { $Colors.Error }
    
    $line = "{0,-20} {1}" -f $service.Name, $statusText
    Write-Host $line -ForegroundColor $color
    $line | Out-File -FilePath $logFile -Append -Encoding UTF8
}

# Proximos pasos
Write-Host ""
Write-Host ""
Write-Host "Proximos Pasos:" -ForegroundColor Yellow
Write-Host ("=" * 70) -ForegroundColor Yellow

"" | Out-File -FilePath $logFile -Append -Encoding UTF8
"" | Out-File -FilePath $logFile -Append -Encoding UTF8
"Proximos Pasos:" | Out-File -FilePath $logFile -Append -Encoding UTF8
"=" * 70 | Out-File -FilePath $logFile -Append -Encoding UTF8

if ($allSuccess) {
    Write-Host "1. Iniciar API: pnpm run dev:api" -ForegroundColor Green
    Write-Host "2. Iniciar Dashboard: pnpm run dev:dashboard" -ForegroundColor Green
    Write-Host "3. Ejecutar tests: .\scripts\smoke-test.ps1" -ForegroundColor Green
    
    "" | Out-File -FilePath $logFile -Append -Encoding UTF8
    "1. Iniciar API: pnpm run dev:api" | Out-File -FilePath $logFile -Append -Encoding UTF8
    "2. Iniciar Dashboard: pnpm run dev:dashboard" | Out-File -FilePath $logFile -Append -Encoding UTF8
    "3. Ejecutar tests: .\scripts\smoke-test.ps1" | Out-File -FilePath $logFile -Append -Encoding UTF8
}
else {
    Write-Host "Revisa el log para mas detalles: $logFile" -ForegroundColor Yellow
    
    "" | Out-File -FilePath $logFile -Append -Encoding UTF8
    "[PARTIAL] Algunos pasos fallaron" | Out-File -FilePath $logFile -Append -Encoding UTF8
}

# Footer
Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host "Log completo: $logFile" -ForegroundColor Green
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host ""

# Log final
"" | Out-File -FilePath $logFile -Append -Encoding UTF8
("=" * 70) | Out-File -FilePath $logFile -Append -Encoding UTF8
"Setup finalizado: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File -FilePath $logFile -Append -Encoding UTF8
"Tiempo total: $totalTime segundos" | Out-File -FilePath $logFile -Append -Encoding UTF8
$finalStatus = if ($allSuccess) { "SUCCESS" } else { "PARTIAL" }
"Estado: $finalStatus" | Out-File -FilePath $logFile -Append -Encoding UTF8
("=" * 70) | Out-File -FilePath $logFile -Append -Encoding UTF8

Write-Log "Setup maestro completado en $totalTime segundos" "Info" -NoConsole
Write-Log "Estado final: $finalStatus" "Info" -NoConsole

# Exit code
exit $(if ($allSuccess) { 0 } else { 1 })