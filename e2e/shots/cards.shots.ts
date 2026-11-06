import { expect, test } from '@playwright/test';
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// One screenshot per explained step and routine item: the whole card with every fold open, as on
// the phone (414 px wide), in screenshots/cards/<id>.png. Run with `npm run shots:cards`
// (playwright.cards.config.ts); the folder is emptied first and ignored by git.

const OUT = join('screenshots', 'cards');

function explainedIds(): string[] {
  const dir = join('content', 'explain');
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .flatMap((file) =>
      (
        JSON.parse(readFileSync(join(dir, file), 'utf8')) as { items: Array<{ id: string }> }
      ).items.map((item) => item.id),
    );
}

test('et skærmbillede af øvelseskortet for hvert forklaret punkt', async ({ page }) => {
  const ids = explainedIds();
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  await page.goto('/comeback/e2e/review/cards.html');
  for (const id of ids) {
    await page.evaluate((hash) => {
      location.hash = hash;
    }, id);
    const card = page.locator(`.exercise-card[data-card="${id}"]`);
    await expect(card.getByRole('heading', { name: 'Sådan gør du', exact: true })).toBeVisible();
    for (const summary of await card.locator('summary').all()) await summary.click();
    await expect(card.locator('details:not([open])')).toHaveCount(0);
    await page.waitForFunction(() =>
      [...document.images].every((img) => img.complete && img.naturalWidth > 0),
    );
    await page.screenshot({ path: join(OUT, `${id}.png`), fullPage: true, scale: 'css' });
  }
  console.log(`${ids.length} kort i ${OUT}`);
});
