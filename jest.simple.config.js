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
                tsconfig: {
                    esModuleInterop: true,
                },
            },
        ],
    },
    testMatch: [
        '**/tests/api/**/*.test.ts',
    ],
    verbose: true,
    testTimeout: 60000,
    maxWorkers: 1,
};
