# Clean .env File Script
# Removes trailing spaces and invisible characters from .env file

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ".env File Cleaner" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

$envFile = ".env"

if (-not (Test-Path $envFile)) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Reading $envFile..." -ForegroundColor Yellow

# Read the file
$content = Get-Content $envFile -Raw

# Count original issues
$originalLines = $content -split "`n"
$linesWithTrailingSpaces = ($originalLines | Where-Object { $_ -match '\s+$' }).Count

Write-Host "🔍 Analysis:" -ForegroundColor Yellow
Write-Host "   Total lines: $($originalLines.Count)" -ForegroundColor White
Write-Host "   Lines with trailing spaces: $linesWithTrailingSpaces" -ForegroundColor White
Write-Host ""

if ($linesWithTrailingSpaces -eq 0) {
    Write-Host "✅ File is already clean! No trailing spaces found." -ForegroundColor Green
    Write-Host ""
    
    # Still verify DATABASE_URL
    $databaseUrl = $originalLines | Where-Object { $_ -match '^DATABASE_URL=' }
    if ($databaseUrl) {
        Write-Host "📋 Current DATABASE_URL:" -ForegroundColor Yellow
        Write-Host "   $databaseUrl" -ForegroundColor White
        
        $expected = "DATABASE_URL=postgresql://aethermind:testpass123@localhost:5432/aethermind"
        if ($databaseUrl.Trim() -eq $expected) {
            Write-Host "✅ DATABASE_URL is correct!" -ForegroundColor Green
        } else {
            Write-Host "⚠️  DATABASE_URL doesn't match expected value:" -ForegroundColor Yellow
            Write-Host "   Expected: $expected" -ForegroundColor White
        }
    }
    exit 0
}

# Create backup
$backupFile = ".env.backup." + (Get-Date -Format "yyyyMMdd-HHmmss")
Copy-Item $envFile $backupFile
Write-Host "💾 Backup created: $backupFile" -ForegroundColor Green
Write-Host ""

# Clean the file
Write-Host "🧹 Cleaning file..." -ForegroundColor Yellow

$cleanedLines = $originalLines | ForEach-Object {
    # Remove trailing whitespace
    $_.TrimEnd()
}

# Join with Unix line endings (LF)
$cleanedContent = $cleanedLines -join "`n"

# Ensure file ends with a single newline
if (-not $cleanedContent.EndsWith("`n")) {
    $cleanedContent += "`n"
}

# Write back to file with UTF8 encoding (no BOM)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Resolve-Path $envFile), $cleanedContent, $utf8NoBom)

Write-Host "✅ File cleaned successfully!" -ForegroundColor Green
Write-Host ""

# Verify DATABASE_URL
$newLines = Get-Content $envFile
$databaseUrl = $newLines | Where-Object { $_ -match '^DATABASE_URL=' }

Write-Host "📋 Verification:" -ForegroundColor Yellow
if ($databaseUrl) {
    Write-Host "   DATABASE_URL: $databaseUrl" -ForegroundColor White
    
    $expected = "DATABASE_URL=postgresql://aethermind:testpass123@localhost:5432/aethermind"
    if ($databaseUrl -eq $expected) {
        Write-Host "   ✅ Matches expected value" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Different from expected:" -ForegroundColor Yellow
        Write-Host "   Expected: $expected" -ForegroundColor White
    }
} else {
    Write-Host "   ❌ DATABASE_URL not found!" -ForegroundColor Red
}

Write-Host ""
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "✅ Cleanup complete!" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""
