# PowerShell script to run database migration
# Usage: .\run-migration.ps1

Write-Host "🔧 Aethermind AgentOS - Database Migration" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker status..." -ForegroundColor Yellow
$dockerRunning = docker ps 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is not running or not installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start Docker and run 'pnpm docker:up' first" -ForegroundColor Yellow
    exit 1
}

# Check if PostgreSQL container is running
Write-Host "Checking PostgreSQL container..." -ForegroundColor Yellow
$postgresContainer = docker ps --filter "name=postgres" --format "{{.Names}}" 2>$null
if (-not $postgresContainer) {
    Write-Host "❌ PostgreSQL container not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run 'pnpm docker:up' to start the database" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Found PostgreSQL container: $postgresContainer" -ForegroundColor Green
Write-Host ""

# Run migration
Write-Host "Running migration..." -ForegroundColor Yellow
$migrationFile = "prisma/migrations/manual_add_budgets_and_alerts.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Migration file not found: $migrationFile" -ForegroundColor Red
    exit 1
}

# Execute SQL file in PostgreSQL container
$result = Get-Content $migrationFile | docker exec -i $postgresContainer psql -U postgres -d aethermind 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Tables created:" -ForegroundColor Cyan
    Write-Host "  - budgets" -ForegroundColor White
    Write-Host "  - alert_logs" -ForegroundColor White
    Write-Host ""
    
    # Generate Prisma client
    Write-Host "Generating Prisma client..." -ForegroundColor Yellow
    pnpm prisma:generate
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Prisma client generated!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🎉 Migration complete! You can now:" -ForegroundColor Green
        Write-Host "  1. Start the API: pnpm dev:api" -ForegroundColor White
        Write-Host "  2. Create budgets via /api/budgets" -ForegroundColor White
        Write-Host "  3. Configure alerts in .env (optional)" -ForegroundColor White
        Write-Host ""
        Write-Host "See MIGRATION_GUIDE.md for testing instructions" -ForegroundColor Cyan
    } else {
        Write-Host "⚠️  Migration succeeded but Prisma generation failed" -ForegroundColor Yellow
        Write-Host "Run 'pnpm prisma:generate' manually" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Migration failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error output:" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    Write-Host ""
    Write-Host "Try running the SQL manually:" -ForegroundColor Yellow
    Write-Host "  docker exec -i $postgresContainer psql -U postgres -d aethermind < $migrationFile" -ForegroundColor White
    exit 1
}
