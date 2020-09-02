module.exports = {
  'plugins': [
    '@typescript-eslint',
    'prettier',
    'import'
  ],
  'extends': [
    'eslint:recommended',
    'airbnb-base',
    'plugin:@typescript-eslint/recommended',
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    'plugin:prettier/recommended',
    'prettier',
    'prettier/@typescript-eslint'
  ],
  'globals': {
    'Atomics': 'readonly',
    'SharedArrayBuffer': 'readonly'
  },
  'parserOptions': {
    'ecmaVersion': 2018,
    'sourceType': 'module',
    'project': './tsconfig.json'
  },
  'env': {
    'es6': true,
    // 'browser': true,
    'node': true
  },
  'rules': {
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'arrow-parens': [
      'error',
      'as-needed'
    ],
    'require-jsdoc': 'off',
    'space-before-function-paren': 'off',
    // 'semi': 'off',
    'comma-dangle': 'off',
    'object-curly-spacing': 'warn',
    'padded-blocks': 'off',
    'camelcase': 'warn',
    'object-property-newline': 'off',
    'prefer-const': 'off',
    'import/no-absolute-path': 'off',
    'no-prototype-builtins': 'off',
    'indent': 'warn',
    'quote-props': 'off'
  }
}
