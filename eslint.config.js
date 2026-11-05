import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    'node_modules/',
    'dist/',
    'dev-dist/',
    'coverage/',
    'test-results/',
    'playwright-report/',
    'public/',
    'tools/',
  ]),
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['scripts/**', 'e2e/**', '*.config.{ts,js}', 'probe/vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // The engine is deterministic: no clock and no randomness (CLAUDE.md, DECISIONS D26).
    files: ['src/engine/**/*.ts'],
    ignores: ['src/engine/__tests__/**'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Pass `now` as a parameter.' },
        { object: 'Math', property: 'random', message: 'The engine must be deterministic.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Pass `today`/`now` as a parameter.',
        },
      ],
    },
  },
  prettier,
);
