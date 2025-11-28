# Troubleshooting Scripts - Prisma/PostgreSQL (Nov 2025)

These scripts were created during the initial setup and troubleshooting of the Prisma/PostgreSQL integration in November 2025. They have been archived for historical reference.

## Context

During the initial setup, we encountered issues with:
- Database connection and password encoding
- Prisma client generation
- Docker container configuration

These scripts were used to diagnose and fix those issues.

## Scripts

### JavaScript/Node.js Tests
- `check-env.js` - Environment variable validation
- `fix-env-password.js` - Password encoding fix
- `test-direct-connection.js` - Direct PostgreSQL connection test
- `test-password.js` - Password encoding validation
- `test-pg-library.js` - pg library driver test
- `test-prisma-connection.js` - Prisma client connection test
- `test-prisma-from-api.mjs` - Prisma test from API context
- `test-simple.mjs` - Basic connection test

### PowerShell Scripts
- `clean-env-file.ps1` - .env file cleanup
- `diagnose-prisma.ps1` - Comprehensive Prisma diagnostics
- `force-refresh-prisma.ps1` - Force Prisma schema refresh
- `reset-postgres-password.ps1` - PostgreSQL password reset
- `run-prisma-docker-simple.ps1` - Simple Docker Prisma setup
- `run-prisma-docker.ps1` - Full Docker Prisma setup

## Status

✅ **Issues Resolved**: All connection and setup issues have been fixed.

The production codebase now uses:
- `apps/api/src/services/PrismaStore.ts` for database operations
- Standard `docker-compose.yml` for container orchestration
- `setup-aethermind.ps1` for initial setup

## Archive Date

2025-11-28

## Notes

These scripts are kept for reference only and should not be needed for normal operation. If you encounter similar issues, refer to the main documentation first.
