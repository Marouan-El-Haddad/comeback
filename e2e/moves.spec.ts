import { expect, test, type Locator, type Page } from '@playwright/test';
import { a11yProblems, APP_RULES } from './a11y.ts';
import { onboard, startSimulation, storedEventCount } from './helpers.ts';

// Flyt og spring over (docs/SPEC.md 3.1 og 3.4, ENGINE.md 5.9, DECISIONS.md D64): tirsdagens Styrke
// A, der ikke blev logget, onsdag (PLAN M3, tjekliste 7), flytningen af tirsdagens Styrke A til
// onsdag som kort version, »Spring over« på dagen og dagen efter, et glemt pas fra tirsdag i Uge
// torsdag – i tidsmaskinen, som intet skriver til lageret – og dobbelttryk, der skriver én gang.

test.describe.configure({ timeout: 300_000 });

/** 08:00 in Copenhagen on Monday 9/11. */
const MONDAY_MORNING = '2026-11-09T07:00:00Z';
/** A whole screen in one picture: the time machine's banner on top, the tabs under the screen. */
const IN_FLOW = '.banner, .tabbar { position: static !important; }';

async function openAt(page: Page, instant: string): Promise<void> {
  await page.clock.install({ time: new Date(instant) });
  await page.goto('/comeback/');
}

async function expectClean(page: Page, where: string): Promise<void> {
  expect.soft(await a11yProblems(page, '.app', APP_RULES), where).toEqual([]);
}

/** »+1 dag« in the time machine, and the banner shows the new date. */
async function nextDay(page: Page, date: string): Promise<void> {
  await page.getByTestId('sim-next').click();
  await expect(page.locator('.banner.sim')).toContainText(date);
}

async function tab(page: Page, name: 'I dag' | 'Uge'): Promise<void> {
  await page.getByRole('button', { name, exact: true }).click();
}

/** The day buttons of a group on the move screen as »day | note | note«, in their order. */
function moveDays(group: Locator): Promise<string[]> {
  return group
    .getByTestId('move-day')
    .evaluateAll((buttons) =>
      buttons.map((b) =>
        [...b.querySelectorAll('span')].map((s) => (s.textContent ?? '').trim()).join(' | '),
      ),
    );
}

/** The line I dag or Uge shows after a write (»✓ …«). */
function savedLine(page: Page, text: string): Locator {
  return page.locator('.life-saved[role="status"]', { hasText: text });
}

function weekRow(page: Page, weekday: string): Locator {
  return page.locator('.week-day', {
    has: page.locator('.week-day-weekday', { hasText: weekday }),
  });
}

test('PLAN M3 tjekliste 7: tirsdagens Styrke A, der ikke blev logget, tilbydes onsdag torsdag (motoren udgår) og søndag som hele dage og onsdag og lørdag som kort version @date', async ({
  page,
}) => {
  await openAt(page, MONDAY_MORNING);
  await onboard(page);
  const stored = await storedEventCount(page);
  await startSimulation(page, '2026-11-10');
  const card = page.getByTestId('main-card');
  await expect(card).toContainText('Styrke A');

  // Tuesday goes by without the session.
  await nextDay(page, 'onsdag 11. november');
  const missed = page.getByTestId('missed-card');
  await expect(missed).toHaveCount(1);
  await expect(missed.locator('.life-card-title')).toHaveText('Styrke A i går blev ikke logget');
  await expect(missed.getByRole('button')).toHaveText(['Flyt', 'Spring over']);
  await expectClean(page, 'I dag onsdag med et glemt pas');
  await page.screenshot({
    path: 'screenshots/i-dag-glemt-pas.png',
    scale: 'css',
    animations: 'disabled',
  });
  await missed.getByRole('button', { name: 'Flyt', exact: true }).click();

  const screen = page.getByTestId('move');
  await expect(screen).toContainText('Styrke A · tirsdag 10. november · ikke logget');
  await expect(screen.getByRole('heading', { name: 'Flyt eller spring over' })).toBeVisible();
  const full = screen.getByRole('group', { name: 'Flyt til' });
  const short = screen.getByRole('group', { name: 'Kort version på en klubdag' });
  // Only the days the engine allows (S-MOVE-01): never Friday (Styrke B).
  expect(await moveDays(full)).toEqual([
    'Torsdag 12. november | Motoren udgår denne uge – tag en valgfri rolig tur søndag. | B skal efterlade dig frisk.',
    'Søndag 15. november',
  ]);
  expect(await moveDays(short)).toEqual([
    'Kort version i dag',
    'Kort version lørdag 14. november | B skal efterlade dig frisk.',
  ]);
  await expect(screen.getByTestId('move-day')).toHaveCount(4);
  await expect(screen).not.toContainText('fredag');
  await expect(screen.getByTestId('move-skip')).toHaveText('Spring over');
  await expectClean(page, 'Flyt eller spring over');
  await page.screenshot({
    path: 'screenshots/flyt.png',
    scale: 'css',
    animations: 'disabled',
    fullPage: true,
    style: IN_FLOW,
  });

  await full.getByRole('button', { name: /^Torsdag 12\. november/ }).click();
  await expect(screen).toHaveCount(0);
  await expect(savedLine(page, '✓ Styrke A er flyttet til torsdag 12. november.')).toBeVisible();
  await expect(missed).toHaveCount(0);
  await expect(page.locator('.tomorrow')).toHaveText('I morgen: Styrke A');
  // The motor drops this week: the optional calm run stands on Sunday, the first free day (D66).
  await page.locator('.rest-of-week summary').click();
  await expect(page.locator('.rest-of-week li')).toHaveText([
    'Fredag: Styrke B',
    'Lørdag: Muay Thai 10–11',
    'Søndag: Valgfri rolig tur',
  ]);
  await expect(page.getByTestId('calm-tour')).toHaveCount(0);

  // Uge: Styrke A on Thursday, no motor this week, and Tuesday without a session.
  await tab(page, 'Uge');
  const thursday = weekRow(page, 'Torsdag');
  await expect(thursday.getByTestId('week-session')).toHaveText(/^Styrke A · \d+ min$/);
  await expect(thursday.locator('.chip.status')).toHaveText('flyttet fra tirsdag');
  await expect(weekRow(page, 'Tirsdag').locator('.chip')).toHaveCount(0);
  await expect(page.locator('.week-days .chip', { hasText: 'Motor' })).toHaveCount(0);
  await expectClean(page, 'Uge med et flyttet pas');
  await page.screenshot({
    path: 'screenshots/uge-flyttet.png',
    scale: 'css',
    animations: 'disabled',
    fullPage: true,
    style: IN_FLOW,
  });

  // Thursday: Styrke A on I dag, moved from Tuesday, and the motor drops this week.
  await tab(page, 'I dag');
  await nextDay(page, 'torsdag 12. november');
  await expect(card.locator('h1')).toHaveText('Styrke A');
  await expect(page.getByTestId('main-card-notes').locator('li')).toHaveText([
    'Flyttet fra tirsdag.',
    'Motoren udgår denne uge – tag en valgfri rolig tur søndag.',
  ]);
  await expect(page.getByTestId('missed-card')).toHaveCount(0);

  // Thursday's A and Friday's B go by and are skipped; Saturday says tomorrow, Sunday says today.
  await nextDay(page, 'fredag 13. november');
  await missed.getByTestId('missed-skip').click();
  await nextDay(page, 'lørdag 14. november');
  await missed.getByTestId('missed-skip').click();
  await expect(missed).toHaveCount(0);
  await expect(page.locator('.tomorrow')).toHaveText('I morgen: Valgfri rolig tur');
  await nextDay(page, 'søndag 15. november');
  await expect(page.getByTestId('calm-tour')).toHaveText(
    'Valgfri rolig tur i dag: motoren udgår denne uge, så tag en rolig tur i tale-tempo, hvis du kan.',
  );
  await expect(card).toContainText('Søndagstjek');
  await expectClean(page, 'I dag søndag med den valgfri rolige tur');
  await page.screenshot({
    path: 'screenshots/i-dag-rolig-tur.png',
    scale: 'css',
    animations: 'disabled',
  });

  expect(await storedEventCount(page)).toBe(stored);
  await page.getByTestId('sim-exit').click();
  await expect(page.locator('.banner.sim')).toHaveCount(0);
  expect(await storedEventCount(page)).toBe(stored);
});

test('flyt tirsdagens Styrke A til onsdag: kort version om morgenen, og den står onsdag i I dag og Uge @date', async ({
  page,
}) => {
  await openAt(page, MONDAY_MORNING);
  await onboard(page);
  const stored = await storedEventCount(page);
  await startSimulation(page, '2026-11-10');

  const card = page.getByTestId('main-card');
  await expect(card.getByTestId('move-open')).toHaveText('Flyt eller spring over');
  await card.getByTestId('move-open').click();
  const screen = page.getByTestId('move');
  await expect(screen).toContainText('Styrke A · tirsdag 10. november');
  await expect(screen).not.toContainText('ikke logget');
  const short = screen.getByRole('group', { name: 'Kort version på en klubdag' });
  expect(await moveDays(short)).toEqual([
    'Kort version onsdag 11. november',
    'Kort version lørdag 14. november | B skal efterlade dig frisk.',
  ]);
  await short.getByRole('button', { name: 'Kort version onsdag 11. november' }).click();

  await expect(
    savedLine(page, '✓ Styrke A er flyttet til onsdag 11. november som kort version.'),
  ).toBeVisible();
  // Tuesday is free now, and tomorrow is the short version.
  await expect(card.locator('h1')).toHaveText('Hviledag');
  await expect(page.locator('.tomorrow')).toHaveText('I morgen: Styrke A · kort version');
  await tab(page, 'Uge');
  const wednesday = weekRow(page, 'Onsdag');
  await expect(wednesday.getByTestId('week-session')).toHaveText('Styrke A · kort · 30 min');
  await expect(wednesday).toContainText('Muay Thai 18–19.30');
  await expect(wednesday.locator('.chip.status')).toHaveText('flyttet fra tirsdag');
  await expect(weekRow(page, 'Tirsdag').locator('.chip')).toHaveCount(0);

  // Wednesday: the short version on I dag, not a forgotten session.
  await tab(page, 'I dag');
  await nextDay(page, 'onsdag 11. november');
  await expect(page.getByTestId('missed-card')).toHaveCount(0);
  await expect(card.locator('h1')).toHaveText('Styrke A');
  await expect(card).toContainText('ca. 30 min');
  await expect(page.getByTestId('main-card-notes').locator('li')).toHaveText([
    'Flyttet fra tirsdag.',
    'Kort version: 30 min med opvarmning, par 1 og 2 – om morgenen, før Muay Thai 18–19.30.',
  ]);
  await expectClean(page, 'I dag med den korte version');
  await page.screenshot({
    path: 'screenshots/flyt-kort-version.png',
    scale: 'css',
    animations: 'disabled',
    fullPage: true,
    style: IN_FLOW,
  });

  // »Dagens pas« has the warm-up and pair 1 and 2, not the tri-set.
  await card.getByTestId('start-session').click();
  const dayPlan = page.getByTestId('day-plan');
  await expect(dayPlan.locator('h1')).toHaveText('Styrke A · kort version');
  await expect(dayPlan).toContainText('Opvarmning');
  await expect(dayPlan).toContainText('Par 1');
  await expect(dayPlan).toContainText('Par 2');
  await expect(dayPlan).not.toContainText('Tri-sæt');
  expect(await storedEventCount(page)).toBe(stored);
});

test('spring over: tirsdagens glemte Styrke A torsdag, torsdagens motor på dagen og fredagens Styrke B dagen efter @date', async ({
  page,
}) => {
  await openAt(page, MONDAY_MORNING);
  await onboard(page);
  const stored = await storedEventCount(page);
  await startSimulation(page, '2026-11-12');

  // Thursday: Tuesday's Styrke A is still offered, as the week has days for it (SPEC 3.1).
  const missed = page.getByTestId('missed-card');
  await expect(missed.locator('.life-card-title')).toHaveText('Styrke A tirsdag blev ikke logget');
  await missed.getByTestId('missed-skip').click();
  await expect(missed).toHaveCount(0);
  await expect(savedLine(page, '✓ Styrke A tirsdag er sprunget over.')).toHaveText(
    '✓ Styrke A tirsdag er sprunget over. Du kan stadig flytte passet under Uge.',
  );

  // Today's motor: skipped from »Flyt eller spring over«, it stands with »Se dagens pas«.
  const card = page.getByTestId('main-card');
  await expect(card.locator('h1')).toHaveText('Motor');
  await card.getByTestId('move-open').click();
  const screen = page.getByTestId('move');
  await expect(screen).toContainText('Motor · torsdag 12. november');
  // The motor only moves to a free day.
  expect(await moveDays(screen.getByRole('group', { name: 'Flyt til' }))).toEqual([
    'Søndag 15. november',
  ]);
  await expect(screen.getByRole('group', { name: 'Kort version på en klubdag' })).toHaveCount(0);
  await screen.getByTestId('move-skip').click();
  await expect(savedLine(page, '✓ Motor er sprunget over i dag.')).toBeVisible();
  await expect(card.locator('h1')).toHaveText('Motor');
  await expect(card).toContainText('Sprunget over i dag.');
  await expect(card.getByRole('button')).toHaveText(['Se dagens pas', 'Flyt']);
  await expectClean(page, 'I dag med et sprunget pas');
  await page.screenshot({
    path: 'screenshots/i-dag-sprunget-over.png',
    scale: 'css',
    animations: 'disabled',
  });

  await tab(page, 'Uge');
  await expect(weekRow(page, 'Tirsdag').locator('.chip.status')).toHaveText('– sprunget over');
  await expect(weekRow(page, 'Torsdag').locator('.chip.status')).toHaveText('– sprunget over');
  // Skipped, Tuesday's A can still be moved, without »Spring over«; it leaves Tuesday empty.
  await weekRow(page, 'Tirsdag').getByTestId('week-session').click();
  await expect(screen.getByRole('heading', { name: 'Flyt passet' })).toBeVisible();
  await expect(screen).toContainText('Styrke A · tirsdag 10. november · sprunget over');
  await expect(screen.getByTestId('move-skip')).toHaveCount(0);
  await screen.getByRole('button', { name: /^Søndag 15\. november/ }).click();
  await expect(weekRow(page, 'Tirsdag').locator('.chip')).toHaveCount(0);
  await expect(weekRow(page, 'Søndag').locator('.chip.status')).toHaveText('flyttet fra tirsdag');

  // Friday: nothing about the motor. Friday's Styrke B goes by without the session.
  await tab(page, 'I dag');
  await nextDay(page, 'fredag 13. november');
  await expect(missed).toHaveCount(0);
  await expect(card.locator('h1')).toHaveText('Styrke B');
  await nextDay(page, 'lørdag 14. november');
  await expect(missed.locator('.life-card-title')).toHaveText('Styrke B i går blev ikke logget');
  await missed.getByTestId('missed-skip').click();
  await expect(missed).toHaveCount(0);
  await expect(savedLine(page, '✓ Styrke B i går er sprunget over.')).toHaveText(
    '✓ Styrke B i går er sprunget over. Du kan stadig flytte passet under Uge.',
  );
  await tab(page, 'Uge');
  // Skipped, Friday's B can still be moved from Uge: to Saturday as the short version.
  await expect(weekRow(page, 'Fredag').locator('.chip.status')).toHaveText('– sprunget over');
  await expect(weekRow(page, 'Fredag').getByTestId('week-session')).toHaveText(/^Styrke B/);

  expect(await storedEventCount(page)).toBe(stored);
  await page.getByTestId('sim-exit').click();
  expect(await storedEventCount(page)).toBe(stored);
});

test('Uge torsdag: tirsdagens glemte Styrke A står som »– ikke logget« og flyttes til søndag @date', async ({
  page,
}) => {
  await openAt(page, MONDAY_MORNING);
  await onboard(page);
  const stored = await storedEventCount(page);
  await startSimulation(page, '2026-11-12');
  await tab(page, 'Uge');

  const tuesday = weekRow(page, 'Tirsdag');
  await expect(tuesday.locator('.chip.status')).toHaveText('– ikke logget');
  await expectClean(page, 'Uge med et glemt pas');
  await tuesday.getByTestId('week-session').click();
  const screen = page.getByTestId('move');
  await expect(screen).toContainText('Styrke A · tirsdag 10. november · ikke logget');
  expect(await moveDays(screen.getByRole('group', { name: 'Flyt til' }))).toEqual([
    'I dag, torsdag 12. november | Motoren udgår denne uge – tag en valgfri rolig tur søndag. | B skal efterlade dig frisk.',
    'Søndag 15. november',
  ]);
  expect(await moveDays(screen.getByRole('group', { name: 'Kort version på en klubdag' }))).toEqual(
    ['Kort version lørdag 14. november | B skal efterlade dig frisk.'],
  );
  // »Tilbage« goes back to Uge without writing.
  await screen.getByRole('button', { name: 'Tilbage', exact: true }).click();
  await expect(page.getByTestId('week')).toBeVisible();
  await tuesday.getByTestId('week-session').click();
  await screen.getByRole('button', { name: /^Søndag 15\. november/ }).click();

  await expect(page.getByTestId('week')).toBeVisible();
  await expect(savedLine(page, '✓ Styrke A er flyttet til søndag 15. november.')).toBeVisible();
  const sunday = weekRow(page, 'Søndag');
  await expect(sunday.getByTestId('week-session')).toHaveText(/^Styrke A · \d+ min$/);
  await expect(sunday.locator('.chip.status')).toHaveText('flyttet fra tirsdag');
  await expect(tuesday.locator('.chip')).toHaveCount(0);
  // The motor stays on Thursday.
  await expect(weekRow(page, 'Torsdag').getByTestId('week-session')).toHaveText(/^Motor/);
  await tab(page, 'I dag');
  await expect(page.getByTestId('missed-card')).toHaveCount(0);
  expect(await storedEventCount(page)).toBe(stored);
});

test('Uge torsdag: »– sprunget over« hører til passet – motoren sprunget over og flyttet til søndag, tirsdagens A flyttet til i dag @date', async ({
  page,
}) => {
  await openAt(page, MONDAY_MORNING);
  await onboard(page);
  const stored = await storedEventCount(page);
  await startSimulation(page, '2026-11-12');
  const card = page.getByTestId('main-card');
  const screen = page.getByTestId('move');
  await card.getByTestId('move-open').click();
  await screen.getByTestId('move-skip').click();
  await expect(card).toContainText('Sprunget over i dag.');
  await card.getByTestId('move-open').click();
  await expect(screen.getByRole('heading', { name: 'Flyt passet' })).toBeVisible();
  await screen.getByRole('button', { name: /^Søndag 15\. november/ }).click();
  await expect(savedLine(page, '✓ Motor er flyttet til søndag 15. november.')).toBeVisible();

  await tab(page, 'Uge');
  await expect(weekRow(page, 'Torsdag').locator('.chip')).toHaveCount(0);
  await expect(weekRow(page, 'Søndag').getByTestId('week-session')).toHaveText(/^Motor/);
  await expect(weekRow(page, 'Søndag').locator('.chip.status')).toHaveText('flyttet fra torsdag');
  await weekRow(page, 'Tirsdag').getByTestId('week-session').click();
  await screen.getByRole('button', { name: /^I dag, torsdag 12\. november/ }).click();
  const thursday = weekRow(page, 'Torsdag');
  await expect(thursday.getByTestId('week-session')).toHaveText(/^Styrke A · \d+ min$/);
  await expect(thursday.locator('.chip.status')).toHaveText('flyttet fra tirsdag');
  expect(await storedEventCount(page)).toBe(stored);
});

test('tidsmaskinen: »+1 dag« skriver kun i kopien, og »Afslut« lukker »Flyt eller spring over« på I dag og i Uge uden at skrive i den rigtige log @date', async ({
  page,
}) => {
  await openAt(page, MONDAY_MORNING);
  await onboard(page);
  const stored = await storedEventCount(page);
  await startSimulation(page, '2026-11-10');
  const card = page.getByTestId('main-card');
  const screen = page.getByTestId('move');

  // »+1 dag« with the screen open: the same world, so it stays and writes in the copy.
  await card.getByTestId('move-open').click();
  await expect(screen).toContainText('Styrke A · tirsdag 10. november');
  await nextDay(page, 'onsdag 11. november');
  await expect(screen).toContainText('Styrke A · tirsdag 10. november · ikke logget');
  await screen.getByRole('button', { name: /^Søndag 15\. november/ }).click();
  await expect(savedLine(page, '✓ Styrke A er flyttet til søndag 15. november.')).toBeVisible();
  expect(await storedEventCount(page)).toBe(stored);

  // »Afslut« with the screen open: it closes, and nothing reaches the real log.
  await nextDay(page, 'torsdag 12. november');
  await card.getByTestId('move-open').click();
  await expect(screen).toContainText('Motor · torsdag 12. november');
  await page.getByTestId('sim-exit').click();
  await expect(page.locator('.banner.sim')).toHaveCount(0);
  await expect(screen).toHaveCount(0);
  await expect(page.getByTestId('today')).toBeVisible();
  await expect(savedLine(page, '✓')).toHaveCount(0);
  expect(await storedEventCount(page)).toBe(stored);

  // The same from Uge.
  await startSimulation(page, '2026-11-10');
  await tab(page, 'Uge');
  await weekRow(page, 'Fredag').getByTestId('week-session').click();
  await expect(screen).toContainText('Styrke B · fredag 13. november');
  await page.getByTestId('sim-exit').click();
  await expect(screen).toHaveCount(0);
  await expect(page.getByTestId('week')).toBeVisible();
  expect(await storedEventCount(page)).toBe(stored);
});

// ------------------------------------------------------------------------------------------------
// A double tap that writes writes once (D61), also when the phone is slow to save.

/** A double tap on a button: the second tap 180 ms after the first, on the same spot. */
async function doubleTapOn(page: Page, target: Locator): Promise<void> {
  await target.click({ trial: true });
  const box = await target.boundingBox();
  if (!box) throw new Error('knappen ses ikke');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await page.waitForTimeout(180);
  await page.mouse.click(x, y);
}

/** Every write to IndexedDB takes 400 ms more while `window.slowWrites` is true. */
async function slowWrites(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const own = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
    if (!own?.set || !own.get) return;
    const flags = window as unknown as { slowWrites?: boolean };
    Object.defineProperty(IDBTransaction.prototype, 'oncomplete', {
      configurable: true,
      get(this: IDBTransaction) {
        return own.get?.call(this) as unknown;
      },
      set(this: IDBTransaction, done: unknown) {
        if (!flags.slowWrites || this.mode !== 'readwrite' || typeof done !== 'function') {
          own.set?.call(this, done);
          return;
        }
        own.set?.call(this, function (this: IDBTransaction, event: Event) {
          setTimeout(() => (done as (e: Event) => void).call(this, event), 400);
        });
      },
    });
  });
}

async function slow(page: Page, on: boolean): Promise<void> {
  await page.evaluate((value) => {
    (window as unknown as { slowWrites?: boolean }).slowWrites = value;
  }, on);
}

test('et dobbelttryk på »Flyt eller spring over«, en dag og »Spring over« skriver én hændelse ad gangen @date', async ({
  page,
}) => {
  await slowWrites(page);
  await openAt(page, '2026-11-10T07:00:00Z');
  await onboard(page);
  const card = page.getByTestId('main-card');
  const before = await storedEventCount(page);
  // The second tap lands on the new screen in its first half second: it does nothing.
  await doubleTapOn(page, card.getByTestId('move-open'));
  const screen = page.getByTestId('move');
  await expect(screen).toBeVisible();
  await page.waitForTimeout(600);
  expect(await storedEventCount(page)).toBe(before);

  await slow(page, true);
  await doubleTapOn(page, screen.getByRole('button', { name: /^Søndag 15\. november/ }));
  await expect(savedLine(page, '✓ Styrke A er flyttet til søndag 15. november.')).toBeVisible();
  await slow(page, false);
  await page.waitForTimeout(600);
  expect(await storedEventCount(page)).toBe(before + 1);

  await tab(page, 'Uge');
  const friday = weekRow(page, 'Fredag');
  await friday.getByTestId('week-session').click();
  const skip = screen.getByTestId('move-skip');
  await expect(skip).toBeVisible();
  await page.waitForTimeout(600);
  await slow(page, true);
  await doubleTapOn(page, skip);
  await expect(friday.locator('.chip.status')).toHaveText('– sprunget over');
  await slow(page, false);
  await page.waitForTimeout(600);
  expect(await storedEventCount(page)).toBe(before + 2);
  await expect(screen).toHaveCount(0);
});

test('et dobbelttryk på kortets »Spring over« skriver én hændelse, og det andet tryk rammer intet @date', async ({
  page,
}) => {
  await openAt(page, '2026-11-10T07:00:00Z');
  await onboard(page);
  // The next morning: the day changes while the app is open, and Tuesday's A was not logged.
  await page.clock.fastForward('24:00:00');
  await expect(page.locator('.today-head .date')).toHaveText('Onsdag 11. november');
  const missed = page.getByTestId('missed-card');
  await expect(missed.locator('.life-card-title')).toHaveText('Styrke A i går blev ikke logget');
  const before = await storedEventCount(page);
  await doubleTapOn(page, missed.getByTestId('missed-skip'));
  await expect(missed).toHaveCount(0);
  await page.waitForTimeout(600);
  expect(await storedEventCount(page)).toBe(before + 1);
  await expect(page.getByTestId('move')).toHaveCount(0);
  await expect(page.getByTestId('day-plan')).toHaveCount(0);
});
