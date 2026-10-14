import react from '@micow/config-eslint/react.js';

export default [
  ...react,
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
];
