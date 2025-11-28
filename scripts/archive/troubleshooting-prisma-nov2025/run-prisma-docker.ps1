# Run Prisma DB Push in Docker
# This script runs Prisma inside a Docker container to avoid Windows authentication issues

$separator = "================================================================================"

Write-Host $separator -ForegroundColor Cyan
Write-Host "Running Prisma DB Push in Docker Container" -ForegroundColor Cyan
Write-Host $separator -ForegroundColor Cyan
Write-Host ""

Write-Host "Building Prisma runner image..." -ForegroundColor Yellow
docker build -f Dockerfile.prisma -t prisma-runner .

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to build Docker image" -ForegroundColor Red
    exit 1
}

Write-Host "Image built successfully" -ForegroundColor Green
Write-Host ""

Write-Host "Running Prisma DB Push..." -ForegroundColor Yellow
Write-Host "Using DATABASE_URL: postgresql://aethermind:testpass123@postgres:5432/aethermind" -ForegroundColor White
Write-Host ""

# Run Prisma in the same network as PostgreSQL
$dbUrl = "postgresql://aethermind:testpass123@postgres:5432/aethermind"
$network = "aethermindagentos_aethermind"
$volumeMount = "${PWD}/prisma:/app/prisma"

docker run --rm --network $network -e DATABASE_URL=$dbUrl -v $volumeMount prisma-runner npx prisma db push

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
