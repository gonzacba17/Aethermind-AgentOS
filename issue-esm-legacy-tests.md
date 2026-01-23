# 🐛 BUG: Tests Legacy Fallan por Import ESM Incorrecto

## Descripción

Los tests unitarios existentes (`routes-workflows.test.ts`, `auth.test.ts`, etc.) fallan con el error:

```
ReferenceError: exports is not defined
at tests/unit/routes-workflows.test.ts:5:23
```

## Causa Raíz

Los tests legacy usan una sintaxis incorrecta para importar archivos `.d.ts`:

```typescript
// ❌ INCORRECTO (línea 5 en routes-workflows.test.ts)
import "../types/express";

// ✅ CORRECTO
/// <reference path="../types/express.d.ts" />
```

En modo ESM, los archivos `.d.ts` (TypeScript Declaration files) NO pueden importarse como módulos porque solo contienen declaraciones de tipos y no código ejecutable.

## Archivos Afectados

- `tests/unit/routes-workflows.test.ts` (línea 5)
- `tests/unit/auth.test.ts` (línea 5)
- `tests/unit/RedisCache.test.ts` (línea 2)
- Posiblemente otros tests unitarios legacy

## Solución Propuesta

### Opción A: Usar Triple-Slash Reference (Recomendada)

```typescript
// Cambiar:
import "../types/express";

// Por:
/// <reference path="../types/express.d.ts" />
```

### Opción B: Crear archivo de tipos exportable

Crear `tests/types/express.ts` que re-exporte los tipos:

```typescript
// tests/types/express.ts
export * from "./express.d";
```

## Pasos para Resolver

1. Identificar todos los archivos con `import '../types/express'`
2. Reemplazar por `/// <reference path="../types/express.d.ts" />`
3. Ejecutar `pnpm test` para validar
4. Commit con mensaje:

```bash
git commit -m "fix: replace .d.ts imports with type references in legacy tests"
```

## Contexto Importante

- **Este issue NO fue causado por el PR actual** (fix/audit-p0-p1)
- Los 32 tests nuevos (StripeService + Auth Flow) **NO tienen este problema**
- Este issue existía ANTES de la auditoría P0/P1
- Es deuda técnica de la migración ESM previa

## Prioridad y Timing

**Prioridad**: P2 (Media)
**No bloquea**: Deploy actual ni features
**Debe resolverse**: Antes del próximo sprint

**Estimación**: 1-2 horas

## Definition of Done

- [ ] `pnpm test` pasa al 100% (sin errores ni warnings)
- [ ] No hay errores ESM en ningún test
- [ ] Los 32 tests nuevos siguen pasando correctamente
- [ ] Documentación actualizada si aplica

## Referencias

- Commit que detectó el issue: `a4c1ba7`
- PR relacionado: fix/audit-p0-p1
- Auditoría: Reporte técnico 23-Enero-2026
