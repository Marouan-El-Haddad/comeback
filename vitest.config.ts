import { defineConfig } from 'vitest/config';

// Two projects: everything in Europe/Copenhagen (the phone's time zone), and the date-sensitive
// engine tests again in UTC, as IronFox can spoof the time zone (docs/DECISIONS.md D25).
const DATE_TESTS = [
  'src/engine/__tests__/dates.test.ts',
  'src/engine/__tests__/weeks.test.ts',
  'src/engine/__tests__/moves.test.ts',
];

export default defineConfig({
  test: {
    environment: 'node',
    projects: [
      {
        extends: true,
        test: {
          name: 'copenhagen',
          include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.{test,spec}.ts'],
          env: { TZ: 'Europe/Copenhagen' },
        },
      },
      {
        extends: true,
        test: { name: 'utc', include: DATE_TESTS, env: { TZ: 'UTC' } },
      },
    ],
  },
});
