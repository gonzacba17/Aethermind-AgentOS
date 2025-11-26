# Installation Guide - Aethermind AgentOS

> Complete installation and setup guide for Aethermind AgentOS v0.1.0

## Table of Contents

- [System Requirements](#system-requirements)
- [Quick Installation](#quick-installation)
- [Detailed Installation](#detailed-installation)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Platform-Specific Instructions](#platform-specific-instructions)

---

## System Requirements

### Minimum Requirements

- **Operating System**: Windows 10+, macOS 12+, or Linux (Ubuntu 20.04+)
- **Node.js**: 20.0.0 or higher
- **pnpm**: 9.0.0 or higher
- **Docker Desktop**: Latest stable version
- **RAM**: 4GB minimum, 8GB recommended
- **Disk Space**: 2GB for dependencies and data

### Required API Keys

At least one LLM provider API key:
- **OpenAI** - [Get API key](https://platform.openai.com/api-keys)
- **Anthropic** - [Get API key](https://console.anthropic.com/)
- **Google AI** - [Get API key](https://makersuite.google.com/app/apikey)

---

## Quick Installation

For experienced developers who want to get started quickly:

```bash
# 1. Clone repository
git clone <repository-url>
cd aethermind-agentos

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 4. Start services
pnpm docker:up

# 5. Generate API key
pnpm generate-api-key
# Add the hash to .env

# 6. Run demo
pnpm demo

# 7. Start development
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) for the dashboard.

---

## Detailed Installation

### Step 1: Install Prerequisites

#### Node.js 20+

**Windows:**
```powershell
# Using winget
winget install OpenJS.NodeJS.LTS

# Or download from https://nodejs.org/
```

**macOS:**
```bash
# Using Homebrew
brew install node@20

# Or download from https://nodejs.org/
```

**Linux (Ubuntu/Debian):**
```bash
# Using NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Verify installation:**
```bash
node --version  # Should show v20.x.x or higher
```

---

#### pnpm 9+

```bash
# Enable corepack (included with Node.js 16+)
corepack enable

# Install pnpm
corepack prepare pnpm@9.0.0 --activate

# Verify installation
pnpm --version  # Should show 9.x.x or higher
```

**Alternative installation:**
```bash
npm install -g pnpm@9
```

---

#### Docker Desktop

**Windows:**
1. Download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
2. Run installer
3. Start Docker Desktop
4. Verify: `docker --version`

**macOS:**
1. Download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
2. Drag to Applications
3. Start Docker Desktop
4. Verify: `docker --version`

**Linux:**
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
```

---

### Step 2: Clone Repository

```bash
# HTTPS
git clone https://github.com/aethermind/agentos.git
cd aethermind-agentos

# SSH
git clone git@github.com:aethermind/agentos.git
cd aethermind-agentos
```

---

### Step 3: Install Dependencies

```bash
# Install all workspace dependencies
pnpm install

# This will install dependencies for:
# - Root workspace
# - apps/api
# - packages/core
# - packages/sdk
# - packages/dashboard
# - packages/create-aethermind-app
# - examples/basic-agent
```

**Expected output:**
```
Progress: resolved X, reused Y, downloaded Z, added W
Done in Xs
```

---

### Step 4: Environment Configuration

#### Create .env file

```bash
# Windows
copy .env.example .env

# macOS/Linux
cp .env.example .env
```

#### Edit .env file

Open `.env` in your text editor and configure the following:

```env
# ============================================
# DATABASE CONFIGURATION (REQUIRED)
# ============================================
POSTGRES_USER=aethermind
POSTGRES_PASSWORD=your_secure_password_here  # CHANGE THIS!
POSTGRES_DB=aethermind
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Database URL (auto-constructed from above)
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}

# ============================================
# LLM API KEYS (At least one required)
# ============================================
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
GOOGLE_API_KEY=your-google-api-key-here

# ============================================
# API AUTHENTICATION (REQUIRED)
# ============================================
# Generate with: pnpm generate-api-key
API_KEY_HASH=  # Will be filled after generation

# ============================================
# OPTIONAL CONFIGURATION
# ============================================
NODE_ENV=development
PORT=3001
DASHBOARD_PORT=3000

# Redis (optional, for caching)
REDIS_HOST=localhost
REDIS_PORT=6379

# Hot reload (development only)
ENABLE_HOT_RELOAD=true

# Logging
LOG_LEVEL=info  # debug, info, warn, error
```

---

### Step 5: Generate API Key

```bash
pnpm generate-api-key
```

**Output:**
```
===========================================
Aethermind AgentOS - API Key Generator
===========================================

Generated API Key (save this securely):
ak_1234567890abcdefghijklmnopqrstuvwxyz

Generated API Key Hash (add to .env):
$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ

===========================================
IMPORTANT:
1. Save the API Key in a secure location
2. Add the API Key Hash to your .env file as API_KEY_HASH
3. The API Key cannot be recovered if lost
===========================================
```

**Add the hash to .env:**
```env
API_KEY_HASH=$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ
```

**Save the API Key** - You'll need it to authenticate API requests.

---

### Step 6: Start Docker Services

```bash
# Start PostgreSQL and Redis
pnpm docker:up

# Wait 30 seconds for services to initialize
```

**Verify services are running:**
```bash
docker ps
```

**Expected output:**
```
CONTAINER ID   IMAGE          STATUS         PORTS
abc123...      postgres:15    Up 30 seconds  0.0.0.0:5432->5432/tcp
def456...      redis:7        Up 30 seconds  0.0.0.0:6379->6379/tcp
```

---

### Step 7: Database Migration

```bash
# Run Prisma migrations
pnpm db:migrate
```

**Expected output:**
```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "aethermind"

Applying migration `20241126_init`
Migration applied successfully
```

---

### Step 8: Verification

```bash
# Run validation script
pnpm validate
```

**This checks:**
- ✅ Node.js version
- ✅ pnpm version
- ✅ Docker running
- ✅ PostgreSQL connection
- ✅ Redis connection
- ✅ Environment variables
- ✅ API key configuration
- ✅ LLM provider API keys

**Expected output:**
```
✓ Node.js version: 20.10.0
✓ pnpm version: 9.0.0
✓ Docker is running
✓ PostgreSQL connection successful
✓ Redis connection successful
✓ Environment variables configured
✓ API key hash configured
✓ OpenAI API key configured

All checks passed! ✓
```

---

### Step 9: Run Demo

```bash
pnpm demo
```

**This will:**
1. Create sample agents
2. Execute a multi-agent workflow
3. Display results and costs

**Expected output:**
```
🚀 Aethermind AgentOS Demo

Creating agents...
✓ Created researcher agent
✓ Created analyst agent
✓ Created writer agent

Executing workflow...
✓ Step 1: Research completed (5.2s, $0.05)
✓ Step 2: Analysis completed (3.8s, $0.04)
✓ Step 3: Writing completed (4.1s, $0.03)

Workflow completed successfully!
Total cost: $0.12
Total time: 13.1s
```

---

### Step 10: Start Development Servers

**Option 1: Start all services**
```bash
pnpm dev
```

**Option 2: Start services individually**

Terminal 1 - API Server:
```bash
cd apps/api
pnpm dev
```

Terminal 2 - Dashboard:
```bash
cd packages/dashboard
pnpm dev
```

**Access the application:**
- **Dashboard**: [http://localhost:3000](http://localhost:3000)
- **API**: [http://localhost:3001](http://localhost:3001)
- **API Health**: [http://localhost:3001/health](http://localhost:3001/health)

---

## Environment Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | PostgreSQL password | `your_secure_password` |
| `API_KEY_HASH` | Bcrypt hash of API key | `$2b$10$...` |
| At least one of: | | |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `ANTHROPIC_API_KEY` | Anthropic API key | `sk-ant-...` |
| `GOOGLE_API_KEY` | Google AI API key | `AIza...` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3001` | API server port |
| `DASHBOARD_PORT` | `3000` | Dashboard port |
| `LOG_LEVEL` | `info` | Logging level |
| `ENABLE_HOT_RELOAD` | `true` | Hot reload in dev |
| `MAX_CONCURRENT_AGENTS` | `10` | Max concurrent executions |

---

## Database Setup

### PostgreSQL Configuration

The Docker Compose file creates a PostgreSQL 15 instance with:
- **Port**: 5432
- **Database**: aethermind
- **User**: aethermind (configurable)
- **Password**: From `.env`
- **Volume**: `postgres-data` (persistent)

### Manual PostgreSQL Setup

If not using Docker:

```bash
# Install PostgreSQL 15+
# Create database
createdb aethermind

# Update DATABASE_URL in .env
DATABASE_URL=postgresql://user:password@localhost:5432/aethermind

# Run migrations
pnpm db:migrate
```

---

## Verification

### Health Check

```bash
curl http://localhost:3001/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-11-26T10:00:00Z",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### Test API

```bash
curl -H "X-API-Key: your-api-key" \
     http://localhost:3001/api/agents
```

**Expected response:**
```json
{
  "agents": []
}
```

---

## Troubleshooting

### Docker not starting

**Problem**: `docker: command not found`

**Solution**:
```bash
# Verify Docker is installed
docker --version

# Start Docker Desktop (Windows/macOS)
# Or start Docker daemon (Linux)
sudo systemctl start docker
```

---

### PostgreSQL connection failed

**Problem**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solutions**:
1. **Check Docker is running**:
   ```bash
   docker ps | grep postgres
   ```

2. **Restart Docker services**:
   ```bash
   pnpm docker:down
   pnpm docker:up
   ```

3. **Check PostgreSQL logs**:
   ```bash
   docker logs postgres
   ```

4. **Verify credentials in .env**:
   ```env
   POSTGRES_PASSWORD=your_password  # Must match docker-compose.yml
   ```

---

### API key authentication failed

**Problem**: `401 Unauthorized` or `403 Forbidden`

**Solutions**:
1. **Verify API key hash in .env**:
   ```bash
   # Regenerate API key
   pnpm generate-api-key
   # Add new hash to .env
   ```

2. **Check API key in request**:
   ```bash
   curl -H "X-API-Key: ak_your_key_here" http://localhost:3001/api/agents
   ```

---

### LLM provider errors

**Problem**: `Error: Invalid API key for openai`

**Solutions**:
1. **Verify API key is valid**:
   ```bash
   # Test OpenAI key
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

2. **Check API key format**:
   - OpenAI: `sk-...`
   - Anthropic: `sk-ant-...`
   - Google: `AIza...`

3. **Ensure key has credits/quota**

---

### Port already in use

**Problem**: `Error: listen EADDRINUSE: address already in use :::3001`

**Solutions**:
1. **Find process using port**:
   ```bash
   # Windows
   netstat -ano | findstr :3001
   
   # macOS/Linux
   lsof -i :3001
   ```

2. **Kill process or change port**:
   ```env
   # In .env
   PORT=3002
   ```

---

### pnpm install fails

**Problem**: `ERR_PNPM_FETCH_404`

**Solutions**:
1. **Clear pnpm cache**:
   ```bash
   pnpm store prune
   pnpm install
   ```

2. **Delete node_modules and reinstall**:
   ```bash
   rm -rf node_modules
   pnpm install
   ```

---

## Platform-Specific Instructions

### Windows

**PowerShell Execution Policy**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Path Separators**:
Use `\` or `/` (both work in most cases)

**Docker Desktop**:
- Must be running before `pnpm docker:up`
- Check system tray for Docker icon

---

### macOS

**Rosetta 2 (Apple Silicon)**:
```bash
# If using M1/M2/M3 Mac
softwareupdate --install-rosetta
```

**Docker Desktop**:
- Use Apple Silicon version for M1/M2/M3
- Use Intel version for Intel Macs

---

### Linux

**Docker permissions**:
```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

**PostgreSQL native installation**:
```bash
sudo apt-get install postgresql-15
sudo systemctl start postgresql
```

---

## Next Steps

After successful installation:

1. **Read the User Guide**: [docs/README.md](README.md)
2. **Explore the API**: [docs/API.md](API.md)
3. **Learn Development**: [docs/DEVELOPMENT.md](DEVELOPMENT.md)
4. **Deploy to Production**: [docs/DEPLOYMENT.md](DEPLOYMENT.md)

---

**Last Updated**: 2025-11-26  
**Version**: 0.1.0  
**Maintainer**: Aethermind Team
