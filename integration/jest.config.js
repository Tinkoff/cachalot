module.exports = {
  globals: {
    'ts-jest': {
      tsConfig: '<rootDir>/../tsconfig.json',
      diagnostics: true,
    },
  },
  testMatch: ['<rootDir>/tests/**/*.spec.ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};
