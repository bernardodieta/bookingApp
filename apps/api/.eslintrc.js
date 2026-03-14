module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  env: {
    node: true,
    jest: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  extends: ['eslint:recommended', 'prettier'],
  rules: {
    'no-unused-vars': 'off',
    'no-undef': 'off',
  },
};
