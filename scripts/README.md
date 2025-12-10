# Aethermind AgentOS - Scripts Documentation

This directory contains all utility scripts for the Aethermind AgentOS project. Scripts are organized by purpose and include setup, testing, production monitoring, security, and database utilities.

## Quick Reference

| Script                                                   | Purpose                      | Usage                                         |
| -------------------------------------------------------- | ---------------------------- | --------------------------------------------- |
| [run-all-tests.ps1](#run-all-testsps1)                   | Run all test suites          | `.\scripts\run-all-tests.ps1`                 |
| [smoke-test.js](#smoke-testjs)                           | Quick smoke tests            | `pnpm test:smoke`                             |
| [validate-mvp.js](#validate-mvpjs)                       | Validate MVP setup           | `pnpm validate`                               |
| [production-health-check.sh](#production-health-checksh) | Production health monitoring | `./scripts/production-health-check.sh --full` |
| [diagnose.ts](#diagnosets)                               | System diagnostics           | `pnpm diagnose`                               |
| [generate-api-key.ts](#generate-api-keyts)               | Generate API keys            | `pnpm generate-api-key`                       |

---

## Table of Contents

- [Setup & Installation](#setup--installation)
- [Testing & Validation](#testing--validation)
- [Production Health & Monitoring](#production-health--monitoring)
- [Security & Secrets](#security--secrets)
- [Database & Migration](#database--migration)
- [Utilities & Diagnostics](#utilities--diagnostics)
- [Configuration Files](#configuration-files)

---

## Setup & Installation

### setup-aethermind.ps1

**Location:** Root directory  
**Type:** PowerShell  
**Purpose:** Complete automated setup wizard for new environments

**Features:**

- Prerequisites checking (Node.js, pnpm, Docker, Git)
- Dependency installation
- Environment configuration
- Docker services management (PostgreSQL, Redis)
- Database initialization with Prisma
- Connection testing
- Comprehensive logging and test reporting

**Usage:**

```powershell
# Basic setup
.\setup-aethermind.ps1

# Skip Docker services
.\setup-aethermind.ps1 -SkipDocker

# Skip validation
.\setup-aethermind.ps1 -SkipValidation

# Production mode
.\setup-aethermind.ps1 -Production
```

**Prerequisites:**

- Windows with PowerShell 5.1+
- Docker Desktop installed
- Node.js 18+
- pnpm 8+

**When to use:**

- Setting up a new development environment
- Onboarding new team members
- After cloning the repository

---

## Testing & Validation

### run-all-tests.ps1

**Location:** `scripts/`  
**Type:** PowerShell  
**Purpose:** Comprehensive test runner for all test suites

**Features:**

- Runs unit, integration, E2E, and API tests
- Auto-starts Docker services if needed
- Generates coverage reports
- Detailed logging with timestamps
- Error tracking and reporting

**Usage:**

```powershell
# Run all tests
.\scripts\run-all-tests.ps1

# Skip validation checks
.\scripts\run-all-tests.ps1 -SkipValidation

# Skip smoke tests
.\scripts\run-all-tests.ps1 -SkipSmoke

# Verbose output
.\scripts\run-all-tests.ps1 -Verbose

# Auto-start services
.\scripts\run-all-tests.ps1 -AutoStart
```

**Test Phases:**

1. System validation (Docker, PostgreSQL, Redis)
2. Smoke tests
3. Unit tests
4. Integration tests
5. E2E tests
6. API tests
7. Coverage report

**When to use:**

- Before committing changes
- In CI/CD pipelines
- Weekly comprehensive testing
- Before releases

---

### smoke-test.js

**Location:** `scripts/`  
**Type:** Node.js  
**Purpose:** Quick validation of critical functionality

**Features:**

- Tests API health endpoint
- Creates, retrieves, updates, and deletes test agents
- Executes test tasks
- Validates logs and costs endpoints
- Tests dashboard accessibility
- Automatic cleanup of test data

**Usage:**

```bash
# Via npm script (recommended)
pnpm test:smoke

# Direct execution
node scripts/smoke-test.js

# With custom URLs
API_URL=https://your-api.com DASHBOARD_URL=https://your-dashboard.com pnpm test:smoke
```

**Environment Variables:**

- `API_URL` - API base URL (default: http://localhost:3001)
- `DASHBOARD_URL` - Dashboard URL (default: http://localhost:3000)

**When to use:**

- After deploying to staging/production
- Quick sanity check during development
- In CI/CD pipelines
- Before releases

---

### validate-mvp.js

**Location:** `scripts/`  
**Type:** Node.js  
**Purpose:** Validate MVP configuration and services

**Features:**

- Checks Docker daemon status
- Validates PostgreSQL container
- Validates Redis container
- Tests API availability
- Tests Dashboard availability
- Verifies database connections
- Cross-platform compatible

**Usage:**

```bash
# Via npm script (recommended)
pnpm validate

# Direct execution
node scripts/validate-mvp.js
```

**Checks:**

1. ✅ Docker is running
2. ✅ PostgreSQL container is running
3. ✅ Redis container is running
4. ✅ API is responding
5. ✅ Dashboard is responding
6. ✅ Database connection works
7. ✅ Redis connection works

**When to use:**

- After setup
- Before starting development
- Troubleshooting environment issues
- Verifying Docker services

---

### test-sanitizer.js

**Location:** `scripts/`  
**Type:** Node.js  
**Purpose:** Test data sanitization functionality

**Features:**

- Tests sensitive data redaction
- Validates sanitizer patterns
- Ensures security compliance

**Usage:**

```bash
node scripts/test-sanitizer.js
```

**When to use:**

- Testing security features
- Validating log sanitization
- Before production deployment

---

### test-without-redis.sh

**Location:** `scripts/`  
**Type:** Shell  
**Purpose:** Run tests without Redis dependency

**Usage:**

```bash
./scripts/test-without-redis.sh
```

**When to use:**

- Testing fallback behavior
- CI environments without Redis
- Debugging Redis-related issues

---

## Production Health & Monitoring

### production-health-check.sh

**Location:** `scripts/`  
**Type:** Shell  
**Purpose:** Unified production health monitoring with multiple modes

**Features:**

- Three modes: quick, full, auth
- Frontend endpoint checks (Landing, Dashboard)
- Backend API endpoint checks
- External service monitoring (Sentry, Vercel, Railway)
- Performance/response time testing
- CORS and security header validation
- SSL/TLS verification
- Authentication testing
- Color-coded output

**Usage:**

```bash
# Quick mode (basic checks)
./scripts/production-health-check.sh --quick

# Full mode (all checks including performance)
./scripts/production-health-check.sh --full

# Auth mode (full + authentication testing)
API_KEY=your-key ./scripts/production-health-check.sh --auth

# Help
./scripts/production-health-check.sh --help
```

**Modes:**

**--quick (default):**

- Frontend endpoints (Landing, Dashboard, Agents, Logs)
- Backend API endpoints (Root, Health, Agents, Logs)

**--full:**

- All quick mode checks
- Additional frontend pages (Traces, Costs, Sentry)
- Additional API routes (Traces, Costs, Workflows, Executions)
- External services (Sentry, Vercel, Railway)
- Performance checks (response times)
- CORS headers validation
- SSL/TLS verification

**--auth:**

- All full mode checks
- Authenticated API requests
- Unauthorized request blocking verification

**Environment Variables:**

- `DASHBOARD_URL` - Dashboard URL (default: https://aethermind-agent-os-dashboard.vercel.app)
- `API_URL` - API URL (default: https://your-api.railway.app)
- `LANDING_URL` - Landing page URL (default: https://aethermind-page.vercel.app)
- `API_KEY` - API key for auth testing (required for --auth mode)

**When to use:**

- Production deployment verification
- Continuous monitoring (cron jobs)
- Post-deployment validation
- Incident investigation

---

### audit-production-readiness.sh

**Location:** Root directory  
**Type:** Shell  
**Purpose:** Score production readiness with detailed audit

**Features:**

- Checks core features (API, auth, database, cost tracking)
- Validates user experience (dashboard, WebSocket)
- Assesses production readiness (error handling, env config, tests)
- Provides score out of 100
- Gives recommendations

**Usage:**

```bash
./audit-production-readiness.sh
```

**Scoring:**

- 80-100: Ready for beta launch
- 60-79: Almost ready
- 40-59: Development stage
- 0-39: Early stage

**When to use:**

- Before production deployment
- Weekly progress tracking
- Feature completeness assessment

---

## Security & Secrets

### generate-api-key.ts

**Location:** `scripts/`  
**Type:** TypeScript  
**Purpose:** Generate secure API keys

**Usage:**

```bash
# Via npm script (recommended)
pnpm generate-api-key

# Direct execution
tsx scripts/generate-api-key.ts
```

**When to use:**

- Creating new API keys for users
- Rotating API keys
- Initial setup

---

### generate-api-key-hash.js

**Location:** `scripts/`  
**Type:** Node.js  
**Purpose:** Generate hashed API keys for storage

**Usage:**

```bash
node scripts/generate-api-key-hash.js
```

**When to use:**

- Storing API keys securely
- Migrating to hashed keys

---

### generate-jwt-secret.js

**Location:** `scripts/`  
**Type:** Node.js  
**Purpose:** Generate JWT secret keys

**Usage:**

```bash
node scripts/generate-jwt-secret.js
```

**When to use:**

- Initial setup
- Rotating JWT secrets
- Production deployment

---

### generate-secrets.js

**Location:** `scripts/`  
**Type:** Node.js  
**Purpose:** Generate all required secrets

**Usage:**

```bash
node scripts/generate-secrets.js
```

**When to use:**

- Initial setup
- Generating multiple secrets at once

---

### generate-production-secrets.ts

**Location:** `scripts/`  
**Type:** TypeScript  
**Purpose:** Generate production-grade secrets

**Usage:**

```bash
tsx scripts/generate-production-secrets.ts
```

**When to use:**

- Production deployment
- Generating cryptographically secure secrets

---

### hash-api-key.js

**Location:** `scripts/`  
**Type:** Node.js  
**Purpose:** Simple API key hashing utility

**Usage:**

```bash
node scripts/hash-api-key.js <api-key>
```

**When to use:**

- Quick API key hashing
- Testing hash functions

---

### hash_api_key.py

**Location:** `scripts/`  
**Type:** Python  
**Purpose:** Python version of API key hashing

**Usage:**

```bash
python scripts/hash_api_key.py <api-key>
```

**When to use:**

- Python-based workflows
- Cross-language verification

---

## Database & Migration

### migrate-db.js

**Location:** `scripts/`  
**Type:** Node.js  
**Purpose:** Database migration utility

**Usage:**

```bash
node scripts/migrate-db.js
```

**When to use:**

- Applying database schema changes
- Production migrations
- Development database updates

---

### init.sql

**Location:** `scripts/`  
**Type:** SQL  
**Purpose:** Database initialization script

**Usage:**

```bash
# Executed automatically by Docker Compose
# Or manually:
psql -U aethermind -d aethermind -f scripts/init.sql
```

**When to use:**

- Initial database setup
- Resetting database to clean state

---

## Utilities & Diagnostics

### diagnose.ts

**Location:** `scripts/`  
**Type:** TypeScript  
**Purpose:** Comprehensive system diagnostics

**Features:**

- Environment variable validation
- Service availability checks
- Configuration verification
- Dependency checking

**Usage:**

```bash
# Via npm script (recommended)
pnpm diagnose

# Direct execution
tsx scripts/diagnose.ts
```

**When to use:**

- Troubleshooting issues
- Environment debugging
- Support requests

---

### validate-and-run.ts

**Location:** `scripts/`  
**Type:** TypeScript  
**Purpose:** Validation runner with comprehensive checks

**Usage:**

```bash
# Via npm script (recommended)
pnpm validate:all

# Direct execution
tsx scripts/validate-and-run.ts
```

**When to use:**

- Pre-deployment validation
- Comprehensive system checks

---

## Configuration Files

### Jest Configurations

**Files:**

- `jest.config.js` - Root Jest configuration
- `jest.e2e.config.js` - E2E test configuration
- `jest.integration.config.js` - Integration test configuration
- `jest.simple.config.js` - Simple test configuration
- `jest.unit.config.js` - Unit test configuration
- `apps/api/jest.config.js` - API-specific Jest config
- `packages/core/jest.config.js` - Core package Jest config

**Purpose:** Configure Jest testing framework for different test types

---

### validate-ci-example.yml

**Location:** `scripts/`  
**Type:** YAML  
**Purpose:** Example CI/CD configuration

**Usage:**
Reference for setting up CI/CD pipelines

---

## Troubleshooting

### Common Issues

**Docker not running:**

```bash
# Check Docker status
docker ps

# Start Docker Desktop
# Then run validation
pnpm validate
```

**PostgreSQL connection failed:**

```bash
# Check PostgreSQL container
docker ps | grep postgres

# Restart PostgreSQL
pnpm docker:down
pnpm docker:up
```

**Redis connection failed:**

```bash
# Check Redis container
docker ps | grep redis

# Restart Redis
pnpm docker:down
pnpm docker:up
```

**API not responding:**

```bash
# Start API
cd apps/api
pnpm dev
```

**Dashboard not responding:**

```bash
# Start Dashboard
cd packages/dashboard
pnpm dev
```

---

## Best Practices

### Script Development

1. **Single Responsibility:** Each script should have one clear purpose
2. **Idempotency:** Scripts should be safe to run multiple times
3. **Error Handling:** Fail fast with clear error messages
4. **Documentation:** Include inline comments and usage examples
5. **Cross-Platform:** Prefer Node.js/TypeScript over shell scripts when possible
6. **Logging:** Provide informative output during execution

### Script Execution

1. **Read documentation first:** Understand what the script does
2. **Check prerequisites:** Ensure all dependencies are installed
3. **Use npm scripts:** Prefer `pnpm <script>` over direct execution
4. **Review output:** Check for errors and warnings
5. **Keep logs:** Save output for troubleshooting

---

## Contributing

When adding new scripts:

1. Place in appropriate category directory
2. Add documentation to this README
3. Add npm script if applicable
4. Include usage examples
5. Add error handling
6. Test on clean environment
7. Update implementation plan if major changes

---

## Support

For issues or questions:

1. Check this documentation
2. Run diagnostics: `pnpm diagnose`
3. Check logs in `logs/` directory
4. Review error messages carefully
5. Consult the main README.md

---

## Change Log

### 2025-12-10 - Script Consolidation

**Deleted:**

- Archived Prisma troubleshooting scripts (15 files)
- `explore-aethermind.sh` (one-off exploration)
- `fix-critical-docs.sh` (one-off documentation fix)
- `Claude.bat` (personal utility)
- `scripts/validate-mvp.ps1` (duplicate, kept Node.js version)
- `scripts/smoke-test.ps1` (duplicate, kept Node.js version)
- `scripts/health-check-production.sh` (consolidated)
- `scripts/production-verification.sh` (consolidated)

**Added:**

- `scripts/production-health-check.sh` (unified health check with 3 modes)

**Result:** Reduced from 48 scripts to 30 scripts (37.5% reduction)
