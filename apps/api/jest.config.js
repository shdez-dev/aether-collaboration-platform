/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 75,
      statements: 75,
    },
    './src/services/': {
      branches: 80,
      functions: 80,
      lines: 85,
      statements: 85,
    },
    './src/controllers/': {
      branches: 75,
      functions: 75,
      lines: 80,
      statements: 80,
    },
    './src/middleware/': {
      branches: 80,
      functions: 80,
      lines: 85,
      statements: 85,
    },
  },
  moduleNameMapper: {
    '^@aether/types$': '<rootDir>/../../packages/shared-types/src',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testTimeout: 10000,
  verbose: true,
};
