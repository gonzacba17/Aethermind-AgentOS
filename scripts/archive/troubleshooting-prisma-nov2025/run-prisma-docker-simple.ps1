# Run Prisma DB Push in Docker (Simplified)
# Uses node:24-alpine image directly without building

$separator = "================================================================================"

Write-Host $separator -ForegroundColor Cyan
Write-Host "Running Prisma DB Push in Docker Container" -ForegroundColor Cyan
Write-Host $separator -ForegroundColor Cyan
Write-Host ""

Write-Host "Running Prisma DB Push using node:24-alpine..." -ForegroundColor Yellow
Write-Host "Using DATABASE_URL: postgresql://aethermind:testpass123@postgres:5432/aethermind" -ForegroundColor White
Write-Host ""

# Run Prisma in the same network as PostgreSQL using node image directly
docker run --rm `
    --network aethermindagentos_aethermind `
    -e DATABASE_URL="postgresql://aethermind:testpass123@postgres:5432/aethermind" `
    -v "${PWD}:/app" `
    -w /app `
    node:24-alpine `
    sh -c "npm install -g pnpm && pnpm install && npx prisma db push"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host $separator -ForegroundColor Cyan
    Write-Host "Prisma DB Push completed successfully!" -ForegroundColor Green
    Write-Host $separator -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host $separator -ForegroundColor Cyan
    Write-Host "Prisma DB Push failed" -ForegroundColor Red
    Write-Host $separator -ForegroundColor Cyan
    exit 1
}
