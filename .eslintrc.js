module.exports = {
  parser: "@typescript-eslint/parser",
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:eslint-comments/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:jest/recommended",
    "plugin:prettier/recommended",
  ],
  rules: {
    "import/no-unresolved": "off",
    "no-await-in-loop": "off",
    "no-implicit-coercion": "error",
    "@typescript-eslint/array-type": "error",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/triple-slash-reference": "off",
    curly: ["error", "all"],
  },
};
