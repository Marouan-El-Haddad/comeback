import { expect, test } from '@playwright/test';

// The app's service worker (scope /comeback/) must never take over the probe on /comeback/probe/
// (docs/DECISIONS.md D13): it precaches nothing from the probe and has no navigation fallback for
// it, and the probe's own service worker (the narrower scope) controls the probe's pages.

test('app service worker leaves the probe alone', async ({ page, context }) => {
  const sw = await (await page.request.get('/comeback/sw.js')).text();
  expect(sw).not.toContain('probe/');
  expect(sw).toContain('probe');

  // Install the app's service worker first, as on a phone that has the app.
  await page.goto('/comeback/');
  const appScope = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.register('/comeback/sw.js', { scope: '/comeback/' });
    await navigator.serviceWorker.ready;
    return reg.scope;
  });
  expect(appScope).toMatch(/\/comeback\/$/);

  // Without network, the app's worker must not answer for the probe with the app's page.
  await context.setOffline(true);
  const offlinePage = await context.newPage();
  const offline = await offlinePage.goto('/comeback/probe/').catch(() => null);
  if (offline) expect(await offlinePage.title()).not.toBe('Comeback');
  await offlinePage.close();
  await context.setOffline(false);

  // Online, the probe registers its own worker, which then controls the probe's pages.
  const probe = await context.newPage();
  await probe.goto('/comeback/probe/');
  await expect(probe.getByRole('heading', { level: 1 })).toHaveText('Comeback-probe');
  await probe.evaluate(() => navigator.serviceWorker.ready);
  await probe.reload();
  const controller = await probe.evaluate(() => navigator.serviceWorker.controller?.scriptURL);
  expect(controller).toMatch(/\/comeback\/probe\/sw\.js$/);
});
