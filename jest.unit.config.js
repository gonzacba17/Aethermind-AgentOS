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
                tsconfig: {
                    esModuleInterop: true,
                    allowSyntheticDefaultImports: true,
                },
            },
        ],
    },
    testMatch: [
        '**/tests/unit/**/*.test.ts',
    ],
    collectCoverageFrom: [
        'apps/api/src/**/*.ts',
        '!apps/api/src/**/*.test.ts',
        '!apps/api/src/**/*.d.ts',
    ],
    coverageDirectory: 'coverage/unit',
    coverageReporters: ['text', 'lcov', 'html'],
    verbose: true,
    testTimeout: 10000,
};
