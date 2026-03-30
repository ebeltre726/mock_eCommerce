export default {
  testEnvironment: "node",
  transform: {
    "^.+\\.js$": "babel-jest",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!uuid|@aws-sdk/.*)" // <-- transpile uuid and AWS SDK modules
  ],
};