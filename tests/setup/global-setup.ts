module.exports = async function globalSetup() {
    console.log('🚀 Global test setup starting...');

    const requiredEnvVars = ['DATABASE_URL', 'REDIS_URL'];
    const missing = requiredEnvVars.filter(v => !process.env[v]);

    if (missing.length > 0) {
        console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
        console.warn('   Tests may fail. Please check your .env file.');
    }

    console.log('✓ Global setup complete');
};
