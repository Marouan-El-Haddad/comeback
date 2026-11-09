import { expect, test, type Locator, type Page } from '@playwright/test';
import { a11yProblems, APP_RULES } from './a11y.ts';
import { onboard, startSession, startSimulation, storedEventCount } from './helpers.ts';

// Klubloggen og søndagstjekket (docs/SPEC.md 3.1, 4.6 og 4.7, DECISIONS.md D63): onsdag 11/11 og
// lørdag 14/11 efter klubtiden, »Jeg var der ikke« dagen efter, »Hård« før motoren i uge 5,
// søndagstjekket søndag 15/11 og mandag 16/11 og dets virkning på tirsdagens trafiklys og trin –
// i tidsmaskinen, som intet skriver til lageret – og et dobbelttryk, der gemmer én gang.

test.describe.configure({ timeout: 300_000 });

/** 20:45 in Copenhagen on Monday 9/11, after Monday's club time (18–19.30). */
const MONDAY_EVENING = '2026-11-09T19:45:00Z';
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

function pressed(scope: Locator, name: string): Promise<void> {
  return expect(scope.getByRole('button', { name, exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
}

/** »+1 dag« in the time machine, and the banner shows the new date. */
async function nextDay(page: Page, date: string): Promise<void> {
  await page.getByTestId('sim-next').click();
  await expect(page.locator('.banner.sim')).toContainText(date);
}

/** I dag → »Dagens pas« → »Start passet«: the traffic light's question 2 and its hints. */
async function trafficLight(page: Page): Promise<Locator> {
  await startSession(page);
  await expect(page.getByRole('heading', { name: 'Før du starter – 10 sekunder' })).toBeVisible();
  return page.locator('.yesno', { hasText: 'Fri for ledsmerter, kun let øm?' });
}

test('klubloggen onsdag 11/11: efter klubtiden spørger kortet, valgene gemmes, og torsdagens trafiklys viser hinten @date', async ({
  page,
}) => {
  await openAt(page, MONDAY_EVENING);
  await onboard(page);
  const stored = await storedEventCount(page);
  await startSimulation(page, '2026-11-11');

  const card = page.getByTestId('main-card');
  await expect(card).toContainText('Muay Thai');
  await expect(card).toContainText('Træning 18–19.30');
  await expectClean(page, 'I dag onsdag efter klubtiden');
  await page.screenshot({
    path: 'screenshots/i-dag-klublog.png',
    scale: 'css',
    animations: 'disabled',
  });
  await card.getByRole('button', { name: 'Hvordan var det?' }).click();

  const form = page.getByTestId('club-log');
  await expect(form).toBeVisible();
  await expect(form).toContainText('Muay Thai · onsdag 11. november · 18–19.30');
  await expect(form.getByRole('heading', { name: 'Hvordan var det?' })).toBeVisible();
  // Saturday only: the technique in the last round.
  await expect(form.getByText('Teknikken i sidste runde')).toHaveCount(0);
  // Tapped out of order: the log keeps the chips' order (Teknik before Sparring).
  for (const name of ['Sparring', 'Teknik', 'Hård', 'Flad']) {
    await form.getByRole('button', { name, exact: true }).click();
  }
  await pressed(form, 'Teknik');
  await pressed(form, 'Sparring');
  // One hardness: »Let« takes the place of »Hård«, and a tap more removes the choice.
  await form.getByRole('button', { name: 'Let', exact: true }).click();
  await pressed(form, 'Let');
  await expect(form.getByRole('button', { name: 'Hård', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await form.getByRole('button', { name: 'Let', exact: true }).click();
  await expect(form.getByRole('button', { name: 'Let', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await form.getByRole('button', { name: 'Hård', exact: true }).click();
  await pressed(form, 'Hård');
  await pressed(form, 'Flad');
  await expectClean(page, 'Klubloggen onsdag');
  await page.screenshot({
    path: 'screenshots/klublog.png',
    scale: 'css',
    animations: 'disabled',
    fullPage: true,
    style: IN_FLOW,
  });
  await form.getByTestId('club-save').click();

  await expect(form).toHaveCount(0);
  await expect(page.locator('.main-card.done')).toContainText(
    '✓ Logget: Hård · Flad · Teknik, Sparring',
  );
  await expect(card.getByRole('button', { name: 'Hvordan var det?' })).toHaveCount(0);

  // Thursday: nothing more to ask, and the motor's traffic light says the club was hard.
  await nextDay(page, 'torsdag 12. november');
  await expect(page.getByTestId('club-card')).toHaveCount(0);
  await expect(card).toContainText('Motor');
  await trafficLight(page);
  await expect(page.getByText('I går var klubtræningen hård.')).toBeVisible();
  await page.getByRole('button', { name: 'Afslut passet' }).click();

  expect(await storedEventCount(page)).toBe(stored);
  await page.getByTestId('sim-exit').click();
  await expect(page.locator('.banner.sim')).toHaveCount(0);
  expect(await storedEventCount(page)).toBe(stored);
});

test('klubloggen lørdag 14/11 med lørdagskarakteren, som søndagstjekket viser @date', async ({
  page,
}) => {
  await openAt(page, MONDAY_EVENING);
  await onboard(page);
  const stored = await storedEventCount(page);
  await startSimulation(page, '2026-11-14');

  const card = page.getByTestId('main-card');
  await expect(card).toContainText('Træning 10–11');
  await card.getByRole('button', { name: 'Hvordan var det?' }).click();
  const form = page.getByTestId('club-log');
  await expect(form).toContainText('Muay Thai · lørdag 14. november · 10–11');
  const grade = form.getByRole('group', { name: 'Teknikken i sidste runde' });
  await expect(grade.getByRole('button')).toHaveCount(10);
  await grade.getByRole('button', { name: '7', exact: true }).click();
  for (const name of ['Teknik', 'Middel', 'OK']) {
    await form.getByRole('button', { name, exact: true }).click();
  }
  await pressed(grade, '7');
  await expectClean(page, 'Klubloggen lørdag');
  await page.screenshot({
    path: 'screenshots/klublog-loerdag.png',
    scale: 'css',
    animations: 'disabled',
    fullPage: true,
    style: IN_FLOW,
  });
  await form.getByTestId('club-save').click();
  await expect(page.locator('.main-card.done')).toContainText(
    '✓ Logget: Middel · OK · Teknik · karakter 7',
  );

  // Sunday: the check has Saturday's grade from the club log, and no buttons to give it again.
  await nextDay(page, 'søndag 15. november');
  await expect(page.getByTestId('club-card')).toHaveCount(0);
  await card.getByRole('button', { name: 'Tag søndagstjekket' }).click();
  const check = page.getByTestId('sunday-check');
  await expect(check).toBeVisible();
  await expect(check.getByTestId('saturday-grade')).toHaveText(/7\s*· allerede givet/);
  await expect(check.getByRole('group', { name: /Lørdagskarakter/ })).toHaveCount(0);
  await check.getByRole('button', { name: 'Tilbage', exact: true }).click();
  await expect(card).toContainText('Søndagstjek');

  expect(await storedEventCount(page)).toBe(stored);
});

test('»Jeg var der ikke« dagen efter: kortet spørger først efter klubtiden, og fraværet logges @date', async ({
  page,
}) => {
  await openAt(page, MONDAY_MORNING);
  await onboard(page);
  const stored = await storedEventCount(page);
  await startSimulation(page, '2026-11-11');

  // Wednesday morning: the club time (18–19.30) has not ended.
  const card = page.getByTestId('main-card');
  await expect(card).toContainText('Træning 18–19.30');
  await expect(card.getByRole('button', { name: 'Hvordan var det?' })).toHaveCount(0);
  // 19:45: the card asks without a tap or a reload.
  await page.clock.fastForward('11:45:00');
  await expect(card.getByRole('button', { name: 'Hvordan var det?' })).toBeVisible();

  // Not answered on Wednesday: Thursday asks about yesterday above the day's card.
  await nextDay(page, 'torsdag 12. november');
  const yesterday = page.getByTestId('club-card');
  await expect(yesterday).toContainText('Muay Thai i går');
  await expectClean(page, 'I dag med gårsdagens klubtræning');
  await yesterday.getByRole('button', { name: 'Hvordan var det?' }).click();
  const form = page.getByTestId('club-log');
  await expect(form).toContainText('Muay Thai · onsdag 11. november');
  await form.getByTestId('club-absent').click();

  await expect(form).toHaveCount(0);
  await expect(yesterday).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({ hasText: 'Klubtræningen i går er logget' }),
  ).toBeVisible();
  // Absent: no hint on Thursday's traffic light.
  await trafficLight(page);
  await expect(page.getByText('I går var klubtræningen hård.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Afslut passet' }).click();

  // Friday: Wednesday is no longer asked about.
  await nextDay(page, 'fredag 13. november');
  await expect(page.getByTestId('club-card')).toHaveCount(0);
  expect(await storedEventCount(page)).toBe(stored);
});

test('søndagstjekket søndag 15/11: søvn, lørdagskarakter, smerte og for tungt; tirsdag står spørgsmål 2 på nej, og trinnene er nede @date', async ({
  page,
}) => {
  await openAt(page, MONDAY_EVENING);
  await onboardHarder(page, { Ben: 2 });
  const stored = await storedEventCount(page);
  await startSimulation(page, '2026-11-15');

  const card = page.getByTestId('main-card');
  await expect(card).toContainText('Søndagstjek');
  await expect(card).toContainText('2 min');
  await card.getByRole('button', { name: 'Tag søndagstjekket' }).click();

  const check = page.getByTestId('sunday-check');
  await expect(check).toBeVisible();
  await expect(check).toContainText('Uge 1 · søndag 15. november');
  await check.getByLabel('Timer søvn i snit').fill('7,5');
  // Saturday was not logged: the grade is given here.
  const grade = check.getByRole('group', { name: /Lørdagskarakter/ });
  await grade.getByRole('button', { name: '6', exact: true }).click();
  // Pain: »Ja« without an exercise cannot be saved.
  const pain = check.getByRole('group', { name: 'Gør noget ondt, der ikke gik væk?' });
  await pressed(pain, 'Nej');
  await pain.getByRole('button', { name: 'Ja', exact: true }).click();
  await expect(check.getByText('Vælg øvelsen, der gør ondt.')).toBeVisible();
  await expect(check.getByTestId('sunday-save')).toBeDisabled();
  await check.getByRole('button', { name: 'Lyske', exact: true }).click();
  await expect(check.getByTestId('sunday-save')).toBeEnabled();
  // Nothing is ready for the next step in week 1; »For tungt?« offers the ladder above step 1.
  await expect(check.getByTestId('ready')).toContainText('Ingen endnu');
  const heavy = check.getByRole('group', { name: 'For tungt?' });
  await expect(heavy.getByRole('button')).toHaveCount(1);
  await heavy.getByRole('button', { name: 'Ben · trin 3', exact: true }).click();
  // What saving does, read from the engine's own events (D65).
  await expect(check.getByTestId('pain-effects')).toContainText(
    'Lyske får en lettere variant til 22. november.',
  );
  await expect(check.getByTestId('heavy-effects')).toHaveText(
    'Ben går fra trin 3 til trin 2 – dit eget valg.',
  );
  // Week 1 is an even week from the start: »Film dig selv« in the week to come.
  await expect(check).toContainText('Film dig selv fra siden i et sæt i næste uge.');
  await expectClean(page, 'Søndagstjekket');
  await page.screenshot({
    path: 'screenshots/soendagstjek.png',
    scale: 'css',
    animations: 'disabled',
    fullPage: true,
    style: IN_FLOW,
  });
  await check.getByTestId('sunday-save').click();

  await expect(check).toHaveCount(0);
  const done = page.locator('.main-card.done');
  await expect(done).toContainText('✓ Gemt');
  await expect(done).toContainText('Søvn: 7,5 t i snit');
  await expect(done).toContainText('Lørdagskarakter: 6');
  await expect(done).toContainText('Ondt: Lyske – lettere variant til 22. november (smerte)');
  await expect(done).toContainText('For tungt: Ben – nu trin 2');
  await expectClean(page, 'I dag med søndagstjekket gemt');
  await page.screenshot({
    path: 'screenshots/i-dag-soendagstjek.png',
    scale: 'css',
    animations: 'disabled',
  });

  // Monday: the saved check stands under the day's card, to be corrected.
  await nextDay(page, 'mandag 16. november');
  const sunday = page.getByTestId('sunday-card');
  await expect(sunday).toContainText('✓ Gemt');
  await expect(sunday.getByRole('button', { name: 'Ret søndagstjekket' })).toBeVisible();

  // Tuesday: Lyske has the lighter variant, Ben is one step down, and question 2 is »nej«.
  await nextDay(page, 'tirsdag 17. november');
  await expect(page.getByTestId('sunday-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Stiger', exact: true }).click();
  await expect(page.locator('.ladder-row', { hasText: 'Lyske' })).toContainText(
    'Lettere variant til 22. november (smerte)',
  );
  await expect(page.locator('.ladder-row', { hasText: 'Ben · trin 2' })).toBeVisible();
  await page.getByRole('button', { name: 'I dag', exact: true }).click();
  const q2 = await trafficLight(page);
  await pressed(q2, 'Nej');
  await expect(page.getByText('Søndagstjekket noterede smerte, der ikke gik væk.')).toBeVisible();
  await page.getByRole('button', { name: 'Afslut passet' }).click();

  expect(await storedEventCount(page)).toBe(stored);
  await page.getByTestId('sim-exit').click();
  expect(await storedEventCount(page)).toBe(stored);
});

test('søndagstjekket mandag 16/11, når det blev glemt, og »Ret søndagstjekket« afløser det gamle @date', async ({
  page,
}) => {
  await openAt(page, MONDAY_EVENING);
  await onboard(page);
  const stored = await storedEventCount(page);
  await startSimulation(page, '2026-11-16');

  // Monday is a club day: the forgotten check stands above the day's card.
  const sunday = page.getByTestId('sunday-card');
  await expect(sunday).toContainText('Glemt i går? Du kan tage det i dag.');
  await expect(page.getByTestId('main-card')).toContainText('Muay Thai');
  await expectClean(page, 'I dag mandag med et glemt søndagstjek');
  await page.screenshot({
    path: 'screenshots/i-dag-mandag-soendagstjek.png',
    scale: 'css',
    animations: 'disabled',
  });
  await sunday.getByRole('button', { name: 'Tag søndagstjekket' }).click();
  const check = page.getByTestId('sunday-check');
  await expect(check).toContainText('søndag 15. november');
  await check.getByTestId('sunday-save').click();
  await expect(sunday).toContainText('✓ Gemt');
  await expect(sunday).toContainText('Intet gør ondt, og intet er for tungt.');

  // Corrected: the form opens with the answers, and the new check replaces the old one.
  await sunday.getByRole('button', { name: 'Ret søndagstjekket' }).click();
  const pain = check.getByRole('group', { name: 'Gør noget ondt, der ikke gik væk?' });
  await pressed(pain, 'Nej');
  await pain.getByRole('button', { name: 'Ja', exact: true }).click();
  await check.getByRole('button', { name: 'Pres', exact: true }).click();
  await check.getByTestId('sunday-save').click();
  await expect(sunday).toContainText('Ondt: Pres – lettere variant til 22. november (smerte)');

  await nextDay(page, 'tirsdag 17. november');
  const q2 = await trafficLight(page);
  await pressed(q2, 'Nej');
  await expect(page.getByText('Søndagstjekket noterede smerte, der ikke gik væk.')).toBeVisible();
  await page.getByRole('button', { name: 'Afslut passet' }).click();
  expect(await storedEventCount(page)).toBe(stored);
});

test('klubloggen »Hård« onsdag i uge 5 gør torsdagens motor til rolig base med valget »Kør intervallerne alligevel« @date', async ({
  page,
}) => {
  // Monday 7/12 at 20:45: the phase-in counts the four weeks since the start as completed, so the
  // week is programme week 5, whose motor runs 30/15 intervals (docs/PLAN.md M3, checklist 8).
  await openAt(page, '2026-12-07T19:45:00Z');
  await onboard(page);
  await expect(page.locator('.today-head .week')).toHaveText('Uge 5 · Opbygning');
  const stored = await storedEventCount(page);
  await startSimulation(page, '2026-12-09');

  const card = page.getByTestId('main-card');
  await card.getByRole('button', { name: 'Hvordan var det?' }).click();
  const form = page.getByTestId('club-log');
  await form.getByRole('button', { name: 'Hård', exact: true }).click();
  await form.getByTestId('club-save').click();
  await expect(page.locator('.main-card.done')).toContainText('✓ Logget: Hård');

  await nextDay(page, 'torsdag 10. december');
  await expect(card).toContainText('Motor');
  await expect(card).toContainText('I går var klubtræningen hård: rolig base i dag.');
  await trafficLight(page);
  await expect(page.getByText('I går var klubtræningen hård.')).toBeVisible();
  // The calm base is the standard; »Kør intervallerne alligevel« runs the week's 30/15.
  const anyway = page.getByLabel('Kør intervallerne alligevel');
  await expect(anyway).not.toBeChecked();
  await anyway.check();
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
  await expect(page.getByTestId('next-strip').locator('.next-name')).toHaveText('Let opvarmning');
  expect(await storedEventCount(page)).toBe(stored);
});

test('uden flueben kører motoren efter en hård klubdag den rolige base @date', async ({ page }) => {
  await openAt(page, '2026-12-07T19:45:00Z');
  await onboard(page);
  await startSimulation(page, '2026-12-09');
  const card = page.getByTestId('main-card');
  await card.getByRole('button', { name: 'Hvordan var det?' }).click();
  await page.getByTestId('club-log').getByRole('button', { name: 'Hård', exact: true }).click();
  await page.getByTestId('club-save').click();
  await nextDay(page, 'torsdag 10. december');
  await trafficLight(page);
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
  await expect(page.getByTestId('next-strip').locator('.next-name')).toHaveText(
    'Rolig base i tale-tempo',
  );
});

// ------------------------------------------------------------------------------------------------
// A double tap that writes saves once (D61), also when the phone is slow to save.

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

test('et dobbelttryk på »Hvordan var det?« og »Gem« gemmer én klublog @date', async ({ page }) => {
  await slowWrites(page);
  await openAt(page, '2026-11-11T19:45:00Z');
  await onboard(page);
  const card = page.getByTestId('main-card');
  const before = await storedEventCount(page);
  // The second tap lands on the new screen in its first half second: it does nothing.
  await doubleTapOn(page, card.getByRole('button', { name: 'Hvordan var det?' }));
  const form = page.getByTestId('club-log');
  await expect(form).toBeVisible();
  await page.waitForTimeout(600);
  expect(await storedEventCount(page)).toBe(before);
  await form.getByRole('button', { name: 'Hård', exact: true }).click();
  await slow(page, true);
  await doubleTapOn(page, form.getByTestId('club-save'));
  await expect(page.locator('.main-card.done')).toContainText('✓ Logget: Hård');
  await slow(page, false);
  await page.waitForTimeout(600);
  expect(await storedEventCount(page)).toBe(before + 1);
});

test('et dobbelttryk på »Gem søndagstjekket« gemmer ét søndagstjek @date', async ({ page }) => {
  await slowWrites(page);
  await openAt(page, '2026-11-15T09:00:00Z');
  await onboard(page);
  const card = page.getByTestId('main-card');
  await card.getByRole('button', { name: 'Tag søndagstjekket' }).click();
  const check = page.getByTestId('sunday-check');
  await check.getByLabel('Timer søvn i snit').fill('7');
  const before = await storedEventCount(page);
  await slow(page, true);
  await doubleTapOn(page, check.getByTestId('sunday-save'));
  await expect(page.locator('.main-card.done')).toContainText('Søvn: 7 t i snit');
  await slow(page, false);
  await page.waitForTimeout(600);
  expect(await storedEventCount(page)).toBe(before + 1);
});

// ------------------------------------------------------------------------------------------------
// After the review of P5a (docs/reviews/nat3-p5a-livet.md, DECISIONS.md D65).

/** The real log's club logs (IndexedDB 'comeback', store 'events'). */
async function clubLogs(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(
    () =>
      new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
        const open = indexedDB.open('comeback');
        open.onerror = () => reject(new Error(String(open.error)));
        open.onsuccess = () => {
          const db = open.result;
          const all = db.transaction('events', 'readonly').objectStore('events').getAll();
          all.onsuccess = () => {
            const events = all.result as Array<Record<string, unknown>>;
            resolve(events.filter((e) => e.type === 'club_logged'));
            db.close();
          };
          all.onerror = () => reject(new Error(String(all.error)));
        };
      }),
  );
}

test('H1: søndagstjekket og klubloggen åbnet i tidsmaskinen lukker ved »Afslut« og skriver aldrig i den rigtige log @date', async ({
  page,
}) => {
  // The real day is Wednesday 11/11 at 20:45, after the club time.
  await openAt(page, '2026-11-11T19:45:00Z');
  await onboardHarder(page, { Ben: 2 });
  const stored = await storedEventCount(page);

  // The Sunday check on a simulated Sunday, with Ben too heavy, left open at »Afslut«.
  await startSimulation(page, '2026-11-15');
  await page.getByTestId('main-card').getByRole('button', { name: 'Tag søndagstjekket' }).click();
  const check = page.getByTestId('sunday-check');
  const heavy = check.getByRole('group', { name: 'For tungt?' });
  await heavy.getByRole('button', { name: 'Ben · trin 3', exact: true }).click();
  await page.getByTestId('sim-exit').click();
  await expect(page.locator('.banner.sim')).toHaveCount(0);
  await expect(check).toHaveCount(0);
  await expect(page.getByTestId('today')).toBeVisible();
  expect(await storedEventCount(page)).toBe(stored);

  // The club log on the simulated Wednesday, left open at »Afslut«.
  await startSimulation(page, '2026-11-11');
  await page.getByTestId('main-card').getByRole('button', { name: 'Hvordan var det?' }).click();
  const form = page.getByTestId('club-log');
  await expect(form).toBeVisible();
  await page.getByTestId('sim-exit').click();
  await expect(form).toHaveCount(0);
  expect(await storedEventCount(page)).toBe(stored);

  // The real Wednesday's club log is still asked for, and is logged once.
  const card = page.getByTestId('main-card');
  await card.getByRole('button', { name: 'Hvordan var det?' }).click();
  await page.getByTestId('club-log').getByRole('button', { name: 'Hård', exact: true }).click();
  await page.getByTestId('club-save').click();
  await expect(page.locator('.main-card.done')).toContainText('✓ Logget: Hård');
  await expect.poll(() => storedEventCount(page)).toBe(stored + 1);
  // And the real Ben is still on trin 3.
  await page.getByRole('button', { name: 'Stiger', exact: true }).click();
  await expect(page.locator('.ladder-row', { hasText: 'Ben · trin 3' })).toBeVisible();
});

test('M1 og M2: »Ret søndagstjekket« fra smerte til for tungt holder Ben på trin 2, og et fjernet svar står stadig på kortet @date', async ({
  page,
}) => {
  await openAt(page, MONDAY_EVENING);
  await onboardHarder(page, { Ben: 2 });
  const stored = await storedEventCount(page);
  await startSimulation(page, '2026-11-15');

  const card = page.getByTestId('main-card');
  await card.getByRole('button', { name: 'Tag søndagstjekket' }).click();
  const check = page.getByTestId('sunday-check');
  const pain = check.getByRole('group', { name: 'Gør noget ondt, der ikke gik væk?' });
  await pain.getByRole('button', { name: 'Ja', exact: true }).click();
  await check.getByRole('button', { name: 'Ben', exact: true }).click();
  await check.getByRole('button', { name: 'Lyske', exact: true }).click();
  await expect(check.getByTestId('pain-effects')).toContainText(
    'Ben går fra trin 3 til trin 2 til 22. november.',
  );
  await check.getByTestId('sunday-save').click();
  const done = page.locator('.main-card.done');
  await expect(done).toContainText('Ondt: Ben – midlertidigt trin til 22. november (smerte)');

  // Corrected: no pain, but Ben too heavy. Ben stays on trin 2, and trin 3 does not come back.
  await done.getByRole('button', { name: 'Ret søndagstjekket' }).click();
  await expect(check.getByTestId('standing')).toContainText(
    'Fra søndagstjekket: Ben – midlertidigt trin til 22. november (smerte) · Lyske – lettere variant til 22. november (smerte).',
  );
  await pain.getByRole('button', { name: 'Nej', exact: true }).click();
  const heavy = check.getByRole('group', { name: 'For tungt?' });
  await heavy.getByRole('button', { name: 'Ben · trin 3', exact: true }).click();
  await expect(check.getByTestId('heavy-effects')).toHaveText(
    'Ben bliver på trin 2 og kommer ikke tilbage til trin 3 – dit eget valg.',
  );
  await expectClean(page, 'Søndagstjekket under »Ret«');
  await page.screenshot({
    path: 'screenshots/soendagstjek-ret.png',
    scale: 'css',
    animations: 'disabled',
    fullPage: true,
    style: IN_FLOW,
  });
  await check.getByTestId('sunday-save').click();
  await expect(done).toContainText('For tungt: Ben – nu trin 2');
  // Lyske is no longer named, but its lighter variant stands, and the card says so.
  await expect(done).toContainText('Ondt: Lyske – lettere variant til 22. november (smerte)');
  await expect(done).toContainText(
    'Fjernet i rettelsen, men står stadig: Lyske. Trinnet kan vælges under Stiger.',
  );
  await expectClean(page, 'I dag efter »Ret søndagstjekket«');
  await page.screenshot({
    path: 'screenshots/i-dag-soendagstjek-ret.png',
    scale: 'css',
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Stiger', exact: true }).click();
  const ben = page.locator('.ladder-row', { hasText: 'Ben · trin 2' });
  await expect(ben).toBeVisible();
  await expect(ben).not.toContainText('Midlertidigt');
  expect(await storedEventCount(page)).toBe(stored);
});

test('M3 med det rigtige ur søndag 15/11: lørdagskarakteren i tjekket lukker ikke lørdagens klublog @date', async ({
  page,
}) => {
  // The phase-in on Friday 13/11 at 08:00, then the real clock on to Sunday at 10:00.
  await openAt(page, '2026-11-13T07:00:00Z');
  await onboard(page);
  await page.clock.fastForward(50 * 3_600_000);
  await expect(page.locator('.today-head .date')).toHaveText('Søndag 15. november');
  const yesterday = page.getByTestId('club-card');
  await expect(yesterday).toContainText('Muay Thai i går');

  // The check first, with Saturday's grade.
  await page.getByTestId('main-card').getByRole('button', { name: 'Tag søndagstjekket' }).click();
  const check = page.getByTestId('sunday-check');
  const grade = check.getByRole('group', { name: /Lørdagskarakter/ });
  await grade.getByRole('button', { name: '4', exact: true }).click();
  await check.getByTestId('sunday-save').click();
  await expect(page.locator('.main-card.done')).toContainText('Lørdagskarakter: 4');

  // Saturday's club card stays: only the grade is given, and the rest is logged without it.
  await expect(yesterday).toContainText('Karakteren 4 er givet. Resten kan du logge her.');
  await yesterday.getByRole('button', { name: 'Hvordan var det?' }).click();
  const form = page.getByTestId('club-log');
  await expect(form.getByTestId('club-grade')).toHaveText(/4\s*· allerede givet/);
  await expect(form.getByRole('group', { name: 'Teknikken i sidste runde' })).toHaveCount(0);
  for (const name of ['Middel', 'Flad']) {
    await form.getByRole('button', { name, exact: true }).click();
  }
  await form.getByTestId('club-save').click();
  await expect(yesterday).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({ hasText: 'Klubtræningen i går er logget' }),
  ).toBeVisible();
  const saturday = (await clubLogs(page)).filter((e) => e.date === '2026-11-14');
  expect(saturday).toEqual([
    expect.objectContaining({ attended: true, technique: 4 }),
    expect.objectContaining({ attended: true, hardness: 'medium', freshness: 'flat' }),
  ]);
  // The flat rule reads one grade for Saturday.
  expect(saturday.filter((e) => e.technique !== undefined)).toHaveLength(1);
});

test('L2: tilbage-gestussen lukker søndagstjekket, klubloggen og »Flyt eller spring over«, ikke appen @date', async ({
  page,
}) => {
  await openAt(page, MONDAY_EVENING);
  await onboard(page);
  const entries = await page.evaluate(() => history.length);
  await startSimulation(page, '2026-11-15');
  const card = page.getByTestId('main-card');

  await card.getByRole('button', { name: 'Tag søndagstjekket' }).click();
  await expect(page.getByTestId('sunday-check')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('sunday-check')).toHaveCount(0);
  await expect(page.getByTestId('today')).toBeVisible();
  await expect(page.locator('.banner.sim')).toBeVisible();

  // »Tilbage« goes back over the screen's step: the history does not grow.
  await card.getByRole('button', { name: 'Tag søndagstjekket' }).click();
  const back = page.getByTestId('sunday-check').getByRole('button', { name: 'Tilbage' });
  await back.click();
  await expect(page.getByTestId('sunday-check')).toHaveCount(0);

  // The club log on Monday evening.
  await nextDay(page, 'mandag 16. november');
  await card.getByRole('button', { name: 'Hvordan var det?' }).click();
  await expect(page.getByTestId('club-log')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('club-log')).toHaveCount(0);
  await expect(card).toContainText('Muay Thai');

  // »Flyt eller spring over« in Uge on Wednesday, for Tuesday's forgotten Styrke A.
  await nextDay(page, 'tirsdag 17. november');
  await nextDay(page, 'onsdag 18. november');
  await page.getByRole('button', { name: 'Uge', exact: true }).click();
  const tuesday = page.locator('.week-day', {
    has: page.locator('.week-day-weekday', { hasText: 'Tirsdag' }),
  });
  await tuesday.getByTestId('week-session').click();
  await expect(page.getByTestId('move')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('move')).toHaveCount(0);
  await expect(page.getByTestId('week')).toBeVisible();
  await expect(page.locator('.banner.sim')).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(entries + 1);
});
