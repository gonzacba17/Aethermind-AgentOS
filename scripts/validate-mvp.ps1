# MVP Validation Script for Windows PowerShell
# Run with: .\scripts\validate-mvp.ps1

# Setup logging
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logDir = "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}
$logFile = Join-Path $logDir "validate_mvp_$timestamp.log"

function Write-Log {
    param([string]$Message, [string]$Color = "White")
    $Message | Out-File -FilePath $logFile -Append -Encoding UTF8
    if ($Color -ne "White") {
        Write-Host $Message -ForegroundColor $Color
    } else {
        Write-Host $Message
    }
}

Write-Log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Starting MVP validation" "Cyan"
Write-Log "Log file: $logFile`n" "Cyan"
Write-Log "[INFO] Validating Aethermind MVP...`n" "Cyan"

$allPassed = $true

# Check 1: Docker
Write-Host "1. Checking Docker..."
try {
    docker ps | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Log "[OK] Docker is running" "Green"
    } else {
        Write-Log "[ERROR] Docker is not running" "Red"
        Write-Log "  Please start Docker Desktop" "Yellow"
        $allPassed = $false
    }
} catch {
    Write-Host "[ERROR] Docker is not running" -ForegroundColor Red
    $allPassed = $false
}

# Check 2: PostgreSQL
Write-Log "`n2. Checking PostgreSQL..."
$pgContainer = docker ps --filter "name=postgres" --format "{{.Names}}"
if ($pgContainer -match "postgres") {
    Write-Log "[OK] PostgreSQL is running" "Green"
} else {
    Write-Log "[ERROR] PostgreSQL is not running" "Red"
    Write-Log "  Run: pnpm docker:up" "Yellow"
    $allPassed = $false
}

# Check 3: Redis
Write-Log "`n3. Checking Redis..."
$redisContainer = docker ps --filter "name=redis" --format "{{.Names}}"
if ($redisContainer -match "redis") {
    Write-Log "[OK] Redis is running" "Green"
} else {
    Write-Log "[ERROR] Redis is not running" "Red"
    Write-Log "  Run: pnpm docker:up" "Yellow"
    $allPassed = $false
}

# Check 4: API
Write-Log "`n4. Checking API..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 2 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Log "[OK] API is responding" "Green"
    } else {
        Write-Log "[WARN] API is not responding" "Yellow"
        Write-Log "  Run: cd apps/api; pnpm dev" "Yellow"
    }
} catch {
    Write-Log "[WARN] API is not responding" "Yellow"
    Write-Log "  Run: cd apps/api; pnpm dev" "Yellow"
}

# Check 5: Dashboard
Write-Log "`n5. Checking Dashboard..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 2 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Log "[OK] Dashboard is responding" "Green"
    } else {
        Write-Log "[WARN] Dashboard is not responding" "Yellow"
        Write-Log "  Run: cd packages/dashboard; pnpm dev" "Yellow"
    }
} catch {
    Write-Log "[WARN] Dashboard is not responding" "Yellow"
    Write-Log "  Run: cd packages/dashboard; pnpm dev" "Yellow"
}

# Check 6: Database Connection
Write-Log "`n6. Testing database connection..."
try {
    $dbTest = docker exec aethermind-postgres psql -U aethermind -d aethermind -c "SELECT 1" 2>&1
    if (-not $dbTest) {
        $dbTest = docker exec postgres psql -U postgres -d aethermind -c "SELECT 1" 2>&1
    }
    if ($dbTest -match "1 row") {
        Write-Log "[OK] Database connection successful" "Green"
    } else {
        Write-Log "[WARN] Database connection uncertain" "Yellow"
    }
} catch {
    Write-Log "[WARN] Could not verify database connection" "Yellow"
}

# Check 7: Redis Connection
Write-Log "`n7. Testing Redis connection..."
try {
    $redisTest = docker exec aethermind-redis redis-cli ping 2>&1
    if (-not $redisTest) {
        $redisTest = docker exec redis redis-cli ping 2>&1
    }
    if ($redisTest -match "PONG") {
        Write-Log "[OK] Redis connection successful" "Green"
    } else {
        Write-Log "[WARN] Redis connection uncertain" "Yellow"
    }
} catch {
    Write-Log "[WARN] Could not verify Redis connection" "Yellow"
}

# Summary
Write-Log "`n=================================================="
if ($allPassed) {
    Write-Log "[SUCCESS] All critical checks passed!" "Green"
    Write-Log "`nNext steps:"
    Write-Log "  - Run tests: pnpm test"
    Write-Log "  - Try example: pnpm demo"
    Write-Log "  - Open dashboard: http://localhost:3000"
} else {
    Write-Log "[FAILED] Some checks failed" "Red"
    Write-Log "`nPlease fix the issues above and run again."
}

Write-Log "`n[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Validation completed"
Write-Host "`nLog saved to: $logFile" -ForegroundColor Cyan
