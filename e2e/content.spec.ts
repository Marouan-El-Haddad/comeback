import { expect, test } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { onboard, openApp } from './helpers.ts';

// The explanations and figures (content/, docs/SPEC.md 7 and 9.1) are JSON files fetched after the
// first screen, not JavaScript. The service worker precaches them, so the cards also work without a
// network. Skipped until the first file in content/ exists.

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
