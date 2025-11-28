import { beforeAll, afterAll } from '@jest/globals';

async function checkServices(): Promise<boolean> {
    try {
        const response = await fetch('http://localhost:3001/health', {
            signal: AbortSignal.timeout(2000)
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

beforeAll(async () => {
    console.log('🎭 E2E test setup...');
    const servicesReady = await checkServices();
    if (!servicesReady) {
        console.warn('⚠️  Some services may not be ready. Tests might fail.');
    }
});

afterAll(async () => {
    console.log('🧹 E2E test cleanup...');
});

export {};
