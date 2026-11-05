import { expect, test } from '@playwright/test';
import { onboard, openApp } from './helpers.ts';

// The guided session's code is fetched after the first screen (docs/DECISIONS.md D35). The service
// worker precaches it, so a session and Open & Strong start without network too.
test('passet og Open & Strong starter uden netværk; koden kommer fra service workeren', async ({
  page,
  context,
}) => {
  await openApp(page, '2026-11-17');
  await onboard(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // One reload so the service worker controls the page, then the start without network.
  await page.reload();
  await expect(page.getByTestId('today')).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await page.getByTestId('os-start').click();
  await expect(page.getByTestId('open-strong')).toContainText('Open & Strong · 6 min');

  // A new load (Open & Strong keeps no state), then the guided session in its own file.
  await page.reload();
  await expect(page.getByTestId('main-card')).toContainText('Styrke A');
  await page.getByTestId('start-session').click();
  await expect(page.getByRole('button', { name: 'Start opvarmningen' })).toBeVisible();
  await context.setOffline(false);
});
