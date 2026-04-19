/**
 * Scoped Jest configuration for security-relevant modules only.
 *
 * Usage:
 *   npx jest --config jest.config.scoped.js --coverage
 *
 * This collects coverage only for the modules exercised by the
 * security test suites, producing the "47.5% scoped line coverage"
 * number shown in the demo dashboard.
 */
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const scopedConfig = {
  setupFilesAfterSetup: undefined,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  testMatch: ['<rootDir>/__tests__/security/**/*.test.ts'],
  collectCoverageFrom: [
    'src/lib/server/auth.ts',
    'src/lib/server/db.ts',
    'src/lib/server/facets-service.ts',
    'src/lib/server/moderation-evaluator.ts',
    'src/lib/server/prompt-injection.ts',
    'src/lib/server/rate-limit.ts',
    'src/lib/server/request-guards.ts',
    'src/lib/server/session-crypto.ts',
    'src/lib/validations.ts',
  ],
  coverageReporters: ['json-summary', 'text', 'lcov'],
};

module.exports = createJestConfig(scopedConfig);
