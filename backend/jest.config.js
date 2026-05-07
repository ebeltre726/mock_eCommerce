export default {
    testEnvironment: 'node',
    setupFiles: ['./jest.setup.js'],
    transform: {
        '^.+\\.js$': 'babel-jest',
    },
    transformIgnorePatterns: [
        '/node_modules/(?!uuid|@aws-sdk/.*|@smithy/.*)',
    ],
};