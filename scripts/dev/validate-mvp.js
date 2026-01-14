// MVP Validation Script for Windows (Node.js)
// Run with: node scripts/validate-mvp.js

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m',
};

async function checkCommand(command) {
    try {
        await execAsync(command);
        return true;
    } catch {
        return false;
    }
}

async function checkUrl(url) {
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
        return response.ok;
    } catch {
        return false;
    }
}

async function main() {
    console.log('🧪 Validating Aethermind MVP...\n');

    let allPassed = true;

    // Check 1: Docker
    console.log('1. Checking Docker...');
    const dockerRunning = await checkCommand('docker ps');
    if (dockerRunning) {
        console.log(`${colors.green}✓ Docker is running${colors.reset}`);
    } else {
        console.log(`${colors.red}✗ Docker is not running${colors.reset}`);
        console.log('  Please start Docker Desktop');
        allPassed = false;
    }

    // Check 2: PostgreSQL
    console.log('\n2. Checking PostgreSQL...');
    try {
        const { stdout } = await execAsync('docker ps --filter "name=postgres" --format "{{.Names}}"');
        if (stdout.includes('postgres')) {
            console.log(`${colors.green}✓ PostgreSQL is running${colors.reset}`);
        } else {
            console.log(`${colors.red}✗ PostgreSQL is not running${colors.reset}`);
            console.log('  Run: pnpm docker:up');
            allPassed = false;
        }
    } catch {
        console.log(`${colors.red}✗ PostgreSQL check failed${colors.reset}`);
        allPassed = false;
    }

    // Check 3: Redis
    console.log('\n3. Checking Redis...');
    try {
        const { stdout } = await execAsync('docker ps --filter "name=redis" --format "{{.Names}}"');
        if (stdout.includes('redis')) {
            console.log(`${colors.green}✓ Redis is running${colors.reset}`);
        } else {
            console.log(`${colors.red}✗ Redis is not running${colors.reset}`);
            console.log('  Run: pnpm docker:up');
            allPassed = false;
        }
    } catch {
        console.log(`${colors.red}✗ Redis check failed${colors.reset}`);
        allPassed = false;
    }

    // Check 4: API
    console.log('\n4. Checking API...');
    const apiRunning = await checkUrl('http://localhost:3001/health');
    if (apiRunning) {
        console.log(`${colors.green}✓ API is responding${colors.reset}`);
    } else {
        console.log(`${colors.yellow}! API is not responding${colors.reset}`);
        console.log('  Run: cd apps/api && pnpm dev');
    }

    // Check 5: Dashboard
    console.log('\n5. Checking Dashboard...');
    const dashboardRunning = await checkUrl('http://localhost:3000');
    if (dashboardRunning) {
        console.log(`${colors.green}✓ Dashboard is responding${colors.reset}`);
    } else {
        console.log(`${colors.yellow}! Dashboard is not responding${colors.reset}`);
        console.log('  Run: cd packages/dashboard && pnpm dev');
    }

    // Check 6: Database Connection
    console.log('\n6. Testing database connection...');
    try {
        const { stdout } = await execAsync('docker exec -i aethermind-postgres psql -U aethermind -d aethermind -c "SELECT 1" 2>&1 || docker exec -i postgres psql -U postgres -d aethermind -c "SELECT 1" 2>&1');
        if (stdout.includes('1 row')) {
            console.log(`${colors.green}✓ Database connection successful${colors.reset}`);
        } else {
            console.log(`${colors.yellow}! Database connection uncertain${colors.reset}`);
        }
    } catch {
        console.log(`${colors.yellow}! Could not verify database connection${colors.reset}`);
    }

    // Check 7: Redis Connection
    console.log('\n7. Testing Redis connection...');
    try {
        const { stdout } = await execAsync('docker exec -i aethermind-redis redis-cli ping 2>&1 || docker exec -i redis redis-cli ping 2>&1');
        if (stdout.includes('PONG')) {
            console.log(`${colors.green}✓ Redis connection successful${colors.reset}`);
        } else {
            console.log(`${colors.yellow}! Redis connection uncertain${colors.reset}`);
        }
    } catch {
        console.log(`${colors.yellow}! Could not verify Redis connection${colors.reset}`);
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    if (allPassed) {
        console.log(`${colors.green}✅ All critical checks passed!${colors.reset}`);
        console.log('\nNext steps:');
        console.log('  • Run tests: pnpm test');
        console.log('  • Try example: pnpm demo');
        console.log('  • Open dashboard: http://localhost:3000');
    } else {
        console.log(`${colors.red}❌ Some checks failed${colors.reset}`);
        console.log('\nPlease fix the issues above and run again.');
    }
}

main().catch(console.error);
