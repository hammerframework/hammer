const path = require('path')

module.exports = {
  extends: path.join(__dirname, 'packages/eslint-config/shared.js'),
  ignorePatterns: [
    'dist',
    'fixtures',
    'packages/structure/**',
    'packages/core/**/__fixtures__/**/*',
    'packages/core/config/storybook/**/*',
    'packages/create-redwood-app/template/web/src/Routes.tsx',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    'import/order': [
      'error',
      {
        'newlines-between': 'always',
        pathGroupsExcludedImportTypes: ['react'],
        pathGroups: [
          {
            pattern: 'react',
            group: 'builtin',
            position: 'after',
          },
          {
            pattern: '@redwoodjs/**',
            group: 'external',
            position: 'after',
          },
          {
            pattern: 'src/lib/test',
            group: 'parent',
            position: 'before',
          },
          {
            pattern: 'src/**',
            group: 'parent',
            position: 'before',
          },
        ],
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
    curly: 'error',
  },
  overrides: [
    {
      files: ['packages/structure/**'],
      rules: {
        '@typescript-eslint/no-this-alias': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'no-case-declarations': 'off',
        'prefer-const': 'off',
        'no-empty': 'warn',
        'no-unused-expressions': 'off',
      },
    },
    // Browser Context
    //
    // We prevent "window" from being used, and instead require "global".
    // This is because prerender runs in the NodeJS context it's undefined.
    {
      files: [
        'packages/auth/src/**',
        'packages/forms/src/**',
        'packages/prerender/src/browserUtils/**',
        'packages/router/src/**',
        'packages/web/src/**',
        'packages/history/src/**',
      ],
      env: {
        es6: true,
        browser: true,
      },
      globals: {
        React: 'readonly', // We auto-import React via Babel.
        window: 'off', // Developers should use `global` instead of window. Since window is undefined in NodeJS.
      },
    },
    // Entry.js rules
    {
      files: ['packages/web/src/entry/index.js'],
      env: {
        es6: true,
        browser: true,
      },
      globals: {
        React: 'readonly',
      },
    },
    // NodeJS Context
    {
      files: [
        'packages/api/src/**',
        'packages/api-server/src/**',
        'packages/cli/src/**',
        'packages/core/src/**',
        'packages/core/config/**',
        'packages/create-redwood-app/src/create-redwood-app.js',
        'packages/dev-server/src/**',
        'packages/internal/src/**',
        'packages/prerender/src/**',
        'packages/structure/src/**',
        'packages/testing/src/**',
        'packages/testing/config/**',
        'packages/eslint-config/*.js',
      ],
      env: {
        es6: true,
        node: true,
      },
    },
  ],
}
