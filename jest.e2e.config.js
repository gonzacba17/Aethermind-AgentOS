/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                useESM: true,
            },
        ],
    },
    testMatch: [
        '**/tests/e2e/**/*.test.ts',
        '**/tests/api/**/*.test.ts',
        '**/tests/websocket/**/*.test.ts',
    ],
    collectCoverageFrom: [
        'packages/*/src/**/*.ts',
        'apps/*/src/**/*.ts',
        '!**/*.test.ts',
        '!**/*.d.ts',
    ],
    coverageDirectory: 'coverage/e2e',
    verbose: true,
    testTimeout: 60000, // 60 seconds for LLM API calls
    setupFilesAfterEnv: ['<rootDir>/tests/setup/e2e.ts'],
    globalSetup: '<rootDir>/tests/setup/global-setup.ts',
    globalTeardown: '<rootDir>/tests/setup/global-teardown.ts',
    maxWorkers: 1, // Run tests serially to avoid rate limits
};
