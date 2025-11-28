# MVP Validation Script v2.0 - Enhanced Security & Robustness
# Run: .\scripts\validate-mvp.ps1 [-Verbose] [-SkipAPI] [-SkipDashboard]

param(
    [switch]$Verbose,
    [switch]$SkipAPI,
    [switch]$SkipDashboard,
    [string]$ApiKey = $env:API_KEY
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# ============================================
# CONFIGURATION
# ============================================

$Config = @{
    API_URL       = if ($env:API_URL) { $env:API_URL } else { "http://localhost:3001" }
    DASHBOARD_URL = if ($env:DASHBOARD_URL) { $env:DASHBOARD_URL } else { "http://localhost:3000" }
    TIMEOUT       = 5
    RETRY_COUNT   = 3
    RETRY_DELAY   = 2
}

# Container names (support multiple patterns)
$ContainerPatterns = @{
    Postgres = @("aethermind-postgres", "postgres", "*postgres*")
    Redis    = @("aethermind-redis", "redis", "*redis*")
    API      = @("aethermind-api", "api", "*api*")
}

# ============================================
# LOGGING SETUP
# ============================================

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logDir = "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}
$logFile = Join-Path $logDir "validate_mvp_$timestamp.log"

function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    
    $logEntry | Out-File -FilePath $script:logFile -Append -Encoding UTF8 -ErrorAction SilentlyContinue
    
    $color = switch ($Level) {
        "SUCCESS" { "Green" }
        "ERROR" { "Red" }
        "WARN" { "Yellow" }
        "DEBUG" { "Gray" }
        default { "White" }
    }
    
    $prefix = switch ($Level) {
        "SUCCESS" { "[OK]" }
        "ERROR" { "[X]" }
        "WARN" { "[!]" }
        "DEBUG" { "[*]" }
        default { "[i]" }
    }
    
    if ($Level -eq "DEBUG" -and -not $Verbose) {
        return
    }
    
    Write-Host "$prefix $Message" -ForegroundColor $color
}

function Test-HttpEndpoint {
    param(
        [string]$Url,
        [int]$ExpectedStatus = 200,
        [hashtable]$Headers = @{},
        [int]$Timeout = 5,
        [switch]$ValidateJson
    )
    
    try {
        $response = Invoke-WebRequest -Uri $Url `
            -TimeoutSec $Timeout `
            -Headers $Headers `
            -UseBasicParsing `
            -ErrorAction Stop
        
        if ($response.StatusCode -ne $ExpectedStatus) {
            throw "Expected status $ExpectedStatus but got $($response.StatusCode)"
        }
        
        if ($ValidateJson) {
            try {
                $json = $response.Content | ConvertFrom-Json
                return @{ Success = $true; Data = $json; Response = $response }
            }
            catch {
                throw "Invalid JSON response: $($_.Exception.Message)"
            }
        }
        
        return @{ Success = $true; Response = $response }
    }
    catch {
        return @{ Success = $false; Error = $_.Exception.Message }
    }
}

function Find-Container {
    param([string[]]$Patterns)
    
    foreach ($pattern in $Patterns) {
        $containers = docker ps --filter "name=$pattern" --format "{{.Names}}" 2>$null
        if ($containers) {
            return $containers | Select-Object -First 1
        }
    }
    return $null
}

function Test-ContainerHealth {
    param(
        [string]$ContainerName,
        [string[]]$HealthCommand
    )
    
    try {
        $args = @("exec", $ContainerName) + $HealthCommand
        $result = & docker $args 2>&1
        return @{ Success = ($LASTEXITCODE -eq 0); Output = $result }
    }
    catch {
        return @{ Success = $false; Error = $_.Exception.Message }
    }
}

# ============================================
# HEADER
# ============================================

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "          AETHERMIND MVP VALIDATION v2.0" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "Log: $logFile" -ForegroundColor Gray
Write-Host ""

$testResults = @()
$criticalFailed = $false

# ============================================
# CHECK 1: Docker Daemon
# ============================================

Write-Log "Checking Docker daemon..." "INFO"
try {
    $null = docker version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Docker daemon is running" "SUCCESS"
        $testResults += @{ Test = "Docker Daemon"; Status = "PASS" }
    }
    else {
        Write-Log "Docker daemon is not responding" "ERROR"
        Write-Log "Start Docker Desktop and retry" "WARN"
        $testResults += @{ Test = "Docker Daemon"; Status = "FAIL" }
        $criticalFailed = $true
    }
}
catch {
    Write-Log "Docker not installed or not in PATH" "ERROR"
    $testResults += @{ Test = "Docker Daemon"; Status = "FAIL" }
    $criticalFailed = $true
}

# ============================================
# CHECK 2: PostgreSQL Container
# ============================================

Write-Log "`nChecking PostgreSQL container..." "INFO"
$pgContainer = Find-Container -Patterns $ContainerPatterns.Postgres

if ($pgContainer) {
    Write-Log "PostgreSQL container found: $pgContainer" "SUCCESS"
    
    # Test connection
    $pgTest = Test-ContainerHealth -ContainerName $pgContainer -HealthCommand @("pg_isready", "-U", "postgres")
    
    if ($pgTest.Success -and $pgTest.Output -match "accepting connections") {
        Write-Log "PostgreSQL is accepting connections" "SUCCESS"
        $testResults += @{ Test = "PostgreSQL"; Status = "PASS" }
    }
    else {
        Write-Log "PostgreSQL is not ready" "WARN"
        Write-Log "Output: $($pgTest.Output)" "DEBUG"
        $testResults += @{ Test = "PostgreSQL"; Status = "DEGRADED" }
    }
}
else {
    Write-Log "PostgreSQL container not found" "ERROR"
    Write-Log "Run: docker-compose up postgres -d" "WARN"
    $testResults += @{ Test = "PostgreSQL"; Status = "FAIL" }
    $criticalFailed = $true
}

# ============================================
# CHECK 3: Redis Container
# ============================================

Write-Log "`nChecking Redis container..." "INFO"
$redisContainer = Find-Container -Patterns $ContainerPatterns.Redis

if ($redisContainer) {
    Write-Log "Redis container found: $redisContainer" "SUCCESS"
    
    # Test connection
    $redisTest = Test-ContainerHealth -ContainerName $redisContainer -HealthCommand @("redis-cli", "ping")
    
    if ($redisTest.Success -and $redisTest.Output -match "PONG") {
        Write-Log "Redis is responding to PING" "SUCCESS"
        $testResults += @{ Test = "Redis"; Status = "PASS" }
    }
    else {
        Write-Log "Redis is not responding" "WARN"
        Write-Log "Output: $($redisTest.Output)" "DEBUG"
        $testResults += @{ Test = "Redis"; Status = "DEGRADED" }
    }
}
else {
    Write-Log "Redis container not found" "ERROR"
    Write-Log "Run: docker-compose up redis -d" "WARN"
    $testResults += @{ Test = "Redis"; Status = "FAIL" }
    $criticalFailed = $true
}

# ============================================
# CHECK 4: Database Schema
# ============================================

Write-Log "`nChecking database schema..." "INFO"
if ($pgContainer) {
    $schemaTest = docker exec $pgContainer psql -U postgres -d aethermind -c "\dt" 2>&1
    
    if ($schemaTest -match "agents|workflows|executions") {
        Write-Log "Database schema initialized" "SUCCESS"
        $testResults += @{ Test = "DB Schema"; Status = "PASS" }
    }
    else {
        Write-Log "Database schema not initialized" "WARN"
        Write-Log "Run: pnpm prisma:migrate" "WARN"
        $testResults += @{ Test = "DB Schema"; Status = "FAIL" }
    }
}
else {
    Write-Log "Skipping schema check (no PostgreSQL)" "WARN"
    $testResults += @{ Test = "DB Schema"; Status = "SKIP" }
}

# ============================================
# CHECK 5: API Health (with retry)
# ============================================

if (-not $SkipAPI) {
    Write-Log "`nChecking API health..." "INFO"
    
    $apiHealthy = $false
    for ($i = 1; $i -le $Config.RETRY_COUNT; $i++) {
        Write-Log "Attempt $i/$($Config.RETRY_COUNT)..." "DEBUG"
        
        $result = Test-HttpEndpoint -Url "$($Config.API_URL)/health" `
            -Timeout $Config.TIMEOUT `
            -ValidateJson
        
        if ($result.Success) {
            $health = $result.Data
            Write-Log "API is responding" "SUCCESS"
            Write-Log "Status: $($health.status)" "DEBUG"
            Write-Log "Uptime: $($health.uptime)s" "DEBUG"
            
            # Validate health response structure
            if ($health.status -eq "ok") {
                Write-Log "API health check passed" "SUCCESS"
                $apiHealthy = $true
                $testResults += @{ Test = "API Health"; Status = "PASS" }
                break
            }
            else {
                Write-Log "API status is not OK: $($health.status)" "WARN"
            }
        }
        else {
            Write-Log "API not responding: $($result.Error)" "DEBUG"
            
            if ($i -lt $Config.RETRY_COUNT) {
                Write-Log "Retrying in $($Config.RETRY_DELAY)s..." "DEBUG"
                Start-Sleep -Seconds $Config.RETRY_DELAY
            }
        }
    }
    
    if (-not $apiHealthy) {
        Write-Log "API health check failed after $($Config.RETRY_COUNT) attempts" "ERROR"
        Write-Log "Start API with: cd apps/api; pnpm dev" "WARN"
        $testResults += @{ Test = "API Health"; Status = "FAIL" }
    }
}
else {
    Write-Log "Skipping API check (SkipAPI parameter)" "WARN"
    $testResults += @{ Test = "API Health"; Status = "SKIP" }
}

# ============================================
# CHECK 6: API Authentication
# ============================================

if (-not $SkipAPI -and $ApiKey) {
    Write-Log "`nChecking API authentication..." "INFO"
    
    $headers = @{ "Authorization" = "Bearer $ApiKey" }
    $result = Test-HttpEndpoint -Url "$($Config.API_URL)/api/agents" `
        -Headers $headers `
        -Timeout $Config.TIMEOUT `
        -ValidateJson
    
    if ($result.Success) {
        Write-Log "API authentication successful" "SUCCESS"
        $testResults += @{ Test = "API Auth"; Status = "PASS" }
    }
    else {
        Write-Log "API authentication failed: $($result.Error)" "WARN"
        Write-Log "Set environment variable: `$env:API_KEY='your-key'" "WARN"
        $testResults += @{ Test = "API Auth"; Status = "FAIL" }
    }
}
elseif (-not $SkipAPI) {
    Write-Log "`nSkipping API auth check (no API_KEY provided)" "WARN"
    $testResults += @{ Test = "API Auth"; Status = "SKIP" }
}

# ============================================
# CHECK 7: Dashboard
# ============================================

if (-not $SkipDashboard) {
    Write-Log "`nChecking Dashboard..." "INFO"
    
    $result = Test-HttpEndpoint -Url $Config.DASHBOARD_URL `
        -Timeout $Config.TIMEOUT
    
    if ($result.Success) {
        Write-Log "Dashboard is accessible" "SUCCESS"
        $testResults += @{ Test = "Dashboard"; Status = "PASS" }
    }
    else {
        Write-Log "Dashboard not accessible: $($result.Error)" "WARN"
        Write-Log "Start Dashboard with: cd packages/dashboard; pnpm dev" "WARN"
        $testResults += @{ Test = "Dashboard"; Status = "FAIL" }
    }
}
else {
    Write-Log "Skipping Dashboard check (SkipDashboard parameter)" "WARN"
    $testResults += @{ Test = "Dashboard"; Status = "SKIP" }
}

# ============================================
# CHECK 8: Environment Variables
# ============================================

Write-Log "`nChecking environment configuration..." "INFO"

if (Test-Path ".env") {
    Write-Log ".env file found" "SUCCESS"
    
    $envContent = Get-Content ".env" -Raw
    $requiredVars = @("DATABASE_URL", "REDIS_URL", "API_KEY_HASH")
    $missingVars = @()
    
    foreach ($var in $requiredVars) {
        if ($envContent -notmatch "$var\s*=\s*.+") {
            $missingVars += $var
        }
    }
    
    if ($missingVars.Count -eq 0) {
        Write-Log "All required environment variables configured" "SUCCESS"
        $testResults += @{ Test = "Environment"; Status = "PASS" }
    }
    else {
        Write-Log "Missing environment variables: $($missingVars -join ', ')" "WARN"
        $testResults += @{ Test = "Environment"; Status = "DEGRADED" }
    }
    
    # Check for default passwords
    if ($envContent -match "POSTGRES_PASSWORD=(password|change_this|your_password_here)") {
        Write-Log "WARNING: Using default PostgreSQL password (INSECURE)" "WARN"
    }
}
else {
    Write-Log ".env file not found" "ERROR"
    Write-Log "Copy .env.example to .env and configure" "WARN"
    $testResults += @{ Test = "Environment"; Status = "FAIL" }
    $criticalFailed = $true
}

# ============================================
# CHECK 9: Network Connectivity
# ============================================

Write-Log "`nChecking Docker network..." "INFO"

$networks = docker network ls --format "{{.Name}}" 2>$null
if ($networks -match "aethermind") {
    Write-Log "Docker network 'aethermind' exists" "SUCCESS"
    $testResults += @{ Test = "Docker Network"; Status = "PASS" }
}
else {
    Write-Log "Docker network 'aethermind' not found" "WARN"
    Write-Log "Network will be created on docker-compose up" "DEBUG"
    $testResults += @{ Test = "Docker Network"; Status = "DEGRADED" }
}

# ============================================
# SUMMARY
# ============================================

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "                    VALIDATION SUMMARY" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$passed = ($testResults | Where-Object { $_.Status -eq "PASS" }).Count
$failed = ($testResults | Where-Object { $_.Status -eq "FAIL" }).Count
$degraded = ($testResults | Where-Object { $_.Status -eq "DEGRADED" }).Count
$skipped = ($testResults | Where-Object { $_.Status -eq "SKIP" }).Count
$total = $testResults.Count

foreach ($result in $testResults) {
    $icon = switch ($result.Status) {
        "PASS" { "[OK]" }
        "FAIL" { "[X]" }
        "DEGRADED" { "[!]" }
        "SKIP" { "[-]" }
    }
    
    $color = switch ($result.Status) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "DEGRADED" { "Yellow" }
        "SKIP" { "Gray" }
    }
    
    Write-Host "  $icon $($result.Test.PadRight(25)) " -ForegroundColor $color -NoNewline
    Write-Host $result.Status -ForegroundColor $color
}

Write-Host ""
Write-Host "Total: $total tests | Passed: $passed | Failed: $failed | Degraded: $degraded | Skipped: $skipped" -ForegroundColor Cyan
Write-Host ""

if ($criticalFailed) {
    Write-Log "CRITICAL: Some essential services are not running" "ERROR"
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Start Docker Desktop" -ForegroundColor White
    Write-Host "  2. Run: docker-compose up -d" -ForegroundColor White
    Write-Host "  3. Run this script again" -ForegroundColor White
    Write-Host ""
    exit 1
}
elseif ($failed -gt 0) {
    Write-Log "Validation completed with failures" "WARN"
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  - Review failed checks above" -ForegroundColor White
    Write-Host "  - Fix issues and re-run validation" -ForegroundColor White
    Write-Host ""
    exit 1
}
elseif ($degraded -gt 0) {
    Write-Log "Validation completed with warnings" "WARN"
    Write-Host ""
    Write-Host "System is operational but has non-critical issues" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Recommended actions:" -ForegroundColor Cyan
    Write-Host "  - Review warnings above" -ForegroundColor White
    Write-Host "  - Run tests: pnpm test" -ForegroundColor White
    Write-Host "  - Open dashboard: $($Config.DASHBOARD_URL)" -ForegroundColor White
    Write-Host ""
    exit 0
}
else {
    Write-Log "All validation checks passed!" "SUCCESS"
    Write-Host ""
    Write-Host "[OK] System is fully operational" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  - Run smoke tests: .\scripts\smoke-test.ps1" -ForegroundColor White
    Write-Host "  - Run unit tests: pnpm test" -ForegroundColor White
    Write-Host "  - Open dashboard: $($Config.DASHBOARD_URL)" -ForegroundColor White
    Write-Host ""
    exit 0
}

Write-Host "Log saved to: $logFile" -ForegroundColor Gray
Write-Host ""