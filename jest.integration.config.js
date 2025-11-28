/** @type {import('jest').Config} */
export default {
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
        '**/tests/integration/**/*.test.ts',
    ],
    collectCoverageFrom: [
        'packages/*/src/**/*.ts',
        'apps/*/src/**/*.ts',
        '!**/*.test.ts',
        '!**/*.d.ts',
    ],
    coverageDirectory: 'coverage/integration',
    verbose: true,
    testTimeout: 30000,
};