import { expect, test, type Page } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { onboard, openApp } from './helpers.ts';

// The explanations and figures (content/, docs/SPEC.md 7 and 9.1) are JSON files fetched after the
// first screen, not JavaScript. The service worker precaches them, so the cards also work without a
// network.

function contentFiles(): string[] {
  return existsSync('dist/assets')
    ? readdirSync('dist/assets').filter((f) => f.endsWith('.json'))
    : [];
}

test('forklaringer og figurer hentes fra service workeren, også uden net', async ({
  page,
  context,
}) => {
  const files = contentFiles();
  test.skip(files.length === 0, 'Ingen filer i content/ endnu');
  await openApp(page, '2026-11-17');
  await onboard(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // One reload so the service worker controls the page, then without network.
  await page.reload();
  await expect(page.getByTestId('today')).toBeVisible();
  await context.setOffline(true);
  for (const file of files) {
    const format = await page.evaluate(async (url) => {
      const response = await fetch(url);
      const data = (await response.json()) as { format?: unknown };
      return data.format;
    }, `/comeback/assets/${file}`);
    expect(format, file).toBe(1);
  }
  await context.setOffline(false);
});

// A measurement has its own card (docs/SPEC.md 9.1: content/explain/measures.json); without an
// explanation it shows the programme's own words. The warm-up's »Potensér« shows the session's first
// power step, and pogo-hop only in Styrke A.

const card = (page: Page) => page.locator('.exercise-card');

/** From »Start passet« to the warm-up's fourth item, »Potensér«; a wall test is saved first. */
async function toPotenser(page: Page): Promise<void> {
  await page.getByTestId('start-session').click();
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  const title = page.locator('.session-title');
  await expect(title).toContainText(/Opvarmning · 1\/4|Måling før opvarmning/);
  if ((await title.innerText()).startsWith('Måling')) {
    await page.locator('.session-body input[type="number"]').fill('3');
    await page.getByRole('button', { name: 'Gem målingen' }).click();
  }
  for (const seconds of [121, 181, 121]) await page.clock.runFor(seconds * 1000);
  await expect(title).toHaveText('Opvarmning · 4/4');
}

test('Væg-testen før opvarmningen har sit eget kort (en måling)', async ({ page }) => {
  await openApp(page, '2026-11-10');
  await onboard(page);
  await page.getByTestId('start-session').click();
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  await expect(page.getByRole('heading', { name: 'Væg-testen' })).toBeVisible();
  await page.getByRole('button', { name: 'Sådan gør du' }).click();
  const c = card(page);
  await expect(c.getByRole('heading', { level: 1 })).toHaveText('Væg-testen');
  await expect(c.locator('.step-kicker')).toHaveText('Måling');
  await expect(c.locator('.card-dose')).toContainText('Afstand i cm');
  await expect(c).toContainText('Mål fra baghoved til væg.');
  await c.getByRole('button', { name: 'Tilbage til passet' }).first().click();
  await expect(page.getByRole('heading', { name: 'Væg-testen' })).toBeVisible();
});

test('»Potensér« i Styrke A: dagens første power-øvelse og pogo-hop', async ({ page }) => {
  await openApp(page, '2026-11-17');
  await onboard(page);
  await toPotenser(page);
  await page.getByRole('button', { name: 'Sådan gør du' }).click();
  const c = card(page);
  await expect(c.getByRole('heading', { level: 1 })).toHaveText('Potensér');
  await expect(c.locator('.card-move-name')).toHaveText(['Squat jump', 'Pogo-hop']);
  await page.screenshot({ path: 'screenshots/kort-potenser.png', scale: 'css', fullPage: true });
});

test('»Potensér« i Styrke B: dagens første power-øvelse, ingen pogo-hop', async ({ page }) => {
  await openApp(page, '2026-11-20');
  await onboard(page);
  await expect(page.getByTestId('main-card')).toContainText('Styrke B');
  await toPotenser(page);
  await page.getByRole('button', { name: 'Sådan gør du' }).click();
  const c = card(page);
  await expect(c.getByRole('heading', { level: 1 })).toHaveText('Potensér');
  await expect(c.locator('.card-move-name')).toHaveText(['Hurtig push-up']);
});
