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
  prettier,
);
