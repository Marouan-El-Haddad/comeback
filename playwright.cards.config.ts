import { defineConfig } from '@playwright/test';
import { phone } from './playwright.config.ts';

// `npm run shots:cards`: one screenshot of the exercise card for every explained step and routine
// item, unfolded, in screenshots/cards/ (ignored by git), for the review of the explanations
// (docs/runs/NAT-2.md: can someone who has never seen the exercise do it right?). The cards are
// drawn by the dev server's review page e2e/review/cards.html, which is never part of the build.
// CARDS_PORT moves the dev server, so a review checkout can run it beside a build.
const port = Number(process.env.CARDS_PORT ?? 4175);

export default defineConfig({
  testDir: 'e2e/shots',
  testMatch: '*.shots.ts',
  outputDir: 'test-results/shots',
  reporter: 'list',
  timeout: 900_000,
  use: { ...phone, baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/comeback/e2e/review/cards.html`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
