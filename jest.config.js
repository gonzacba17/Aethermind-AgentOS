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
    '**/__tests__/**/*.test.ts',
    '**/packages/**/src/**/*.test.ts',
  ],
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    'apps/*/src/**/*.ts',
    '!packages/*/src/**/*.test.ts',
    '!apps/*/src/**/*.test.ts',
    '!packages/*/src/**/*.d.ts',
    '!apps/*/src/**/*.d.ts',
    '!**/node_modules/**',
    '!**/{.next,dist,coverage}/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      lines: 20,
      functions: 20,
      branches: 20,
      statements: 20,
    },
  },
  verbose: true,
  testTimeout: 10000,
};
