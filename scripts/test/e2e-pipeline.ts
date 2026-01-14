/**
 * End-to-End Validation Script
 * 
 * Tests the complete telemetry pipeline:
 * 1. SDK captures OpenAI call
 * 2. Events sent to /v1/ingest
 * 3. Data stored in PostgreSQL
 * 4. Verify in database
 */

import { initAethermind } from '@aethermind/agent';
import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function setupTestOrganization() {
  console.log('📝 Setting up test organization...');
  
  // Generate test API key
  const testApiKey = `aether_test_${Date.now()}`;
  const apiKeyHash = await bcrypt.hash(testApiKey, 10);
  
  // Create test organization
  const org = await prisma.organization.create({
    data: {
      name: 'Test Organization',
      slug: `test-org-${Date.now()}`,
      apiKeyHash,
      plan: 'FREE',
      rateLimitPerMin: 100,
    },
  });
  
  console.log(`✅ Created organization: ${org.id}`);
  console.log(`📋 API Key: ${testApiKey}`);
  
  return { org, apiKey: testApiKey };
}

async function testSDKCapture(apiKey: string) {
  console.log('\n🧪 Testing SDK telemetry capture...');
  
  // Initialize SDK with test API key
  initAethermind({
    apiKey,
    endpoint: process.env.AETHERMIND_API_URL || 'http://localhost:3001',
    flushInterval: 5000, // 5 seconds for testing
    batchSize: 10,
  });
  
  // Make a test OpenAI call
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });
  
  console.log('📞 Making test OpenAI call...');
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "Test successful" in exactly 2 words.' },
      ],
      max_tokens: 10,
    });
    
    console.log(`✅ OpenAI call successful`);
    console.log(`📊 Usage: ${JSON.stringify(response.usage)}`);
    console.log(`💬 Response: ${response.choices[0]?.message.content}`);
    
    return true;
  } catch (error) {
    console.error('❌ OpenAI call failed:', error);
    return false;
  }
}

async function verifyDatabaseStorage(orgId: string) {
  console.log('\n🔍 Verifying database storage...');
  
  // Wait for async processing
  console.log('⏳ Waiting 10 seconds for event processing...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Check for events in database
  const events = await prisma.telemetryEvent.findMany({
    where: {
      organizationId: orgId,
    },
    orderBy: {
      timestamp: 'desc',
    },
    take: 10,
  });
  
  console.log(`📦 Found ${events.length} events in database`);
  
  if (events.length > 0) {
    console.log('\n✅ Sample event:');
    const event = events[0];
    console.log(`  Provider: ${event.provider}`);
    console.log(`  Model: ${event.model}`);
    console.log(`  Tokens: ${event.totalTokens}`);
    console.log(`  Cost: $${event.cost.toString()}`);
    console.log(`  Latency: ${event.latency}ms`);
    console.log(`  Status: ${event.status}`);
    return true;
  } else {
    console.log('❌ No events found in database');
    return false;
  }
}

async function cleanup(orgId: string) {
  console.log('\n🧹 Cleaning up test data...');
  
  // Delete test events
  await prisma.telemetryEvent.deleteMany({
    where: { organizationId: orgId },
  });
  
  // Delete test organization
  await prisma.organization.delete({
    where: { id: orgId },
  });
  
  console.log('✅ Cleanup complete');
}

async function main() {
  console.log('🚀 Aethermind E2E Validation Test\n');
  console.log('='.repeat(50));
  
  let org: any;
  let success = false;
  
  try {
    // Step 1: Setup
    const { org: testOrg, apiKey } = await setupTestOrganization();
    org = testOrg;
    
    // Step 2: Test SDK
    const sdkSuccess = await testSDKCapture(apiKey);
    if (!sdkSuccess) {
      throw new Error('SDK test failed');
    }
    
    // Step 3: Verify storage
    const dbSuccess = await verifyDatabaseStorage(org.id);
    if (!dbSuccess) {
      throw new Error('Database verification failed');
    }
    
    success = true;
    console.log('\n' + '='.repeat(50));
    console.log('✅ END-TO-END TEST PASSED');
    console.log('='.repeat(50));
    console.log('\nPipeline validated:');
    console.log('  1. SDK captured event ✅');
    console.log('  2. Event sent to API ✅');
    console.log('  3. Event stored in DB ✅');
    
  } catch (error) {
    console.error('\n' + '='.repeat(50));
    console.error('❌ END-TO-END TEST FAILED');
    console.error('='.repeat(50));
    console.error('\nError:', error);
  } finally {
    // Cleanup
    if (org) {
      await cleanup(org.id);
    }
    
    await prisma.$disconnect();
    process.exit(success ? 0 : 1);
  }
}

// Check prerequisites
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY environment variable not set');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  process.exit(1);
}

main();
