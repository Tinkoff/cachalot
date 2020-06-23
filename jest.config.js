module.exports = {
  moduleFileExtensions: ["ts", "js"],
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.ts",
    "<rootDir>/src/*.spec.ts",
    "<rootDir>/src/**/*.spec.ts"
  ],
  testEnvironment: "node",
  collectCoverageFrom: [
    "<rootDir>/src/*.ts",
    "<rootDir>/src/**/*.ts",
    "!<rootDir>/src/RedisStorageAdapter.ts",
    "!<rootDir>/src/constants.ts",
    "!<rootDir>/src/errors.ts",
    "!<rootDir>/src/index.ts",
    "!<rootDir>/src/ConnectionStatus.ts",
    "!<rootDir>/src/LockedKeyRetrieveStrategy.ts",
    "!<rootDir>/src/adapters/TestStorageAdapter.ts",
  ],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  coverageReporters: ["text", "text-summary"],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
};

