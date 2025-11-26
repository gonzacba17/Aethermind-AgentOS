// Setup for integration tests
import { beforeAll, afterAll } from '@jest/globals';

beforeAll(async () => {
    console.log('📦 Integration test setup...');
    // Add integration-specific setup here
});

afterAll(async () => {
    console.log('🧹 Integration test cleanup...');
    // Add integration-specific cleanup here
});
