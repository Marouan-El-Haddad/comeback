import { expect, test } from '@playwright/test';
import { onboard, openApp } from './helpers.ts';

// The tabs besides I dag: Uge (view), Stiger (view and »vælg selv et trin«), Mere → Backup,
// Om → Diagnose (Tilføjelse T6; its start-up times in diagnose.spec.ts). Screenshots for the
// design review.
test('Uge, Stiger, Mere og Diagnose', async ({ page }) => {
  await openApp(page, '2026-11-17');
  // The welcome drawn with its fonts, not the blank page before it (P4 review follow-up N3).
  await expect(page.getByTestId('onboarding')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'screenshots/onboarding.png', scale: 'css' });
  await onboard(page);

  await page.getByRole('button', { name: 'Uge', exact: true }).click();
  await expect(page.getByTestId('week')).toContainText('Uge 2 · Fundament');
  await expect(page.locator('.week-day')).toHaveCount(7);
  await expect(page.locator('.week-day.today')).toContainText('Styrke A');
  await page.screenshot({ path: 'screenshots/uge.png', scale: 'css', fullPage: true });

  await page.getByRole('button', { name: 'Stiger', exact: true }).click();
  await expect(page.locator('.ladder-row')).toHaveCount(13);
  await page.screenshot({ path: 'screenshots/stiger.png', scale: 'css' });
  await page.locator('.ladder-row', { hasText: 'Pres · trin 1' }).click();
  await page.getByRole('button', { name: 'Vælg selv dette trin' }).first().click();
  await expect(
    page.getByText('Det sværeste trin med dårlig form lærer dig dårlig form.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Vælg trin 2' }).click();
  await expect(page.locator('.prog-step.mine')).toContainText('Fødderne på en stol');
  await page.getByRole('button', { name: 'Tilbage' }).click();
  await expect(page.locator('.ladder-row', { hasText: 'Pres · trin 2' })).toBeVisible();

  await page.getByRole('button', { name: 'Mere', exact: true }).click();
  await page.getByRole('button', { name: 'Backup' }).click();
  await expect(page.getByTestId('last-backup')).toHaveText('aldrig');
  await page.screenshot({ path: 'screenshots/backup.png', scale: 'css' });
  await page.getByRole('button', { name: 'Tilbage' }).click();
  await page.getByRole('button', { name: 'Om' }).click();
  await expect(page.getByTestId('version')).toContainText('Version');
  await page.getByTestId('diagnose-open').click();
  const diagnose = page.getByTestId('diagnose');
  for (const label of [
    'Version',
    'Service worker',
    'Spejl',
    'Varigt lager',
    'Lagerplads',
    'Wake Lock',
    'Lyd',
    'Viewport',
    'Tidszone',
    'Sprog',
  ]) {
    await expect(diagnose.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByTestId('diag-Viewport')).toContainText('414 × 847');
  await expect(page.getByTestId('diag-Tidszone')).toHaveText('Europe/Copenhagen');
  await expect(page.getByRole('heading', { name: 'Opstart fra ikonet' })).toBeVisible();
});
