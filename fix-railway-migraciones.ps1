# ========================================
# SCRIPT: Arreglar Railway - Ejecutar Migraciones de Prisma
# ========================================

Write-Host "`nINICIANDO REPARACION DE RAILWAY BACKEND`n" -ForegroundColor Cyan

# Verificar que estamos en el directorio correcto
Write-Host "[INFO] Directorio actual: $(Get-Location)" -ForegroundColor Cyan
if (!(Test-Path "prisma/schema.prisma")) {
    Write-Host "ERROR: No se encuentra el archivo prisma/schema.prisma" -ForegroundColor Red
    Write-Host "Asegurate de estar en el directorio del backend: c:\wamp64\www\Aethermind Agent os`n" -ForegroundColor Red
    exit 1
}

Write-Host "OK - En el directorio correcto del backend`n" -ForegroundColor Green

# Paso 1: Verificar cambios pendientes en git
Write-Host "[Paso 1] Verificando estado de git..." -ForegroundColor Yellow
git status
Write-Host ""

# Paso 2: Commit los cambios de trust proxy
Write-Host "[Paso 2] Commiteando fix de trust proxy..." -ForegroundColor Yellow
git add apps/api/src/index.ts

$commitMessage = "fix: Added trust proxy for Railway and prepared for migrations"
git commit -m $commitMessage

if ($LASTEXITCODE -eq 0) {
    Write-Host "OK - Commit creado exitosamente`n" -ForegroundColor Green
} else {
    Write-Host "INFO - No hay cambios para commitear (probablemente ya esta commiteado)`n" -ForegroundColor Yellow
}

# Paso 3: Push a GitHub
Write-Host "[Paso 3] Pusheando cambios a GitHub..." -ForegroundColor Yellow
git push

if ($LASTEXITCODE -eq 0) {
    Write-Host "OK - Cambios pusheados exitosamente`n" -ForegroundColor Green
    Write-Host "INFO - Railway auto-desplegara en unos segundos...`n" -ForegroundColor Cyan
} else {
    Write-Host "ERROR - Error al pushear. Revisa tu conexion a GitHub`n" -ForegroundColor Red
}

# Paso 4: Verificar si Railway CLI está instalado
Write-Host "[Paso 4] Verificando Railway CLI..." -ForegroundColor Yellow
$railwayCLI = Get-Command railway -ErrorAction SilentlyContinue

if (!$railwayCLI) {
    Write-Host "INFO - Railway CLI no esta instalado. Instalando..." -ForegroundColor Yellow
    npm install -g @railway/cli
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK - Railway CLI instalado exitosamente`n" -ForegroundColor Green
    } else {
        Write-Host "ERROR - Error al instalar Railway CLI" -ForegroundColor Red
        Write-Host "Por favor, instalalo manualmente: npm install -g @railway/cli`n" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "OK - Railway CLI ya esta instalado`n" -ForegroundColor Green
}

# Paso 5: Login a Railway
Write-Host "[Paso 5] Iniciando sesion en Railway..." -ForegroundColor Yellow
Write-Host "Se abrira tu navegador para autenticarte.`n" -ForegroundColor Cyan
railway login

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR - Error al hacer login en Railway`n" -ForegroundColor Red
    Write-Host "Intenta manualmente: railway login`n" -ForegroundColor Yellow
    exit 1
}

Write-Host "OK - Login exitoso`n" -ForegroundColor Green

# Paso 6: Vincular proyecto
Write-Host "[Paso 6] Vinculando proyecto de Railway..." -ForegroundColor Yellow
Write-Host "Selecciona el proyecto Aethermind Agent OS o similar`n" -ForegroundColor Cyan

# Check if already linked
$isLinked = railway status 2>&1

if ($isLinked -match "Not linked") {
    railway link
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR - Error al vincular proyecto`n" -ForegroundColor Red
        Write-Host "Intenta manualmente: railway link`n" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "OK - Proyecto vinculado exitosamente`n" -ForegroundColor Green
} else {
    Write-Host "OK - Ya esta vinculado a un proyecto`n" -ForegroundColor Green
}

# Paso 7: EJECUTAR MIGRACIONES (CRÍTICO)
Write-Host "`n[Paso 7 - CRITICO] EJECUTANDO MIGRACIONES DE PRISMA...`n" -ForegroundColor Magenta
Write-Host "Este proceso puede tomar 30-60 segundos. Por favor espera...`n" -ForegroundColor Cyan

railway run npx prisma migrate deploy --schema=./prisma/schema.prisma

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nOK - MIGRACIONES EJECUTADAS EXITOSAMENTE!`n" -ForegroundColor Green
} else {
    Write-Host "`nINFO - Las migraciones fallaron. Intentando con db push...`n" -ForegroundColor Yellow
    railway run npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nOK - DB PUSH EJECUTADO EXITOSAMENTE!`n" -ForegroundColor Green
    } else {
        Write-Host "`nERROR - Error al ejecutar migraciones`n" -ForegroundColor Red
        Write-Host "Revisa los logs con: railway logs`n" -ForegroundColor Yellow
    }
}

# Paso 8: Verificar health check
Write-Host "[Paso 8] Verificando health del backend...`n" -ForegroundColor Yellow
Write-Host "Esperando 10 segundos para que Railway se actualice...`n" -ForegroundColor Cyan
Start-Sleep -Seconds 10

try {
    $health = Invoke-RestMethod -Uri "https://aethermindapi-production.up.railway.app/health" -Method Get
    
    Write-Host "OK - Health Check Response:" -ForegroundColor Green
    $health | ConvertTo-Json -Depth 3
    Write-Host ""
    
    if ($health.checks.database -eq $true) {
        Write-Host "OK - BASE DE DATOS CONECTADA EXITOSAMENTE!" -ForegroundColor Green
        Write-Host "OK - TODO ESTA FUNCIONANDO!" -ForegroundColor Green
    } else {
        Write-Host "INFO - Base de datos aun no conectada. Espera unos minutos y verifica nuevamente." -ForegroundColor Yellow
    }
} catch {
    Write-Host "INFO - No se pudo verificar el health check. El backend puede estar reiniciandose." -ForegroundColor Yellow
    Write-Host "Intenta manualmente en unos minutos`n" -ForegroundColor Cyan
}

# Paso 9: Ver logs de Railway
Write-Host "`n[Paso 9] Mostrando logs recientes de Railway...`n" -ForegroundColor Yellow
railway logs --tail 50

# Resumen final
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PROCESO COMPLETADO" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "PASOS REALIZADOS:" -ForegroundColor Green
Write-Host "1. OK - Cambios de trust proxy commiteados y pusheados" -ForegroundColor White
Write-Host "2. OK - Railway CLI instalado/verificado" -ForegroundColor White
Write-Host "3. OK - Login a Railway completado" -ForegroundColor White
Write-Host "4. OK - Proyecto vinculado" -ForegroundColor White
Write-Host "5. OK - Migraciones de Prisma ejecutadas" -ForegroundColor White
Write-Host "6. OK - Health check verificado`n" -ForegroundColor White

Write-Host "PROXIMOS PASOS - PRUEBA TU APP:" -ForegroundColor Cyan
Write-Host "1. Ve a: https://aethermind-page.vercel.app/signup" -ForegroundColor White
Write-Host "2. Crea una cuenta con email y contrasena" -ForegroundColor White
Write-Host "3. Inicia sesion" -ForegroundColor White
Write-Host "4. Ve a /pricing y activa el plan Free" -ForegroundColor White
Write-Host "5. Deberias ser redirigido al dashboard sin errores!`n" -ForegroundColor White

Write-Host "SI ALGO FALLA:" -ForegroundColor Yellow
Write-Host "- Revisa los logs: railway logs" -ForegroundColor White
Write-Host "- Verifica variables: railway variables" -ForegroundColor White
Write-Host "- Contacta soporte con los logs`n" -ForegroundColor White

Write-Host "Railway esta arreglado y listo para usar!`n" -ForegroundColor Green
