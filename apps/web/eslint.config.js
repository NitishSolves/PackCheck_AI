import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', '**/*.test.ts', 'vitest.config.ts'] },
  ...tseslint.configs.recommended,
);
