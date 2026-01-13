# Generador de Secretos para Aethermind Backend
# Genera JWT_SECRET y SESSION_SECRET seguros

Write-Host "Generador de Secretos para Aethermind Backend" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Funcion para generar un secreto aleatorio
function Generate-Secret {
    param (
        [int]$Length = 64
    )
    
    $characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    $secret = -join ((1..$Length) | ForEach-Object { $characters[(Get-Random -Minimum 0 -Maximum $characters.Length)] })
    return $secret
}

# Generar JWT_SECRET
$jwtSecret = Generate-Secret -Length 64
Write-Host "JWT_SECRET generado:" -ForegroundColor Green
Write-Host $jwtSecret -ForegroundColor Yellow
Write-Host ""

# Generar SESSION_SECRET
$sessionSecret = Generate-Secret -Length 64
Write-Host "SESSION_SECRET generado:" -ForegroundColor Green  
Write-Host $sessionSecret -ForegroundColor Yellow
Write-Host ""

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "IMPORTANTE: Copia estos secretos y agregalos a las Environment Variables de Koyeb" -ForegroundColor Red
Write-Host "NUNCA los compartas ni los subas a Git" -ForegroundColor Red
Write-Host ""

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Variables de entorno para Koyeb:" -ForegroundColor Cyan
Write-Host ""
Write-Host "JWT_SECRET=$jwtSecret"
Write-Host "SESSION_SECRET=$sessionSecret"
Write-Host "NODE_ENV=production"
Write-Host "PORT=3001"
Write-Host "DATABASE_URL=postgresql://usuario:password@host:5432/dbname"
Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Listo! Ahora puedes deployar en Koyeb" -ForegroundColor Green
