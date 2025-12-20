# Legacy Key Generation Scripts

**Status**: Archived  
**Date**: 2025-12-14  
**Reason**: Consolidated into canonical scripts

## Archived Scripts

These scripts are legacy versions or one-off utilities that have been replaced by the canonical scripts in the root `scripts/` directory.

| Script | Purpose | Replaced By |
|--------|---------|-------------|
| `generate-api-key-hash.js` | Generate API key + hash (JavaScript) | `generate-api-key.ts` |
| `hash-api-key.js` | Hash a hardcoded API key | `generate-api-key.ts` |
| `hash_api_key.py` | Python version of key hasher | `generate-api-key.ts` |
| `generate-secrets.js` | Generate multiple secrets | `generate-production-secrets.ts` |
| `generate-jwt-secret.js` | Generate JWT secret only | `generate-production-secrets.ts` |

## Current Canonical Scripts

Use these scripts instead:

### For Development
```bash
# Generate a single API key + hash
pnpm generate-api-key
# -> Uses: scripts/generate-api-key.ts
```

### For Production
```bash
# Generate all secrets (JWT + API Key)
tsx scripts/generate-production-secrets.ts
```

## Why Archived?

1. **Duplication**: Multiple scripts doing the same thing
2. **Language inconsistency**: Mix of JS, TS, Python
3. **Maintenance burden**: Updating 5 scripts vs 2
4. **Package.json reference**: Only `generate-api-key.ts` is in npm scripts

## Safety

These scripts are kept in archive for historical reference. They can be safely deleted after 3 months (2025-03-14) if no issues arise.
