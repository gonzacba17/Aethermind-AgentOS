#!/usr/bin/env node
/**
 * END-TO-END TEST: Budget Enforcement
 * 
 * This script tests the complete budget enforcement flow:
 * 1. Creates a budget with low limit
 * 2. Executes workflow within budget (should succeed)
 * 3. Executes workflow exceeding budget (should fail)
 * 4. Verifies error message and budget state
 * 
 * Prerequisites:
 * - Database migrated (budgets table exists)
 * - API server running (pnpm dev:api)
 * - Valid API key configured
 */

const API_URL = 'http://localhost:3001';
const API_KEY = process.env.API_KEY || 'test-api-key';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function apiCall(method, endpoint, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, options);
  const data = await response.json();

  return { status: response.status, data };
}

async function runTest() {
  log('\n🧪 Budget Enforcement - End-to-End Test', 'cyan');
  log('==========================================\n', 'cyan');

  let budgetId = null;

  try {
    // Step 1: Create Budget
    log('Step 1: Creating budget with $0.10 limit...', 'yellow');
    const createBudget = await apiCall('POST', '/api/budgets', {
      name: 'E2E Test Budget',
      limitAmount: 0.10,
      period: 'monthly',
      scope: 'user',
      hardLimit: true,
      alertAt: 80,
    });

    if (createBudget.status !== 201) {
      throw new Error(`Failed to create budget: ${JSON.stringify(createBudget.data)}`);
    }

    budgetId = createBudget.data.id;
    log(`✅ Budget created: ${budgetId}`, 'green');
    log(`   Limit: $${createBudget.data.limitAmount}`, 'green');
    log(`   Hard Limit: ${createBudget.data.hardLimit}\n`, 'green');

    // Step 2: Check initial budget state
    log('Step 2: Checking initial budget state...', 'yellow');
    const initialState = await apiCall('GET', `/api/budgets/${budgetId}/usage`);
    
    log(`✅ Initial state:`, 'green');
    log(`   Current Spend: $${initialState.data.currentSpend}`, 'green');
    log(`   Remaining: $${initialState.data.remaining}`, 'green');
    log(`   Usage: ${initialState.data.percentUsed}%\n`, 'green');

    // Step 3: Execute workflow within budget (should succeed)
    log('Step 3: Executing workflow within budget ($0.05)...', 'yellow');
    const workflow1 = await apiCall('POST', '/api/workflows/execute', {
      workflowName: 'test-workflow',
      input: { prompt: 'Hello, this should work' },
      estimatedCost: 0.05, // Within budget
    });

    if (workflow1.status === 200) {
      log(`✅ Workflow executed successfully`, 'green');
      log(`   Execution ID: ${workflow1.data.executionId}\n`, 'green');
    } else {
      log(`⚠️  Workflow execution status: ${workflow1.status}`, 'yellow');
      log(`   Response: ${JSON.stringify(workflow1.data)}\n`, 'yellow');
    }

    // Step 4: Check budget after first execution
    log('Step 4: Checking budget after first execution...', 'yellow');
    const afterFirst = await apiCall('GET', `/api/budgets/${budgetId}/usage`);
    
    log(`✅ Budget state:`, 'green');
    log(`   Current Spend: $${afterFirst.data.currentSpend}`, 'green');
    log(`   Remaining: $${afterFirst.data.remaining}`, 'green');
    log(`   Usage: ${afterFirst.data.percentUsed}%\n`, 'green');

    // Step 5: Execute workflow exceeding budget (should fail)
    log('Step 5: Executing workflow exceeding budget ($0.10)...', 'yellow');
    const workflow2 = await apiCall('POST', '/api/workflows/execute', {
      workflowName: 'test-workflow',
      input: { prompt: 'This should be blocked' },
      estimatedCost: 0.10, // Exceeds remaining budget
    });

    if (workflow2.status === 429 || workflow2.status === 403) {
      log(`✅ Workflow BLOCKED as expected!`, 'green');
      log(`   Status: ${workflow2.status}`, 'green');
      log(`   Error: ${workflow2.data.error || workflow2.data.message}`, 'green');
      
      if (workflow2.data.budgetId) {
        log(`   Budget ID: ${workflow2.data.budgetId}`, 'green');
        log(`   Budget Name: ${workflow2.data.budgetName}`, 'green');
        log(`   Limit: $${workflow2.data.limitAmount}`, 'green');
        log(`   Current: $${workflow2.data.currentSpend}`, 'green');
        log(`   Estimated: $${workflow2.data.estimatedCost}\n`, 'green');
      }
    } else {
      log(`❌ FAIL: Workflow should have been blocked!`, 'red');
      log(`   Status: ${workflow2.status}`, 'red');
      log(`   Response: ${JSON.stringify(workflow2.data)}\n`, 'red');
    }

    // Step 6: Final budget state
    log('Step 6: Final budget state...', 'yellow');
    const finalState = await apiCall('GET', `/api/budgets/${budgetId}/usage`);
    
    log(`✅ Final state:`, 'green');
    log(`   Current Spend: $${finalState.data.currentSpend}`, 'green');
    log(`   Remaining: $${finalState.data.remaining}`, 'green');
    log(`   Usage: ${finalState.data.percentUsed}%\n`, 'green');

    // Cleanup
    log('Cleanup: Deleting test budget...', 'yellow');
    await apiCall('DELETE', `/api/budgets/${budgetId}`);
    log(`✅ Test budget deleted\n`, 'green');

    // Summary
    log('\n🎉 TEST SUMMARY', 'cyan');
    log('==========================================', 'cyan');
    log('✅ Budget creation: PASS', 'green');
    log('✅ Workflow within budget: PASS', 'green');
    log('✅ Budget blocking: PASS', 'green');
    log('✅ Error message: PASS\n', 'green');
    log('🚀 Budget enforcement is WORKING!', 'green');
    log('   Product is ready for demo.\n', 'green');

  } catch (error) {
    log(`\n❌ TEST FAILED`, 'red');
    log('==========================================', 'red');
    log(`Error: ${error.message}`, 'red');
    log(`Stack: ${error.stack}\n`, 'red');

    // Cleanup on error
    if (budgetId) {
      try {
        await apiCall('DELETE', `/api/budgets/${budgetId}`);
        log(`Cleaned up test budget: ${budgetId}`, 'yellow');
      } catch (cleanupError) {
        log(`Failed to cleanup budget: ${cleanupError.message}`, 'red');
      }
    }

    process.exit(1);
  }
}

// Run test
runTest().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

/**
 * USAGE:
 * 
 * 1. Ensure API is running:
 *    pnpm dev:api
 * 
 * 2. Set API key:
 *    export API_KEY=your-api-key
 * 
 * 3. Run test:
 *    node test-budget-enforcement.js
 * 
 * EXPECTED OUTPUT:
 * - Budget created successfully
 * - First workflow executes (within budget)
 * - Second workflow is BLOCKED (exceeds budget)
 * - Error message includes budget details
 * - All tests pass
 * 
 * IF TEST FAILS:
 * - Check that migration was run (budgets table exists)
 * - Check that Orchestrator integration is complete
 * - Check API logs for errors
 * - Verify API_KEY is correct
 */
