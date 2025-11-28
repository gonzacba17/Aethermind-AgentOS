# Force Refresh Prisma Configuration
# Run: .\force-refresh-prisma.ps1

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "          FORCE REFRESH PRISMA CONFIGURATION" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# STEP 1: Clear Environment Cache
# ============================================

Write-Host "[1] Clearing environment variable cache..." -ForegroundColor Yellow

# Remove cached env vars
Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:\POSTGRES_PASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:\POSTGRES_USER -ErrorAction SilentlyContinue
Remove-Item Env:\POSTGRES_DB -ErrorAction SilentlyContinue

Write-Host "    [OK] Environment cache cleared" -ForegroundColor Green
Write-Host ""

# ============================================
# STEP 2: Load Fresh .env
# ============================================

Write-Host "[2] Loading fresh .env configuration..." -ForegroundColor Yellow

if (Test-Path ".env") {
    $envContent = Get-Content ".env"
    
    foreach ($line in $envContent) {
        if ($line -match '^\s*([^#][^=]+)=(.+)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
            
            if ($key -eq "DATABASE_URL" -or $key -eq "POSTGRES_PASSWORD") {
                $maskedValue = if ($key -eq "DATABASE_URL") { 
                    $value -replace ':[^@]+@', ':****@' 
                } else { 
                    "****" 
                }
                Write-Host "    $key = $maskedValue" -ForegroundColor Gray
            }
        }
    }
    
    Write-Host "    [OK] Environment variables loaded" -ForegroundColor Green
} else {
    Write-Host "    [X] .env file not found" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ============================================
# STEP 3: Clean Prisma Artifacts
# ============================================

Write-Host "[3] Cleaning Prisma artifacts..." -ForegroundColor Yellow

# Remove generated client
if (Test-Path "node_modules/.prisma") {
    Remove-Item "node_modules/.prisma" -Recurse -Force
    Write-Host "    [OK] Removed .prisma cache" -ForegroundColor Green
}

if (Test-Path "node_modules/@prisma/client") {
    Remove-Item "node_modules/@prisma/client" -Recurse -Force
    Write-Host "    [OK] Removed @prisma/client" -ForegroundColor Green
}

Write-Host ""

# ============================================
# STEP 4: Regenerate Prisma Client
# ============================================

Write-Host "[4] Regenerating Prisma Client..." -ForegroundColor Yellow

$generateOutput = pnpm prisma generate 2>&1 | Out-String

if ($LASTEXITCODE -eq 0) {
    Write-Host "    [OK] Prisma Client generated successfully" -ForegroundColor Green
} else {
    Write-Host "    [X] Generation failed" -ForegroundColor Red
    Write-Host $generateOutput -ForegroundColor Gray
    exit 1
}

Write-Host ""

# ============================================
# STEP 5: Test Connection
# ============================================

Write-Host "[5] Testing Prisma connection..." -ForegroundColor Yellow

$testScript = @'
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error']
});

async function main() {
  try {
    await prisma.$connect();
    const result = await prisma.$queryRaw`SELECT current_user, current_database()`;
    console.log('[OK] Connected successfully');
    console.log('User:', result[0].current_user);
    console.log('Database:', result[0].current_database);
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[X] Connection failed:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
'@

Set-Content -Path "test-connection.mjs" -Value $testScript -Encoding UTF8

$connectionTest = node test-connection.mjs 2>&1 | Out-String
Write-Host $connectionTest -ForegroundColor Gray

Remove-Item "test-connection.mjs" -Force -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    Write-Host "    [OK] Connection test passed!" -ForegroundColor Green
} else {
    Write-Host "    [X] Connection test failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "    Checking DATABASE_URL format..." -ForegroundColor Yellow
    
    if (Test-Path ".env") {
        $envContent = Get-Content ".env" -Raw
        if ($envContent -match 'DATABASE_URL\s*=\s*(.+)') {
            $dbUrl = $matches[1].Trim()
            $maskedUrl = $dbUrl -replace ':[^@]+@', ':****@'
            Write-Host "    Current: $maskedUrl" -ForegroundColor Gray
            
            # Verify format
            if ($dbUrl -match 'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)') {
                Write-Host "    [OK] URL format is correct" -ForegroundColor Green
                Write-Host "    User: $($matches[1])" -ForegroundColor Gray
                Write-Host "    Host: $($matches[3])" -ForegroundColor Gray
                Write-Host "    Port: $($matches[4])" -ForegroundColor Gray
                Write-Host "    Database: $($matches[5])" -ForegroundColor Gray
            } else {
                Write-Host "    [X] URL format is invalid" -ForegroundColor Red
            }
        }
    }
    
    exit 1
}

Write-Host ""

# ============================================
# STEP 6: Apply Schema
# ============================================

Write-Host "[6] Applying database schema..." -ForegroundColor Yellow

$pushOutput = pnpm prisma db push --skip-generate --accept-data-loss 2>&1 | Out-String

if ($LASTEXITCODE -eq 0) {
    Write-Host "    [OK] Schema applied successfully!" -ForegroundColor Green
    
    # Show tables
    Write-Host ""
    Write-Host "    Verifying tables..." -ForegroundColor Yellow
    
    $container = docker ps --filter "name=postgres" --format "{{.Names}}" 2>$null | Select-Object -First 1
    if ($container) {
        $tables = docker exec $container psql -U aethermind -d aethermind -c "\dt" 2>&1
        Write-Host $tables -ForegroundColor Gray
    }
} else {
    Write-Host "    [X] Schema push failed" -ForegroundColor Red
    Write-Host $pushOutput -ForegroundColor Gray
    exit 1
}

Write-Host ""

# ============================================
# SUMMARY
# ============================================

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "                    REFRESH COMPLETE" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Prisma is now configured correctly!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Run: .\setup-aethermind.ps1" -ForegroundColor White
    Write-Host "  2. Or start development: pnpm dev" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "[X] Configuration issues remain" -ForegroundColor Red
    Write-Host ""
    Write-Host "Nuclear option (complete reset):" -ForegroundColor Yellow
    Write-Host "  docker-compose down -v" -ForegroundColor White
    Write-Host "  docker volume prune -f" -ForegroundColor White
    Write-Host "  Remove-Item node_modules -Recurse -Force" -ForegroundColor White
    Write-Host "  Remove-Item .env" -ForegroundColor White
    Write-Host "  Copy-Item .env.example .env" -ForegroundColor White
    Write-Host "  # Edit .env with correct password" -ForegroundColor White
    Write-Host "  pnpm install" -ForegroundColor White
    Write-Host "  docker-compose up -d" -ForegroundColor White
    Write-Host "  .\fix-postgres-auth.ps1" -ForegroundColor White
    Write-Host ""
}