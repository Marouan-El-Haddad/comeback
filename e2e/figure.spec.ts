import { expect, test, type Page } from '@playwright/test';
import { a11yProblems, SESSION_RULES } from './a11y.ts';
import { closeIntro, onboard, openApp, startSession } from './helpers.ts';

// The animated figure on the exercise card (docs/SPEC.md 3.8, 5 and 6; DECISIONS.md D48): it moves
// in the step's tempo (push-up: 3 sek ned, 1 sek stille, op) with the running phase highlighted, a
// tap plays it at half speed, reduced motion shows the positions as still images, it has a text
// alternative, and it works without a network. The clock is page.clock: the animation runs on
// requestAnimationFrame and performance.now, so the test steps time and watches the phases change.

test.describe.configure({ timeout: 120_000 });

const card = (page: Page) => page.locator('.exercise-card');
const current = (page: Page) => card(page).locator('.figure-phase[aria-current="step"]');

/** Opens a step's card from Stiger. */
async function openCard(page: Page, ladder: string, step: string): Promise<void> {
  await page.getByRole('button', { name: 'Stiger', exact: true }).click();
  await page.locator('.ladder-row', { hasText: ladder }).click();
  await page.locator('.step-open', { hasText: step }).click();
  await expect(card(page).getByRole('heading', { level: 1 })).toHaveText(step);
}

/** Stops the clock, so the test moves time itself. */
async function pauseClock(page: Page): Promise<void> {
  // The page's clock runs on in real time until it stands still; under load it can pass the moment
  // first, so try a little further ahead.
  for (let i = 1; ; i++) {
    const now = await page.evaluate(() => Date.now());
    try {
      await page.clock.pauseAt(now + 50 * i);
      return;
    } catch (error) {
      if (i >= 5) throw error;
    }
  }
}

/** Moves time on in steps of `step` ms until the running phase is `label`; returns the ms it took. */
async function untilPhase(page: Page, label: string, step = 50, limit = 15_000): Promise<number> {
  for (let ms = 0; ms <= limit; ms += step) {
    if ((await current(page).allTextContents())[0] === label) return ms;
    await page.clock.runFor(step);
  }
  throw new Error(`Fasen »${label}« kom ikke inden for ${limit} ms`);
}

/** The y of the hip, from the torso line: it moves while the figure moves. */
async function hipY(page: Page): Promise<number> {
  return Number(await card(page).locator('.figure-stage [data-k="torso"]').getAttribute('y1'));
}

test('figuren animerer push-uppen i tempoet: 3 sek ned, 1 sek stille, op', async ({ page }) => {
  await openApp(page, '2026-11-17');
  await onboard(page);
  await openCard(page, 'Pres · trin 1', 'Push-up med tempo');
  const c = card(page);
  // The figure replaces the pictogram, with its text alternative and the phases under it.
  await expect(c.locator('img.card-picto')).toHaveCount(0);
  const stage = c.locator('.figure-stage');
  await expect(stage).toHaveAttribute('role', 'img');
  await expect(stage).toHaveAttribute(
    'aria-label',
    /^Push-up med tempo\. Oppe: Strakte arme .* Nede: Brystet .* Faserne: 3 sek ned, 1 sek stille og op\. Markeringer: i »3 sek ned« en pil ned ved brystet; ved Nede en lige linje fra foden til skulderen: »Én planke«; i »Op« en pil op ved brystet\.$/,
  );
  await expect(c.locator('.figure-phase')).toHaveText(['3 sek ned', '1 sek stille', 'Op']);
  await expect(c.locator('.card-phases').first()).toHaveText('3 sek ned · 1 sek stille · Op');
  await expect(c.getByRole('button', { name: 'Slowmotion' })).toBeVisible();
  await page.screenshot({ path: 'screenshots/kort-figur.png', scale: 'css' });

  await pauseClock(page);
  // From the start of »Op« the timeline is known to the frame: 1 sek op, then 3 sek ned.
  await untilPhase(page, 'Op');
  await untilPhase(page, '3 sek ned');
  const top = await hipY(page);
  await page.clock.runFor(1_500);
  await expect(current(page)).toHaveText('3 sek ned');
  // SVG y grows downward: the hip is lower halfway down.
  expect(await hipY(page)).toBeGreaterThan(top + 3);
  await page.clock.runFor(1_400);
  await expect(current(page)).toHaveText('3 sek ned');
  const down = await untilPhase(page, '1 sek stille');
  expect(down, 'ned varer 3 sek').toBeLessThanOrEqual(250);
  const bottom = await hipY(page);
  await page.clock.runFor(850);
  await expect(current(page)).toHaveText('1 sek stille');
  expect(await hipY(page), 'stille i bunden').toBeCloseTo(bottom, 1);
  const still = await untilPhase(page, 'Op');
  expect(still, 'stille varer 1 sek').toBeLessThanOrEqual(250);
  await page.clock.runFor(850);
  await expect(current(page)).toHaveText('Op');
  expect(await untilPhase(page, '3 sek ned'), 'op varer 1 sek').toBeLessThanOrEqual(250);
  expect(await hipY(page)).toBeCloseTo(top, 0);
  expect(await a11yProblems(page, '.exercise-card', SESSION_RULES)).toEqual([]);
});

test('et tryk på figuren giver slowmotion (halv fart), og et tryk mere normal fart', async ({
  page,
}) => {
  await openApp(page, '2026-11-17');
  await onboard(page);
  await openCard(page, 'Pres · trin 1', 'Push-up med tempo');
  const c = card(page);
  await pauseClock(page);
  await untilPhase(page, 'Op');
  await untilPhase(page, '3 sek ned');
  await c.locator('.figure-stage').tap();
  await expect(c.getByRole('button', { name: 'Normal fart' })).toBeVisible();
  // »3 sek ned« now takes 6 sek, »1 sek stille« 2 sek.
  await page.clock.runFor(5_500);
  await expect(current(page)).toHaveText('3 sek ned');
  expect(await untilPhase(page, '1 sek stille')).toBeLessThanOrEqual(800);
  await page.clock.runFor(1_700);
  await expect(current(page)).toHaveText('1 sek stille');
  expect(await untilPhase(page, 'Op')).toBeLessThanOrEqual(500);
  await page.screenshot({ path: 'screenshots/kort-figur-slowmotion.png', scale: 'css' });
  // The button does the same: back to normal speed, »Op« in 1 sek.
  await c.getByRole('button', { name: 'Normal fart' }).click();
  await expect(c.getByRole('button', { name: 'Slowmotion' })).toBeVisible();
  await untilPhase(page, '3 sek ned');
  await page.clock.runFor(2_800);
  await expect(current(page)).toHaveText('3 sek ned');
  expect(await untilPhase(page, '1 sek stille')).toBeLessThanOrEqual(400);
});

test('reduceret bevægelse giver positionerne som stillbilleder side om side', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page, '2026-11-17');
  await onboard(page);
  await openCard(page, 'Pres · trin 1', 'Push-up med tempo');
  const c = card(page);
  const stills = c.locator('.figure-still');
  await expect(stills).toHaveCount(2);
  await expect(c.locator('.figure-still-name')).toHaveText(['Oppe', 'Nede']);
  await expect(c.locator('.figure-stills')).toHaveAttribute('role', 'img');
  await expect(c.locator('.figure-stills')).toHaveAttribute(
    'aria-label',
    /^Push-up med tempo\. Oppe: /,
  );
  // Side by side, and nothing moves: no running phase, no slow motion, the same drawing later.
  const [first, second] = [await stills.nth(0).boundingBox(), await stills.nth(1).boundingBox()];
  expect(first && second && Math.abs(first.y - second.y)).toBeLessThan(1);
  expect(first && second && second.x).toBeGreaterThan((first?.x ?? 0) + (first?.width ?? 0) - 1);
  await expect(c.locator('.figure-phase[aria-current]')).toHaveCount(0);
  await expect(c.locator('.figure-speed')).toHaveCount(0);
  const drawing = await c.locator('.figure-stills').innerHTML();
  await page.clock.runFor(4_000);
  expect(await c.locator('.figure-stills').innerHTML()).toBe(drawing);
  expect(await a11yProblems(page, '.exercise-card', SESSION_RULES)).toEqual([]);
  await page.screenshot({ path: 'screenshots/kort-figur-stillbilleder.png', scale: 'css' });
});

test('wall sit ved væggen og rygsæk-row med stol og rygsæk: figur, faser og tekstalternativ', async ({
  page,
}) => {
  await openApp(page, '2026-11-17');
  await onboard(page);
  await openCard(page, 'Wall sit · trin W1', 'Wall sit, 90°');
  const c = card(page);
  await expect(c.locator('.figure-phase')).toHaveText(['Glid ned', 'Hold', 'Glid op']);
  await expect(c.locator('.figure-stage')).toHaveAttribute(
    'aria-label',
    /^Wall sit, 90°\. Stående: /,
  );
  await pauseClock(page);
  // The hold (a "dose" phase) lasts 2 sek on the card.
  await untilPhase(page, 'Hold');
  await page.clock.runFor(1_800);
  await expect(current(page)).toHaveText('Hold');
  expect(await untilPhase(page, 'Glid op')).toBeLessThanOrEqual(400);
  await page.screenshot({ path: 'screenshots/kort-figur-wallsit.png', scale: 'css' });
  await c.getByRole('button', { name: 'Tilbage', exact: true }).first().click();
  await page.getByRole('button', { name: 'Tilbage', exact: true }).click();

  await openCard(page, 'Træk · trin 1', 'Rygsæk-row med én arm');
  await expect(c.locator('.figure-phase')).toHaveText(['Træk op', '1 sek stop', '3 sek ned']);
  // The chair and the backpack are drawn with the figure.
  expect(await c.locator('.figure-stage svg rect').count()).toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: 'screenshots/kort-figur-row.png', scale: 'css' });
  expect(await a11yProblems(page, '.exercise-card', SESSION_RULES)).toEqual([]);
});

test('figuren står stille, når kortet er rullet væk, og fortsætter, hvor den stod', async ({
  page,
}) => {
  await openApp(page, '2026-11-17');
  await onboard(page);
  await openCard(page, 'Pres · trin 1', 'Push-up med tempo');
  const c = card(page);
  await pauseClock(page);
  await untilPhase(page, 'Op');
  await untilPhase(page, '3 sek ned');
  await page.clock.runFor(1_000);
  // Scrolled out of view: the loop stops, so »3 sek ned« is still running much later.
  await c.locator('.card-back').scrollIntoViewIfNeeded();
  await expect(c.locator('.figure-stage')).not.toBeInViewport();
  await page.clock.runFor(10_000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(c.locator('.figure-stage')).toBeInViewport();
  await page.clock.runFor(100);
  await expect(current(page)).toHaveText('3 sek ned');
  expect(await untilPhase(page, '1 sek stille')).toBeGreaterThan(1_500);
});

/** The angle at the near knee in the drawing, from the thigh's and the shin's lines (180° = straight). */
async function nearKnee(page: Page): Promise<number> {
  return card(page)
    .locator('.figure-stage svg')
    .evaluate((svg) => {
      const line = (k: string) => {
        const el = svg.querySelector(`[data-k="${k}"]`);
        const n = (a: string) => Number(el?.getAttribute(a));
        return { x1: n('x1'), y1: n('y1'), x2: n('x2'), y2: n('y2') };
      };
      const thigh = line('near.leg.1');
      const shin = line('near.leg.2');
      const a = [thigh.x1 - thigh.x2, thigh.y1 - thigh.y2];
      const b = [shin.x2 - shin.x1, shin.y2 - shin.y1];
      const dot = (a[0] ?? 0) * (b[0] ?? 0) + (a[1] ?? 0) * (b[1] ?? 0);
      const cos = dot / (Math.hypot(a[0] ?? 0, a[1] ?? 0) * Math.hypot(b[0] ?? 0, b[1] ?? 0));
      return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
    });
}

test('push-uppen knækker ikke midt i en fase: knæet er strakt hele vejen ned og op (H1)', async ({
  page,
}) => {
  await openApp(page, '2026-11-17');
  await onboard(page);
  await openCard(page, 'Pres · trin 1', 'Push-up med tempo');
  await pauseClock(page);
  await untilPhase(page, 'Op');
  await untilPhase(page, '3 sek ned');
  // Every quarter of a second through »3 sek ned«, »1 sek stille« and »Op«.
  const knees: number[] = [];
  for (let ms = 0; ms < 5_000; ms += 250) {
    knees.push(await nearKnee(page));
    await page.clock.runFor(250);
  }
  expect(Math.min(...knees), knees.map((k) => Math.round(k)).join(' ')).toBeGreaterThanOrEqual(175);
  // Halfway down: the body is still one line, and the screenshot shows it.
  await untilPhase(page, '3 sek ned');
  await page.clock.runFor(1_500);
  expect(await nearKnee(page)).toBeGreaterThanOrEqual(175);
  await page.screenshot({ path: 'screenshots/kort-figur-halvvejs.png', scale: 'css' });
});

test('figuren står stille i baggrunden og tegner højst 30 gange i sekundet (L2)', async ({
  page,
}) => {
  await openApp(page, '2026-11-17');
  await onboard(page);
  await openCard(page, 'Pres · trin 1', 'Push-up med tempo');
  await pauseClock(page);
  await untilPhase(page, '3 sek ned');
  // Count drawings: each one sets the torso's x1 once.
  await card(page)
    .locator('.figure-stage [data-k="torso"]')
    .evaluate((el) => {
      const counter = window as unknown as { draws: number };
      counter.draws = 0;
      const set = el.setAttribute.bind(el);
      el.setAttribute = (name: string, value: string) => {
        if (name === 'x1') counter.draws++;
        set(name, value);
      };
    });
  const draws = () => page.evaluate(() => (window as unknown as { draws: number }).draws);
  await page.clock.runFor(1_000);
  const perSecond = await draws();
  expect(perSecond).toBeGreaterThan(5);
  expect(perSecond).toBeLessThanOrEqual(30);

  // The app goes to the background: no drawing, and the phase stands still.
  const phase = await current(page).innerText();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const before = await draws();
  await page.clock.runFor(6_000);
  expect(await draws()).toBe(before);
  await expect(current(page)).toHaveText(phase);
  // Back in front: it goes on from where it stood.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(500);
  expect(await draws()).toBeGreaterThan(before);
  await expect(current(page)).toHaveText(phase);
});

test('reduceret bevægelse med fem positioner: højst tre stillbilleder pr. række, store nok at se (L1)', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page, '2026-11-17');
  await onboard(page);
  await openCard(page, 'Burpees · trin E1', 'EMOM 4 × 3');
  const stills = card(page).locator('.figure-still');
  await expect(stills).toHaveCount(5);
  const boxes = await stills.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  );
  const rows = new Map<number, number>();
  for (const b of boxes) rows.set(Math.round(b.y), (rows.get(Math.round(b.y)) ?? 0) + 1);
  expect(rows.size).toBeGreaterThanOrEqual(2);
  expect(Math.max(...rows.values())).toBeLessThanOrEqual(3);
  for (const b of boxes) expect(b.width).toBeGreaterThanOrEqual(100);
  // No still overlaps another.
  for (const [i, a] of boxes.entries()) {
    for (const b of boxes.slice(i + 1)) {
      const apart =
        a.x + a.width <= b.x + 1 ||
        b.x + b.width <= a.x + 1 ||
        a.y + a.height <= b.y + 1 ||
        b.y + b.height <= a.y + 1;
      expect(apart).toBe(true);
    }
  }
  expect(await a11yProblems(page, '.exercise-card', SESSION_RULES)).toEqual([]);
  await card(page).locator('.figure-stills').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'screenshots/kort-figur-fem-stillbilleder.png', scale: 'css' });
});

// ---------------------------------------------------------------------------------------------
// Views, marks and typical mistakes (docs/SPEC.md 3.2 and 3.8, DECISIONS.md D58): the examples
// press.1 (arrows, »Én planke« and the hanging hip), power_legs.1 (the squat jump from the side and
// the front with »Knæ over tæer«) and wallsit.W1 (90° at the knee).
// ---------------------------------------------------------------------------------------------

/** The text of the mark shown now in a view, or null when none is shown. */
async function markText(root: ReturnType<Page['locator']>, view = 0): Promise<string | null> {
  const mark = root.locator('.figure-draw').nth(view).locator('.figure-mark');
  return (await mark.isVisible()) ? mark.innerText() : null;
}

/** Whether a view draws a mark's shapes now. */
async function markDrawn(root: ReturnType<Page['locator']>, view = 0): Promise<boolean> {
  return root
    .locator('.figure-draw')
    .nth(view)
    .locator('g.figure-marks')
    .evaluate((g) => g.childElementCount > 0);
}

test('to vinkler: squat jumpet fra siden og forfra på samme ur, med navnene over @date', async ({
  page,
}) => {
  await openApp(page, '2026-11-17');
  await onboard(page);
  await openCard(page, 'Power ben · trin 1', 'Squat jump');
  const c = card(page);
  const figure = c.locator('.card-figure .figure');
  await expect(figure).toHaveClass(/\btwo\b/);
  await expect(figure.locator('.figure-view-name')).toHaveText(['Fra siden', 'Forfra']);
  await expect(figure.locator('.figure-draw')).toHaveCount(2);
  // One line of phases for both, and a text alternative that names the views and the marks.
  await expect(c.locator('.card-figure .figure-phases')).toHaveCount(1);
  await expect(c.locator('.card-figure .figure-stage')).toHaveAttribute(
    'aria-label',
    /Tegnet fra siden og forfra\. Markeringer: i »Sæt dig ned« en pil .* ved hoften; forfra ved Landing »Knæ over tæer« ved knæet\.$/,
  );
  await pauseClock(page);
  await untilPhase(page, 'Rejs dig');
  await untilPhase(page, 'Sæt dig ned');
  const hips = () =>
    figure
      .locator('.figure-draw svg [data-k="torso"]')
      .evaluateAll((els) =>
        els.map((el) =>
          Number(el.getAttribute('y1') ?? el.getAttribute('points')?.split(/[ ,]/)[1]),
        ),
      );
  const before = await hips();
  // In »Sæt dig ned« both views go down together: the same clock (SVG y grows downward).
  await page.clock.runFor(400);
  await expect(current(page)).toHaveText('Sæt dig ned');
  const after = await hips();
  expect(after[0]).toBeGreaterThan((before[0] ?? 0) + 3);
  expect(after[1]).toBeGreaterThan((before[1] ?? 0) + 3);
  // The arrow for the hip on the way down in the side view; no text with it.
  expect(await markDrawn(figure, 0)).toBe(true);
  expect(await markText(figure, 0)).toBeNull();
  await page.screenshot({ path: 'screenshots/kort-figur-vinkler.png', scale: 'css' });
  // »Frys 2 sek« at the landing: »Knæ over tæer« by the front view's knee, at 18 px.
  await untilPhase(page, 'Frys 2 sek');
  await page.clock.runFor(200);
  expect(await markText(figure, 1)).toBe('Knæ over tæer');
  expect(await markDrawn(figure, 0)).toBe(false);
  expect(await a11yProblems(page, '.exercise-card', SESSION_RULES)).toEqual([]);
  await page.screenshot({ path: 'screenshots/kort-figur-vinkler-cue.png', scale: 'css' });
  // It leaves with the phase: one mark at a time, only at its moment.
  await untilPhase(page, 'Rejs dig');
  await page.clock.runFor(100);
  expect(await markText(figure, 1)).toBeNull();
});

test('en markering står i sin fase: pil ned, »Én planke« i bunden, pil op (press.1), 90° i wall sit', async ({
  page,
}) => {
  await openApp(page, '2026-11-17');
  await onboard(page);
  await openCard(page, 'Pres · trin 1', 'Push-up med tempo');
  const c = card(page);
  const figure = c.locator('.card-figure .figure');
  await pauseClock(page);
  await untilPhase(page, 'Op');
  await untilPhase(page, '3 sek ned');
  await page.clock.runFor(1_000);
  // »3 sek ned«: the arrow at the chest, no text.
  expect(await markDrawn(figure)).toBe(true);
  expect(await markText(figure)).toBeNull();
  const arrow = await figure.locator('g.figure-marks').innerHTML();
  expect(arrow).toContain('polyline');
  // »1 sek stille« at the bottom: the guide line from the heel to the shoulder with its cue.
  await untilPhase(page, '1 sek stille');
  await page.clock.runFor(300);
  expect(await markText(figure)).toBe('Én planke');
  expect(await figure.locator('g.figure-marks').innerHTML()).toContain('stroke-dasharray');
  // The text stands inside the drawing and covers no more than its own box (18 px, SPEC 6).
  const mark = await figure.locator('.figure-mark').boundingBox();
  const draw = await figure.locator('.figure-draw').boundingBox();
  expect(
    mark && draw && mark.x >= draw.x - 1 && mark.x + mark.width <= draw.x + draw.width + 1,
  ).toBe(true);
  expect(await a11yProblems(page, '.exercise-card', SESSION_RULES)).toEqual([]);
  await page.screenshot({ path: 'screenshots/kort-figur-markering.png', scale: 'css' });
  // »Op«: a new arrow, the text gone.
  await untilPhase(page, 'Op');
  await page.clock.runFor(300);
  expect(await markText(figure)).toBeNull();
  expect(await figure.locator('g.figure-marks').innerHTML()).not.toBe(arrow);
  await c.getByRole('button', { name: 'Tilbage', exact: true }).first().click();
  await page.getByRole('button', { name: 'Tilbage', exact: true }).click();

  // Wall sit: the knee's 90° in the hold, with its arc.
  await openCard(page, 'Wall sit · trin W1', 'Wall sit, 90°');
  await pauseClock(page);
  await untilPhase(page, 'Hold');
  await page.clock.runFor(300);
  expect(await markText(c.locator('.card-figure .figure'))).toBe('90°');
  await page.screenshot({ path: 'screenshots/kort-figur-vinkel.png', scale: 'css' });
});

test('typiske fejl som figur: »Rigtigt« og »Forkert« side om side under fejlen (press.1)', async ({
  page,
}) => {
  await openApp(page, '2026-11-17');
  await onboard(page);
  await openCard(page, 'Pres · trin 1', 'Push-up med tempo');
  const c = card(page);
  const fold = c.locator('details.card-fold', { hasText: 'Typiske fejl' });
  // Drawn when the fold opens, not before (the card opens as fast as before).
  await expect(c.locator('.fault-pair')).toHaveCount(0);
  await fold.locator('summary').click();
  const first = fold.locator('.card-mistakes li').first();
  const pair = first.locator('.fault-pair');
  await expect(pair).toBeVisible();
  await expect(pair.locator('.fault-label')).toHaveText(['Rigtigt', 'Forkert']);
  await expect(pair).toHaveAttribute(
    'aria-label',
    'Rigtigt: Oppe. Forkert: Hoften hænger, eller den stikker op.',
  );
  // Side by side at the same size, the wrong one with a ring where it differs.
  const [right, wrong] = [
    await pair.locator('.fault-cell').nth(0).boundingBox(),
    await pair.locator('.fault-cell').nth(1).boundingBox(),
  ];
  expect(right && wrong && Math.abs(right.y - wrong.y)).toBeLessThan(1);
  expect(right && wrong && Math.abs(right.width - wrong.width)).toBeLessThan(1);
  expect(await pair.locator('.fault-cell.wrong svg').innerHTML()).toContain('stroke-dasharray');
  // Only the mistake the figure draws has a pair.
  await expect(fold.locator('.fault-pair')).toHaveCount(1);
  expect(await a11yProblems(page, '.exercise-card', SESSION_RULES)).toEqual([]);
  await pair.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'screenshots/kort-fejlpar.png', scale: 'css' });
});

test('reduceret bevægelse: stillbillederne har deres markeringer, og den anden vinkel står under sit navn', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page, '2026-11-17');
  await onboard(page);
  await openCard(page, 'Pres · trin 1', 'Push-up med tempo');
  const c = card(page);
  const stills = c.locator('.card-figure .figure-still');
  await expect(stills).toHaveCount(2);
  // »Nede« carries the guide line with »Én planke« and the arrow up for »Op« that starts there;
  // »Oppe« the arrow down for »3 sek ned«.
  await expect(stills.nth(1).locator('.figure-mark')).toHaveText('Én planke');
  await expect(stills.nth(1).locator('.figure-mark')).toBeVisible();
  expect(await stills.nth(0).locator('svg').innerHTML()).toContain('polyline');
  expect(await a11yProblems(page, '.exercise-card', SESSION_RULES)).toEqual([]);
  await page.screenshot({ path: 'screenshots/kort-stillbilleder-markeringer.png', scale: 'css' });
  await c.getByRole('button', { name: 'Tilbage', exact: true }).first().click();
  await page.getByRole('button', { name: 'Tilbage', exact: true }).click();

  // The squat jump: its positions from the side, then from the front under »Forfra«, the cue on the
  // front view's landing.
  await openCard(page, 'Power ben · trin 1', 'Squat jump');
  const views = c.locator('.card-figure .figure-stills-view');
  await expect(views).toHaveCount(2);
  await expect(c.locator('.card-figure .figure-view-name')).toHaveText(['Fra siden', 'Forfra']);
  const landing = views.nth(1).locator('.figure-still').filter({ hasText: 'Landing' });
  await expect(landing.locator('.figure-mark')).toHaveText('Knæ over tæer');
  await expect(c.locator('.card-figure .figure-stills-all')).toHaveAttribute(
    'aria-label',
    /Markeringer: .*»Knæ over tæer«/,
  );
  await page.screenshot({ path: 'screenshots/kort-stillbilleder-vinkler.png', scale: 'css' });
});

test('»Nu« i passet: begge vinkler og markeringen på sit tidspunkt (D52, D58) @date', async ({
  page,
}) => {
  await openApp(page, '2026-11-17');
  await onboard(page);
  await startSession(page);
  // The warm-up as still images, so the fake clock does not draw four minutes of frames.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
  await closeIntro(page);
  const now = page.locator('.session .stack.now');
  await expect(now.locator('.set-name')).toHaveText('Squat jump');
  const figure = now.locator('.now-stage .figure');
  await expect(figure.locator('.figure-draw')).toHaveCount(2);
  // In a session the views stand without names, to leave room for the set.
  await expect(figure.locator('.figure-view-name')).toHaveCount(0);
  await pauseClock(page);
  const phase = now.locator('.figure-current .figure-phase');
  for (let ms = 0; ms < 10_000 && (await phase.allTextContents())[0] !== 'Frys 2 sek'; ms += 50) {
    await page.clock.runFor(50);
  }
  await expect(phase).toHaveText('Frys 2 sek');
  await page.clock.runFor(200);
  expect(await markText(figure, 1)).toBe('Knæ over tæer');
  // »Som planlagt« stays where it is (D33), and the text reads at 18 px and 7:1 (SPEC 6).
  await expect(page.getByTestId('as-planned')).toBeInViewport();
  expect(await a11yProblems(page, '.session', SESSION_RULES)).toEqual([]);
  await page.screenshot({ path: 'screenshots/pas-nu-vinkler-markering.png', scale: 'css' });
});
