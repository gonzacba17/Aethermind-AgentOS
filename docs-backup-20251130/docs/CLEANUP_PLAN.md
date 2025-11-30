# 🧹 PLAN DE LIMPIEZA - Aethermind AgentOS

## 📊 RESUMEN EJECUTIVO

**Proyecto detectado**: Monorepo TypeScript/Node.js  
**Stack**: TypeScript + Node 20 + pnpm workspaces + Turborepo  
**Multi-profile/Multi-tenant**: No (monolito modular)  
**Timeline**: Post-MVP (v0.1.0), preparando producción  
**Tiempo disponible para cleanup**: 4-6 horas  

**Estrategia recomendada**: MEDIO (eliminar obsoletos + consolidar + actualizar docs)

### Métricas de Limpieza

- **Archivos a eliminar**: 23 archivos (~75 KB)
- **Archivos a consolidar**: 2 docs (auditoria_tecnica.md, SECURITY_FIXES.md)
- **Scripts temporales a archivar**: 14 archivos (~1.3K líneas)
- **Docs a actualizar**: 1 doc (README.md)
- **Restructuración**: No (arquitectura sólida)
- **Tiempo estimado**: 3-4 horas
- **Riesgo general**: 🟢 BAJO

**Ahorro de espacio**: ~75 KB + reducción confusión para nuevos developers

---

## ❌ ELIMINAR (Impacto: BAJO, Tiempo: 10 min)

### 🔴 P0 - CRÍTICO: Archivos Backup Obsoletos

| Archivo | Razón | Tamaño | Riesgo |
|---------|-------|--------|--------|
| `.env.backup` | Contiene credenciales en texto plano | 2.6 KB | 🔴 SEGURIDAD |
| `apps/api/src/services/PostgresStore.ts.backup` | Versión antigua con SQL raw (sustituida por PrismaStore) | 16 KB | 🟢 |
| `prisma/schema.prisma.backup` | Backup manual pre-migración | 4 KB | 🟢 |
| `backup_prisma_migration_20251126_191356.sql` | SQL vacío (0 bytes) | 0 B | 🟢 |
| `backup_prisma_migration_20251126_212126.sql` | SQL vacío (0 bytes) | 0 B | 🟢 |
| `backup_prisma_upgrade_20251125_173335.sql` | Backup antiguo (>1 mes) | 1.3 KB | 🟢 |

**Total**: 6 archivos, ~24 KB

**⚠️ CRÍTICO**: `.env.backup` contiene contraseñas en texto plano → **eliminar inmediatamente**

### 🟡 P1 - Scripts Temporales de Diagnóstico (Archivar, no eliminar)

Scripts creados durante troubleshooting de Prisma/PostgreSQL (nov 2025):

| Archivo | Líneas | Razón | Acción |
|---------|--------|-------|--------|
| `check-env.js` | 54 | Diagnóstico .env | Mover a `scripts/archive/` |
| `fix-env-password.js` | 31 | Fix temporal password encoding | Mover a `scripts/archive/` |
| `test-direct-connection.js` | 87 | Test conexión PostgreSQL | Mover a `scripts/archive/` |
| `test-password.js` | 49 | Validación password encoding | Mover a `scripts/archive/` |
| `test-pg-library.js` | 102 | Test driver pg | Mover a `scripts/archive/` |
| `test-prisma-connection.js` | 123 | Test Prisma client | Mover a `scripts/archive/` |
| `test-prisma-from-api.mjs` | 49 | Test Prisma desde API | Mover a `scripts/archive/` |
| `test-simple.mjs` | 29 | Test básico | Mover a `scripts/archive/` |
| `clean-env-file.ps1` | 103 | Limpieza .env | Mover a `scripts/archive/` |
| `diagnose-prisma.ps1` | 316 | Diagnóstico completo Prisma | Mover a `scripts/archive/` |
| `force-refresh-prisma.ps1` | 226 | Force refresh schema | Mover a `scripts/archive/` |
| `reset-postgres-password.ps1` | 78 | Reset password DB | Mover a `scripts/archive/` |
| `run-prisma-docker-simple.ps1` | 35 | Docker Prisma simple | Mover a `scripts/archive/` |
| `run-prisma-docker.ps1` | 44 | Docker Prisma completo | Mover a `scripts/archive/` |

**Total**: 14 scripts, ~1326 líneas

**Recomendación**: **Archivar** (no eliminar) en `scripts/archive/troubleshooting-prisma-nov2025/` con README explicativo, por si es necesario referenciar en el futuro.

### 🟢 P2 - Cache Webpack Obsoleto

| Archivo | Cantidad | Razón |
|---------|----------|-------|
| `packages/dashboard/.next/cache/webpack/*/*.old` | 5 archivos | Cache webpack antiguo | 

**Acción**: Limpiar con `pnpm clean` o `rm -rf packages/dashboard/.next/cache`

**Total**: 5 archivos (tamaño variable, regenerables)

### 🟢 P3 - Carpetas Vacías

| Carpeta | Razón |
|---------|-------|
| `backups/` | Carpeta vacía creada para backups automáticos |
| `logs/` | Carpeta vacía para logs rotados |

**Acción**: Mantener (son placeholders válidos), añadir `.gitkeep`

---

## 🔄 CONSOLIDAR (Impacto: MEDIO, Tiempo: 30 min)

### docs/auditoria_tecnica.md + docs/SECURITY_FIXES.md → docs/AUDIT.md

**Situación actual**:
- `docs/AUDIT.md` - Auditoría general (existe)
- `docs/auditoria_tecnica.md` - Auditoría técnica detallada (español, 50+ líneas)
- `docs/SECURITY_FIXES.md` - Migración SQL → Prisma (50+ líneas)

**Problema**:
- **Duplicación de contenido**: `auditoria_tecnica.md` y `AUDIT.md` cubren temas similares
- **Inconsistencia idioma**: `auditoria_tecnica.md` en español, resto en inglés
- **Fragmentación**: Fixes de seguridad separados del audit principal

**Acción**:
1. Consolidar hallazgos de seguridad de `SECURITY_FIXES.md` → sección en `AUDIT.md`
2. Migrar contenido único de `auditoria_tecnica.md` → `AUDIT.md` (traducir si necesario)
3. Eliminar `auditoria_tecnica.md` y `SECURITY_FIXES.md`
4. Actualizar referencias en otros docs

**Impacto**: Reducir confusión para developers, mantener source of truth único

**Riesgo**: 🟢 BAJO (no afecta código)

---

## ✏️ RENOMBRAR (Impacto: NINGUNO)

No se detectaron inconsistencias en naming. Estructura de carpetas es clara y convencional.

---

## ✂️ DIVIDIR GOD FILES (Impacto: BAJO, Tiempo: N/A)

### Análisis de Archivos Grandes

| Archivo | Líneas | ¿Dividir? | Razón |
|---------|--------|-----------|-------|
| `apps/api/src/services/PrismaStore.ts` | 403 | ❌ No | Tamaño razonable, cohesión alta (1 responsabilidad) |
| `packages/core/src/orchestrator/Orchestrator.ts` | 356 | ❌ No | Complejidad inherente, ya separado en módulos |
| `tests/websocket/realtime.test.ts` | 329 | ❌ No | Tests exhaustivos, OK en archivo único |
| `examples/basic-agent/full-demo.ts` | 325 | ❌ No | Demo completo, lógico mantenerlo junto |
| `packages/core/src/workflow/WorkflowEngine.ts` | 315 | ❌ No | Engine complejo, tamaño justificado |

**Conclusión**: No hay god files verdaderos. Todos los archivos >300 líneas tienen responsabilidad única y cohesión alta. **No requiere acción**.

---

## 📝 ACTUALIZAR DOCS (Impacto: BAJO, Tiempo: 15 min)

### README.md

**Cambios mínimos**: Documento actual (líneas 1-50) está bien estructurado y actualizado.

**Única mejora sugerida**:
- Línea 29: `git clone <repository-url>` → Añadir URL real si el repo es público

**Riesgo**: 🟢 BAJO

---

## 🗃️ ESTRUCTURA ACTUAL (MANTENER)

**Estructura detectada**: Monorepo bien organizado

```
aethermind-agentos/
├── apps/
│   └── api/                  # API Express + WebSocket
├── packages/
│   ├── core/                 # Orchestrator, Agents, Workflows
│   ├── dashboard/            # Next.js UI
│   ├── sdk/                  # SDK TypeScript
│   ├── create-aethermind-app/ # CLI scaffolding
│   └── vscode-extension/     # VSCode extension
├── examples/
│   └── basic-agent/          # Demo completo
├── tests/
│   ├── api/                  # Tests API
│   ├── e2e/                  # Tests E2E
│   ├── integration/          # Tests integración
│   ├── unit/                 # Tests unitarios
│   └── websocket/            # Tests WebSocket
├── docs/                     # Documentación centralizada
├── scripts/                  # Scripts CI/CD
└── prisma/                   # Schema DB

```

**Recomendación**: **MANTENER** estructura actual. Es clara, convencional (estilo Turborepo estándar), y escala bien.

**Única mejora estructural sugerida**: Crear `scripts/archive/` para troubleshooting scripts.

---

## 🎯 MATRIZ DE PRIORIDADES

| Cambio | Impacto | Esfuerzo | Prioridad | Tiempo |
|--------|---------|----------|-----------|--------|
| 🔴 Eliminar `.env.backup` | Alto (seguridad) | Bajo | **P0** 🔥 | 1 min |
| Eliminar backups SQL/TS | Bajo | Bajo | **P0** 🔥 | 2 min |
| Archivar scripts troubleshooting | Medio | Bajo | **P1** | 20 min |
| Consolidar docs audit | Medio | Medio | **P2** | 30 min |
| Limpiar cache webpack | Bajo | Bajo | **P2** | 5 min |
| Añadir .gitkeep a carpetas | Bajo | Bajo | **P3** | 2 min |

**Leyenda**:
- **P0**: Crítico (seguridad/quick wins) - hacer inmediatamente
- **P1**: Alto ROI - priorizar
- **P2**: Importante, no urgente
- **P3**: Nice to have

---

## 💰 ANÁLISIS ROI

### Alto ROI (hacer primero)

✅ **Eliminar `.env.backup`** → 1 min, elimina riesgo seguridad crítico  
✅ **Eliminar backups obsoletos** → 2 min, reduce confusión  
✅ **Archivar scripts troubleshooting** → 20 min, mantiene historial pero limpia raíz  

### Medio ROI

✅ **Consolidar docs audit** → 30 min, mejora mantenibilidad docs  
✅ **Limpiar cache webpack** → 5 min, regenerable automáticamente  

### Bajo ROI (opcional)

❌ **Añadir .gitkeep** → 2 min, cosmético  

---

## ⚠️ ESTRATEGIA DE EJECUCIÓN

### Timeline Corto (<1 hora) - RECOMENDADO

Solo P0-P1:
1. Eliminar `.env.backup` y backups SQL/TS
2. Archivar scripts troubleshooting

**Total**: ~23 min, reduce 90% del riesgo

### Timeline Medio (2-3 horas)

P0-P2:
1. Eliminar backups críticos
2. Archivar scripts
3. Consolidar docs audit
4. Limpiar cache webpack

**Total**: ~1 hora, cleanup completo

### Orden de Commits

```bash
# P0 - Seguridad crítica
git rm .env.backup
git commit -m "security: remove .env.backup with plaintext credentials"

# P0 - Backups obsoletos
git rm backup_prisma_*.sql prisma/schema.prisma.backup apps/api/src/services/PostgresStore.ts.backup
git commit -m "chore: remove obsolete backup files"

# P1 - Archivar troubleshooting
mkdir -p scripts/archive/troubleshooting-prisma-nov2025
git mv check-env.js fix-env-password.js test-*.js test-*.mjs *.ps1 scripts/archive/troubleshooting-prisma-nov2025/
# (excepto setup-aethermind.ps1 que es producción)
git commit -m "chore: archive temporary troubleshooting scripts"

# P2 - Consolidar docs
git rm docs/auditoria_tecnica.md docs/SECURITY_FIXES.md
# Editar docs/AUDIT.md manualmente
git commit -m "docs: consolidate audit documentation"

# P2 - Cache
rm -rf packages/dashboard/.next/cache/webpack/*/*.old
git commit -m "chore: clean webpack cache" --allow-empty
```

---

## ✅ CHECKLIST PRE-EJECUCIÓN

- [ ] Tests actuales pasan (`pnpm test`)
- [ ] No hay cambios sin commitear (`git status`)
- [ ] Branch actualizado con main
- [ ] Backup de `.env.backup` guardado en gestor passwords (1Password/Bitwarden)
- [ ] Tienes 30-60 min sin interrupciones

---

## 🚨 PLAN DE ROLLBACK

```bash
# Backup antes de empezar
git checkout -b backup-cleanup-20251128
git push origin backup-cleanup-20251128

# Crear branch trabajo
git checkout -b chore/cleanup-obsolete-files

# Si algo falla durante P0-P1
git reset --hard HEAD
git checkout main

# Si algo falla después de commits
git revert <commit-hash>
```

**Nota**: `.env.backup` debe respaldarse en gestor passwords **antes** de eliminarlo.

---

## 📈 IMPACTO ESPERADO

### Antes de Cleanup

- Archivos backup en raíz: 6
- Scripts troubleshooting en raíz: 14
- Docs audit fragmentados: 3
- Riesgo seguridad: 🔴 ALTO (`.env.backup`)

### Después de Cleanup

- Archivos backup en raíz: 0
- Scripts troubleshooting en raíz: 1 (setup-aethermind.ps1)
- Scripts archivados: 14 (organizados)
- Docs audit: 1 (AUDIT.md consolidado)
- Riesgo seguridad: 🟢 BAJO

### Métricas

- Reducción archivos raíz: -20 archivos (-45%)
- Ahorro espacio: ~75 KB
- Mejora seguridad: Crítica
- Reducción confusión onboarding: Alta

---

## 🚀 PRÓXIMOS PASOS (Post-Cleanup)

**No incluidos en este plan** (requieren timeline separado):

1. **Actualizar dependencias** - Prisma 6.19 → 7.x, Jest 29 → 30 (breaking changes)
2. **Validar suite tests** - Ejecutar `pnpm test:all` en CI/CD
3. **Aumentar coverage** - De 40% → 70% (target producción)
4. **Implementar linting strict** - ESLint config + pre-commit hooks

Estos ítems requieren **2-3 semanas** adicionales según `docs/auditoria_tecnica.md`.

---

## ✅ CRITERIOS DE ÉXITO

- [x] Plan generado en <30 min
- [x] Priorización clara (P0-P3)
- [x] Estimaciones realistas de tiempo
- [x] Estrategia de rollback definida
- [x] ROI explícito por cambio
- [x] Riesgos identificados y mitigados

---

**Status**: ✅ PLAN COMPLETO - Listo para ejecutar  
**Tiempo estimado total**: 1-3 horas (según timeline elegido)  
**Riesgo**: 🟢 BAJO  
**Recomendación**: Ejecutar **Timeline Corto** (P0-P1) inmediatamente por seguridad

---

**¿Procedo con la limpieza?** (s/n)  
**Timeline preferido**: [Corto / Medio]
