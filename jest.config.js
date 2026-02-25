/**
 * Unified Jest configuration using projects for different test suites.
 * Replaces: jest.unit.config.js, jest.integration.config.js, jest.e2e.config.js
 *
 * Usage:
 *   pnpm test                     → runs default (unit + integration)
 *   pnpm test -- --selectProjects unit
 *   pnpm test -- --selectProjects integration
 *   pnpm test -- --selectProjects e2e
 * @type {import('jest').Config}
 */

const sharedConfig = {
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
  verbose: true,
};

export default {
  // Global coverage settings
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    'apps/*/src/**/*.ts',
    '!**/*.test.ts',
    '!**/*.d.ts',
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

  projects: [
    // ─── Unit Tests ────────────────────────────────────────────────
    {
      ...sharedConfig,
      displayName: 'unit',
      testMatch: ['**/tests/unit/**/*.test.ts'],
      collectCoverageFrom: [
        'apps/api/src/**/*.ts',
        '!apps/api/src/**/*.test.ts',
        '!apps/api/src/**/*.d.ts',
      ],
      coverageDirectory: 'coverage/unit',
      testTimeout: 10000,
    },

    // ─── Integration Tests ─────────────────────────────────────────
    {
      ...sharedConfig,
      displayName: 'integration',
      testMatch: ['**/tests/integration/**/*.test.ts'],
      coverageDirectory: 'coverage/integration',
      testTimeout: 30000,
    },

    // ─── E2E Tests ─────────────────────────────────────────────────
    {
      ...sharedConfig,
      displayName: 'e2e',
      testMatch: [
        '**/tests/e2e/**/*.test.ts',
        '**/tests/api/**/*.test.ts',
        '**/tests/websocket/**/*.test.ts',
      ],
      coverageDirectory: 'coverage/e2e',
      testTimeout: 60000,
      setupFilesAfterEnv: ['<rootDir>/tests/setup/e2e.ts'],
      globalSetup: '<rootDir>/tests/setup/global-setup.ts',
      globalTeardown: '<rootDir>/tests/setup/global-teardown.ts',
      maxWorkers: 1,
    },
  ],
};
