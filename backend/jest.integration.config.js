import baseConfig from './jest.config.js';

export default {
  ...baseConfig,
  displayName: 'integration',
  testMatch: ['**/tests/integration/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
};
