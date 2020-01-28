module.exports = {
  globals: {
    'ts-jest': {
      tsConfig: '<rootDir>/../tsconfig.json',
      diagnostics: true,
    },
  },
  testMatch: ['<rootDir>/tests/**/*.spec.ts'],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};
