import { defineConfig } from '@playwright/test';

// Pixel 9a in portrait. Firefox is the default engine because the phone runs Gecko (IronFox).
// Playwright rejects isMobile in Firefox; set PW_ENGINE=chromium to fall back to Chromium with
// isMobile: true when Firefox cannot be installed (docs/DECISIONS.md D10).
const chromium = process.env.PW_ENGINE === 'chromium';

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173/comeback/',
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'pixel9a',
      use: {
        browserName: chromium ? 'chromium' : 'firefox',
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 2.625,
        hasTouch: true,
        ...(chromium ? { isMobile: true } : {}),
      },
    },
  ],
});
