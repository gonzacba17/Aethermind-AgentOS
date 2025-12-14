# 🧹 PLAN DE LIMPIEZA - Aethermind AgentOS

## 📊 RESUMEN EJECUTIVO

**Fecha**: 2025-12-14  
**Archivos analizados**: 12 packages + 178 test files + 24 docs  
**Tipo de proyecto**: **Monorepo** (Turborepo + pnpm workspaces)  
**Stack**: **TypeScript/Node.js** (Next.js + Express + Prisma)  
**Estado actual**: En desarrollo activo (recent commits: fix build, auditorías QA)  
**Estrategia**: **Conservadora** (proyecto en auditoría, evitar cambios disruptivos)

### Hallazgos Principales
- ❌ **2 archivos de auditoría duplicados** en raíz (~40KB)
- 🔄 **4 archivos de configuración Jest** (posible consolidación)
- 📦 **3 Dockerfiles** (aparentemente necesarios para distintos ambientes)
- 🏗️ **2 packages nuevos sin versionar** (api-client, types - 14KB total)
- 📝 **24 archivos de documentación** (excelente, pero verificar duplicación)
- ⚠️ **5 scripts de generación de keys** con funcionalidad similar

### Impacto Estimado
- **Tiempo total**: 2-4 horas (limpieza conservadora)
- **Riesgo**: 🟢 BAJO (solo eliminación de duplicados obvios)
- **Requiere tests**: NO (cambios no afectan código funcional)

---

## INVENTARIO DE PROBLEMAS

### ❌ ELIMINAR (Tiempo: 30 min)

| Archivo | Razón | Riesgo | Acción |
|---------|-------|--------|--------|
| `AUDITORIA_PRODUCCION_QA.md` | Duplicado de `AUDITORIA_PRODUCCION_QA_FINAL.md` | 🟢 | Mover a `docs/archive/` |
| `audit-agentos.json` | Resultado de auditoría temporal | 🟢 | Eliminar o mover a `.gitignore` |
| `C:\Users\gonza\AppData\Local\pnpm\store\v3/` | Symlink roto de Windows en WSL | 🟢 | `git rm` (no debería estar en repo) |

**Total**: 3 archivos, ~42KB liberados

**Comando sugerido**:
```bash
# Verificar primero qué contiene cada archivo
diff AUDITORIA_PRODUCCION_QA.md AUDITORIA_PRODUCCION_QA_FINAL.md

# Si FINAL es la versión actualizada, mover la anterior
mkdir -p docs/archive/audits
git mv AUDITORIA_PRODUCCION_QA.md docs/archive/audits/
git commit -m "docs: archive old audit report"

# Eliminar audit JSON temporal (si ya se integró en .md)
git rm audit-agentos.json
echo "audit-agentos.json" >> .gitignore
git commit -m "chore: remove temporary audit output"

# Eliminar symlink roto de Windows
git rm -r "C:\Users\gonza\AppData\Local\pnpm\store\v3"
git commit -m "chore: remove broken Windows symlink from WSL"
```

---

### 🔄 CONSOLIDAR (Tiempo: 1-2 horas)

#### Caso 1: Scripts de generación de secrets duplicados

**Problema**: 5 scripts con funcionalidad similar de generación de keys
- `scripts/generate-api-key.ts` (TypeScript)
- `scripts/generate-api-key-hash.js` (JavaScript)
- `scripts/hash-api-key.js` (JavaScript)
- `scripts/hash_api_key.py` (Python)
- `scripts/generate-jwt-secret.js` (JavaScript)
- `scripts/generate-secrets.js` (JavaScript agregador?)
- `scripts/generate-production-secrets.ts` (TypeScript completo)

**Análisis necesario**: Leer cada script para entender si:
- Son versiones legacy vs actuales
- Tienen propósitos distintos (dev vs prod)
- Alguno es el "canónico" referenciado en docs

**Propuesta** (REQUIERE VALIDACIÓN):
```
scripts/
├── security/
│   ├── generate-secrets.ts       # Script principal (consolidado)
│   └── README.md                  # Docs de uso
└── archive/                       # Versiones legacy
    ├── generate-api-key.js
    ├── hash-api-key.js
    └── hash_api_key.py
```

**Pasos**:
1. **PRIMERO**: Buscar referencias en `package.json` y documentación
   ```bash
   grep -r "generate-api-key" package.json docs/ README.md
   ```
2. Identificar cuál es el script actualmente usado
3. Verificar si `generate-production-secrets.ts` es el más completo
4. Mover scripts no usados a `scripts/archive/`
5. Actualizar referencias en docs si es necesario

**Riesgo**: 🟡 MEDIO (requiere verificar qué script usa el workflow actual)  
**Validación**: Verificar que `pnpm generate-api-key` siga funcionando

---

#### Caso 2: Múltiples configuraciones de Jest

**Problema**: 5 archivos de config Jest en raíz
- `jest.config.js` (base)
- `jest.unit.config.js`
- `jest.integration.config.js`
- `jest.e2e.config.js`
- `jest.simple.config.js`

**Análisis**: 
✅ **NO consolidar** - Esta separación es intencional y buena práctica  
- Permite correr distintos tipos de tests independientemente
- Referenciados en `package.json` (líneas 23-24)
- Patrón común en monorepos enterprise

**Acción**: **NINGUNA** - Mantener como está

---

#### Caso 3: Documentación de auditorías

**Problema**: 4 archivos relacionados con auditorías
- `AUDITORIA_PRODUCCION_QA.md` (raíz)
- `AUDITORIA_PRODUCCION_QA_FINAL.md` (raíz)
- `docs/AUDITORIA_TECNICA.md`
- `docs/AUDITORIA_TECNICA_COMPLETA.md`

**Propuesta**:
```
docs/
└── audits/
    ├── README.md                          # Índice de auditorías
    ├── 2025-12-13-produccion-qa.md        # Renombrado de FINAL
    ├── 2025-12-13-tecnica.md              # Renombrado de COMPLETA
    └── archive/
        ├── produccion-qa-draft.md         # Versión borrador
        └── tecnica-draft.md
```

**Pasos**:
```bash
# Crear estructura
mkdir -p docs/audits/archive

# Mover versiones finales con fecha
git mv AUDITORIA_PRODUCCION_QA_FINAL.md docs/audits/2025-12-13-produccion-qa.md
git mv docs/AUDITORIA_TECNICA_COMPLETA.md docs/audits/2025-12-13-tecnica.md

# Archivar borradores
git mv AUDITORIA_PRODUCCION_QA.md docs/audits/archive/produccion-qa-draft.md
git mv docs/AUDITORIA_TECNICA.md docs/audits/archive/tecnica-draft.md

# Crear índice
cat > docs/audits/README.md << 'EOF'
# Auditorías de Producción

## Última Auditoría: 2025-12-13

### Producción/QA
- **Archivo**: [2025-12-13-produccion-qa.md](./2025-12-13-produccion-qa.md)
- **Estado**: 4/8 issues P0 resueltos (50%)
- **Veredicto**: ❌ NO LISTO PARA PRODUCCIÓN
- **Bloqueantes**: Vulnerabilidades CVE, build roto

### Auditoría Técnica
- **Archivo**: [2025-12-13-tecnica.md](./2025-12-13-tecnica.md)
- **Cobertura**: Arquitectura, seguridad, performance, testing

## Historial
Ver carpeta [archive/](./archive/) para versiones anteriores.
EOF

git add docs/audits/README.md
git commit -m "docs: organize audit reports by date"
```

**Riesgo**: 🟢 BAJO (solo organización de docs)  
**Tiempo**: 20 minutos

---

### ✏️ RENOMBRAR (Tiempo: 15 min)

| Actual | Nuevo | Razón | Impacto |
|--------|-------|-------|---------|
| `AUDITORIA_PRODUCCION_QA_FINAL.md` | `docs/audits/2025-12-13-produccion-qa.md` | Organización + fecha clara | 0 imports (solo docs) |

**Comando sugerido**: Ver sección "Consolidar - Caso 3" arriba

---

### 🏗️ REORGANIZAR - **NO RECOMENDADO**

**Justificación**: 
El proyecto YA tiene una estructura excelente:
```
aethermind-agentos/
├── apps/          # Aplicaciones (API)
├── packages/      # Librerías compartidas (core, sdk, dashboard, types, api-client)
├── examples/      # Ejemplos de uso
├── tests/         # Tests centralizados
├── docs/          # Documentación
├── scripts/       # Utilidades
└── prisma/        # Schema DB
```

Esta es la **estructura ideal** para un monorepo enterprise con Turborepo.

❌ **NO hacer reorganización estructural**

---

## 🎯 RECOMENDACIONES PRIORIZADAS

### PRIORIDAD 0: HACER AHORA (< 30 min)

1. **Eliminar symlink roto de Windows** → 2 min → 🟢 Sin riesgo
   ```bash
   git rm -r "C:\Users\gonza\AppData\Local\pnpm\store\v3"
   git commit -m "chore: remove broken Windows symlink"
   ```

2. **Verificar y mover audit-agentos.json a .gitignore** → 5 min → 🟢 Sin riesgo
   ```bash
   git rm audit-agentos.json
   echo "audit-agentos.json" >> .gitignore
   git commit -m "chore: ignore temporary audit output"
   ```

3. **Organizar documentación de auditorías** → 20 min → Mejora navegación
   - Ver "Consolidar - Caso 3" arriba

### PRIORIDAD 1: ESTA SEMANA (1-2 horas)

4. **Analizar y consolidar scripts de generación de keys** → 1-2h → Reduce confusión
   - REQUIERE análisis detallado de cada script
   - Verificar referencias en docs y package.json
   - Mover versiones legacy a archive/

5. **Versionar packages nuevos (api-client, types)** → 30 min → Resolver warning de Turbo
   ```bash
   cd packages/api-client && git add . && cd ../..
   cd packages/types && git add . && cd ../..
   git commit -m "feat: add api-client and types packages to repo"
   ```

6. **Verificar duplicación en docs/** → 30 min → Eliminar contenido redundante
   ```bash
   # Buscar archivos con contenido similar
   find docs/ -name "*.md" -exec wc -l {} \; | sort -rn
   # Revisar manualmente los más grandes
   ```

### PRIORIDAD 2: ESTE MES (si hay tiempo)

7. **Crear `.env.template` unificado** → 1h → Documentación clara
   - Consolidar variables de todos los `.env.example` dispersos
   - Agregar comentarios explicativos

8. **Limpiar scripts/archive/** → 30 min → Eliminar scripts completamente obsoletos
   - Revisar qué hay en archive/
   - Eliminar lo que no aporta valor histórico

### PRIORIDAD 3: BACKLOG

- Crear pre-commit hook para prevenir commits de archivos .json temporales
- Implementar script de health-check que valide estructura del monorepo
- Documentar proceso de limpieza en CONTRIBUTING.md

---

## ⚠️ ANTES DE EMPEZAR

### Checklist Obligatorio
- [x] Tests actuales pasan (según audit: tests no ejecutables por build roto - OK proceder con limpieza de docs)
- [ ] No hay cambios sin commitear → **VERIFICAR**: `git status` muestra archivos modificados
- [ ] Tienes backup o rama de respaldo
- [ ] Equipo está informado (si es colaborativo)

### Crear Branch de Seguridad
```bash
# Verificar estado actual
git status

# Si hay cambios sin commitear, hacer stash o commit
git stash

# Crear backup
git checkout -b backup-cleanup-$(date +%Y%m%d)
git push origin backup-cleanup-$(date +%Y%m%d)

# Trabajar en rama limpia
git checkout main
git checkout -b cleanup/organize-audit-docs
```

---

## 🚀 ORDEN DE EJECUCIÓN

### Fase 1: Limpieza Segura (commits separados)

**Paso 1**: Eliminar symlink roto
```bash
git rm -r "C:\Users\gonza\AppData\Local\pnpm\store\v3"
git commit -m "chore: remove broken Windows symlink from WSL"
```

**Paso 2**: Ignorar archivos temporales
```bash
git rm audit-agentos.json
echo "audit-agentos.json" >> .gitignore
git commit -m "chore: ignore temporary audit output"
```

**Paso 3**: Versionar packages nuevos
```bash
git add packages/api-client packages/types
git commit -m "feat: add api-client and types packages to monorepo

- Add @aethermind/api-client package
- Add @aethermind/types package
- Resolves Turbo workspace warnings"
```

**Verificar**: `git log --oneline -3` (deben ser 3 commits separados)

---

### Fase 2: Organización de Documentación

**Paso 1**: Crear estructura de audits
```bash
mkdir -p docs/audits/archive
```

**Paso 2**: Mover y renombrar archivos
```bash
# Mover versiones finales
git mv AUDITORIA_PRODUCCION_QA_FINAL.md docs/audits/2025-12-13-produccion-qa.md
git mv docs/AUDITORIA_TECNICA_COMPLETA.md docs/audits/2025-12-13-tecnica.md

# Archivar borradores
git mv AUDITORIA_PRODUCCION_QA.md docs/audits/archive/produccion-qa-draft.md
git mv docs/AUDITORIA_TECNICA.md docs/audits/archive/tecnica-draft.md
```

**Paso 3**: Crear índice
```bash
cat > docs/audits/README.md << 'EOF'
# Auditorías de Producción

## Última Auditoría: 2025-12-13

### Producción/QA
- **Archivo**: [2025-12-13-produccion-qa.md](./2025-12-13-produccion-qa.md)
- **Estado**: 4/8 issues P0 resueltos (50%)
- **Veredicto**: ❌ NO LISTO PARA PRODUCCIÓN
- **Bloqueantes**: 4 CVEs HIGH, build roto

### Auditoría Técnica
- **Archivo**: [2025-12-13-tecnica.md](./2025-12-13-tecnica.md)
- **Cobertura**: Arquitectura, seguridad, performance, testing

## Historial
Ver carpeta [archive/](./archive/) para versiones anteriores.
EOF

git add docs/audits/README.md
git commit -m "docs: organize audit reports by date in dedicated folder"
```

---

### Fase 3: Análisis de Scripts (REQUIERE INVESTIGACIÓN MANUAL)

**NO ejecutar automáticamente** - Requiere decisión humana

```bash
# 1. Buscar referencias a scripts de generación
grep -r "generate-api-key" package.json docs/*.md README.md
grep -r "generate-secrets" package.json docs/*.md README.md
grep -r "hash-api-key" package.json docs/*.md README.md

# 2. Leer cada script para entender su propósito
cat scripts/generate-api-key.ts
cat scripts/generate-production-secrets.ts
cat scripts/hash_api_key.py

# 3. Verificar cuál está en package.json:scripts
cat package.json | grep -A2 "generate-api-key"

# 4. DECISIÓN MANUAL: ¿Cuál es el canónico?
# - Si es generate-api-key.ts → mover los demás a archive/
# - Si es generate-production-secrets.ts → mover los demás a archive/

# 5. Ejemplo (AJUSTAR según hallazgos):
mkdir -p scripts/archive
git mv scripts/hash_api_key.py scripts/archive/
git mv scripts/generate-api-key-hash.js scripts/archive/
git commit -m "chore: archive deprecated key generation scripts"
```

---

## 📋 COMANDOS ÚTILES

### Encontrar Duplicados por Contenido
```bash
# Archivos markdown duplicados (por hash)
find docs/ -type f -name "*.md" -exec md5sum {} + | sort | uniq -w32 -D

# Archivos de config duplicados
find . -maxdepth 2 -name "*.json" -exec md5sum {} + | sort
```

### Análisis de Tamaño
```bash
# Top 20 archivos más grandes (excluyendo node_modules)
find . -type f -not -path "*/node_modules/*" -exec du -h {} + | sort -rh | head -20

# Tamaño de carpetas principales
du -sh apps packages examples tests docs scripts
```

### Búsqueda de Scripts No Usados
```bash
# Scripts en package.json
cat package.json | jq -r '.scripts | keys[]'

# Scripts en carpeta scripts/
ls scripts/*.{js,ts,sh,py} 2>/dev/null | xargs -n1 basename

# Comparar para encontrar scripts huérfanos
```

### Verificar Referencias Rotas
```bash
# Links en README y docs
grep -r "\[.*\](.*)" README.md docs/ | grep -v "http" | grep -v "^#"

# Verificar que los archivos existan
# (requiere script custom o verificación manual)
```

---

## ❓ FAQ RÁPIDO

**P: ¿Puedo hacer todo de una vez?**  
R: NO. Hazlo por fases con commits separados. Si algo falla, es más fácil hacer rollback.

**P: ¿Los 5 scripts de generación de keys son todos necesarios?**  
R: Probablemente NO, pero DEBES verificar primero:
1. Cuál referencia `package.json` en el script `generate-api-key`
2. Si hay scripts legacy de migraciones previas
3. Si Python/JS son para distintos ambientes

**P: ¿Debo eliminar los Jest configs múltiples?**  
R: **NO**. Es una práctica estándar tener configs separados para unit/integration/e2e tests.

**P: ¿Qué hago con los 3 Dockerfiles?**  
R: **MANTENERLOS**. Lectura de nombres sugiere:
- `Dockerfile` → Desarrollo local
- `Dockerfile.prisma` → Migraciones DB
- `Dockerfile.railway` → Deploy en Railway
Esto es correcto para multi-ambiente.

**P: ¿Los packages api-client y types deben commitearse?**  
R: **SÍ**. Son parte del monorepo según `pnpm-workspace.yaml`. El warning de Turbo confirma que deben agregarse al repo.

**P: ¿Qué hago si rompo algo?**  
R: Rollback inmediato:
```bash
git checkout backup-cleanup-YYYYMMDD
# O si ya hiciste commit:
git reset --hard HEAD~1
```

---

## 📊 CRITERIOS DE ÉXITO

Al finalizar, deberías tener:
- ✅ Menos archivos en raíz (meta: mover auditorías a docs/)
- ✅ Sin archivos temporales commiteados (audit-agentos.json)
- ✅ Sin symlinks rotos de Windows
- ✅ Documentación de auditorías organizada por fecha
- ✅ Packages api-client y types versionados correctamente
- ✅ Commits atómicos con mensajes claros
- ✅ Tests pasando (N/A - ya están rotos por issue P0 no relacionado)

**Métrica**: Si alguien busca "última auditoría" debería ir a `docs/audits/README.md` y encontrarla en <30 segundos.

---

## 🔍 ANÁLISIS ESPECÍFICO DEL PROYECTO

### Contexto Detectado

Este proyecto está en **fase de auditoría pre-producción**:
- ✅ Excelente documentación (24 archivos, incluyendo API, arquitectura, deployment)
- ✅ Estructura de monorepo enterprise-grade (Turborepo + pnpm)
- ✅ Testing robusto (178 test files, configs separados)
- ⚠️ Auditorías recientes detectaron 4/8 issues P0 resueltos
- ⚠️ Build actualmente roto (CVEs pendientes + dependencias)
- ✅ Commits recientes enfocados en fixes de build y Sentry

### Issues del Proyecto (NO relacionados con limpieza)

Según `AUDITORIA_PRODUCCION_QA_FINAL.md`:
1. **4 CVEs HIGH** (jws, glob, 2x next) - P0 bloqueante
2. **Build roto** - Dependencias no instaladas - P0 bloqueante
3. **Tests no ejecutables** - Depende del build - P0 bloqueante

**IMPORTANTE**: La limpieza de código propuesta NO resolverá estos issues. Son problemas de dependencias y seguridad que requieren:
```bash
# Según roadmap.md (ya existente en el repo)
pnpm install --no-frozen-lockfile
pnpm update jsonwebtoken@latest next@14.2.35
pnpm audit fix
pnpm turbo run build --force
```

### Lo Que SÍ Mejorará Esta Limpieza

1. **Navegación de documentación** → Auditorías fáciles de encontrar
2. **Claridad de estado** → Sin archivos de auditoría duplicados/ambiguos
3. **Warnings de Turbo** → Resolver packages no versionados
4. **Higiene del repo** → Sin symlinks rotos, sin archivos temporales

---

## 🎯 DECISIÓN FINAL: LIMPIEZA MINIMALISTA

Dado que el proyecto está en auditoría crítica con build roto, **recomiendo limpieza conservadora**:

### ✅ HACER (Total: 1 hora)
1. Eliminar symlink roto (2 min)
2. Ignorar audit-agentos.json (5 min)  
3. Versionar api-client y types (10 min)
4. Organizar documentación de auditorías (20 min)
5. Actualizar README.md si referencia archivos movidos (15 min)

### ⏸️ POSTPONER (hasta resolver P0s)
1. Consolidación de scripts de generación (requiere testing que build está roto)
2. Análisis profundo de duplicación en docs (no crítico ahora)
3. Limpieza de scripts/archive (no afecta funcionalidad)

### ❌ NO HACER
1. Reorganización de carpetas (estructura ya es óptima)
2. Refactorización de código (fuera de scope de limpieza)
3. Modificación de configs de Jest/Turbo (funcionan correctamente)
4. Eliminación de Dockerfiles (todos necesarios)

---

**Versión**: 1.0  
**Generado**: 2025-12-14  
**Contexto**: Monorepo TypeScript en auditoría pre-producción con issues P0 de seguridad pendientes

---

**¿Listo para empezar?**

1. **¿Quieres ejecutar la limpieza conservadora (1h)?**  
   → Puedo darte los comandos paso a paso

2. **¿Prefieres postponer hasta resolver los issues P0 de build?**  
   → Es una decisión válida dado el estado del proyecto

3. **¿Quieres que analice algún aspecto específico primero?**  
   → Ej: scripts de generación, duplicación en docs, etc.
