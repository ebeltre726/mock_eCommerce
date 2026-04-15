import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",  // since you're using ES modules
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
      }
    }
  }
];