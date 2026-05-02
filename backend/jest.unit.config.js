import baseConfig from './jest.config.js';

export default {
    ...baseConfig,
    displayName:            'unit',
    testMatch:              ['**/tests/unit/**/*.test.js'],
    testPathIgnorePatterns: ['/node_modules/'],
};