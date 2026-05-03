import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  // Source files use ESM-style `.js` extensions on relative imports
  // (required because package.json sets "type": "module"). ts-jest runs in
  // CJS mode here, so strip the suffix when resolving those specifiers.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
};

export default config; 