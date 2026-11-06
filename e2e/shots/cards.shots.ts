import { expect, test } from '@playwright/test';
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// One screenshot per explained step, routine item and measurement: the whole card with every fold
// open, as on the phone (414 px wide), in screenshots/cards/<id>.png. Run with `npm run
// shots:cards` (playwright.cards.config.ts); the folder is emptied first and ignored by git. The
// run also lists the cards whose first cue, or the first line of whose first step, lies below the
// first screen in a session: 847 px (SPEC 3.8, D47).

const OUT = join('screenshots', 'cards');
const FIRST_SCREEN = 847;
/** One line of a step: 18 px at line height 1.35. */
const LINE = 24;

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
  const low: string[] = [];
  for (const id of ids) {
    await page.evaluate((hash) => {
      location.hash = hash;
    }, id);
    const card = page.locator(`.exercise-card[data-card="${id}"]`);
    await expect(card.getByRole('heading', { name: 'Sådan gør du', exact: true })).toBeVisible();
    await page.waitForFunction(() =>
      [...document.images].every((img) => img.complete && img.naturalWidth > 0),
    );
    // Folded as you first see it: where do the first cue and the first step stand?
    const cue = await card.locator('.card-cues li').first().boundingBox();
    const step = await card.locator('.card-steps li').first().boundingBox();
    const cueEnd = cue ? Math.round(cue.y + cue.height) : null;
    const stepTop = step ? Math.round(step.y) : null;
    if (
      cueEnd === null ||
      cueEnd > FIRST_SCREEN ||
      stepTop === null ||
      stepTop + LINE > FIRST_SCREEN
    )
      low.push(
        `${id}: første cue slutter ${cueEnd ?? '–'} px, første trin begynder ${stepTop ?? '–'} px`,
      );
    for (const summary of await card.locator('summary').all()) await summary.click();
    await expect(card.locator('details:not([open])')).toHaveCount(0);
    await page.screenshot({ path: join(OUT, `${id}.png`), fullPage: true, scale: 'css' });
  }
  console.log(`${ids.length} kort i ${OUT}`);
  console.log(
    low.length === 0
      ? `Alle kort har første cue og første trin på første skærm (${FIRST_SCREEN} px).`
      : `Under første skærm (${FIRST_SCREEN} px):\n  ${low.join('\n  ')}`,
  );
});
