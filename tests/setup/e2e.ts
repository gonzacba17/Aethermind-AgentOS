// Setup for E2E tests
import { beforeAll, afterAll } from '@jest/globals';

beforeAll(async () => {
    console.log('🎭 E2E test setup...');
    // Verify services are running
    const servicesReady = await checkServices();
    if (!servicesReady) {
        console.warn('⚠️  Some services may not be ready. Tests might fail.');
    }
});

afterAll(async () => {
    console.log('🧹 E2E test cleanup...');
    // Add E2E-specific cleanup here
});

async function checkServices(): Promise<boolean> {
    try {
        // Check if API is running
        const response = await fetch('http://localhost:3001/health', {
            signal: AbortSignal.timeout(2000)
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}
