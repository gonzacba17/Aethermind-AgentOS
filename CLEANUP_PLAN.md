# 🧹 PLAN DE LIMPIEZA - Aethermind AgentOS

## 📊 RESUMEN EJECUTIVO

**Fecha**: 2026-01-13  
**Archivos analizados**: ~58 archivos en `apps/api`, 151 en `packages/`, 31 en `scripts/`, 35 en `docs/`  
**Tiempo disponible**: A definir por usuario  
**Estrategia**: Moderada-Conservadora (Proyecto en producción/demo activo)

### Hallazgos Principales

- ❌ **5 archivos .env** en raíz (RIESGO SEGURIDAD)
- 🔄 **3 Dockerfiles** diferentes (consolidación necesaria)
- 📦 **Scripts de test duplicados** (`scripts/archive/` contiene 13 archivos legacy)
- 🏗️ **Documentación dispersa**: 21 archivos .md en `docs/` + 6 en raíz
- 🧪 **Tests mixtos**: Algunos tests en `tests/`, otros potencialmente en packages
- 📄 **Múltiples READMEs**: `scripts/README.md`, `docs/README.md`, raíz

### Impacto Estimado

- **Tiempo P0 (Quick Wins)**: 30-45 min
- **Tiempo P1 (Consolidación)**: 3-4 horas
- **Tiempo P2 (Reorganización)**: 6-8 horas
- **Riesgo**: 🟡 MEDIO (proyecto con deployment activo)
- **Requiere tests**: SÍ (verificar después de cada cambio)

---

## 📋 RESPUESTAS AL DESCUBRIMIENTO

**1. Tipo de proyecto**: **MONOREPO** (Turborepo + pnpm workspaces)

- `apps/api` (Node.js/Express/TypeScript backend)
- `packages/` con 9 paquetes (dashboard, agent, core, sdk, types, etc.)
- `examples/` con casos de uso

**2. Stack principal**:

- **Frontend**: Next.js 14 + React 18 + Tailwind CSS (`packages/dashboard`)
- **Backend**: Node.js 18+ + Express + TypeScript (`apps/api`)
- **Base de datos**: PostgreSQL + Prisma 6.19
- **Build**: Turborepo + pnpm 9
- **Deploy**: Vercel (frontend), Railway/Koyeb (backend - docs presentes)
- **Monitoring**: Sentry + Prometheus

**3. Tiempo disponible**: **A CONFIRMAR CON USUARIO**

**4. Preocupaciones detectadas**:

- ⚠️ **CRÍTICO**: Múltiples archivos `.env` (potencial exposición de secrets)
- 📁 **Archivos obsoletos**: `scripts/archive/` con 13 archivos legacy
- 🏗️ **Estructura**: Dockerfiles múltiples, docs dispersos
- 📦 **Dependencias**: Revisar (no detectados problemas obvios aún)
- 🧪 **Tests**: Estructura mixta entre `tests/` y packages individuales
- 📄 **Documentación**: Múltiples READMEs y guías de deployment redundantes

**5. Tests**:

- ✅ Existen tests: `tests/api/`, `tests/e2e/`, `tests/unit/`, `tests/integration/`, `tests/websocket/`
- ⚠️ Estado: Algunos packages reportan "No tests in core package"
- 📝 Build funciona (se vio en ejecución de `pnpm test`)

---

## INVENTARIO DE PROBLEMAS

### 🔴 P0: SEGURIDAD CRÍTICA (HACER AHORA - 15 min)

| Archivo                    | Razón                       | Riesgo     | Acción                                                                 |
| -------------------------- | --------------------------- | ---------- | ---------------------------------------------------------------------- |
| `.env` (raíz)              | **Commiteado con secretos** | 🔴 CRÍTICO | Verificar si tiene secretos reales, eliminar de git, mover a gitignore |
| `.env.sentry-build-plugin` | Potencial API key expuesta  | 🔴 ALTO    | Verificar contenido, eliminar si tiene secretos                        |

**Comandos sugeridos**:

```powershell
# 1. PRIMERO: Verificar si .env tiene secretos reales
Get-Content .env

# 2. Si tiene secretos, limpiar historial de git (CUIDADO)
# Solo si confirmamos que hay secretos reales commiteados
# git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env" --prune-empty --tag-name-filter cat -- --all

# 3. Mover .env a .env.local (no trackeado)
Move-Item .env .env.local -Force

# 4. Actualizar .gitignore
Add-Content .gitignore "`n# Environment variables`n.env`n.env.local`n.env.*.local"

# 5. Commit
git add .gitignore
git commit -m "security: remove .env from tracking, update gitignore"
```

**⚠️ VALIDACIÓN REQUERIDA**: El usuario debe verificar el contenido de `.env` antes de proceder.

---

### ❌ P0: ELIMINAR (Tiempo: 15-20 min)

#### Archivos Obsoletos

| Archivo/Carpeta                  | Razón                         | Riesgo  | Acción                                    |
| -------------------------------- | ----------------------------- | ------- | ----------------------------------------- |
| `scripts/archive/` (13 archivos) | Archivos legacy ya archivados | 🟢 BAJO | Revisar si algo se usa, luego eliminar    |
| `backups/` (si vacía o antigua)  | Backups locales               | 🟢 BAJO | Verificar contenido, eliminar si obsoleto |

**Comandos sugeridos**:

```powershell
# 1. Revisar contenido de archive
Get-ChildItem scripts\archive -Recurse | Format-Table Name, LastWriteTime

# 2. Buscar referencias a archivos en archive
Select-String -Path "apps\**\*.ts","apps\**\*.js","packages\**\*.ts","packages\**\*.js" -Pattern "scripts/archive" -List

# 3. Si no hay referencias, eliminar
git rm -r scripts/archive
git commit -m "chore: remove archived legacy scripts"

# 4. Verificar backups/
Get-ChildItem backups -Recurse

# 5. Si está vacía o con archivos >3 meses
git rm -r backups
git commit -m "chore: remove old backups folder"
```

---

### 🔄 P1: CONSOLIDAR (Tiempo: 2-3 horas)

#### Caso 1: Múltiples Dockerfiles

**Problema**: 3 Dockerfiles diferentes sin clara distinción de propósito

```
Dockerfile           (2699 bytes)
Dockerfile.prisma    (367 bytes)
Dockerfile.railway   (3288 bytes)
```

**Propuesta**:

```
docker/
├── Dockerfile              # Build principal (multi-stage)
├── Dockerfile.migrations   # Solo para migraciones Prisma
└── railway.Dockerfile      # Específico para Railway deployment
```

**Pasos**:

1. Crear carpeta `docker/` en raíz
2. Analizar cada Dockerfile para entender diferencias
3. Consolidar en un solo multi-stage Dockerfile con targets:
   - `base`: Dependencias comunes
   - `development`: Para desarrollo local
   - `production`: Build optimizado
   - `migrations`: Solo Prisma
4. Mover Railway-specific a `docker/railway.Dockerfile`
5. Actualizar `docker-compose.yml` para usar nuevo path
6. Actualizar docs de deployment

**Archivos a actualizar**:

- `docker-compose.yml` (línea ~5-10, build context)
- `KOYEB_DEPLOYMENT_GUIDE.md` (referencias a Dockerfile)
- `docs/DEPLOYMENT.md` (actualizar paths)
- `railway.json` (si referencia Dockerfile)

**Riesgo**: 🟡 MEDIO (puede romper CI/CD si no actualizamos todos los paths)

**Validación**:

```powershell
# Test build local
docker build -f docker/Dockerfile --target development -t aethermind-dev .
docker build -f docker/Dockerfile --target production -t aethermind-prod .

# Verificar docker-compose
docker-compose build
```

---

#### Caso 2: Documentación Dispersa

**Problema**: Documentación en múltiples ubicaciones sin jerarquía clara

**Archivos en raíz** (6):

- `README.md` (principal)
- `DECISION_MATRIX.md`
- `MIGRATION_GUIDE.md`
- `KOYEB_DEPLOYMENT_GUIDE.md`
- `SECURITY_AUDIT_EXECUTIVE_SUMMARY.md`
- `SECURITY_AUDIT_REPORT.md`
- `VALUE_PROPOSITION.md`
- `VERCEL_COMPATIBILITY_ANALYSIS.md`

**Archivos en docs/** (21):

- `API.md`, `ARCHITECTURE.md`, `DEPLOYMENT.md`, etc.

**Propuesta**:

```
docs/
├── README.md                          # Índice de documentación
├── getting-started/
│   ├── INSTALLATION.md               # Movido desde docs/
│   └── QUICK_START_DEPLOYMENT.md
├── architecture/
│   ├── ARCHITECTURE.md
│   ├── ESTRUCTURA.md
│   └── DECISION_MATRIX.md            # Movido desde raíz
├── deployment/
│   ├── DEPLOYMENT.md
│   ├── KOYEB_DEPLOYMENT_GUIDE.md     # Movido desde raíz
│   ├── VERCEL-CHECKLIST.md
│   └── RAILWAY-CHECKLIST.md
├── security/
│   ├── SECURITY.md
│   ├── SECURITY_AUDIT_REPORT.md      # Movido desde raíz
│   └── SECURITY_AUDIT_EXECUTIVE_SUMMARY.md
├── development/
│   ├── DEVELOPMENT.md
│   ├── TESTING.md
│   └── MIGRATION_GUIDE.md            # Movido desde raíz
├── api/
│   ├── API.md
│   └── openapi.yaml
├── audits/                            # Ya existe
└── archive/                           # Ya existe

# Mantener en raíz:
README.md                  # Principal
VALUE_PROPOSITION.md       # Documento de negocio
VERCEL_COMPATIBILITY_ANALYSIS.md  # Análisis técnico específico (puede ir a docs/deployment/)
```

**Riesgo**: 🟢 BAJO (solo mover archivos, no afecta código)

**Comandos**:

```powershell
# Crear estructura
New-Item -ItemType Directory -Force docs\getting-started
New-Item -ItemType Directory -Force docs\architecture
New-Item -ItemType Directory -Force docs\deployment
New-Item -ItemType Directory -Force docs\security
New-Item -ItemType Directory -Force docs\development

# Mover archivos (con git mv para mantener historial)
git mv DECISION_MATRIX.md docs\architecture\
git mv MIGRATION_GUIDE.md docs\development\
git mv KOYEB_DEPLOYMENT_GUIDE.md docs\deployment\
git mv SECURITY_AUDIT_EXECUTIVE_SUMMARY.md docs\security\
git mv SECURITY_AUDIT_REPORT.md docs\security\
git mv VERCEL_COMPATIBILITY_ANALYSIS.md docs\deployment\

# Mover archivos de docs/ a subcarpetas
git mv docs\INSTALLATION.md docs\getting-started\
git mv docs\QUICK_START_DEPLOYMENT.md docs\getting-started\
git mv docs\ARCHITECTURE.md docs\architecture\
git mv docs\ESTRUCTURA.md docs\architecture\
git mv docs\DEPLOYMENT.md docs\deployment\
git mv docs\VERCEL-CHECKLIST.md docs\deployment\
git mv docs\RAILWAY-CHECKLIST.md docs\deployment\
git mv docs\DEVELOPMENT.md docs\development\
git mv docs\TESTING.md docs\development\
git mv docs\SECURITY.md docs\security\
git mv docs\API.md docs\api\
git mv docs\openapi.yaml docs\api\

# Actualizar referencias en README principal
# (Hacer manualmente o con script)

git commit -m "docs: reorganize documentation into logical folders"
```

**Actualizar Referencias**:

- Buscar todos los links a documentos movidos en README.md y otros archivos

```powershell
Select-String -Path "README.md","docs\**\*.md" -Pattern "DEPLOYMENT\.md|KOYEB_DEPLOYMENT|SECURITY_AUDIT" -List
```

---

#### Caso 3: Scripts de Test Redundantes

**Problema**: Múltiples archivos de test en `scripts/` con propósitos similares

**Scripts actuales**:

- `test-e2e-pipeline.ts` (usado en package.json)
- `scripts/archive/test-*.js` (7 archivos)
- `test-aethermind-api.sh`
- `test-with-auth.sh`

**Propuesta**:

```
scripts/
├── test/
│   ├── e2e-pipeline.ts              # Renombrado de test-e2e-pipeline.ts
│   ├── api-integration.sh           # Renombrado de test-aethermind-api.sh
│   └── auth-flow.sh                 # Renombrado de test-with-auth.sh
├── db/
│   ├── migrate.js                   # migrate-db.js
│   ├── seed.js                      # Referencia de package.json
│   └── init.sql
├── dev/
│   ├── diagnose.ts
│   └── smoke-test.js
└── security/
    ├── generate-api-key.ts
    └── generate-production-secrets.ts
```

**Riesgo**: 🟡 MEDIO (requiere actualizar package.json)

**Pasos**:

1. Crear subcarpetas en `scripts/`
2. Mover archivos con `git mv`
3. Actualizar referencias en `package.json`
4. Verificar que `pnpm test:e2e` siga funcionando

---

### ✏️ P1: RENOMBRAR (Tiempo: 30 min)

| Actual                                   | Nuevo                     | Razón                                  | Impacto                    |
| ---------------------------------------- | ------------------------- | -------------------------------------- | -------------------------- |
| `inforapido.md`                          | `docs/QUICK_REFERENCE.md` | Estandarizar idioma inglés + ubicación | 0 imports (doc standalone) |
| `scripts/archive/legacy-key-generation/` | Eliminar o documentar     | Clarificar si es necesario             | 0 imports detectados       |

**Comando sugerido**:

```powershell
git mv inforapido.md docs\QUICK_REFERENCE.md
git commit -m "docs: rename inforapido.md to QUICK_REFERENCE.md for consistency"
```

---

### 📦 P2: DEPENDENCIAS (Tiempo: 1-2 horas)

#### Análisis de Duplicación en package.json

**Problema potencial**: Dependencias definidas en raíz Y en workspaces

**Detectado**:

- `@prisma/client` en raíz package.json (línea 43)
- `@prisma/client` en `apps/api/package.json` (línea 20)
- `@sentry/nextjs` en raíz (línea 44)
- `@sentry/nextjs` en `packages/dashboard/package.json` (línea 19)

**Recomendación**:

- Si es una dependencia compartida por TODOS los workspaces → Raíz
- Si solo la usa un workspace → Workspace específico
- Prisma y Sentry parecen compartidos → DEJAR EN RAÍZ, eliminar de workspaces individuales

**Validación**:

```powershell
# Encontrar dependencias duplicadas
$rootDeps = (Get-Content package.json | ConvertFrom-Json).dependencies.PSObject.Properties.Name
Get-ChildItem -Recurse -Filter "package.json" | ForEach-Object {
    $pkg = Get-Content $_.FullName | ConvertFrom-Json
    $pkg.dependencies.PSObject.Properties.Name | Where-Object { $rootDeps -contains $_ } | ForEach-Object {
        Write-Host "$($_.FullName): $_"
    }
}
```

**Acción**:

- Revisar output
- Eliminar duplicados de workspaces si están en raíz
- Ejecutar `pnpm install` para validar
- Verificar que `pnpm build` pase

---

## 🎯 RECOMENDACIONES PRIORIZADAS

### PRIORIDAD 0: HACER AHORA (< 30 min)

1. **🔴 CRÍTICO: Verificar y asegurar archivos .env** → 10 min → RIESGO SEGURIDAD
   ```powershell
   # Ver contenido
   Get-Content .env
   Get-Content .env.sentry-build-plugin
   ```
2. **Eliminar `scripts/archive/` si no tiene referencias** → 5 min → 🟢 Sin riesgo

   ```powershell
   Select-String -Path "**\*.ts","**\*.js" -Pattern "scripts/archive" -Exclude "CLEANUP_PLAN.md"
   # Si devuelve vacío:
   git rm -r scripts/archive
   git commit -m "chore: remove archived legacy scripts"
   ```

3. **Añadir entradas faltantes a .gitignore** → 5 min

   ```powershell
   # Verificar que estos estén en .gitignore
   @"
   # Environment variables
   .env
   .env.local
   .env.*.local
   !.env.example
   !.env.*.example

   # Logs
   logs/
   *.log

   # Backups
   backups/
   "@ | Add-Content .gitignore

   git add .gitignore
   git commit -m "chore: enhance .gitignore with env and backup exclusions"
   ```

---

### PRIORIDAD 1: ESTA SEMANA (3-4 horas)

1. **Consolidar Dockerfiles** → 2h → Mejora deployment consistency
2. **Reorganizar documentación** → 1.5h → Mejora navegabilidad
3. **Renombrar `inforapido.md`** → 5 min → Estandarización
4. **Organizar scripts en subcarpetas** → 1h → Claridad

---

### PRIORIDAD 2: ESTE MES (6-8 horas)

1. **Auditoría completa de dependencias duplicadas** → 2h
2. **Crear script de validación de estructura** → 2h

   - Script que verifique que no hay:
     - Archivos `.old` o `.backup`
     - Dependencias duplicadas
     - Links rotos en documentación
     - Secrets expuestos en archivos commiteados

3. **Implementar pre-commit hooks** → 2h

   - Verificar formato con Prettier
   - Verificar tipos con TypeScript
   - Bloquear commit de archivos .env

4. **Dividir archivos grandes si existen >800 líneas** → Variable
   ```powershell
   # Encontrar archivos grandes
   Get-ChildItem -Recurse -Include "*.ts","*.tsx","*.js" | Where-Object {
       (Get-Content $_.FullName | Measure-Object -Line).Lines -gt 800
   } | Select-Object FullName, @{Name="Lines";Expression={(Get-Content $_.FullName | Measure-Object -Line).Lines}}
   ```

---

### PRIORIDAD 3: BACKLOG

- **Migrar tests de carpeta raíz `tests/` a workspaces individuales**

  - `tests/api/` → `apps/api/src/__tests__/`
  - `tests/unit/` → packages correspondientes
  - Mantener `tests/e2e/` en raíz (son cross-workspace)

- **Consolidar configuraciones de Jest** (5 archivos en raíz)

  ```
  jest.config.js
  jest.e2e.config.js
  jest.integration.config.js
  jest.simple.config.js
  jest.unit.config.js
  ```

  → Mover a `jest/` folder con configs específicos

- **Crear monorepo documentation site** (Docusaurus o similar)
  - Consolidar todos los .md en sitio navegable
  - Incluir ejemplos interactivos

---

## ⚠️ ANTES DE EMPEZAR

### Checklist Obligatorio

- [ ] **Tests actuales pasan**: Ejecutar `pnpm test:all` y verificar
- [ ] **No hay cambios sin commitear**: `git status` debe estar limpio
- [ ] **Crear branch de respaldo**:
  ```powershell
  git checkout -b backup-cleanup-20260113
  git push origin backup-cleanup-20260113
  ```
- [ ] **Branch de trabajo**:
  ```powershell
  git checkout main
  git pull origin main
  git checkout -b cleanup/p0-security-and-quick-wins
  ```
- [ ] **Equipo está informado** (si es colaborativo)

### Verificación de Estado Actual

```powershell
# 1. Ver estado de git
git status

# 2. Ver última build
pnpm build

# 3. Verificar tests (puede tomar tiempo)
pnpm test

# 4. Ver estructura actual
tree /F /A > estructura-antes.txt
```

---

## 🚀 ORDEN DE EJECUCIÓN SUGERIDO

### ✅ Fase 1: Seguridad y Quick Wins (commits separados)

```powershell
# ========================================
# PASO 1: Verificar archivos .env
# ========================================
Write-Host "=== PASO 1: Verificando archivos .env ===" -ForegroundColor Yellow

# Ver contenido de .env (REVISAR MANUALMENTE si hay secretos reales)
Get-Content .env

# Ver contenido de .env.sentry-build-plugin
Get-Content .env.sentry-build-plugin

# SI TIENE SECRETOS REALES (como DATABASE_URL con passwords, API keys reales):
# → Seguir con limpieza
# SI NO TIENE SECRETOS (solo ejemplos o valores locales):
# → Pue mover a .env.local de todas formas para mejor práctica

# ========================================
# PASO 2: Mover .env a .env.local
# ========================================
Write-Host "=== PASO 2: Asegurando archivos .env ===" -ForegroundColor Yellow

Move-Item .env .env.local -Force -ErrorAction SilentlyContinue

# ========================================
# PASO 3: Actualizar .gitignore
# ========================================
Write-Host "=== PASO 3: Actualizando .gitignore ===" -ForegroundColor Yellow

$gitignoreAdditions = @"

# Environment variables
.env
.env.local
.env.*.local
!.env.example
!.env.*.example

# Logs
logs/
*.log

# Backups
backups/
"@

Add-Content .gitignore $gitignoreAdditions

git add .gitignore
git commit -m "chore: enhance .gitignore to exclude .env files and backups"

# ========================================
# PASO 4: Eliminar scripts/archive (si no se usa)
# ========================================
Write-Host "=== PASO 4: Buscando referencias a scripts/archive ===" -ForegroundColor Yellow

# Buscar referencias
$archiveRefs = Select-String -Path "apps\**\*.ts","apps\**\*.js","packages\**\*.ts","packages\**\*.js","*.json" -Pattern "scripts/archive|scripts\\archive" -ErrorAction SilentlyContinue

if ($archiveRefs.Count -eq 0) {
    Write-Host "No se encontraron referencias. Seguro para eliminar." -ForegroundColor Green
    git rm -r scripts/archive
    git commit -m "chore: remove archived legacy scripts (no references found)"
} else {
    Write-Host "ADVERTENCIA: Se encontraron referencias:" -ForegroundColor Red
    $archiveRefs | Format-Table -AutoSize
    Write-Host "Revisar manualmente antes de eliminar" -ForegroundColor Yellow
}

# ========================================
# PASO 5: Limpiar backups/ si está vacío o antiguo
# ========================================
Write-Host "=== PASO 5: Revisando carpeta backups/ ===" -ForegroundColor Yellow

$backupItems = Get-ChildItem backups -Recurse -ErrorAction SilentlyContinue
if ($backupItems.Count -eq 0) {
    Write-Host "Carpeta backups/ está vacía. Eliminando..." -ForegroundColor Green
    git rm -r backups
    git commit -m "chore: remove empty backups directory"
} else {
    Write-Host "Carpeta backups/ contiene $($backupItems.Count) archivos:" -ForegroundColor Yellow
    $backupItems | Format-Table Name, LastWriteTime -AutoSize
    Write-Host "Revisar manualmente si son necesarios" -ForegroundColor Yellow
}

# ========================================
# PASO 6: Verificar build
# ========================================
Write-Host "=== PASO 6: Verificando build ===" -ForegroundColor Yellow
pnpm build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build pasó correctamente" -ForegroundColor Green
} else {
    Write-Host "❌ Build falló. Revisar errores antes de continuar" -ForegroundColor Red
    exit 1
}
```

---

### ✅ Fase 2: Reorganización de Documentación

```powershell
# ========================================
# PASO 1: Crear estructura de carpetas
# ========================================
Write-Host "=== Creando estructura de carpetas docs/ ===" -ForegroundColor Yellow

New-Item -ItemType Directory -Force docs\getting-started
New-Item -ItemType Directory -Force docs\architecture
New-Item -ItemType Directory -Force docs\deployment
New-Item -ItemType Directory -Force docs\security
New-Item -ItemType Directory -Force docs\development
New-Item -ItemType Directory -Force docs\api

# ========================================
# PASO 2: Mover archivos de raíz a docs/
# ========================================
Write-Host "=== Moviendo archivos de raíz a docs/ ===" -ForegroundColor Yellow

git mv DECISION_MATRIX.md docs\architecture\
git mv MIGRATION_GUIDE.md docs\development\
git mv KOYEB_DEPLOYMENT_GUIDE.md docs\deployment\
git mv SECURITY_AUDIT_EXECUTIVE_SUMMARY.md docs\security\
git mv SECURITY_AUDIT_REPORT.md docs\security\
git mv VERCEL_COMPATIBILITY_ANALYSIS.md docs\deployment\
git mv inforapido.md docs\QUICK_REFERENCE.md

# ========================================
# PASO 3: Reorganizar archivos dentro de docs/
# ========================================
Write-Host "=== Reorganizando archivos en docs/ ===" -ForegroundColor Yellow

git mv docs\INSTALLATION.md docs\getting-started\
git mv docs\QUICK_START_DEPLOYMENT.md docs\getting-started\
git mv docs\ARCHITECTURE.md docs\architecture\
git mv docs\ESTRUCTURA.md docs\architecture\
git mv docs\DEPLOYMENT.md docs\deployment\
git mv docs\DEPLOYMENT-SAAS.md docs\deployment\
git mv docs\VERCEL-CHECKLIST.md docs\deployment\
git mv docs\RAILWAY-CHECKLIST.md docs\deployment\
git mv docs\DEVELOPMENT.md docs\development\
git mv docs\TESTING.md docs\development\
git mv docs\VERIFICATION.md docs\development\
git mv docs\MANUAL_TESTING.md docs\development\
git mv docs\SECURITY.md docs\security\
git mv docs\API.md docs\api\
git mv docs\openapi.yaml docs\api\
git mv docs\api-spec-ingestion.yml docs\api\

# ========================================
# PASO 4: Commit
# ========================================
git commit -m "docs: reorganize documentation into logical folders"

# ========================================
# PASO 5: Buscar y listar referencias rotas
# ========================================
Write-Host "=== Buscando referencias a archivos movidos ===" -ForegroundColor Yellow

$movedFiles = @(
    "DECISION_MATRIX.md",
    "MIGRATION_GUIDE.md",
    "KOYEB_DEPLOYMENT_GUIDE.md",
    "SECURITY_AUDIT_EXECUTIVE_SUMMARY.md",
    "SECURITY_AUDIT_REPORT.md",
    "VERCEL_COMPATIBILITY_ANALYSIS.md",
    "inforapido.md",
    "INSTALLATION.md",
    "DEPLOYMENT.md"
)

foreach ($file in $movedFiles) {
    Write-Host "`nBuscando referencias a $file..." -ForegroundColor Cyan
    Select-String -Path "README.md","docs\**\*.md" -Pattern $file -List -ErrorAction SilentlyContinue
}

Write-Host "`n⚠️ ACCIÓN REQUERIDA: Actualizar manualmente los links encontrados arriba" -ForegroundColor Yellow
```

**Nota**: Después de ejecutar, actualizar manualmente los links en README.md y otros archivos que referencien documentos movidos.

---

## 📊 CRITERIOS DE ÉXITO

Al finalizar P0 + P1, deberías tener:

- ✅ **Seguridad**: No hay archivos .env trackeados en git
- ✅ **Limpieza**: Sin carpetas `archive/` o `backups/` obsoletas
- ✅ **Documentación**: Estructura lógica en `docs/` con subcarpetas
- ✅ **Consistencia**: Archivos en inglés, nombres estandarizados
- ✅ **Tests pasando**: `pnpm build` y `pnpm test` exitosos
- ✅ **Commits atómicos**: Historial claro con mensajes descriptivos
- ✅ **Documentación actualizada**: Links funcionando correctamente

**Métrica de éxito**:

- Un desarrollador nuevo puede navegar `docs/` y encontrar deployment/architecture/security en <3 minutos
- No hay warnings de seguridad en archivos commiteados
- Estructura es clara y predecible

---

## 📋 COMANDOS ÚTILES DE VERIFICACIÓN

### Encontrar Archivos Grandes

```powershell
Get-ChildItem -Recurse -Include "*.ts","*.tsx","*.js","*.jsx" | Where-Object {
    (Get-Content $_.FullName | Measure-Object -Line).Lines -gt 500
} | Select-Object FullName, @{Name="Lines";Expression={(Get-Content $_.FullName | Measure-Object -Line).Lines}} | Sort-Object Lines -Descending
```

### Encontrar TODOs

```powershell
Select-String -Path "**\*.ts","**\*.tsx","**\*.js" -Pattern "TODO|FIXME|HACK|XXX" | Format-Table -AutoSize
```

### Análisis de Dependencias Duplicadas

```powershell
# Listar todas las dependencias de todos los packages
Get-ChildItem -Recurse -Filter "package.json" | ForEach-Object {
    $pkg = Get-Content $_.FullName | ConvertFrom-Json
    [PSCustomObject]@{
        Package = $pkg.name
        Path = $_.DirectoryName
        Dependencies = $pkg.dependencies.PSObject.Properties.Name -join ", "
    }
} | Format-Table -AutoSize
```

### Top 10 Archivos Más Grandes

```powershell
Get-ChildItem -Recurse -File | Sort-Object Length -Descending | Select-Object -First 10 FullName, @{Name="Size(MB)";Expression={[math]::Round($_.Length / 1MB, 2)}}
```

### Verificar Secrets Expuestos (básico)

```powershell
# Buscar patrones sospechosos
Select-String -Path "**\*.ts","**\*.js","**\*.json" -Pattern "password\s*=|api_key\s*=|secret\s*=|token\s*=" -Exclude "node_modules\**","dist\**" | Format-Table -AutoSize
```

---

## ❓ FAQ RÁPIDO

**P: ¿Puedo hacer todo de una vez?**  
R: **NO**. Hazlo por fases con commits separados. Si algo falla, rollback es más fácil.

**P: ¿Qué hago si no tengo tiempo para todo?**  
R: **Solo P0**. Lo crítico es seguridad (.env) y quick wins. El resto puede esperar.

**P: ¿Cómo sé si un archivo es seguro eliminar?**  
R: Búscalo en todo el proyecto:

```powershell
Select-String -Path "**\*.ts","**\*.js","*.json" -Pattern "nombre-del-archivo" -Exclude "CLEANUP_PLAN.md"
```

Si no aparece, probablemente sea seguro.

**P: ¿Y si rompo algo?**  
R: Por eso creaste el branch `backup-cleanup-20260113`. Rollback:

```powershell
git checkout backup-cleanup-20260113
```

**P: ¿Debo hacer esto en main o en una branch?**  
R: **SIEMPRE en branch separada**. Ejemplo:

```powershell
git checkout -b cleanup/p0-security-fixes
# Hacer cambios
git push origin cleanup/p0-security-fixes
# Crear PR para revisión
```

**P: ¿Qué pasa con los archivos en español?**  
R: `ESTRUCTURA.md` y `AUDITORIA_TECNICA.md` están en español. Si el proyecto es internacional, considerar traducir a inglés o mantener ambas versiones.

---

## 🎯 PRÓXIMOS PASOS RECOMENDADOS

**Después de completar este plan**:

1. **Automatizar validaciones**:

   - Crear script PowerShell que verifique:
     - No hay archivos .env trackeados
     - No hay TODOs de más de 90 días
     - No hay links rotos en docs
     - No hay dependencias duplicadas

2. **Implementar Husky hooks**:

   - Pre-commit: Verificar formato, types, no secrets
   - Pre-push: Ejecutar tests unitarios

3. **Configurar Renovate/Dependabot**:

   - Auto-update de dependencias
   - PRs automáticos para security patches

4. **Documentación viva**:

   - Considerar Docusaurus o VitePress para docs/
   - Auto-generar API docs desde TypeScript con TypeDoc

5. **Monitoreo continuo**:
   - GitHub Actions workflow que ejecute validación de estructura cada semana
   - Alertas si se detectan archivos prohibidos (.env, .backup, etc.)

---

**Versión del Plan**: 1.0  
**Generado**: 2026-01-13  
**Proyecto**: Aethermind AgentOS (Monorepo)  
**Próxima Revisión**: Después de completar P0 y P1

---

## 🚦 ESTADO ACTUAL: ESPERANDO CONFIRMACIÓN DEL USUARIO

**Para proceder**:

1. ✅ **Revisar este plan completo**
2. ✅ **Confirmar tiempo disponible** (P0 solo, P0+P1, o todo)
3. ✅ **Verificar contenido de archivos .env manualmente**
4. ✅ **Decidir si proceder con scripts automatizados o paso a paso**

**Responder**:

- "Comenzar con P0" → Ejecutaré comandos de Prioridad 0
- "Comenzar con P0 + P1" → Ejecutaré P0 y luego P1
- "Solo quiero el plan, yo ejecuto" → Este documento es suficiente
- "Necesito más detalle en [área específica]" → Ampliaré esa sección
