# Diagnostic Script for Prisma Database Issues
# Run: .\diagnose-prisma.ps1

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "          AETHERMIND PRISMA DIAGNOSTIC" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# CHECK 1: Environment Variables
# ============================================

Write-Host "[1] Checking Environment Variables..." -ForegroundColor Yellow

if (Test-Path ".env") {
    Write-Host "    [OK] .env file found" -ForegroundColor Green
    
    $envContent = Get-Content ".env" -Raw
    
    if ($envContent -match 'DATABASE_URL\s*=\s*(.+)') {
        $dbUrl = $matches[1].Trim()
        Write-Host "    [OK] DATABASE_URL found" -ForegroundColor Green
        
        if ($Verbose) {
            # Mask password for security
            $maskedUrl = $dbUrl -replace ':[^@]+@', ':****@'
            Write-Host "        URL: $maskedUrl" -ForegroundColor Gray
        }
        
        # Parse DATABASE_URL
        if ($dbUrl -match 'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)') {
            $dbUser = $matches[1]
            $dbPass = $matches[2]
            $dbHost = $matches[3]
            $dbPort = $matches[4]
            $dbName = $matches[5]
            
            Write-Host "        User: $dbUser" -ForegroundColor Gray
            Write-Host "        Host: $dbHost" -ForegroundColor Gray
            Write-Host "        Port: $dbPort" -ForegroundColor Gray
            Write-Host "        Database: $dbName" -ForegroundColor Gray
        }
    } else {
        Write-Host "    [X] DATABASE_URL not found in .env" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "    [X] .env file not found" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ============================================
# CHECK 2: PostgreSQL Container
# ============================================

Write-Host "[2] Checking PostgreSQL Container..." -ForegroundColor Yellow

$container = docker ps --filter "name=postgres" --format "{{.Names}}" 2>$null | Select-Object -First 1

if ($container) {
    Write-Host "    [OK] Container found: $container" -ForegroundColor Green
    
    # Check if container is running
    $status = docker inspect --format='{{.State.Status}}' $container 2>$null
    Write-Host "        Status: $status" -ForegroundColor Gray
    
    if ($status -ne "running") {
        Write-Host "    [X] Container is not running" -ForegroundColor Red
        Write-Host "        Fix: docker start $container" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "    [X] PostgreSQL container not found" -ForegroundColor Red
    Write-Host "        Fix: docker-compose up postgres -d" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# ============================================
# CHECK 3: PostgreSQL Connectivity
# ============================================

Write-Host "[3] Testing PostgreSQL Connectivity..." -ForegroundColor Yellow

# Test pg_isready
$pgReadyResult = docker exec $container pg_isready -U $dbUser 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "    [OK] PostgreSQL is accepting connections" -ForegroundColor Green
} else {
    Write-Host "    [X] PostgreSQL is not ready" -ForegroundColor Red
    Write-Host "        Output: $pgReadyResult" -ForegroundColor Gray
    exit 1
}

# Test actual connection
$testQuery = "SELECT version();"
$versionResult = docker exec $container psql -U $dbUser -d postgres -c $testQuery 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "    [OK] Can execute queries" -ForegroundColor Green
    if ($Verbose) {
        Write-Host "        $versionResult" -ForegroundColor Gray
    }
} else {
    Write-Host "    [X] Cannot execute queries" -ForegroundColor Red
    Write-Host "        Output: $versionResult" -ForegroundColor Gray
}

Write-Host ""

# ============================================
# CHECK 4: Database Exists
# ============================================

Write-Host "[4] Checking Database '$dbName'..." -ForegroundColor Yellow

$dbExistsQuery = "SELECT 1 FROM pg_database WHERE datname='$dbName';"
$dbExistsResult = docker exec $container psql -U $dbUser -d postgres -t -c $dbExistsQuery 2>&1

if ($dbExistsResult -match "1") {
    Write-Host "    [OK] Database '$dbName' exists" -ForegroundColor Green
} else {
    Write-Host "    [!] Database '$dbName' does not exist" -ForegroundColor Yellow
    Write-Host "        Creating database..." -ForegroundColor Yellow
    
    $createDbResult = docker exec $container psql -U $dbUser -d postgres -c "CREATE DATABASE $dbName;" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    [OK] Database created successfully" -ForegroundColor Green
    } else {
        Write-Host "    [X] Failed to create database" -ForegroundColor Red
        Write-Host "        Output: $createDbResult" -ForegroundColor Gray
    }
}

Write-Host ""

# ============================================
# CHECK 5: Prisma Schema
# ============================================

Write-Host "[5] Validating Prisma Schema..." -ForegroundColor Yellow

if (Test-Path "prisma/schema.prisma") {
    Write-Host "    [OK] schema.prisma found" -ForegroundColor Green
    
    # Validate schema
    $validateResult = pnpm prisma validate 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    [OK] Schema is valid" -ForegroundColor Green
    } else {
        Write-Host "    [X] Schema validation failed" -ForegroundColor Red
        Write-Host "        Output: $validateResult" -ForegroundColor Gray
        exit 1
    }
} else {
    Write-Host "    [X] schema.prisma not found" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ============================================
# CHECK 6: Prisma Client Generation
# ============================================

Write-Host "[6] Testing Prisma Client Generation..." -ForegroundColor Yellow

$generateResult = pnpm prisma generate 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "    [OK] Prisma Client generated successfully" -ForegroundColor Green
} else {
    Write-Host "    [X] Prisma Client generation failed" -ForegroundColor Red
    Write-Host "        Output:" -ForegroundColor Gray
    Write-Host $generateResult -ForegroundColor Gray
    exit 1
}

Write-Host ""

# ============================================
# CHECK 7: Database Push (Dry Run)
# ============================================

Write-Host "[7] Testing Prisma DB Push (Dry Run)..." -ForegroundColor Yellow

$dryRunResult = pnpm prisma db push --accept-data-loss --skip-generate 2>&1
$dryRunOutput = $dryRunResult | Out-String

Write-Host "    Output:" -ForegroundColor Gray
Write-Host $dryRunOutput -ForegroundColor Gray

if ($LASTEXITCODE -eq 0) {
    Write-Host "    [OK] DB Push succeeded" -ForegroundColor Green
} else {
    Write-Host "    [X] DB Push failed" -ForegroundColor Red
    
    # Common error patterns
    if ($dryRunOutput -match "authentication failed") {
        Write-Host ""
        Write-Host "    DIAGNOSIS: Authentication Error" -ForegroundColor Yellow
        Write-Host "    - Check POSTGRES_PASSWORD in .env" -ForegroundColor White
        Write-Host "    - Verify password in DATABASE_URL matches" -ForegroundColor White
        Write-Host "    - Try: docker exec $container psql -U $dbUser -c '\du'" -ForegroundColor White
    }
    elseif ($dryRunOutput -match "does not exist") {
        Write-Host ""
        Write-Host "    DIAGNOSIS: Database/Table Missing" -ForegroundColor Yellow
        Write-Host "    - Database may need to be created" -ForegroundColor White
        Write-Host "    - Try: docker exec $container createdb -U $dbUser $dbName" -ForegroundColor White
    }
    elseif ($dryRunOutput -match "connection refused") {
        Write-Host ""
        Write-Host "    DIAGNOSIS: Connection Refused" -ForegroundColor Yellow
        Write-Host "    - PostgreSQL may not be running" -ForegroundColor White
        Write-Host "    - Check: docker ps | findstr postgres" -ForegroundColor White
        Write-Host "    - Try: docker-compose up postgres -d" -ForegroundColor White
    }
    elseif ($dryRunOutput -match "timeout") {
        Write-Host ""
        Write-Host "    DIAGNOSIS: Connection Timeout" -ForegroundColor Yellow
        Write-Host "    - Check network connectivity" -ForegroundColor White
        Write-Host "    - Verify port 5432 is exposed" -ForegroundColor White
    }
    
    exit 1
}

Write-Host ""

# ============================================
# CHECK 8: Test Database Connection via Node
# ============================================

Write-Host "[8] Testing Connection from Node.js..." -ForegroundColor Yellow

$testScript = @"
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function main() {
  try {
    await prisma.\`$connect\`();
    console.log('[OK] Connected successfully');
    
    const result = await prisma.\`$queryRaw\`\`SELECT current_database(), current_user, version()\`;
    console.log('[OK] Query executed:', result[0]);
    
    await prisma.\`$disconnect\`();
    process.exit(0);
  } catch (error) {
    console.error('[X] Connection failed:', error.message);
    process.exit(1);
  }
}

main();
"@

Set-Content -Path "test-prisma-connection.mjs" -Value $testScript

$nodeTestResult = node test-prisma-connection.mjs 2>&1

Write-Host "    Output:" -ForegroundColor Gray
Write-Host $nodeTestResult -ForegroundColor Gray

Remove-Item "test-prisma-connection.mjs" -Force -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    Write-Host "    [OK] Node.js connection test passed" -ForegroundColor Green
} else {
    Write-Host "    [X] Node.js connection test failed" -ForegroundColor Red
}

Write-Host ""

# ============================================
# SUMMARY
# ============================================

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "                    DIAGNOSTIC COMPLETE" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] All checks passed! Prisma should be working." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  - Run: .\setup-aethermind.ps1" -ForegroundColor White
    Write-Host "  - Or run: pnpm dev" -ForegroundColor White
} else {
    Write-Host "[X] Some checks failed. Review the output above." -ForegroundColor Red
    Write-Host ""
    Write-Host "Common fixes:" -ForegroundColor Cyan
    Write-Host "  1. Reset PostgreSQL: docker-compose down -v && docker-compose up postgres -d" -ForegroundColor White
    Write-Host "  2. Check .env file: Verify DATABASE_URL and passwords match" -ForegroundColor White
    Write-Host "  3. Regenerate Prisma: pnpm prisma generate" -ForegroundColor White
    Write-Host "  4. Manual push: pnpm prisma db push --accept-data-loss" -ForegroundColor White
}

Write-Host ""