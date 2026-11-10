import { expect, test, type Locator, type Page } from '@playwright/test';
import { a11yProblems, APP_RULES } from './a11y.ts';
import { onboard, startSimulation, storedEventCount } from './helpers.ts';

// Status og begivenheder (docs/SPEC.md 3.1, 3.4 og 3.6, ENGINE.md 3.1, 5.1 og 5.7–5.8, DECISIONS.md
// D67): »Syg« i to dage (PLAN M3, tjekliste 5), en begivenhed i morgen (tjekliste 6), rejsepasset,
// kamp-runderne, »Flyt« uden syge- og feriedage (S-MOVE-05), to og tre uger uden pas (tjekliste 3),
// »Afslut« og »Fjern« – i tidsmaskinen, som intet skriver til lageret – og skærmene, der lukker ved
// tidsmaskinens »Afslut« og tilbage-gestussen, og et dobbelttryk, der skriver én gang.

test.describe.configure({ timeout: 300_000 });

/** 08:00 in Copenhagen on Monday 9/11. */
const MONDAY_MORNING = '2026-11-09T07:00:00Z';
/** A whole screen in one picture: the time machine's banner on top, the tabs under the screen. */
const IN_FLOW = '.banner, .tabbar { position: static !important; }';

async function openAt(page: Page, instant: string): Promise<void> {
  await page.clock.install({ time: new Date(instant) });
  await page.goto('/comeback/');
}

/** The phase-in with the defaults, but some ladders `n` steps harder (»Ben: sværere trin«). */
async function onboardHarder(page: Page, harder: Record<string, number>): Promise<void> {
  await expect(page.getByTestId('onboarding')).toBeVisible();
  for (let i = 0; i < 8; i++) {
    const heading = page.locator('.onboarding h1').first();
    await expect(heading).toBeVisible();
    const title = (await heading.textContent()) ?? '';
    if (title === 'Dit trin på hver stige') {
      for (const [ladder, n] of Object.entries(harder)) {
        for (let j = 0; j < n; j++) {
          await page.getByRole('button', { name: `${ladder}: sværere trin`, exact: true }).click();
        }
      }
    }
    const done = page.getByTestId('onboarding-done');
    if (await done.isVisible()) {
      await done.click();
      break;
    }
    await page.getByTestId('onboarding-next').click();
    await expect(heading).not.toHaveText(title);
  }
  await expect(page.getByTestId('today')).toBeVisible();
}

async function expectClean(page: Page, where: string): Promise<void> {
  expect.soft(await a11yProblems(page, '.app', APP_RULES), where).toEqual([]);
}

/** »+1 dag« in the time machine, and the banner shows the new date. */
async function nextDay(page: Page, date: string): Promise<void> {
  await page.getByTestId('sim-next').click();
  await expect(page.locator('.banner.sim')).toContainText(date);
}

async function tab(page: Page, name: 'I dag' | 'Uge' | 'Stiger' | 'Mere'): Promise<void> {
  await page.getByRole('button', { name, exact: true }).click();
}

/** The line I dag or Mere shows after a write (»✓ …«). */
function savedLine(page: Page, text: string): Locator {
  return page.locator('.life-saved[role="status"]', { hasText: text });
}

/** No field keeps the focus (and its highlighted text) in a picture. */
async function blur(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

/** The step names on the day's card (»Pres trin 1«), without the doses. */
function blockNames(page: Page): Promise<string[]> {
  return page
    .getByTestId('main-card')
    .locator('.block-lines li > span:first-child')
    .allTextContents();
}

/** Status: a new status from today (the default) to `to`. */
async function setStatus(page: Page, name: string, to: string, from?: string): Promise<void> {
  const screen = page.getByTestId('status');
  await expect(screen).toBeVisible();
  await screen
    .getByRole('group', { name: 'Ny status' })
    .getByRole('button', { name, exact: true })
    .click();
  if (from) await screen.getByTestId('status-from').fill(from);
  await screen.getByTestId('status-to').fill(to);
  await expect(screen.getByTestId('status-effects')).toBeVisible();
}

test('PLAN M3 tjekliste 5: »Syg« i to dage viser kun Open & Strong, og »Afslut« giver dagen tilbage @date', async ({
  page,
}) => {
  await openAt(page, MONDAY_MORNING);
  await onboard(page);
  const stored = await storedEventCount(page);
  await startSimulation(page, '2026-11-10');
  const card = page.getByTestId('main-card');
  await expect(card).toContainText('Styrke A');

  // »Sæt status« at the bottom of I dag opens Status at its top.
  await page.getByTestId('status-open').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.getByTestId('status-open').click();
  const screen = page.getByTestId('status');
  await expect(screen.getByRole('heading', { name: 'Status' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(screen.getByTestId('status-item')).toHaveCount(0);
  await expect(screen.getByTestId('status-save')).toBeDisabled();
  await expect(screen).toContainText('Vælg en status.');
  await expect(screen.getByTestId('status-from')).toHaveValue('2026-11-10');
  await setStatus(page, 'Syg', '2026-11-11');
  await expect(screen.getByTestId('status-effects').locator('li')).toHaveText([
    'Syg fra i dag til og med onsdag 11. november.',
    'Alle dage er røde: kun Open & Strong og en gåtur.',
    'Ugerne under sygdom er ikke gennemførte.',
    'Kun forkølet over halsen er din egen vurdering.',
  ]);
  await expect(screen).toContainText('I dag, tirsdag 10. november');
  await expect(screen).toContainText('Onsdag 11. november');
  await blur(page);
  await expectClean(page, 'Status med Syg i to dage');
  await page.screenshot({
    path: 'screenshots/status.png',
    scale: 'css',
    animations: 'disabled',
    fullPage: true,
    style: IN_FLOW,
  });

  await screen.getByTestId('status-save').click();
  await expect(screen).toHaveCount(0);
  // I dag comes back at its top, with the »✓« line in sight.
  await expect(savedLine(page, '✓ Syg fra i dag til og med onsdag 11. november.')).toBeInViewport();
  // Only Open & Strong and a walk: no session to start (R-ILL).
  await expect(card.locator('h1')).toHaveText('Syg');
  await expect(card).toContainText('Kun Open & Strong og en gåtur.');
  await expect(card).toContainText('Til og med onsdag 11. november.');
  await expect(card.getByTestId('start-session')).toHaveCount(0);
  await expect(card.getByTestId('status-change')).toHaveText('Ret status');
  await expect(page.getByTestId('os-start')).toBeVisible();
  await expect(page.locator('.tomorrow')).toHaveText('I morgen: Syg: Open & Strong og en gåtur');
  await expectClean(page, 'I dag syg');
  await page.screenshot({
    path: 'screenshots/i-dag-syg.png',
    scale: 'css',
    animations: 'disabled',
  });

  // Wednesday is the second day: still only Open & Strong, no club log, no forgotten Styrke A.
  await nextDay(page, 'onsdag 11. november');
  await expect(card.locator('h1')).toHaveText('Syg');
  await expect(card).toContainText('Kun i dag.');
  await expect(page.getByTestId('missed-card')).toHaveCount(0);
  await expect(page.getByTestId('club-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Uge', exact: true }).click();
  const wednesday = page.locator('.week-day', {
    has: page.locator('.week-day-weekday', { hasText: 'Onsdag' }),
  });
  await expect(wednesday.locator('.chip')).toHaveText(['Syg']);
  await tab(page, 'I dag');

  // Well again on Wednesday: »Afslut« ends it yesterday, and Wednesday is a club day again.
  await card.getByTestId('status-change').click();
  const item = screen.getByTestId('status-item');
  await expect(item).toHaveCount(1);
  await expect(item.locator('.status-item-name')).toHaveText('Syg i dag');
  await expect(item).toContainText('Afslut, så gælder den almindelige plan fra i dag.');
  await item.getByTestId('status-end').click();
  await expect(screen).toHaveCount(0);
  await expect(
    savedLine(page, '✓ Syg er afsluttet. Fra i dag gælder den almindelige plan.'),
  ).toBeVisible();
  await expect(card.locator('h1')).toHaveText('Muay Thai');
  await expect(page.getByTestId('missed-card')).toHaveCount(0);
  await nextDay(page, 'torsdag 12. november');
  await expect(card.locator('h1')).toHaveText('Motor');
  expect(await storedEventCount(page)).toBe(stored);
});

test('PLAN M3 tjekliste 6: en begivenhed i morgen tager power-ben, ben-stigen og Nordic ud af Styrke A, og I dag siger hvorfor @date', async ({
  page,
}) => {
  await openAt(page, MONDAY_MORNING);
  // Bagkæde on trin 4, a Nordic step.
  await onboardHarder(page, { Bagkæde: 3 });
  const stored = await storedEventCount(page);
  await startSimulation(page, '2026-11-10');
  expect(await blockNames(page)).toEqual(
    expect.arrayContaining(['Power ben trin 1', 'Ben trin 1', 'Bagkæde trin 4']),
  );

  await page.getByTestId('event-open').click();
  const screen = page.getByTestId('event');
  await expect(screen.getByRole('heading', { name: 'Begivenhed' })).toBeVisible();
  await expect(screen.getByTestId('event-save')).toBeDisabled();
  await screen.getByTestId('event-label').fill('Kamp');
  await screen.getByTestId('event-date').fill('2026-11-11');
  await expect(screen.getByTestId('event-effects').locator('li')).toHaveText([
    'I dag er dagen før: ingen tunge ben, Nordic eller intervaller.',
    'Styrke A mister Power ben, Ben og Bagkæde.',
    'En begivenhed kan ikke fjernes igen.',
  ]);
  await blur(page);
  await expectClean(page, 'Begivenhed i morgen');
  await page.screenshot({
    path: 'screenshots/begivenhed.png',
    scale: 'css',
    animations: 'disabled',
    fullPage: true,
    style: IN_FLOW,
  });

  await screen.getByTestId('event-save').click();
  await expect(screen).toHaveCount(0);
  await expect(savedLine(page, '✓ Kamp onsdag 11. november er tilføjet.')).toBeVisible();
  await expect(page.getByTestId('event-flag')).toHaveText(
    'I morgen: Kamp – let udgave i dag. Dagen før en begivenhed er der aldrig tunge ben, Nordic eller intervaller: Power ben, Ben og Bagkæde er taget ud af dagens pas.',
  );
  const names = await blockNames(page);
  expect(names).toContain('Pres trin 1');
  for (const gone of ['Power ben', 'Ben trin', 'Bagkæde']) {
    expect(names.some((n) => n.startsWith(gone))).toBe(false);
  }
  await expectClean(page, 'I dag før en begivenhed');

  // Under Mere: the event is listed, and a second one the same day cannot be added.
  await tab(page, 'Mere');
  await page.getByTestId('more-event').click();
  await expect(screen.getByTestId('event-list')).toContainText('Kamp · onsdag 11. november');
  await expect(screen.getByTestId('event-list')).toContainText('I dag er let.');
  await screen.getByTestId('event-label').fill('Graduering');
  await screen.getByTestId('event-date').fill('2026-11-11');
  await expect(screen.getByRole('alert')).toHaveText(
    'Der er allerede en begivenhed den dag: Kamp.',
  );
  await expect(screen.getByTestId('event-save')).toBeDisabled();
  await screen.getByRole('button', { name: 'Tilbage' }).click();
  await expect(page.getByTestId('more')).toBeVisible();
  expect(await storedEventCount(page)).toBe(stored);
});

test('PLAN M3 tjekliste 6: en begivenhed fredag i uge 5 gør torsdagens intervaller til en rolig base @date', async ({
  page,
}) => {
  // The phase-in on Monday 7/12: the four weeks before are done, so this is programme week 5.
  await openAt(page, '2026-12-07T07:00:00Z');
  await onboard(page);
  const stored = await storedEventCount(page);
  await startSimulation(page, '2026-12-10');
  const card = page.getByTestId('main-card');
  await expect(card.locator('h1')).toHaveText('Motor');
  await expect(card.locator('.block-line')).toContainText('30/15');

  await page.getByTestId('event-open').click();
  const screen = page.getByTestId('event');
  await screen.getByTestId('event-label').fill('Kamp');
  await screen.getByTestId('event-date').fill('2026-12-11');
  await expect(screen.getByTestId('event-effects').locator('li')).toHaveText([
    'I dag er dagen før: ingen tunge ben, Nordic eller intervaller.',
    'Motoren bliver en rolig base i stedet for intervaller.',
    'En begivenhed kan ikke fjernes igen.',
  ]);
  await screen.getByTestId('event-save').click();
  await expect(page.getByTestId('event-flag')).toHaveText(
    'I morgen: Kamp – let udgave i dag. Dagen før en begivenhed er der aldrig tunge ben, Nordic eller intervaller: Motoren er en rolig base i stedet for intervaller.',
  );
  await expect(card.locator('.block-line')).toHaveText('Rolig base, 30 min');
  expect(await storedEventCount(page)).toBe(stored);
});

test('rejse viser rejsepasset på Styrke-dagene, og klubben lukket viser kamp-runder på Muay Thai-dagene @date', async ({
  page,
}) => {
  await openAt(page, MONDAY_MORNING);
  await onboard(page);
  const stored = await storedEventCount(page);
  await startSimulation(page, '2026-11-10');
  const card = page.getByTestId('main-card');

  await page.getByTestId('status-open').click();
  await setStatus(page, 'Rejse', '2026-11-13');
  await expect(page.getByTestId('status-effects').locator('li')).toHaveText([
    'Rejse fra i dag til og med fredag 13. november.',
    'Styrke-dagene får rejsepasset: 25 min med push-ups, rygsæk-row, split squats og 6 min EMOM.',
    'Rejsepasset gennemfører ugen, men flytter ingen stiger.',
  ]);
  await page.getByTestId('status-save').click();
  await expect(savedLine(page, '✓ Rejse fra i dag til og med fredag 13. november.')).toBeVisible();
  const status = page.getByTestId('status-card');
  await expect(status.locator('.life-card-title')).toHaveText(
    'Rejse til og med fredag 13. november',
  );
  await expect(status).toContainText('Rejsepasset på Styrke-dagene.');
  await expect(card.locator('h1')).toHaveText('Rejsepas');
  await expect(card.locator('.main-card-time')).toHaveText('ca. 25 min');
  const names = await blockNames(page);
  expect(names[0]).toBe('Opvarmning');
  expect(names.slice(1, 4).map((n) => n.replace(/ trin .*$/, ''))).toEqual([
    'Pres',
    'Rygsæk-row',
    'Ben',
  ]);
  await expect(card.locator('.block-lines li').last()).toContainText('Burpees EMOM E1');
  await expect(card.locator('.block-lines li').last()).toContainText('6 ×');
  await expectClean(page, 'I dag på rejse');
  await page.screenshot({
    path: 'screenshots/i-dag-rejse.png',
    scale: 'css',
    animations: 'disabled',
  });

  // Wednesday: the club closes until Saturday. It applies to the club days next to the trip, which
  // keeps its travel session on Friday (ENGINE 5.1 step 3).
  await nextDay(page, 'onsdag 11. november');
  await page.getByTestId('status-open').click();
  await setStatus(page, 'Klubben lukket', '2026-11-14');
  await expect(page.getByTestId('status-effects').locator('li')).toHaveText([
    'Klubben lukket fra i dag til og med lørdag 14. november.',
    'Muay Thai-dagene bliver 4–5 kamp-runder hjemme.',
  ]);
  await page.getByTestId('status-save').click();
  await expect(card.locator('h1')).toHaveText('Klubben er lukket');
  await expect(card).toContainText('4–5 kamp-runder hjemme i stedet for Muay Thai.');
  await expect(status.locator('.life-card-title')).toHaveText(
    'Rejse til og med fredag 13. november',
  );
  await expectClean(page, 'I dag med klubben lukket på en rejse');
  await page.screenshot({
    path: 'screenshots/i-dag-klubben-lukket.png',
    scale: 'css',
    animations: 'disabled',
  });
  await page.locator('.rest-of-week summary').click();
  await expect(page.locator('.rest-of-week li')).toHaveText([
    'Fredag: Rejsepas',
    'Lørdag: 4–5 kamp-runder hjemme',
    'Søndag: Fri gåtur · Open & Strong valgfri',
  ]);
  await expect(page.locator('.tomorrow')).toHaveText('I morgen: Motor');

  // Mere → Status lists both, each with »Afslut«.
  await tab(page, 'Mere');
  await page.getByTestId('more-status').click();
  const items = page.getByTestId('status-item');
  await expect(items.locator('.status-item-name')).toHaveText([
    'Rejse til og med fredag 13. november',
    'Klubben lukket til og med lørdag 14. november',
  ]);
  await expect(items.getByTestId('status-end')).toHaveText(['Afslut', 'Afslut']);
  await expectClean(page, 'Status med to statusser');
  await page.screenshot({
    path: 'screenshots/status-liste.png',
    scale: 'css',
    animations: 'disabled',
    fullPage: true,
    style: IN_FLOW,
  });
  await page.getByTestId('status').getByRole('button', { name: 'Tilbage' }).click();

  // Uge: the travel session on Friday, the fight rounds on Saturday.
  await tab(page, 'Uge');
  const row = (weekday: string) =>
    page.locator('.week-day', { has: page.locator('.week-day-weekday', { hasText: weekday }) });
  await expect(row('Fredag').getByTestId('week-session')).toContainText('Rejsepas');
  await expect(row('Lørdag').locator('.chip.club')).toHaveText('Kamp-runder hjemme');
  await expect(row('Torsdag').locator('.chip', { hasText: 'Rejse' })).toHaveText('Rejse');
  expect(await storedEventCount(page)).toBe(stored);
});

test('S-MOVE-05: »Flyt« tilbyder ingen syge- eller feriedage, men en rejsedag tager Styrke A som rejsepas, og »Fjern« fjerner en status, der ikke er begyndt @date', async ({
  page,
}) => {
  await openAt(page, MONDAY_MORNING);
  await onboard(page);
  const stored = await storedEventCount(page);
  // Wednesday 11/11: Tuesday's Styrke A was not logged.
  await startSimulation(page, '2026-11-11');
  const missed = page.getByTestId('missed-card');
  await expect(missed.locator('.life-card-title')).toHaveText('Styrke A i går blev ikke logget');

  // Sick on Thursday, on holiday Saturday and Sunday.
  await page.getByTestId('status-open').click();
  await setStatus(page, 'Syg', '2026-11-12', '2026-11-12');
  await page.getByTestId('status-save').click();
  await expect(savedLine(page, '✓ Syg torsdag 12. november.')).toBeVisible();
  await page.getByTestId('status-open').click();
  await setStatus(page, 'Ferie', '2026-11-15', '2026-11-14');
  await expect(page.getByTestId('status-effects').locator('li')).toHaveText([
    'Ferie fra lørdag 14. november til og med søndag 15. november.',
    'Hvile: ingen pas, og Open & Strong er valgfri.',
    'Ugerne er ikke gennemførte. Vil du træne i ferien, så sæt ikke ferie.',
  ]);
  await page.getByTestId('status-save').click();
  await page.locator('.rest-of-week summary').click();
  await expect(page.locator('.rest-of-week li')).toHaveText([
    'Fredag: Styrke B',
    'Lørdag: Ferie: hvile',
    'Søndag: Ferie: hvile',
  ]);
  await expect(page.locator('.tomorrow')).toHaveText('I morgen: Syg: Open & Strong og en gåtur');

  // Only Wednesday as the short version (S-MOVE-05).
  await missed.getByRole('button', { name: 'Flyt', exact: true }).click();
  const move = page.getByTestId('move');
  await expect(move.getByRole('group', { name: 'Flyt til' })).toHaveCount(0);
  await expect(move.getByTestId('move-day')).toHaveText(['Kort version i dag']);
  await move.getByRole('button', { name: 'Tilbage' }).click();

  // Thursday becomes a travel day instead: the sick day goes (»Fjern«), and A can move there.
  await page.getByTestId('status-open').click();
  const screen = page.getByTestId('status');
  const items = screen.getByTestId('status-item');
  await expect(items.locator('.status-item-name')).toHaveText([
    'Syg torsdag 12. november',
    'Ferie fra lørdag 14. november til og med søndag 15. november',
  ]);
  await expect(items.first()).toContainText('Fjern, så gælder statussen ikke.');
  await items.first().getByTestId('status-end').click();
  await expect(savedLine(page, '✓ Syg torsdag 12. november er fjernet.')).toBeVisible();
  await page.getByTestId('status-open').click();
  await setStatus(page, 'Rejse', '2026-11-12', '2026-11-12');
  await page.getByTestId('status-save').click();
  await missed.getByRole('button', { name: 'Flyt', exact: true }).click();
  await expect(move.getByRole('group', { name: 'Flyt til' }).getByTestId('move-day')).toHaveText([
    /^Torsdag 12\. november/,
  ]);
  await move.getByRole('button', { name: /^Torsdag 12\. november/ }).click();
  await nextDay(page, 'torsdag 12. november');
  const card = page.getByTestId('main-card');
  await expect(card.locator('h1')).toHaveText('Rejsepas');
  await expect(card).toContainText('Flyttet fra tirsdag.');
  expect(await storedEventCount(page)).toBe(stored);
});

test('PLAN M3 tjekliste 3: to uger uden pas gentager den sidste gennemførte uge, og tre uger rykker stigerne ned med forklaring @date', async ({
  page,
}) => {
  // The phase-in on Monday 23/11 with the two weeks before done (programme week 3) and Ben on
  // trin 3.
  await openAt(page, '2026-11-23T07:00:00Z');
  await onboardHarder(page, { Ben: 2 });
  const stored = await storedEventCount(page);
  await expect(page.locator('.today-head .week')).toHaveText('Uge 3 · Fundament');
  await expect(page.getByTestId('week-repeat')).toHaveCount(0);

  // Two weeks without a session: the last completed week, week 2, comes again (R-PW).
  await startSimulation(page, '2026-12-07');
  await expect(page.locator('.today-head .week')).toHaveText('Uge 2 · Fundament');
  await expect(page.getByTestId('week-repeat')).toHaveText(
    'Sidste uge blev ikke gennemført: du gentager uge 2.',
  );
  await expect(page.getByTestId('absence-card')).toHaveCount(0);

  // Three weeks: every ladder one step down, with the engine's explanation (R-ABSENCE-3).
  await startSimulation(page, '2026-12-14');
  await expect(page.locator('.today-head .week')).toHaveText('Uge 2 · Fundament');
  const absence = page.getByTestId('absence-card');
  await expect(absence.locator('.life-card-title')).toHaveText(
    'Tre uger uden styrkepas: alle stiger ét trin ned.',
  );
  await expect(absence.locator('li')).toHaveText([
    'Ben: trin 2.',
    'Stiger på første trin bliver der og starter forfra.',
  ]);
  await expectClean(page, 'I dag efter tre uger uden pas');
  await page.screenshot({
    path: 'screenshots/i-dag-tre-uger.png',
    scale: 'css',
    animations: 'disabled',
  });
  await nextDay(page, 'tirsdag 15. december');
  expect(await blockNames(page)).toContain('Ben trin 2');
  await expect(absence).toBeVisible();
  await tab(page, 'Stiger');
  await expect(page.locator('.ladder-row', { hasText: 'Ben · trin 2' })).toBeVisible();
  expect(await storedEventCount(page)).toBe(stored);
});

test('tidsmaskinens »Afslut« lukker Status og Begivenhed på I dag og under Mere uden at skrive i den rigtige log, og tilbage-gestussen lukker dem @date', async ({
  page,
}) => {
  await openAt(page, MONDAY_MORNING);
  await onboard(page);
  const stored = await storedEventCount(page);
  const entries = await page.evaluate(() => history.length);

  // Status opened on I dag in the time machine, left open at »Afslut«.
  await startSimulation(page, '2026-11-10');
  await page.getByTestId('status-open').click();
  await setStatus(page, 'Syg', '2026-11-11');
  await page.getByTestId('sim-exit').click();
  await expect(page.locator('.banner.sim')).toHaveCount(0);
  await expect(page.getByTestId('status')).toHaveCount(0);
  await expect(page.getByTestId('today')).toBeVisible();
  expect(await storedEventCount(page)).toBe(stored);

  // Begivenhed opened under Mere in the time machine, left open at »Afslut«.
  await startSimulation(page, '2026-11-10');
  await tab(page, 'Mere');
  await page.getByTestId('more-event').click();
  const event = page.getByTestId('event');
  await event.getByTestId('event-label').fill('Kamp');
  await event.getByTestId('event-date').fill('2026-11-12');
  await page.getByTestId('sim-exit').click();
  await expect(event).toHaveCount(0);
  await expect(page.getByTestId('more')).toBeVisible();
  expect(await storedEventCount(page)).toBe(stored);

  // The back gesture closes the screens, not the app – on I dag and under Mere.
  await page.getByTestId('more-status').click();
  await expect(page.getByTestId('status')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('status')).toHaveCount(0);
  await expect(page.getByTestId('more')).toBeVisible();
  await tab(page, 'I dag');
  await page.getByTestId('event-open').click();
  await expect(event).toBeVisible();
  await page.goBack();
  await expect(event).toHaveCount(0);
  await expect(page.getByTestId('today')).toBeVisible();
  // »Tilbage« goes back over the screen's step: the history does not grow.
  await page.getByTestId('status-open').click();
  await page.getByTestId('status').getByRole('button', { name: 'Tilbage' }).click();
  await expect(page.getByTestId('status')).toHaveCount(0);
  expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(entries + 1);

  // In the real log the event is written once.
  await page.getByTestId('event-open').click();
  await event.getByTestId('event-label').fill('Kamp');
  await event.getByTestId('event-date').fill('2026-11-14');
  await event.getByTestId('event-save').click();
  await expect(savedLine(page, '✓ Kamp lørdag 14. november er tilføjet.')).toBeVisible();
  await expect.poll(() => storedEventCount(page)).toBe(stored + 1);
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

test('et dobbelttryk på »Gem status«, »Afslut« og »Tilføj begivenhed« skriver én hændelse ad gangen @date', async ({
  page,
}) => {
  await slowWrites(page);
  await openAt(page, '2026-11-10T07:00:00Z');
  await onboard(page);
  const before = await storedEventCount(page);

  await page.getByTestId('status-open').click();
  await setStatus(page, 'Syg', '2026-11-11');
  await slow(page, true);
  await doubleTapOn(page, page.getByTestId('status-save'));
  await expect(savedLine(page, '✓ Syg fra i dag til og med onsdag 11. november.')).toBeVisible();
  await slow(page, false);
  await page.waitForTimeout(600);
  expect(await storedEventCount(page)).toBe(before + 1);

  const card = page.getByTestId('main-card');
  await card.getByTestId('status-change').click();
  const end = page.getByTestId('status-end');
  await expect(end).toBeVisible();
  await page.waitForTimeout(600);
  await slow(page, true);
  await doubleTapOn(page, end);
  await expect(savedLine(page, '✓ Syg er afsluttet.')).toBeVisible();
  await slow(page, false);
  await page.waitForTimeout(600);
  expect(await storedEventCount(page)).toBe(before + 2);
  await expect(card.locator('h1')).toHaveText('Styrke A');

  await page.getByTestId('event-open').click();
  const event = page.getByTestId('event');
  await event.getByTestId('event-label').fill('Kamp');
  await event.getByTestId('event-date').fill('2026-11-21');
  await slow(page, true);
  await doubleTapOn(page, event.getByTestId('event-save'));
  await expect(savedLine(page, '✓ Kamp lørdag 21. november er tilføjet.')).toBeVisible();
  await slow(page, false);
  await page.waitForTimeout(600);
  expect(await storedEventCount(page)).toBe(before + 3);
  await expect(event).toHaveCount(0);
});
