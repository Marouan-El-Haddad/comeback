import { expect, test } from '@playwright/test';

// Milestone 1 phone deliverable: /program shows every ladder and step from the data.
test('program page lists all tracks, weeks and catalogues', async ({ page }) => {
  await page.goto('/comeback/program/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Programmet');
  await expect(page.locator('.prog-track')).toHaveCount(20);
  await expect(page.locator('.prog-step')).toHaveCount(107);
  await expect(page.locator('#press .prog-step').first()).toContainText('Push-up med tempo');
  await expect(page.locator('#press .prog-step').first()).toContainText('3 × 6–12');
  await expect(page.locator('.prog-week')).toHaveCount(12);
  await expect(page.locator('#hero li')).toHaveCount(12);
  await expect(page.locator('#imponer h2').first()).toHaveText('Imponer-kataloget (17)');
  await expect(page.locator('.prog-table tbody tr')).toHaveCount(12);
  await expect(page.locator('#boss li')).toHaveCount(6);
  // Every pictogram image loads.
  const broken = await page
    .locator('img.picto')
    .evaluateAll(
      (imgs) =>
        (imgs as HTMLImageElement[]).filter((i) => !i.complete || i.naturalWidth === 0).length,
    );
  expect(broken).toBe(0);
  await page.screenshot({ path: 'screenshots/program.png', scale: 'css' });
});
