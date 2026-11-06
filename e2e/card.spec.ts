import { expect, test, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findSourceRef } from '../src/content/refs.ts';
import { a11yProblems, SESSION_RULES } from './a11y.ts';
import { onboard, openApp, startSimulation, storedEventCount } from './helpers.ts';

// The exercise card (docs/SPEC.md 3.8, DECISIONS.md D43): from Stiger (a tap on a step), from a
// session started in the time machine (the current exercise and the next one in the pause), and
// without a network. The card can be skimmed in the middle of a session: name, dose, figure,
// Træner, Udgangsstilling, the steps and the cues are visible, the rest is folded. A step without
// an explanation shows the programme's own execution and cues. Screenshots in screenshots/.

test.describe.configure({ timeout: 300_000 });

interface Track {
  steps: Array<{ id: string; name: string; execution: string }>;
}

const explained = new Set(
  readdirSync(join('content', 'explain')).flatMap((file) =>
    (
      JSON.parse(readFileSync(join('content', 'explain', file), 'utf8')) as {
        items: Array<{ id: string }>;
      }
    ).items.map((item) => item.id),
  ),
);

function track(id: string): Track {
  return JSON.parse(readFileSync(join('program', 'tracks', `${id}.json`), 'utf8')) as Track;
}

const card = (page: Page) => page.locator('.exercise-card');

async function expectCardIsClean(page: Page): Promise<void> {
  expect(await a11yProblems(page, '.exercise-card', SESSION_RULES)).toEqual([]);
  const text = await card(page).innerText();
  expect(findSourceRef(text), 'kortet henviser til PDF, sidetal eller kilder').toBeNull();
}

test('øvelseskortet fra Stiger: kan skimmes, foldes ud og fører tilbage til stigen', async ({
  page,
}) => {
  await openApp(page, '2026-11-17');
  await onboard(page);
  await page.getByRole('button', { name: 'Stiger', exact: true }).click();
  await page.locator('.ladder-row', { hasText: 'Pres · trin 1' }).click();
  await expect(page.locator('.ladder-detail')).toBeVisible();
  // Every step is a button that opens its card (SPEC 3.5), with »Sådan gør du« as its cue.
  await expect(page.locator('.step-open')).toHaveCount(7);
  await expect(page.locator('.step-open-how')).toHaveCount(7);
  await page.screenshot({ path: 'screenshots/stige.png', scale: 'css' });
  await page.locator('.step-open', { hasText: 'Push-up med tempo' }).click();

  const c = card(page);
  await expect(c).toBeVisible();
  await expect(page.locator('.ladder-detail')).toBeHidden();
  await expect(c.getByRole('heading', { level: 1 })).toHaveText('Push-up med tempo');
  await expect(c.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(c.locator('.step-kicker')).toHaveText('Pres · trin 1');
  await expect(c.locator('.card-dose')).toContainText('3 × 6–12');
  await expect(c.locator('.card-dose')).toContainText('sæt × gentagelser');
  // Until the figure system (P3) the figure is the pictogram, with the phases under it.
  await expect(c.locator('img.card-picto')).toHaveAttribute('alt', /^Oppe: Strakte arme/);
  await expect(c.locator('.card-phases')).toHaveText('3 sek ned · 1 sek stille · Op');
  await expect(c.locator('.card-similar')).toHaveCount(0);
  // Visible without unfolding: Træner, Udgangsstilling, the numbered steps and the cues.
  for (const title of ['Træner', 'Udgangsstilling', 'Sådan gør du', 'Cues'])
    await expect(c.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(c.locator('.card-steps li')).toHaveCount(4);
  await expect(c.locator('.card-cues li')).toHaveText([
    '3 sek ned, 1 sek stille',
    'Albuerne 45° ud',
    'Kroppen som én planke',
  ]);
  // Folded, one tap each: tempo and breathing, mistakes, easier and harder, equipment, »Hvorfor«.
  await expect(c.locator('summary')).toHaveText([
    'Tempo og vejrtrækning',
    'Typiske fejl',
    'Lettere og sværere',
    'Udstyr: Kun gulvet',
    'Hvorfor',
  ]);
  await expect(c.getByText('Hoften hænger, eller den stikker op.')).toBeHidden();
  await page.screenshot({ path: 'screenshots/kort-skimmet.png', scale: 'css' });
  await expectCardIsClean(page);

  for (const summary of await c.locator('summary').all()) await summary.click();
  await expect(c.getByText('Hoften hænger, eller den stikker op.')).toBeVisible();
  await expect(c.locator('.card-fold').filter({ hasText: 'Tempo og vejrtrækning' })).toContainText(
    'Ånd ind på vej ned',
  );
  await expect(c.locator('.card-fold').filter({ hasText: 'Lettere og sværere' })).toContainText(
    'Trin 2: fødderne på en stol',
  );
  await expect(c.locator('.card-fold').filter({ hasText: 'Udstyr' })).toContainText(
    'Gør klar: Find en fri plads på gulvet',
  );
  // The track's »Hvorfor« in the app's own words (content/explain).
  await expect(c.locator('.card-fold').filter({ hasText: 'Hvorfor' })).toContainText(
    'Push-ups bygger bryst, skuldre og armenes bagside',
  );
  await expectCardIsClean(page);
  // The whole card; the fixed tab bar would land in the middle of a full-page picture.
  await page.screenshot({
    path: 'screenshots/kort-foldet-ud.png',
    scale: 'css',
    fullPage: true,
    style: '.tabbar { visibility: hidden; }',
  });

  // »Tilbage« at the bottom returns to the ladder.
  await c.getByRole('button', { name: 'Tilbage', exact: true }).last().click();
  await expect(card(page)).toHaveCount(0);
  await expect(page.locator('.ladder-detail')).toBeVisible();
  await expect(page.locator('.step-open', { hasText: 'Push-up med tempo' })).toBeInViewport();

  // A step explained, with a pictogram borrowed from the ladder: the card says so.
  await page.locator('.step-open', { hasText: 'Fødderne på en stol' }).click();
  await expect(c.locator('.card-similar')).toHaveText('Tegningen viser en lignende øvelse.');
  await expect(c.locator('summary', { hasText: 'Udstyr' })).toHaveText('Udstyr: Stol og væg');
  await c.getByRole('button', { name: 'Tilbage', exact: true }).first().click();
  await expect(page.locator('.ladder-detail')).toBeVisible();
});

test('et trin uden forklaring viser programmets udførelse og ser ikke tomt ud', async ({
  page,
}) => {
  // The first push-up step without an explanation; when all have one, there is nothing to show.
  const step = track('press').steps.find((s) => !explained.has(s.id));
  test.skip(!step, 'Alle trin i Pres er forklaret');
  if (!step) return;
  await openApp(page, '2026-11-17');
  await onboard(page);
  await page.getByRole('button', { name: 'Stiger', exact: true }).click();
  await page.locator('.ladder-row', { hasText: 'Pres · trin 1' }).click();
  await page.locator('.step-open', { hasText: step.name }).click();

  const c = card(page);
  await expect(c.getByRole('heading', { level: 1 })).toHaveText(step.name);
  await expect(c.getByRole('heading', { name: 'Sådan gør du', exact: true })).toBeVisible();
  await expect(c.locator('.card-section').first()).toContainText(step.execution);
  // No empty headings and nothing that looks like an error.
  for (const title of ['Træner', 'Udgangsstilling'])
    await expect(c.getByRole('heading', { name: title, exact: true })).toHaveCount(0);
  for (const heading of await c.locator('h2').all()) {
    const section = heading.locator('xpath=..');
    expect((await section.innerText()).trim().length).toBeGreaterThan(
      (await heading.innerText()).trim().length,
    );
  }
  await expect(c.locator('img.card-picto')).toBeVisible();
  await expect(c.locator('summary')).toHaveText(['Hvorfor']);
  await expectCardIsClean(page);
  await page.screenshot({ path: 'screenshots/kort-uden-forklaring.png', scale: 'css' });
});

test('øvelseskortet fra et pas i tidsmaskinen: passet kører videre under kortet @date', async ({
  page,
}) => {
  await openApp(page, '2026-11-06');
  await onboard(page);
  const stored = await storedEventCount(page);
  // The first Tuesday of the programme: wall test, warm-up, then power legs.
  await startSimulation(page, '2026-11-10');
  await page.getByTestId('start-session').click();
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  await expect(page.getByRole('heading', { name: 'Væg-testen' })).toBeVisible();
  await page.locator('.session-body input[type="number"]').fill('3');
  await page.getByRole('button', { name: 'Gem målingen' }).click();

  // The warm-up's first item has its card.
  await expect(page.locator('.session-title')).toHaveText('Opvarmning · 1/4');
  await page.getByRole('button', { name: 'Sådan gør du' }).click();
  const c = card(page);
  await expect(c.getByRole('heading', { level: 1 })).toHaveText('Hæv pulsen');
  await expect(c.locator('.step-kicker')).toHaveText('Opvarmning · 1 af 4');
  await expect(c.locator('.card-dose')).toHaveText('2 min');
  await expect(page.locator('.session')).toBeHidden();
  await expect(page.locator('.banner.sim')).toBeVisible();
  await expectCardIsClean(page);
  await c.getByRole('button', { name: 'Tilbage til passet' }).first().click();
  await expect(page.locator('.session-title')).toHaveText('Opvarmning · 1/4');

  // The warm-up's timers run on under the card, through question 3; the card stays until closed.
  await page.getByRole('button', { name: 'Sådan gør du' }).click();
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await expect(c.getByRole('heading', { level: 1 })).toHaveText('Hæv pulsen');
  await c.getByRole('button', { name: 'Tilbage til passet' }).first().click();
  await expect(page.getByRole('heading', { name: 'Spørgsmål 3' })).toBeVisible();
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
  await expect(card(page)).toHaveCount(0);

  // The first set: the card of the exercise in hand.
  const count = page.locator('.set-count');
  await expect(count).toHaveText(/^Sæt 1 af \d$/);
  const sets = (await count.innerText()).slice('Sæt 1 af '.length);
  await page.getByRole('button', { name: 'Sådan gør du' }).click();
  await expect(c.getByRole('heading', { level: 1 })).toHaveText('Squat jump');
  await expect(c.locator('.step-kicker')).toHaveText('Power ben · trin 1');
  await expect(c.getByRole('heading', { name: 'Sådan gør du', exact: true })).toBeVisible();
  await expect(c.getByRole('button', { name: 'Tilbage til passet' })).toHaveCount(2);
  await expectCardIsClean(page);
  await page.screenshot({ path: 'screenshots/kort-fra-passet.png', scale: 'css' });
  await c.getByRole('button', { name: 'Tilbage til passet' }).last().click();
  await expect(count).toHaveText(`Sæt 1 af ${sets}`);
  await expect(page.getByTestId('as-planned')).toBeVisible();

  // In the pause: the next exercise's card; the rest timer runs on under it.
  await page.getByTestId('as-planned').click();
  await expect(page.getByText('Spring pausen over')).toBeVisible();
  await page.locator('.next-up').getByRole('button', { name: 'Sådan gør du' }).click();
  await expect(c.getByRole('heading', { level: 1 })).toHaveText('Squat jump');
  await page.clock.runFor(120_000);
  await c.getByRole('button', { name: 'Tilbage til passet' }).first().click();
  await expect(count).toHaveText(`Sæt 2 af ${sets}`);

  // The time machine never writes to storage (SPEC 3.7).
  expect(await storedEventCount(page)).toBe(stored);
});

test('øvelseskortet virker uden net: koden og forklaringen kommer fra service workeren', async ({
  page,
  context,
}) => {
  await openApp(page, '2026-11-17');
  await onboard(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // One reload so the service worker controls the page, then a start without network.
  await page.reload();
  await expect(page.getByTestId('today')).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Stiger', exact: true }).click();
  await page.locator('.ladder-row', { hasText: 'Træk · trin 1' }).click();
  await page.locator('.step-open').first().click();
  const c = card(page);
  await expect(c.getByRole('heading', { name: 'Træner', exact: true })).toBeVisible();
  await expect(c.locator('.card-steps li').first()).toBeVisible();
  expect(
    await c.locator('img.card-picto').evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);
  await context.setOffline(false);
});
