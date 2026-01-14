# ========================================
# SCRIPT: Crear Usuario Admin en Railway
# ========================================

Write-Host "`nCREANDO USUARIO ADMIN EN RAILWAY`n" -ForegroundColor Cyan

# Verificar que Railway CLI este instalado
$railwayCLI = Get-Command railway -ErrorAction SilentlyContinue

if (!$railwayCLI) {
    Write-Host "ERROR - Railway CLI no esta instalado" -ForegroundColor Red
    Write-Host "Instala con: npm install -g @railway/cli`n" -ForegroundColor Yellow
    exit 1
}

Write-Host "OK - Railway CLI instalado`n" -ForegroundColor Green

# Login a Railway
Write-Host "[Paso 1] Verificando login en Railway..." -ForegroundColor Yellow
railway whoami 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "INFO - No estas logueado. Iniciando sesion..." -ForegroundColor Yellow
    railway login
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR - Error al hacer login`n" -ForegroundColor Red
        exit 1
    }
}

Write-Host "OK - Estas logueado en Railway`n" -ForegroundColor Green

# Verificar que estamos vinculados al proyecto
Write-Host "[Paso 2] Verificando vinculacion del proyecto..." -ForegroundColor Yellow
$isLinked = railway status 2>&1

if ($isLinked -match "Not linked") {
    Write-Host "INFO - No estas vinculado a un proyecto. Vinculando..." -ForegroundColor Yellow
    railway link
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR - Error al vincular proyecto`n" -ForegroundColor Red
        exit 1
    }
}

Write-Host "OK - Proyecto vinculado`n" -ForegroundColor Green

# PASO CRÍTICO: Ejecutar migraciones primero
Write-Host "`n[Paso 3 - CRITICO] Ejecutando migraciones de Prisma...`n" -ForegroundColor Magenta
Write-Host "Esto es necesario para que existan las tablas en la base de datos.`n" -ForegroundColor Cyan
Write-Host "Puede tomar 30-60 segundos...`n" -ForegroundColor Cyan

railway run npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss --skip-generate

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nOK - Migraciones ejecutadas exitosamente!`n" -ForegroundColor Green
} else {
    Write-Host "`nERROR - Las migraciones fallaron`n" -ForegroundColor Red
    Write-Host "No se puede continuar sin migraciones. Revisa los logs.`n" -ForegroundColor Yellow
    railway logs --tail 100
    exit 1
}

# Crear script de creación de usuario admin
Write-Host "[Paso 4] Creando script para usuario admin..." -ForegroundColor Yellow

$scriptContent = @'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { randomBytes } = require('crypto');

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    const email = 'admin@aethermind.com';
    const password = 'Admin123!';
    
    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } });
    
    if (existing) {
      console.log('Usuario admin ya existe:', email);
      console.log('ID:', existing.id);
      console.log('Email:', existing.email);
      console.log('Plan:', existing.plan);
      return;
    }
    
    // Create admin user
    const passwordHash = await bcrypt.hash(password, 10);
    const apiKey = `aethermind_${randomBytes(32).toString('hex')}`;
    
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        apiKey,
        name: 'Admin User',
        plan: 'enterprise',
        usageLimit: 999999,
        usageCount: 0,
        emailVerified: true,
        subscriptionStatus: 'active',
        hasCompletedOnboarding: true,
        maxAgents: 999,
        logRetentionDays: 365,
        firstLoginAt: new Date(),
        lastLoginAt: new Date(),
      },
    });
    
    console.log('\n=================================');
    console.log('USUARIO ADMIN CREADO EXITOSAMENTE');
    console.log('=================================\n');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Plan:', user.plan);
    console.log('API Key:', user.apiKey);
    console.log('\nGUARDA ESTAS CREDENCIALES EN UN LUGAR SEGURO!\n');
    
  } catch (error) {
    console.error('Error creando usuario admin:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
'@

# Guardar script temporalmente
$scriptPath = "./temp-create-admin.js"
$scriptContent | Out-File -FilePath $scriptPath -Encoding UTF8

Write-Host "OK - Script creado`n" -ForegroundColor Green

# Ejecutar script en Railway
Write-Host "[Paso 5] Ejecutando script de creacion de usuario en Railway...`n" -ForegroundColor Yellow
Write-Host "Esto puede tomar unos segundos...`n" -ForegroundColor Cyan

railway run node $scriptPath

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nOK - Usuario admin creado exitosamente!`n" -ForegroundColor Green
} else {
    Write-Host "`nERROR - Error al crear usuario admin`n" -ForegroundColor Red
    Write-Host "Revisa los logs para mas detalles`n" -ForegroundColor Yellow
}

# Limpiar archivo temporal
Remove-Item $scriptPath -ErrorAction SilentlyContinue

# Verificar health check
Write-Host "[Paso 6] Verificando estado del backend...`n" -ForegroundColor Yellow

try {
    $health = Invoke-RestMethod -Uri "https://aethermindapi-production.up.railway.app/health" -Method Get
    
    Write-Host "Health Check:" -ForegroundColor Green
    $health | ConvertTo-Json -Depth 3
    Write-Host ""
    
    if ($health.checks.database -eq $true) {
        Write-Host "OK - Base de datos conectada!`n" -ForegroundColor Green
    } else {
        Write-Host "WARNING - Base de datos no conectada`n" -ForegroundColor Yellow
    }
} catch {
    Write-Host "WARNING - No se pudo verificar health check`n" -ForegroundColor Yellow
}

# Resumen
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PROCESO COMPLETADO" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "CREDENCIALES DEL USUARIO ADMIN:" -ForegroundColor Green
Write-Host "Email: admin@aethermind.com" -ForegroundColor White  
Write-Host "Password: Admin123!" -ForegroundColor White
Write-Host "Plan: enterprise (todos los permisos)" -ForegroundColor White
Write-Host ""

Write-Host "COMO USAR:" -ForegroundColor Cyan
Write-Host "1. Ve a: https://aethermind-page.vercel.app/login" -ForegroundColor White
Write-Host "2. Ingresa el email y password de arriba" -ForegroundColor White
Write-Host "3. Deberias poder acceder sin problemas" -ForegroundColor White
Write-Host "4. CAMBIA LA CONTRASENA inmediatamente por seguridad!`n" -ForegroundColor Yellow

Write-Host "SI SIGUE FALLANDO:" -ForegroundColor Yellow
Write-Host "- Revisa los logs: railway logs" -ForegroundColor White
Write-Host "- Verifica health: curl https://aethermindapi-production.up.railway.app/health" -ForegroundColor White
Write-Host "- Espera 2-3 minutos y vuelve a intentar`n" -ForegroundColor White

Write-Host "Todo listo!`n" -ForegroundColor Green
