export default {
  testEnvironment: "node",
  setupFiles: ['./jest.setup.js'], // Load .env variables before tests
  transform: {
    "^.+\\.js$": "babel-jest",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!uuid|@aws-sdk/.*)" // <-- transpile uuid and AWS SDK modules
  ],
};