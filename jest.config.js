module.exports = {
  "collectCoverageFrom": [
    "src/**/*.{js,ts}"
  ],
  "testMatch": [
    "<rootDir>/src/**/__tests__/**/*.ts",
    "<rootDir>/src/**/?(*.)spec.ts"
  ],
  "testEnvironment": "node",
  "testURL": "http://localhost",
  "transform": {
    "^.+\\.ts$": "ts-jest",
  },
  "transformIgnorePatterns": [
    "[/\\\\]node_modules[/\\\\].+\\.(js|ts)$"
  ],
  "coveragePathIgnorePatterns": [
    "<rootDir>/dist/",
    "<rootDir>/node_modules/",
    "<rootDir>/src/index.ts",
    "<rootDir>/src/constants.ts",
    "<rootDir>/src/errors.ts",
    "<rootDir>/src/connection-status.ts",
    "<rootDir>/src/locked-key-retrieve-strategy.ts",
    "<rootDir>/src/adapters/test",
  ],
  "coverageThreshold": {
    "global": {
      "branches": 90,
      "functions": 90,
      "lines": 90,
      "statements": 90
    }
  },
  "moduleFileExtensions": [
    "ts",
    "js",
    "json",
    "node"
  ],
  "coverageReporters": [
    "text",
    "text-summary"
  ]
};

