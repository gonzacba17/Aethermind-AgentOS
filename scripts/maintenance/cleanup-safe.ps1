# Limpieza Segura - Aethermind AgentOS
param(
    [switch]$DryRun,
    [switch]$Force,
    [switch]$SkipBackups
)

$ErrorActionPreference = "Stop"
$projectRoot = "c:\wamp64\www\Aethermind Agent os"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  LIMPIEZA SEGURA - Aethermind AgentOS" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "[DRY RUN MODE] -No se eliminaran archivos" -ForegroundColor Yellow
    Write-Host ""
}

# Verificar directorio
if (-not (Test-Path "$projectRoot\package.json")) {
    Write-Host "ERROR: No se encuentra package.json" -ForegroundColor Red
    exit 1
}

Set-Location $projectRoot

# PASO 1: Backup en Git
Write-Host "[PASO 1] Verificando estado de Git..." -ForegroundColor Green

if (-not $SkipBackups) {
    $gitStatus = git status --porcelain
    
    if ($gitStatus -and -not $Force) {
        Write-Host "ADVERTENCIA: Hay cambios sin commitear" -ForegroundColor Yellow
        $response = Read-Host "Continuar sin commit? (s/N)"
        if ($response -ne 's' -and $response -ne 'S') {
            Write-Host "Limpieza cancelada" -ForegroundColor Yellow
            exit 0
        }
    }
    
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $tagName = "pre-cleanup-$timestamp"
    
    Write-Host "Creando tag: $tagName" -ForegroundColor Cyan
    
    if (-not $DryRun) {
        git tag $tagName 2>$null
        Write-Host "Tag creado: $tagName" -ForegroundColor Green
    }
    else {
        Write-Host "[DRY RUN] git tag $tagName" -ForegroundColor Yellow
    }
}

Write-Host ""

# PASO 2: Documentacion de Migracion
Write-Host "[PASO 2] Eliminando documentacion obsoleta..." -ForegroundColor Green

$migrationDocs = @(
    "MIGRACION_DASHBOARD_COMPLETADA.md",
    "PLAN_MIGRACION_DASHBOARD.md",
    "PRISMA_MIGRATION_REPORT.md",
    "VERIFICACION_DEPLOY_RAILWAY.md"
)

$removedDocs = 0
foreach ($doc in $migrationDocs) {
    $path = Join-Path $projectRoot $doc
    if (Test-Path $path) {
        $size = (Get-Item $path).Length
        $sizeKB = [math]::Round($size / 1KB, 2)
        Write-Host "  - Eliminando: $doc ($sizeKB KB)" -ForegroundColor Cyan
        
        if (-not $DryRun) {
            Remove-Item $path -Force
            $removedDocs++
        }
        else {
            Write-Host "    [DRY RUN]" -ForegroundColor Yellow
        }
    }
}

Write-Host "Documentos eliminados: $removedDocs" -ForegroundColor Green
Write-Host ""

# PASO 3: Carpetas de Backup
Write-Host "[PASO 3] Eliminando carpetas de backup..." -ForegroundColor Green

$backupFolders = @(
    "packages\dashboard-old",
    "packages\dashboard-backup-20260114-163703",
    "Nuevo dash"
)

$removedBackups = 0
$spaceSaved = 0

foreach ($folder in $backupFolders) {
    $path = Join-Path $projectRoot $folder
    if (Test-Path $path) {
        try {
            $size = (Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            if ($null -eq $size) { $size = 0 }
            $sizeMB = [math]::Round($size / 1MB, 2)
            Write-Host "  - Eliminando: $folder ($sizeMB MB)" -ForegroundColor Cyan
            
            if (-not $DryRun) {
                Remove-Item $path -Recurse -Force
                $removedBackups++
                $spaceSaved += $size
            }
            else {
                Write-Host "    [DRY RUN]" -ForegroundColor Yellow
            }
        }
        catch {
            Write-Host "  - Error calculando: $folder" -ForegroundColor Yellow
        }
    }
}

$spaceSavedMB = [math]::Round($spaceSaved / 1MB, 2)
Write-Host "Backups eliminados: $removedBackups ($spaceSavedMB MB)" -ForegroundColor Green
Write-Host ""

# PASO 4: Build Artifacts
Write-Host "[PASO 4] Limpiando build artifacts..." -ForegroundColor Green

$buildPaths = @(
    "apps\api\dist",
    "packages\dashboard\.next"
)

$removedBuilds = 0
$buildSpaceSaved = 0

foreach ($buildPath in $buildPaths) {
    $path = Join-Path $projectRoot $buildPath
    if (Test-Path $path) {
        try {
            $size = (Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            if ($null -eq $size) { $size = 0 }
            $sizeMB = [math]::Round($size / 1MB, 2)
            Write-Host "  - Eliminando: $buildPath ($sizeMB MB)" -ForegroundColor Cyan
            
            if (-not $DryRun) {
                Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
                $removedBuilds++
                $buildSpaceSaved += $size
            }
            else {
                Write-Host "    [DRY RUN]" -ForegroundColor Yellow
            }
        }
        catch {
            Write-Host "  - Saltando: $buildPath" -ForegroundColor Yellow
        }
    }
}

$buildSpaceSavedMB = [math]::Round($buildSpaceSaved / 1MB, 2)
Write-Host "Build artifacts eliminados: $removedBuilds ($buildSpaceSavedMB MB)" -ForegroundColor Green
Write-Host ""

# PASO 5: TypeScript Cache
Write-Host "[PASO 5] Limpiando TypeScript cache..." -ForegroundColor Green

$tsbuildinfo = Get-ChildItem -Path $projectRoot -Filter "*.tsbuildinfo" -Recurse -File -ErrorAction SilentlyContinue
$removedTsinfo = 0
$tsinfoSpaceSaved = 0

foreach ($file in $tsbuildinfo) {
    $size = $file.Length
    $sizeMB = [math]::Round($size / 1MB, 2)
    $relativePath = $file.FullName.Replace($projectRoot, "")
    Write-Host "  - Eliminando: $relativePath ($sizeMB MB)" -ForegroundColor Cyan
    
    if (-not $DryRun) {
        Remove-Item $file.FullName -Force
        $removedTsinfo++
        $tsinfoSpaceSaved += $size
    }
    else {
        Write-Host "    [DRY RUN]" -ForegroundColor Yellow
    }
}

$tsinfoSpaceSavedMB = [math]::Round($tsinfoSpaceSaved / 1MB, 2)
Write-Host "TS cache eliminado: $removedTsinfo archivos ($tsinfoSpaceSavedMB MB)" -ForegroundColor Green
Write-Host ""

# PASO 6: Configs Redundantes
Write-Host "[PASO 6] Eliminando configs redundantes..." -ForegroundColor Green

$redundantConfigs = @("vercel.json.backup")
$removedConfigs = 0

foreach ($config in $redundantConfigs) {
    $path = Join-Path $projectRoot $config
    if (Test-Path $path) {
        Write-Host "  - Eliminando: $config" -ForegroundColor Cyan
        
        if (-not $DryRun) {
            Remove-Item $path -Force
            $removedConfigs++
        }
        else {
            Write-Host "    [DRY RUN]" -ForegroundColor Yellow
        }
    }
}

Write-Host "Configs eliminadas: $removedConfigs" -ForegroundColor Green
Write-Host ""

# PASO 7: pnpm Store
Write-Host "[PASO 7] Limpiando pnpm store..." -ForegroundColor Green

if (-not $DryRun) {
    Write-Host "  Ejecutando: pnpm store prune" -ForegroundColor Cyan
    pnpm store prune 2>$null
    Write-Host "pnpm store limpiado" -ForegroundColor Green
}
else {
    Write-Host "  [DRY RUN] pnpm store prune" -ForegroundColor Yellow
}

Write-Host ""

# RESUMEN
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  RESUMEN DE LIMPIEZA" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

$totalSpaceSaved = $spaceSaved + $buildSpaceSaved + $tsinfoSpaceSaved
$totalSpaceSavedMB = [math]::Round($totalSpaceSaved / 1MB, 2)
$totalSpaceSavedGB = [math]::Round($totalSpaceSaved / 1GB, 2)

Write-Host ""
Write-Host "Documentos de migracion: $removedDocs archivos" -ForegroundColor White
Write-Host "Carpetas de backup:      $removedBackups carpetas ($spaceSavedMB MB)" -ForegroundColor White
Write-Host "Build artifacts:         $removedBuilds ($buildSpaceSavedMB MB)" -ForegroundColor White
Write-Host "TypeScript cache:        $removedTsinfo archivos ($tsinfoSpaceSavedMB MB)" -ForegroundColor White
Write-Host "Configs redundantes:     $removedConfigs archivos" -ForegroundColor White
Write-Host ""
Write-Host "ESPACIO TOTAL LIBERADO: $totalSpaceSavedMB MB ($totalSpaceSavedGB GB)" -ForegroundColor Green
Write-Host ""

if ($DryRun) {
    Write-Host "================================================" -ForegroundColor Yellow
    Write-Host "  MODO DRY RUN - NO SE ELIMINO NADA" -ForegroundColor Yellow
    Write-Host "================================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Para ejecutar la limpieza real:" -ForegroundColor Cyan
    Write-Host "  .\cleanup-safe.ps1" -ForegroundColor White
}
else {
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "  LIMPIEZA COMPLETADA" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "SIGUIENTE PASO:" -ForegroundColor Cyan
    Write-Host "1. Verificar build: pnpm build" -ForegroundColor White
    Write-Host "2. Ejecutar tests: pnpm test" -ForegroundColor White
    if (-not $SkipBackups) {
        Write-Host "3. Restaurar si falla: git checkout $tagName" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "Generado: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
