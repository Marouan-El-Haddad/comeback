import { defineConfig, type Project } from '@playwright/test';

// The phone as measured in milestone 0 (probe/RESULTS.md): IronFox 159 on a Pixel 9a, installed
// as a PWA. Viewport 414 × 847 CSS px at devicePixelRatio 2, locale spoofed to en-US, time zone
// Europe/Copenhagen, JIT disabled. Firefox is the default engine because the phone runs Gecko.
// Playwright rejects isMobile in Firefox; set PW_ENGINE=chromium to fall back to Chromium with
// isMobile: true when Firefox cannot be installed (docs/DECISIONS.md D10).
const chromium = process.env.PW_ENGINE === 'chromium';

/** IronFox' hardening turns the JavaScript JIT off; these prefs do the same in Firefox. */
export const IRONFOX_PREFS: Record<string, boolean> = {
  'javascript.options.baselinejit': false,
  'javascript.options.ion': false,
  'javascript.options.native_regexp': false,
  'javascript.options.asmjs': false,
  'javascript.options.wasm_baselinejit': false,
  'javascript.options.wasm_optimizingjit': false,
};

const phone: Project['use'] = {
  browserName: chromium ? 'chromium' : 'firefox',
  viewport: { width: 414, height: 847 },
  deviceScaleFactor: 2,
  hasTouch: true,
  locale: 'en-US',
  timezoneId: 'Europe/Copenhagen',
  ...(chromium ? { isMobile: true } : { launchOptions: { firefoxUserPrefs: IRONFOX_PREFS } }),
};

// E2E_PORT lets a second checkout (a review worktree) run the suite at the same time.
const port = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  forbidOnly: !!process.env.CI,
  // Firefox sometimes fails to close a browser context under load (»_maybeDontRestoreTabs«);
  // one retry, and the report shows such tests as flaky.
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/comeback/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    { name: 'pixel9a', use: phone },
    // Date logic must not depend on the browser's time zone (docs/SPEC.md section 8): the tests
    // tagged @date run once more with the clock in UTC, as IronFox can be set to spoof it.
    { name: 'pixel9a-utc', grep: /@date/, use: { ...phone, timezoneId: 'UTC' } },
  ],
});
