# Changelog

All notable changes to Aethermind AgentOS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

**P0 Critical Improvements (2025-12-07)**

- GitHub Actions CI/CD pipeline with automated tests
- Sentry integration for error tracking and monitoring
- Rate limiting on authentication endpoints (5 attempts per 15 minutes)
- PrismaClient singleton pattern to prevent connection pool exhaustion
- Sentry DSN configuration in environment files

### Changed

**P0 Critical Improvements (2025-12-07)**

- JWT_SECRET now throws error if weak or missing in production
- Frozen lockfile enforced in Railway deployments
- Consolidated health check endpoints (removed duplicate /health)
- PrismaClient refactored to singleton pattern in `apps/api/src/lib/prisma.ts`

### Fixed

**P0 Critical Improvements (2025-12-07)**

- Fixed non-null assertion in orchestrator initialization (changed to `?? null`)
- Fixed multiple PrismaClient instances causing memory leaks
- Fixed potential brute force vulnerability in auth endpoints

### Security

**P0 Critical Improvements (2025-12-07)**

- Enhanced JWT secret validation (minimum 32 characters, throws error in production)
- Added rate limiting to prevent brute force attacks on auth routes
- Improved error tracking with Sentry integration
- Singleton pattern for PrismaClient prevents connection pool exhaustion

---

### Added (Sprints 1-4)

**Testing Infrastructure (Sprint 1)**

- Comprehensive test suite with 146+ tests across 6 categories
- Unit tests for OpenAIProvider (33 tests), PrismaStore (58 tests), and sanitizer
- Integration tests for Orchestrator (37 tests) with Bull queue
- API tests for agents routes (32 tests) with Zod validation
- E2E and WebSocket tests for complete workflows
- Coverage baseline established at 20%

**Security Enhancements (Sprint 2)**

- Zod validation on 4 additional API routes (logs, costs, executions, traces)
- Content Security Policy (CSP) enabled in Helmet
- Pagination enforcement on executions and traces routes
- Structured logging for authentication failures
- Non-root user (nodejs:1001) in Docker containers
- Renovate bot for automated dependency updates

**Performance Optimizations (Sprint 3)**

- Redis caching for authentication (30-60x latency improvement: ~300ms → <10ms)
- Async bcrypt with SHA-256 hash caching
- Workflow definitions caching (5min TTL)
- Cost summary caching (1min TTL)
- Database persistence for traces and costs
- Cache invalidation on create/update operations

**Dependency Updates (Sprint 4)**

- Jest upgraded from 29.7.0 to 30.2.0
- @jest/globals upgraded to 30.2.0
- @types/jest upgraded to 30.0.0
- jest-environment-jsdom upgraded to 30.2.0
- ts-jest upgraded to 29.2.5
- Prisma maintained at 6.19.0 (latest stable 6.x)

### Changed

**Configuration**

- Magic numbers extracted to config/constants.ts
- Environment variables with proper defaults
- PostgreSQL upgraded to version 16 in Docker
- Redis 7-alpine for caching layer

**Architecture**

- Traces now persisted in database instead of in-memory
- Costs tracked and persisted per execution
- Bull queue integration for orchestrator
- Express types extended for Redis cache

### Fixed

- Authentication middleware performance bottleneck
- Missing validation on critical API endpoints
- Inconsistent pagination across routes
- Security vulnerabilities in container configuration

---

## [0.1.0] - 2024-11-25

### MVP Release

Initial release of Aethermind AgentOS - A powerful platform for building, orchestrating, and monitoring multi-agent AI systems.

#### Added

**Core Features**

- Multi-agent orchestration engine with workflow support
- Real-time monitoring and logging system
- Cost tracking and estimation for LLM API calls
- WebSocket-based real-time updates
- REST API for agent management and execution

**Infrastructure**

- PostgreSQL database integration for persistent storage
- Redis integration for caching and pub/sub
- Docker Compose setup for local development
- Prisma ORM with schema management

**LLM Provider Support**

- OpenAI (GPT-3.5, GPT-4, GPT-4-turbo)
- Anthropic (Claude models)
- Google (Gemini models)
- Ollama (local model support)

**Developer Experience**

- TypeScript SDK with full type safety
- Next.js dashboard for visual monitoring
- Comprehensive documentation
- Example projects and demos
- Hot reload for agent configurations

**Security**

- API key authentication for REST endpoints
- WebSocket authentication (API key via header or query parameter)
- Environment-based configuration
- Rate limiting support
- CORS configuration
- Log sanitization (credentials, API keys, sensitive data)

**Testing**

- Unit tests
- Integration tests
- End-to-end tests
- API endpoint tests
- WebSocket tests

#### Project Structure

- **Monorepo** with pnpm workspaces and Turborepo
- **packages/core** - Core agent orchestration engine
- **packages/sdk** - Developer SDK
- **packages/dashboard** - Monitoring dashboard
- **packages/create-aethermind-app** - CLI scaffolding tool
- **packages/vscode-extension** - VSCode snippets
- **apps/api** - REST API server
- **examples/** - Example implementations
- **tests/** - Comprehensive test suite

#### Known Limitations

- Single-region deployment only
- Basic error recovery mechanisms
- Coverage at 20% baseline (target: 60%)

#### Development History

For detailed development history including sprints 1-3 and version 0.2.0-0.6.0 milestones, see [CHANGELOG_DEV_HISTORY.md](./CHANGELOG_DEV_HISTORY.md).

---

## Future Roadmap

See [ROADMAP.md](./ROADMAP.md) for planned features and development timeline.

---

## Related Documentation

- **[Main README](README.md)** - Getting started guide
- **[Development History](CHANGELOG_DEV_HISTORY.md)** - Detailed sprint-by-sprint development (v0.2.0-0.6.0)
- **[Roadmap](ROADMAP.md)** - Strategic plan and future features
- **[Project Structure](ESTRUCTURA.md)** - Architecture overview
- **[Technical Audit](auditoria_tecnica.md)** - Quality and security assessment

---

**Contributors**: Aethermind Team  
**License**: MIT  
**Repository**: [GitHub](#)

[Unreleased]: https://github.com/aethermind/agentos/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/aethermind/agentos/releases/tag/v0.1.0
