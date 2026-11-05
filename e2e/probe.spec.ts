import { expect, test } from '@playwright/test';

// Milestone 0 smoke test (docs/PLAN.md): the probe opens and shows ten rows.
test('probe opens and shows ten rows', async ({ page }) => {
  await page.goto('/comeback/probe/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Comeback-probe');
  await expect(page.getByText(/^Version \d+$/)).toBeVisible();

  const rows = page.locator('[data-row]');
  await expect(rows).toHaveCount(10);
  for (let n = 1; n <= 10; n++) {
    await expect(page.locator(`[data-row="${n}"] [data-status]`)).toHaveText(/^(GRØN|RØD|VENTER)$/);
  }

  // Wait for the storage and the benchmark, so the screenshot shows measured values.
  await expect(page.locator('[data-row="2"] .big')).toHaveText(/^\d{4}$/);
  await expect(page.locator('[data-row="8"] [data-status]')).not.toHaveText('VENTER', {
    timeout: 15_000,
  });
  await page.screenshot({ path: 'screenshots/probe.png', fullPage: true, scale: 'css' });
});
