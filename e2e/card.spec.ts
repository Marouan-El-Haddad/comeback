import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findSourceRef } from '../src/content/refs.ts';
import { a11yProblems, SESSION_RULES } from './a11y.ts';
import {
  closeIntro,
  onboard,
  openApp,
  startSession,
  startSimulation,
  stillFigures,
  storedEventCount,
} from './helpers.ts';

// The exercise card (docs/SPEC.md 3.5, 3.8; DECISIONS.md D43, D47, D55): from Stiger (a step, also
// under »Øvrige«), from a session started in the time machine (the warm-up, the set, the next
// exercise in the pause), from Open & Strong and without a network. The card can be skimmed in the
// middle of a session: figure, cues, »Sådan gør du«, »Træner« and »Mærk«, the rest folded; cues and
// the first step on the first screen. While it is open the session stands still, so nothing starts or is logged
// behind it, and Android's back gesture closes it. Screenshots in screenshots/.

test.describe.configure({ timeout: 300_000 });

const PHONE_HEIGHT = 847;
const TAB_BAR = 64;

interface Track {
  steps: Array<{ id: string; name: string; execution: string }>;
}

function track(id: string): Track {
  return JSON.parse(readFileSync(join('program', 'tracks', `${id}.json`), 'utf8')) as Track;
}

/** An item's »Mærk« in content/explain (DECISIONS.md D55), or undefined when it has none. */
function feelOf(subject: string, id: string): string | undefined {
  const file = JSON.parse(readFileSync(join('content', 'explain', `${subject}.json`), 'utf8')) as {
    items: Array<{ id: string; feel?: string }>;
  };
  return file.items.find((item) => item.id === id)?.feel;
}

/** The headings visible without unfolding: »Mærk« comes after »Træner« when the item has it. */
function skimmed(subject: string, id: string, headings: string[]): string[] {
  return feelOf(subject, id) === undefined ? headings : [...headings, 'Mærk'];
}

const card = (page: Page) => page.locator('.exercise-card');

async function expectCardIsClean(page: Page): Promise<void> {
  expect(await a11yProblems(page, '.exercise-card', SESSION_RULES)).toEqual([]);
  const text = await card(page).innerText();
  expect(findSourceRef(text), 'kortet henviser til PDF, sidetal eller kilder').toBeNull();
}

/** The first cue is whole, and the steps start, on the first screen (SPEC 3.8, D47). */
async function expectCuesAndStepsOnFirstScreen(page: Page, bottom: number): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  const cue = await card(page).locator('.card-cues li').first().boundingBox();
  const step = await card(page).locator('.card-steps li').first().boundingBox();
  expect(cue && cue.y + cue.height, 'første cue på første skærm').toBeLessThanOrEqual(bottom);
  expect(step && step.y + 24, 'første trin begynder på første skærm').toBeLessThanOrEqual(bottom);
}

/** The countdown on the screen in seconds (»1:25« = 85). */
async function secondsLeft(page: Page): Promise<number> {
  const text = await page.getByTestId('countdown').first().innerText();
  const [minutes, seconds] = text.split(':').map(Number);
  return (minutes ?? 0) * 60 + (seconds ?? 0);
}

/** The clock stood still: the same time left, give or take the second it took to tap. */
async function expectSameTimeLeft(page: Page, before: number): Promise<void> {
  const after = await secondsLeft(page);
  expect(Math.abs(after - before), `${before} sek før, ${after} sek efter`).toBeLessThanOrEqual(2);
}

/** Taps through a session as planned (sets, pauses, questions) until `done` holds. */
async function driveUntil(page: Page, done: () => Promise<boolean>, what: string): Promise<void> {
  for (let i = 0; i < 300; i++) {
    if (await done()) return;
    // An intro card in the pause (D44): closed, so the pause shows »Næste«.
    const intro = page.getByTestId('intro-close');
    if (await intro.isVisible()) {
      await intro.click();
      continue;
    }
    const asPlanned = page.getByTestId('as-planned');
    if (await asPlanned.isVisible()) {
      // Disabled on its way out after a tap that writes (D61): never wait for it.
      await asPlanned.click({ timeout: 5_000 }).catch(() => undefined);
      continue;
    }
    const skip = page.getByRole('button', { name: 'Spring pausen over' });
    if (await skip.isVisible()) {
      await skip.click();
      continue;
    }
    const yes = page.getByRole('button', { name: 'Ja', exact: true });
    if (await yes.isVisible()) {
      await yes.click();
      continue;
    }
    await page.clock.runFor(5_000);
  }
  throw new Error(`Passet nåede ikke ${what}`);
}

/** »Dagens pas«, »Start passet«, a green traffic light and the warm-up's four timers. */
async function startGreen(page: Page): Promise<void> {
  await startSession(page);
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
  await closeIntro(page);
}

test('øvelseskortet fra Stiger: kan skimmes, foldes ud og lukkes med »Tilbage« og tilbage-gestussen', async ({
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
  const entries = await page.evaluate(() => history.length);
  await page.locator('.step-open', { hasText: 'Push-up med tempo' }).click();

  const c = card(page);
  await expect(c).toBeVisible();
  await expect(page.locator('.ladder-detail')).toBeHidden();
  await expect(c.getByRole('heading', { level: 1 })).toHaveText('Push-up med tempo');
  await expect(c.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(c.locator('.step-kicker')).toHaveText('Pres · trin 1');
  await expect(c.locator('.card-dose')).toContainText('3 × 6–12');
  await expect(c.locator('.card-dose')).toContainText('sæt × gentagelser');
  await expect(c.locator('.card-status')).toHaveCount(0);
  // The animated figure (P3, D48) with its text alternative and the phases under it.
  await expect(c.locator('img.card-picto')).toHaveCount(0);
  await expect(c.locator('.figure-stage')).toHaveAttribute(
    'aria-label',
    /^Push-up med tempo. Oppe: Strakte arme/,
  );
  await expect(c.locator('.card-phases')).toHaveText('3 sek ned · 1 sek stille · Op');
  await expect(c.locator('.card-similar')).toHaveCount(0);
  // Visible without unfolding, in this order: cues, »Sådan gør du« (start position first), Træner
  // and Mærk (D55).
  await expect(c.locator('h2')).toHaveText(['Cues', 'Sådan gør du', 'Træner', 'Mærk']);
  await expect(c.locator('.card-cues li')).toHaveText([
    '3 sek ned, 1 sek stille',
    'Albuerne 45° ud',
    'Kroppen som én planke',
  ]);
  await expect(c.locator('.card-start')).toContainText('Udgangsstilling: Hænderne i gulvet');
  await expect(c.locator('.card-steps li')).toHaveCount(4);
  await expectCuesAndStepsOnFirstScreen(page, PHONE_HEIGHT - TAB_BAR);
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

  // »Mærk« right after »Træner«, not folded: where the exercise should be felt (D55).
  const feel = feelOf('press', 'press.1');
  expect(feel, 'press.1 har »Mærk« i content/explain/press.json').toBeTruthy();
  const feelSection = c.locator('.card-section').filter({
    has: page.getByRole('heading', { name: 'Mærk', exact: true }),
  });
  await expect(feelSection.locator('p')).toHaveText(feel ?? '');
  await expect(feelSection.locator('p')).toBeVisible();
  await feelSection.evaluate((section) => section.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: 'screenshots/kort-maerk.png', scale: 'css' });

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

  // Android's back gesture closes the card, not the app (D47).
  await page.goBack();
  await expect(card(page)).toHaveCount(0);
  await expect(page.locator('.ladder-detail')).toBeVisible();
  await expect(page.locator('.step-open', { hasText: 'Push-up med tempo' })).toBeInViewport();

  // A step with its own figure (every step has one now): no word about a similar drawing, which
  // only a borrowed pictogram gets (the test without the files below). »Tilbage« closes the card
  // and leaves no step behind in the history.
  await page.locator('.step-open', { hasText: 'Fødderne på en stol' }).click();
  await expect(c.locator('.figure-stage')).toBeVisible();
  await expect(c.locator('.card-similar')).toHaveCount(0);
  await expect(c.locator('summary', { hasText: 'Udstyr' })).toHaveText('Udstyr: Stol og væg');
  await c.getByRole('button', { name: 'Tilbage', exact: true }).first().click();
  await expect(page.locator('.ladder-detail')).toBeVisible();
  await page.locator('.step-open', { hasText: 'Push-up med tempo' }).click();
  await c.getByRole('button', { name: 'Tilbage', exact: true }).last().click();
  await expect(page.locator('.ladder-detail')).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(entries + 1);
});

test('»Øvrige« i Stiger: rotation, klubsekvens, nakke, burpee-varianter, læg, etbens RDL, rygsæk-row, opvarmning, Open & Strong og målinger', async ({
  page,
}) => {
  await openApp(page, '2026-11-17');
  await onboard(page);
  await page.getByRole('button', { name: 'Stiger', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Øvrige', exact: true })).toBeVisible();
  await page.evaluate(() => document.querySelector('.other-heading')?.scrollIntoView());
  await page.screenshot({ path: 'screenshots/stiger-ovrige.png', scale: 'css' });
  const rows = page.locator('.other-row');
  await expect(rows.locator('.ladder-name')).toHaveText([
    'Rotation · trin R1',
    'Burpee-varianter · trin 1',
    'Klubsekvensen · trin C1',
    'Nakke · trin N1',
    'Læg · trin 1',
    'Etbens RDL · trin 1',
    'Rygsæk-row · trin 1',
    'Opvarmning',
    'Open & Strong',
    'Målinger',
  ]);
  // Every entry opens its list, and every item in it opens its card.
  const c = card(page);
  for (let i = 0; i < 10; i++) {
    const name = (await rows.nth(i).locator('.ladder-name').innerText()).trim();
    await rows.nth(i).click();
    const items = page.locator('.other-detail .step-open');
    expect(await items.count(), name).toBeGreaterThan(0);
    await items.first().click();
    await expect(c.getByRole('heading', { level: 1 }), name).not.toHaveText('');
    expect(findSourceRef(await c.innerText()), name).toBeNull();
    await c.getByRole('button', { name: 'Tilbage', exact: true }).first().click();
    await expect(page.locator('.other-detail')).toBeVisible();
    await page.getByRole('button', { name: 'Tilbage', exact: true }).click();
  }

  // Nakke trin 3: three directions, each animated under its name at the top of the card and the
  // first on the first screen; no »Bevægelserne« after the steps (D62).
  await rows.filter({ hasText: 'Nakke' }).click();
  await expect(page.locator('.other-detail .mine-label')).toHaveText(['Dit trin']);
  await page.locator('.step-open', { hasText: 'Isometri, halv kraft' }).click();
  await expect(c.locator('.step-kicker')).toHaveText('Nakke · trin N3');
  await expect(c.locator('h2')).toHaveText(
    skimmed('neck', 'neck.N3', ['Cues', 'Sådan gør du', 'Træner']),
  );
  await expect(c.locator('.card-moves .card-move-title')).toHaveText([
    'Retning 1: pande',
    'Retning 2: baghoved',
    'Retning 3 og 4: siderne',
  ]);
  await expect(c.locator('.card-moves .figure-stage')).toHaveCount(3);
  await expect(c.locator('img.card-picto')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  const first = await c.locator('.card-moves .figure-stage').first().boundingBox();
  expect(first && first.y + first.height).toBeLessThanOrEqual(PHONE_HEIGHT - TAB_BAR);
  await expectCardIsClean(page);
  await c.getByRole('button', { name: 'Tilbage', exact: true }).first().click();
  await page.getByRole('button', { name: 'Tilbage', exact: true }).click();

  // A measurement's card, and the club sequence's dose explained.
  await rows.filter({ hasText: 'Målinger' }).click();
  await page.locator('.step-open', { hasText: 'Væg-testen' }).click();
  await expect(c.locator('.step-kicker')).toHaveText('Måling');
  await c.getByRole('button', { name: 'Tilbage', exact: true }).first().click();
  await page.getByRole('button', { name: 'Tilbage', exact: true }).click();
  await rows.filter({ hasText: 'Klubsekvensen' }).click();
  await page.locator('.step-open').first().click();
  await expect(c.locator('.card-dose')).toHaveText(/2 × 1 runde\s*sæt × runder/);
});

test.describe('uden forklaringsfil', () => {
  // Without the service worker, so the route below sees the request for the explanation file.
  test.use({ serviceWorkers: 'block' });

  test('et trin uden forklaring viser programmets udførelse og ser ikke tomt ud', async ({
    page,
  }) => {
    // Every step has an explanation now; a missing file shows what a step without one looks like.
    const step = track('press').steps[2];
    if (!step) throw new Error('Pres har ikke tre trin');
    await page.route(/\/content\/explain\/press|\/assets\/press-[^/]+\.json$/, (route) =>
      route.fulfill({ status: 404, body: '' }),
    );
    await openApp(page, '2026-11-17');
    await onboard(page);
    await page.getByRole('button', { name: 'Stiger', exact: true }).click();
    await page.locator('.ladder-row', { hasText: 'Pres · trin 1' }).click();
    await page.locator('.step-open', { hasText: step.name }).click();

    const c = card(page);
    await expect(c.getByRole('heading', { level: 1 })).toHaveText(step.name);
    await expect(c.getByRole('heading', { name: 'Sådan gør du', exact: true })).toBeVisible();
    await expect(c.locator('.card-section').filter({ hasText: 'Sådan gør du' })).toContainText(
      step.execution,
    );
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
    // Its pictogram is borrowed from the ladder's nearest step, and the card says so (SPEC 3.8).
    await expect(c.locator('.card-similar')).toHaveText('Tegningen viser en lignende øvelse.');
    // Without the file there is no explanation and no »Hvorfor« from content/; the programme's own
    // »Hvorfor« is shown, and pres has none, so there is nothing to fold.
    await expect(c.locator('summary')).toHaveCount(0);
    await expectCardIsClean(page);
    await page.screenshot({ path: 'screenshots/kort-uden-forklaring.png', scale: 'css' });
  });
});

test.describe('en forklaring uden »Mærk«', () => {
  // Without the service worker, so the route below sees the request for the explanation file.
  test.use({ serviceWorkers: 'block' });

  test('kortet viser ingen tom »Mærk«, når forklaringen ikke har feltet (D55)', async ({
    page,
  }) => {
    // press.json as it is, but without »Mærk«: an explanation written before the field. The figure
    // file has the same name and passes unchanged.
    await page.route(/\/content\/explain\/press|\/assets\/press-[^/]+\.json$/, async (route) => {
      const response = await route.fetch();
      const data = (await response.json()) as { items?: Array<Record<string, unknown>> };
      for (const item of data.items ?? []) delete item.feel;
      await route.fulfill({ response, json: data });
    });
    await openApp(page, '2026-11-17');
    await onboard(page);
    await page.getByRole('button', { name: 'Stiger', exact: true }).click();
    await page.locator('.ladder-row', { hasText: 'Pres · trin 1' }).click();
    await page.locator('.step-open', { hasText: 'Push-up med tempo' }).click();

    const c = card(page);
    await expect(c.getByRole('heading', { level: 1 })).toHaveText('Push-up med tempo');
    await expect(c.locator('h2')).toHaveText(['Cues', 'Sådan gør du', 'Træner']);
    await expect(c.getByText('Mærk', { exact: true })).toHaveCount(0);
    await expectCardIsClean(page);
  });
});

test('øvelseskortet fra et pas i tidsmaskinen: passet står stille, mens kortet er åbent @date', async ({
  page,
}) => {
  await openApp(page, '2026-11-06');
  await onboard(page);
  const stored = await storedEventCount(page);
  // The first Tuesday of the programme: wall test, warm-up, then power legs.
  await startSimulation(page, '2026-11-10');
  await startSession(page);
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  await expect(page.getByRole('heading', { name: 'Væg-testen' })).toBeVisible();
  await page.locator('.session-body input[type="number"]').fill('3');
  await page.getByRole('button', { name: 'Gem målingen' }).click();

  // The warm-up's first item has its card, and its timer stands still while the card is open.
  await expect(page.locator('.session-title')).toHaveText('Opvarmning · 1/4');
  await closeIntro(page);
  await page.clock.runFor(10_000);
  const warmupLeft = await secondsLeft(page);
  await page.getByRole('button', { name: 'Sådan gør du' }).click();
  const c = card(page);
  await expect(c.getByRole('heading', { level: 1 })).toHaveText('Hæv pulsen');
  await expect(c.locator('.step-kicker')).toHaveText('Opvarmning · 1 af 4');
  await expect(c.locator('.card-dose')).toHaveText('2 min');
  await expect(c.locator('.card-status')).toHaveText('Passet står stille.');
  await expect(page.locator('.session')).toBeHidden();
  await expect(page.locator('.banner.sim')).toBeVisible();
  await expectCardIsClean(page);
  // Five minutes with the card open, and the warm-up after it, as still images: the card's two
  // movements animate at its top (D62), and the fake clock would run every frame of them.
  await stillFigures(page);
  await page.clock.runFor(300_000);
  await expect(c.getByRole('heading', { level: 1 })).toHaveText('Hæv pulsen');
  await c.getByRole('button', { name: 'Tilbage til passet' }).first().click();
  await expect(page.locator('.session-title')).toHaveText('Opvarmning · 1/4');
  await expectSameTimeLeft(page, warmupLeft);
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
  await closeIntro(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });

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

  // In the pause: the next exercise's card. The pause stands still under it, and the back gesture
  // returns to it.
  await page.getByTestId('as-planned').click();
  await expect(page.getByText('Spring pausen over')).toBeVisible();
  await page.clock.runFor(5_000);
  const restLeft = await secondsLeft(page);
  await page.getByTestId('next-up').getByRole('button', { name: 'Sådan gør du' }).click();
  await expect(c.getByRole('heading', { level: 1 })).toHaveText('Squat jump');
  await page.clock.runFor(120_000);
  await page.goBack();
  await expect(card(page)).toHaveCount(0);
  await expect(page.getByText('Spring pausen over')).toBeVisible();
  await expectSameTimeLeft(page, restLeft);
  await page.getByText('Spring pausen over').click();
  await expect(count).toHaveText(`Sæt 2 af ${sets}`);

  // The time machine never writes to storage (SPEC 3.7).
  expect(await storedEventCount(page)).toBe(stored);
});

test("»Næste« viser EMOM'en i pausen og nakken ved EMOM-spørgsmålene", async ({ page }) => {
  await stillFigures(page);
  await openApp(page, '2026-11-17');
  await onboard(page);
  await startGreen(page);
  const next = page.getByTestId('next-up');
  await driveUntil(page, () => next.filter({ hasText: 'Burpees' }).isVisible(), 'pausen før EMOM');
  await expect(next.locator('.next-title')).toHaveText(/^Burpees · EMOM \d+ × \d+$/);
  await next.getByRole('button', { name: 'Sådan gør du' }).click();
  const c = card(page);
  await expect(c.locator('.step-kicker')).toHaveText(/^Burpees · trin E\d$/);
  await c.getByRole('button', { name: 'Tilbage til passet' }).first().click();
  await page.getByText('Spring pausen over').click();
  await page.getByRole('button', { name: 'Start EMOM' }).click();
  const save = page.getByRole('button', { name: 'Gem', exact: true });
  for (let i = 0; i < 12 && !(await save.isVisible()); i++) await page.clock.runFor(61_000);
  await expect(save).toBeVisible();
  await expect(next.locator('.next-title')).toContainText('Nakke');
  await next.getByRole('button', { name: 'Sådan gør du' }).click();
  await expect(c.locator('.step-kicker')).toHaveText('Nakke · trin N1');
  await c.getByRole('button', { name: 'Tilbage til passet' }).first().click();
  await expect(page.getByRole('button', { name: 'Gem', exact: true })).toBeVisible();
});

test('et hold starter og logges ikke bag kortet: det venter, til kortet er lukket', async ({
  page,
}) => {
  await stillFigures(page);
  // Styrke B, programme week 2: the side plank (a hold) after a pause, as in the review (K1).
  await openApp(page, '2026-11-20');
  await onboard(page);
  await expect(page.getByTestId('main-card')).toContainText('Styrke B');
  await startGreen(page);
  const next = page.getByTestId('next-up');
  await driveUntil(
    page,
    () => next.filter({ hasText: 'Sideplanke på albuen' }).isVisible(),
    'pausen før sideplanken',
  );
  const before = await storedEventCount(page);
  await next.getByRole('button', { name: 'Sådan gør du' }).click();
  const c = card(page);
  await expect(c.locator('.card-status')).toHaveText('Passet står stille.');
  // Longer than the pause and the hold together: nothing starts, and nothing is logged.
  await page.clock.runFor(200_000);
  await expect(c).toBeVisible();
  expect(await storedEventCount(page)).toBe(before);
  // The back gesture returns to the pause, which goes on from where it stood.
  await page.goBack();
  await expect(card(page)).toHaveCount(0);
  await expect(page.getByText('Spring pausen over')).toBeVisible();
  expect(await storedEventCount(page)).toBe(before);
  // Now the pause runs out, the hold counts down from »Klar« and logs itself (SK3).
  for (let i = 0; i < 40 && (await storedEventCount(page)) === before; i++)
    await page.clock.runFor(5_000);
  expect(await storedEventCount(page)).toBe(before + 1);
});

test('Open & Strong: kortet ved et punkt; uret står stille, og resten kører uden tryk', async ({
  page,
}) => {
  await openApp(page, '2026-11-17');
  await onboard(page);
  const before = await storedEventCount(page);
  await page.getByTestId('os-start').click();
  await page.getByTestId('os-go').click();
  await expect(page.locator('.session-title')).toContainText('1/6');
  await page.clock.runFor(10_000);
  const left = await secondsLeft(page);
  await page.getByRole('button', { name: 'Sådan gør du' }).click();
  const c = card(page);
  await expect(c.locator('.step-kicker')).toHaveText('Open & Strong · 1 af 6');
  await expect(c.locator('.card-status')).toHaveText('Open & Strong står stille.');
  await expectCardIsClean(page);
  await page.clock.runFor(120_000);
  await c.getByRole('button', { name: 'Tilbage til Open & Strong' }).first().click();
  await expect(page.locator('.session-title')).toContainText('1/6');
  await expectSameTimeLeft(page, left);
  // From here to the end without a touch (SK3), and os_done is written as before.
  for (let i = 0; i < 100; i++) {
    if (await page.getByTestId('os-close').isVisible()) break;
    await page.clock.runFor(5_000);
  }
  await expect(page.getByText('Denne uge: 1 af 7.')).toBeVisible();
  expect(await storedEventCount(page)).toBe(before + 1);
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
  // The figure: the card's code with the figure system and content/figures/pull.json.
  await expect(c.locator('.figure-stage [data-k="torso"]')).toHaveCount(1);
  await expect(c.locator('.figure-phase')).toHaveText(['Træk op', '1 sek stop', '3 sek ned']);
  // The next step's figure comes from the cache too, and so do the ladder's pictograms.
  await c.getByRole('button', { name: 'Tilbage', exact: true }).first().click();
  const picto = page.locator('.step-open img').first();
  await expect(picto).toBeVisible();
  expect(await picto.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.locator('.step-open').nth(1).click();
  await expect(c.locator('.figure-stage [data-k="torso"]')).toHaveCount(1);
  await context.setOffline(false);
});
