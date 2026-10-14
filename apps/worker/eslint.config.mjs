import base from '@micow/config-eslint/index.js';

export default [
  ...base,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];
