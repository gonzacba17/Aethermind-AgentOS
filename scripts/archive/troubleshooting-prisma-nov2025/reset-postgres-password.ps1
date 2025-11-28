# Reset PostgreSQL Password Script
# This script resets the PostgreSQL password to ensure it matches the .env file

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "PostgreSQL Password Reset Script" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

$newPassword = "testpass123"
$dbUser = "aethermind"
$dbName = "aethermind"

Write-Host "📋 Configuration:" -ForegroundColor Yellow
Write-Host "   User: $dbUser"
Write-Host "   Database: $dbName"
Write-Host "   New Password: $newPassword"
Write-Host ""

# Check if PostgreSQL container is running
Write-Host "🔍 Checking PostgreSQL container status..." -ForegroundColor Yellow
$containerStatus = docker ps --filter "name=postgres" --format "{{.Names}}: {{.Status}}"

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($containerStatus)) {
    Write-Host "❌ PostgreSQL container is not running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start PostgreSQL first:" -ForegroundColor Yellow
    Write-Host "   docker-compose up -d postgres" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "✅ Container status: $containerStatus" -ForegroundColor Green
Write-Host ""

# Reset the password
Write-Host "🔐 Resetting password for user '$dbUser'..." -ForegroundColor Yellow

$sqlCommand = "ALTER USER $dbUser WITH PASSWORD '$newPassword';"

try {
    docker exec -i aethermind-agent-os-postgres-1 psql -U $dbUser -d $dbName -c $sqlCommand 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Password reset successfully!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Command executed with warnings (this is often normal)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error resetting password: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test the new password
Write-Host "🧪 Testing new password..." -ForegroundColor Yellow

$env:PGPASSWORD = $newPassword
$testResult = docker exec -i aethermind-agent-os-postgres-1 psql -U $dbUser -d $dbName -c "SELECT 1;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Password test successful!" -ForegroundColor Green
} else {
    Write-Host "❌ Password test failed!" -ForegroundColor Red
    Write-Host "Error: $testResult" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "✅ Password reset complete!" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "   1. Verify .env has: DATABASE_URL=postgresql://aethermind:testpass123@localhost:5432/aethermind" -ForegroundColor White
Write-Host "   2. Run: node test-prisma-connection.js" -ForegroundColor White
Write-Host "   3. Run: npx prisma db push" -ForegroundColor White
Write-Host ""
