module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    'max-len': 0,
    'no-nested-tenary': 0,
    semi: ['error', 'always'],
    quotes: ['error', 'single'],
  },
  root: true,
};
