import { expect, test, type Page } from '@playwright/test';
import { a11yProblems, SESSION_RULES } from './a11y.ts';
import { onboard, openApp } from './helpers.ts';

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
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 20);
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
    /^Push-up med tempo\. Oppe: Strakte arme .* Nede: Brystet .* Faserne: 3 sek ned, 1 sek stille og op\.$/,
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
