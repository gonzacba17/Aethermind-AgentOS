# 🧹 Script de Limpieza de Duplicados
# Ejecuta este script para completar la limpieza

Write-Host "=== INICIANDO LIMPIEZA DE DUPLICADOS ===" -ForegroundColor Cyan

# Fase 1: Eliminar Tests Duplicados
Write-Host "`n[1/4] Eliminando tests duplicados..." -ForegroundColor Yellow
Remove-Item -Recurse -Force tests\unit -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force tests\api -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force tests\websocket -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force packages\core\tests -ErrorAction SilentlyContinue
Write-Host "  ✓ Tests duplicados eliminados" -ForegroundColor Green

# Fase 2: Eliminar Documentación Redundante
Write-Host "`n[2/4] Eliminando documentación redundante..." -ForegroundColor Yellow
Remove-Item -Force CLEANUP_P0_SUMMARY.md -ErrorAction SilentlyContinue
Remove-Item -Force CLEANUP_P1_SUMMARY.md -ErrorAction SilentlyContinue
Remove-Item -Force docs\architecture\AUDITORIA_TECNICA.md -ErrorAction SilentlyContinue
Remove-Item -Force docs\audits\2025-12-13-tecnica.md -ErrorAction SilentlyContinue
Remove-Item -Force docs\audits\2025-12-13-produccion-qa.md -ErrorAction SilentlyContinue
Write-Host "  ✓ Documentación redundante eliminada" -ForegroundColor Green

# Fase 3: Mover Archivos a Ubicaciones Correctas
Write-Host "`n[3/4] Moviendo archivos a ubicaciones correctas..." -ForegroundColor Yellow

# Crear carpetas si no existen
New-Item -ItemType Directory -Force docs\architecture -ErrorAction SilentlyContinue | Out-Null
New-Item -ItemType Directory -Force docs\security -ErrorAction SilentlyContinue | Out-Null
New-Item -ItemType Directory -Force docs\deployment -ErrorAction SilentlyContinue | Out-Null
New-Item -ItemType Directory -Force scripts\security -ErrorAction SilentlyContinue | Out-Null

# Mover archivos (solo si existen)
if (Test-Path "DECISION_MATRIX.md") {
    Move-Item DECISION_MATRIX.md docs\architecture\ -Force
    Write-Host "  ✓ DECISION_MATRIX.md → docs/architecture/" -ForegroundColor Green
}

if (Test-Path "SECURITY_AUDIT_EXECUTIVE_SUMMARY.md") {
    Move-Item SECURITY_AUDIT_EXECUTIVE_SUMMARY.md docs\security\ -Force
    Write-Host "  ✓ SECURITY_AUDIT_EXECUTIVE_SUMMARY.md → docs/security/" -ForegroundColor Green
}

if (Test-Path "SECURITY_AUDIT_REPORT.md") {
    Move-Item SECURITY_AUDIT_REPORT.md docs\security\ -Force
    Write-Host "  ✓ SECURITY_AUDIT_REPORT.md → docs/security/" -ForegroundColor Green
}

if (Test-Path "VERCEL_COMPATIBILITY_ANALYSIS.md") {
    Move-Item VERCEL_COMPATIBILITY_ANALYSIS.md docs\deployment\ -Force
    Write-Host "  ✓ VERCEL_COMPATIBILITY_ANALYSIS.md → docs/deployment/" -ForegroundColor Green
}

if (Test-Path "VALUE_PROPOSITION.md") {
    Move-Item VALUE_PROPOSITION.md docs\ -Force
    Write-Host "  ✓ VALUE_PROPOSITION.md → docs/" -ForegroundColor Green
}

if (Test-Path "verify-security-fixes.ps1") {
    Move-Item verify-security-fixes.ps1 scripts\security\ -Force
    Write-Host "  ✓ verify-security-fixes.ps1 → scripts/security/" -ForegroundColor Green
}

# Fase 4: Limpiar archivos innecesarios
Write-Host "`n[4/4] Limpiando archivos innecesarios..." -ForegroundColor Yellow
Remove-Item -Force DUPLICATE_ANALYSIS.md -ErrorAction SilentlyContinue
Remove-Item -Force apps\api\tests\setup.js -ErrorAction SilentlyContinue
Write-Host "  ✓ Archivos innecesarios eliminados" -ForegroundColor Green

# Resumen
Write-Host "`n=== LIMPIEZA COMPLETADA ===" -ForegroundColor Cyan
Write-Host "`nResumen de cambios:" -ForegroundColor White
Write-Host "  - Tests duplicados eliminados: tests/unit/, tests/api/, tests/websocket/, packages/core/tests/" -ForegroundColor Gray
Write-Host "  - Documentación redundante eliminada: cleanup summaries, auditorías antiguas" -ForegroundColor Gray
Write-Host "  - Archivos organizados en docs/ apropiados" -ForegroundColor Gray
Write-Host "`nPróximos pasos:" -ForegroundColor Yellow
Write-Host "  1. Revisar los cambios: git status" -ForegroundColor White
Write-Host "  2. Agregar al staging: git add -A" -ForegroundColor White
Write-Host "  3. Commitear: git commit -m 'chore: remove duplicates and reorganize docs/tests'" -ForegroundColor White
Write-Host "  4. Verificar tests: pnpm test" -ForegroundColor White
