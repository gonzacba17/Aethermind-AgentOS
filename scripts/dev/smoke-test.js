// Smoke Test - Quick validation of critical functionality
// Run with: node scripts/smoke-test.js

const API_URL = process.env.API_URL || 'http://localhost:3001';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
};

let testsPassed = 0;
let testsFailed = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`${colors.green}✓${colors.reset} ${name}`);
        testsPassed++;
    } catch (error) {
        console.log(`${colors.red}✗${colors.reset} ${name}`);
        console.log(`  ${colors.red}Error: ${error.message}${colors.reset}`);
        testsFailed++;
    }
}

async function main() {
    console.log(`${colors.cyan}🔥 Running smoke tests...${colors.reset}\n`);

    // Test 1: API Health
    await test('API health check', async () => {
        const response = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(2000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.status !== 'healthy' && data.status !== 'ok') {
            throw new Error('API not healthy');
        }
    });

    // Test 2: Create Agent
    let agentId;
    await test('Create agent', async () => {
        const response = await fetch(`${API_URL}/api/agents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'smoke-test-agent',
                model: 'gpt-4',
                systemPrompt: 'You are a test agent',
            }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data.id) throw new Error('No agent ID returned');
        agentId = data.id;
    });

    // Test 3: Get Agent
    await test('Get agent', async () => {
        if (!agentId) throw new Error('No agent ID from previous test');
        const response = await fetch(`${API_URL}/api/agents/${agentId}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.id !== agentId) throw new Error('Agent ID mismatch');
    });

    // Test 4: Execute Task
    let executionId;
    await test('Execute task', async () => {
        if (!agentId) throw new Error('No agent ID from previous test');
        const response = await fetch(`${API_URL}/api/agents/${agentId}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input: 'test' }),
            signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data.executionId) throw new Error('No execution ID returned');
        executionId = data.executionId;
    });

    // Test 5: Get Logs
    await test('Get logs', async () => {
        const response = await fetch(`${API_URL}/api/logs?limit=10`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Logs not an array');
    });

    // Test 6: Get Costs
    await test('Get costs', async () => {
        const response = await fetch(`${API_URL}/api/costs`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Costs not an array');
    });

    // Test 7: Dashboard Accessibility
    await test('Dashboard accessible', async () => {
        const response = await fetch(DASHBOARD_URL, { signal: AbortSignal.timeout(2000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
    });

    // Test 8: Delete Agent
    await test('Delete agent', async () => {
        if (!agentId) throw new Error('No agent ID from previous test');
        const response = await fetch(`${API_URL}/api/agents/${agentId}`, {
            method: 'DELETE',
        });
        if (response.status !== 204 && response.status !== 200) {
            throw new Error(`HTTP ${response.status}`);
        }
    });

    // Summary
    console.log('\n' + '='.repeat(50));
    const total = testsPassed + testsFailed;
    console.log(`Tests: ${total} total, ${colors.green}${testsPassed} passed${colors.reset}, ${testsFailed > 0 ? colors.red : colors.green}${testsFailed} failed${colors.reset}`);

    if (testsFailed === 0) {
        console.log(`\n${colors.green}✅ All smoke tests passed!${colors.reset}`);
        process.exit(0);
    } else {
        console.log(`\n${colors.red}❌ Some tests failed${colors.reset}`);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error);
    process.exit(1);
});
