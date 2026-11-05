import { expect, test } from '@playwright/test';
import { onboard } from './helpers.ts';

// SK1: the day's plan is visible without a tap, under 1 second after opening (warm start), with
// no network. Measured in the pixel9a profile (Firefox, JIT off). Prints the numbers for the report.
test('SK1: I dag er synlig under 1 sekund ved varm start uden netværk', async ({
  page,
  context,
}) => {
  await page.goto('/comeback/');
  await onboard(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // One reload so the service worker controls the page and every file is cached.
  await page.reload();
  await expect(page.getByTestId('today')).toBeVisible();
  await context.setOffline(true);

  const runs: Array<{ fcp: number; today: number }> = [];
  for (let i = 0; i < 5; i++) {
    await page.reload();
    await expect(page.getByTestId('today')).toBeVisible();
    await page.waitForFunction(() => performance.getEntriesByName('cb-today').length > 0);
    runs.push(
      await page.evaluate(() => ({
        fcp:
          performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint')
            ?.startTime ?? -1,
        today: performance.getEntriesByName('cb-today')[0]?.startTime ?? -1,
      })),
    );
  }
  await context.setOffline(false);
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? -1;
  const fcp = median(runs.map((r) => r.fcp));
  const today = median(runs.map((r) => r.today));
  console.log(
    `SK1 (varm start, offline, 5 kørsler): første tegning median ${Math.round(fcp)} ms, I dag synlig median ${Math.round(today)} ms; alle: ${JSON.stringify(runs.map((r) => [Math.round(r.fcp), Math.round(r.today)]))}`,
  );
  expect(today).toBeGreaterThan(0);
  expect(today).toBeLessThan(1000);
});
