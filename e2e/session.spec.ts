import { expect, test, type Page } from '@playwright/test';
import { a11yProblems, SESSION_RULES } from './a11y.ts';
import {
  closeIntro,
  onboard,
  openApp,
  runSessionToSummary,
  startSession,
  startSimulation,
  stillFigures,
  storedEventCount,
  throughWarmup,
} from './helpers.ts';

// The session: what to do now and what comes next (docs/SPEC.md 3.2 and 4.2–4.5, DECISIONS.md D44
// and D50–D53). »Dagens pas« before the start; »Nu« (figure, target, two cues), »Næste« (figure, name,
// target) and the part of the session on every step; the next exercise big with »Gør klar« in the
// pause; an intro card the first time an exercise comes, which closes by itself so holds, the club
// sequence and the neck still run without a touch (SK3); »Hold pause« to the tabs and back. Styrke
// A, Styrke B, the motor and Open & Strong run in the time machine, so the user's own data are never
// touched. Screenshots in screenshots/.

test.describe.configure({ timeout: 600_000 });

const now = (page: Page) => page.locator('.session .stack.now');
const strip = (page: Page) => page.getByTestId('next-strip');
const nextUp = (page: Page) => page.getByTestId('next-up');
const intro = (page: Page) => page.getByTestId('intro');
const progress = (page: Page) => page.getByTestId('session-progress');
/** An exercise in »Dagens pas« by its name (another may mention it in a note). */
const dayItem = (page: Page, name: string) =>
  page
    .getByTestId('day-plan')
    .locator('.day-item')
    .filter({ has: page.locator('.day-item-name').getByText(name, { exact: true }) });

/** Onboarding with the defaults, but power legs at `step` (skater-hop is step 3). */
async function onboardPowerLegs(page: Page, step: number): Promise<void> {
  await expect(page.getByTestId('onboarding')).toBeVisible();
  for (let i = 0; i < 8; i++) {
    if (await page.getByRole('heading', { name: 'Dit trin på hver stige' }).isVisible()) {
      const harder = page.getByRole('button', { name: 'Power ben: sværere trin' });
      for (let s = 1; s < step; s++) await harder.click();
    }
    const done = page.getByTestId('onboarding-done');
    if (await done.isVisible()) {
      await done.click();
      break;
    }
    await page.getByTestId('onboarding-next').click();
  }
  await expect(page.getByTestId('today')).toBeVisible();
}

/**
 * Two taps 180 ms apart in the middle of a button, as a clumsy double tap (SPEC 6, D33): the second
 * lands on whatever stands there once the first has changed the screen.
 */
async function doubleTap(page: Page, testId: string): Promise<void> {
  // First until the button takes taps (the half second after its own screen came, D33).
  await page.getByTestId(testId).click({ trial: true });
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`${testId} ses ikke`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await page.waitForTimeout(180);
  await page.mouse.click(x, y);
}

/**
 * Taps through a running session as planned until `stop` holds: intro cards closed with »Luk«,
 * pauses skipped, questions answered yes, the EMOM's minutes run (unless `stop` stops before it).
 */
async function driveUntil(page: Page, stop: () => Promise<boolean>): Promise<void> {
  for (let i = 0; i < 400; i++) {
    if (await stop()) return;
    if (await page.getByTestId('intro-close').isVisible()) {
      await closeIntro(page);
      continue;
    }
    if (await page.getByTestId('as-planned').isVisible()) {
      await page.getByTestId('as-planned').click();
      continue;
    }
    const skip = page.getByRole('button', { name: 'Spring pausen over' });
    if (await skip.isVisible()) {
      await skip.click();
      continue;
    }
    const startEmom = page.getByRole('button', { name: 'Start EMOM' });
    if (await startEmom.isVisible()) {
      await startEmom.click();
      for (let s = 0; s < 60 && !(await page.getByText('Alle minutter rene?').isVisible()); s++)
        await page.clock.runFor(5_000);
      continue;
    }
    let answered = false;
    for (const name of ['Gem', 'Ja']) {
      const button = page.getByRole('button', { name, exact: true });
      if (await button.isVisible()) {
        await button.click();
        answered = true;
        break;
      }
    }
    if (!answered) await page.clock.runFor(2_000);
  }
  throw new Error('Passet nåede ikke frem');
}

/** The session as the previous version saved it: the step's index without its key (D54). */
async function saveAsPreviousVersion(page: Page, stepIndex?: number): Promise<void> {
  await page.evaluate((index) => {
    const run = JSON.parse(localStorage.getItem('comeback.run') ?? '{}') as Record<string, unknown>;
    delete run.stepKey;
    if (index !== undefined) run.stepIndex = index;
    localStorage.setItem('comeback.run', JSON.stringify(run));
  }, stepIndex);
}

/** The countdown on the screen in seconds (»1:25« = 85). */
async function secondsLeft(page: Page): Promise<number> {
  const text = await page.getByTestId('countdown').first().innerText();
  const [minutes, seconds] = text.split(':').map(Number);
  return (minutes ?? 0) * 60 + (seconds ?? 0);
}

/** The text of the figure's running phase in »Nu« (one line in a session). */
async function runningPhase(page: Page): Promise<string> {
  return ((await now(page).locator('.figure-current').allTextContents())[0] ?? '').trim();
}

/** Every exercise screen has »Nu« with its name and »Næste«, and the header the part (SPEC 3.2). */
async function expectNowAndNext(page: Page): Promise<void> {
  await expect(now(page).locator('.now-label')).toHaveText('Nu');
  await expect(now(page).locator('.set-name')).not.toHaveText('');
  await expect(strip(page)).toBeVisible();
  await expect(strip(page).locator('.next-name')).not.toHaveText('');
}

/**
 * Taps through a session like `runSessionToSummary`, but checks on each screen that »Nu« and »Næste«
 * (or the pause's next exercise, an intro card or a question's »Næste«) are there, and counts what
 * it saw. Intro cards are left to close by themselves.
 */
async function driveChecking(page: Page): Promise<Record<string, number>> {
  const seen: Record<string, number> = {};
  const count = (what: string) => (seen[what] = (seen[what] ?? 0) + 1);
  for (let i = 0; i < 500; i++) {
    if (await page.getByTestId('done').isVisible()) return seen;
    // The EMOM's intro stands on its own screen until »Start EMOM« (D44); then its minutes run
    // to the questions without a touch (SK3).
    const startEmom = page.getByRole('button', { name: 'Start EMOM' });
    if (await startEmom.isVisible()) {
      count('emom');
      await startEmom.click();
      await expectNowAndNext(page);
      for (let s = 0; s < 60 && !(await page.getByText('Alle minutter rene?').isVisible()); s++)
        await page.clock.runFor(5_000);
      await expect(page.getByText('Alle minutter rene?')).toBeVisible();
      continue;
    }
    if (await intro(page).isVisible()) {
      count('intro');
      await page.clock.runFor(5_000);
      continue;
    }
    if (await page.locator('.session .rest').isVisible()) {
      count('rest');
      await expect(nextUp(page).or(strip(page)).first()).toBeVisible();
      await page.clock.runFor(5_000);
      continue;
    }
    const asPlanned = page.getByTestId('as-planned');
    if (await asPlanned.isVisible()) {
      count('set');
      await expectNowAndNext(page);
      await expect(progress(page)).toBeVisible();
      await asPlanned.click();
      continue;
    }
    if (await now(page).isVisible()) {
      // A timer: a hold, the EMOM, the club sequence, a round, the neck or a measurement.
      count('timer');
      await expect(strip(page)).toBeVisible();
    }
    for (const name of ['Start 3 minutter', 'Start uret', 'Stop']) {
      const button = page.getByRole('button', { name, exact: true });
      if (await button.isVisible()) {
        await button.click();
        if (name !== 'Stop') await page.clock.runFor(name === 'Start uret' ? 20_000 : 181_000);
        break;
      }
    }
    const save = page.getByRole('button', { name: 'Gem målingen' });
    if (await save.isVisible()) {
      const depth = page.getByRole('button', { name: 'Halvvejs' });
      if (await depth.isVisible()) await depth.click();
      const input = page.locator('.session-body input[type="number"]');
      if ((await input.count()) > 0 && (await input.first().inputValue()) === '')
        await input.first().fill('20');
      if (await save.isEnabled()) {
        count('measure');
        await save.click();
        continue;
      }
    }
    const finish = page.getByTestId('finish');
    if (await finish.isVisible()) {
      await finish.click();
      continue;
    }
    if (await nextUp(page).isVisible()) count('question');
    // »Gem« first: the EMOM's questions have »Ja« buttons that only choose an answer.
    for (const name of ['Gem', 'Ja', 'Passende', 'Videre']) {
      const button = page.getByRole('button', { name, exact: true });
      if (await button.isVisible()) {
        await button.click();
        break;
      }
    }
    await page.clock.runFor(5_000);
  }
  throw new Error('Passet nåede ikke opsummeringen');
}

test('Styrke A i tidsmaskinen: dagens pas, nu og næste, pausen og introkortet @date', async ({
  page,
}) => {
  await openApp(page, '2026-11-06');
  await onboard(page);
  const stored = await storedEventCount(page);
  // The first Tuesday: the wall test, the zero-point measurements, power legs, EMOM E1 and the neck.
  await startSimulation(page, '2026-11-10');
  await expect(page.getByTestId('start-session')).toHaveText('Se dagens pas');
  await page.getByTestId('start-session').click();

  // »Dagens pas«: the parts in order with their numbers, the exercises with figure, sets ×
  // repetitions, pauses, equipment and the expected time; »Start passet« at the bottom.
  const plan = page.getByTestId('day-plan');
  await expect(plan.getByRole('heading', { level: 1 })).toHaveText('Styrke A');
  await expect(plan.locator('.day-plan-time')).toHaveText(/^ca\. \d+ min$/);
  await expect(plan.locator('.day-part h2')).toHaveText([
    'Måling',
    'Opvarmning',
    'Power',
    'Par 1',
    'Par 2',
    'Tri-sæt',
    'Burpees',
    'Nakke',
  ]);
  await expect(plan.locator('.day-part-number')).toHaveText([
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
  ]);
  await expect(dayItem(page, 'Squat jump')).toContainText('Pause 75 sek');
  // A measurement in place of the first set comes before the sets, and its equipment counts:
  // bord-rows need a table. The row's chair stands with its back against a wall (P65).
  await expect(dayItem(page, 'Push-up med tempo')).toContainText(
    'Første sæt er en måling: Push-ups',
  );
  await expect(dayItem(page, 'Push-up med tempo').locator('.day-item-dose')).toHaveText(
    '1 × 6 + måling',
  );
  await expect(dayItem(page, 'Rygsæk-row med én arm')).toContainText('1 × 8 pr. side + måling');
  await expect(dayItem(page, 'Rygsæk-row med én arm')).toContainText(
    'Udstyr: Rygsæk, stol, væg og bord',
  );
  await expect(plan.getByTestId('day-equipment')).toContainText(/rygsæk/i);
  await expect(plan.getByTestId('day-equipment')).toContainText(/bord/i);
  // Every exercise has its drawn figure or its pictogram; only a measurement can have neither.
  expect(await plan.locator('.day-item .figure-still-only').count()).toBeGreaterThan(5);
  const bare = await plan
    .locator('.day-item')
    .evaluateAll((rows) =>
      rows
        .filter((row) => !row.querySelector('.figure-still-only, .session-picto'))
        .map((row) => row.querySelector('.step-kicker')?.textContent ?? row.textContent ?? ''),
    );
  expect(
    bare.every((kicker) => kicker === 'Måling'),
    bare.join(', '),
  ).toBe(true);
  expect(await a11yProblems(page, '.session', SESSION_RULES)).toEqual([]);
  await page.screenshot({
    path: 'screenshots/dagens-pas.png',
    scale: 'css',
    animations: 'disabled',
  });
  await page.screenshot({
    path: 'screenshots/dagens-pas-hele.png',
    scale: 'css',
    fullPage: true,
    style: '.session-actions { visibility: hidden; }',
  });
  // A tap on an exercise opens its card, and »Tilbage« returns to »Dagens pas«.
  await dayItem(page, 'Squat jump').click();
  const card = page.locator('.exercise-card');
  await expect(card.getByRole('heading', { level: 1 })).toHaveText('Squat jump');
  await card.getByRole('button', { name: 'Tilbage til dagens pas' }).first().click();
  await expect(plan).toBeVisible();

  await page.getByTestId('day-start').click();
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();

  // The wall test before the warm-up: the part in the header, the warm-up as »Næste«, and the
  // field on the first screen above the actions, even under the time machine's banner (D54).
  await expect(page.getByRole('heading', { name: 'Væg-testen' })).toBeVisible();
  await expect(progress(page)).toHaveText('Del 1 af 8');
  await expect(strip(page).locator('.next-name')).toHaveText('Opvarmning · Hæv pulsen');
  await expect(now(page).getByRole('button', { name: 'Sådan gør du' })).toBeVisible();
  const field = await page.locator('.session-body input[type="number"]').boundingBox();
  const actions = await page.locator('.fixed-actions').boundingBox();
  expect((field?.y ?? 0) + (field?.height ?? 0)).toBeLessThanOrEqual(actions?.y ?? 0);
  expect(await a11yProblems(page, '.session', SESSION_RULES)).toEqual([]);
  await page.screenshot({
    path: 'screenshots/maaling-nu.png',
    scale: 'css',
    animations: 'disabled',
  });
  await page.locator('.session-body input[type="number"]').fill('3');
  // The warm-up is fast-forwarded with its figures as stills; they move again from the first set.
  await stillFigures(page);
  await page.getByRole('button', { name: 'Gem målingen' }).click();

  // The warm-up's one card: its four items with name and figure for 10 sek, then the first timer
  // starts by itself (D44).
  await expect(intro(page)).toContainText('Opvarmning · 8 min');
  await expect(intro(page).locator('.intro-moves li')).toHaveCount(4);
  await expect(intro(page).locator('.countdown-label')).toHaveText('Gør klar');
  await page.clock.runFor(10_500);
  await expect(intro(page)).toHaveCount(0);
  await expect(progress(page)).toHaveText('Del 2 af 8');
  await expectNowAndNext(page);
  await expect(now(page).locator('.set-name')).toHaveText('Hæv pulsen');
  await expect(strip(page).locator('.next-name')).toHaveText('Opvarmning · Mobilisér');
  expect(await secondsLeft(page)).toBeGreaterThan(110);
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);

  // Question 3 shows the first exercise as »Næste«.
  await expect(page.getByRole('heading', { name: 'Spørgsmål 3' })).toBeVisible();
  await expect(nextUp(page).locator('.next-title')).toHaveText('Power ben · Squat jump');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();

  // No pause before power: its intro card counts »Gør klar« down by itself, then the set.
  await expect(intro(page).locator('.intro-label')).toHaveText('Ny øvelse');
  await expect(intro(page).getByRole('heading', { level: 1 })).toHaveText('Power ben · Squat jump');
  await expect(intro(page).locator('.intro-steps li').first()).toBeVisible();
  await expect(intro(page).locator('.countdown-label')).toHaveText('Gør klar');
  await page.clock.runFor(10_500);
  await expect(intro(page)).toHaveCount(0);

  // »Nu«: the figure, the target and two cues; »Næste« above »Som planlagt«; the part on top.
  await expectNowAndNext(page);
  await expect(progress(page)).toHaveText('Del 3 af 8');
  await expect(now(page).locator('.set-name')).toHaveText('Squat jump');
  await expect(now(page).locator('.figure-stage')).toHaveAttribute('role', 'img');
  await expect(now(page).locator('.now-cues li')).toHaveCount(2);
  await expect(page.getByTestId('target').locator('.number')).toHaveText('3');
  await expect(strip(page).locator('.next-line')).toHaveText('Sæt 2 af 2 · 3 reps');
  expect(await a11yProblems(page, '.session', SESSION_RULES)).toEqual([]);
  await page.screenshot({
    path: 'screenshots/pas-nu-og-naeste.png',
    scale: 'css',
    animations: 'disabled',
  });
  await page.getByTestId('as-planned').click();

  // The pause: the next exercise big with its animation and »Gør klar«.
  await expect(page.getByText('Spring pausen over')).toBeVisible();
  await expect(nextUp(page).locator('.next-title')).toHaveText('Power ben · Squat jump');
  await expect(nextUp(page).locator('.get-ready')).toContainText('Gør klar:');
  await expect(nextUp(page).locator('.figure-stage')).toBeVisible();
  await page.getByText('Spring pausen over').click();
  await page.getByTestId('as-planned').click();

  // The pause after power: the push-ups measurement comes for the first time, so its intro card
  // stands in the pause with the pause's clock; a tap closes it, and the pause shows »Næste«. The
  // measurement is its own exercise – an ordinary push-up, not the step's tempo push-up (D45).
  await expect(intro(page).getByRole('heading', { level: 1 })).toHaveText('Måling · Push-ups');
  await expect(intro(page).locator('.intro-line')).toHaveText('Første sæt i Pres · max');
  await expect(intro(page).locator('.countdown-label')).toHaveText('Pause');
  await page.clock.runFor(2_000);
  expect(await a11yProblems(page, '.session', SESSION_RULES)).toEqual([]);
  await page.screenshot({
    path: 'screenshots/introkort.png',
    scale: 'css',
    animations: 'disabled',
  });
  const left = await secondsLeft(page);
  await closeIntro(page);
  await expect(nextUp(page).locator('.next-title')).toHaveText('Måling · Push-ups');
  await expect(nextUp(page).locator('.get-ready')).toBeVisible();
  // The same clock: closing the card changes nothing in the pause.
  expect(Math.abs((await secondsLeft(page)) - left)).toBeLessThanOrEqual(1);
  expect(await a11yProblems(page, '.session', SESSION_RULES)).toEqual([]);
  await page.screenshot({ path: 'screenshots/pause.png', scale: 'css', animations: 'disabled' });
  // At the end of the pause the power question shows the measurement as »Næste«.
  await page.clock.runFor(80_000);
  await expect(
    page.getByRole('heading', { name: 'Alle hop/reps lige høje og hurtige?' }),
  ).toBeVisible();
  await expect(nextUp(page).locator('.next-title')).toHaveText('Måling · Push-ups');
  await page.getByRole('button', { name: 'Ja', exact: true }).click();

  // The rest of the session: »Nu« and »Næste« on every screen, the intro cards close themselves.
  await stillFigures(page);
  const seen = await driveChecking(page);
  expect(seen.set ?? 0).toBeGreaterThan(8);
  expect(seen.rest ?? 0).toBeGreaterThan(5);
  expect(seen.intro ?? 0).toBeGreaterThan(3);
  await page.getByTestId('done').click();
  await expect(page.locator('.main-card.done')).toContainText('Logget i dag');
  // The time machine never writes to storage (SPEC 3.7).
  expect(await storedEventCount(page)).toBe(stored);
});

test('Styrke B i tidsmaskinen: hold og nakke uden berøring, figuren følger uret @date', async ({
  page,
}) => {
  await openApp(page, '2026-11-06');
  await onboard(page);
  // Programme week 1, Friday: Styrke B with its measurements, wall sit W1 and the club sequence.
  await startSimulation(page, '2026-11-13');
  await page.getByTestId('start-session').click();
  const plan = page.getByTestId('day-plan');
  await expect(plan.getByRole('heading', { level: 1 })).toHaveText('Styrke B');
  await expect(plan.locator('.day-part h2').first()).toHaveText('Opvarmning');
  await expect(plan.locator('.day-part h2', { hasText: 'Klubsekvensen' })).toHaveCount(1);
  await expect(dayItem(page, 'Klubsekvensen')).toContainText('2 × 1 runde');
  // Hollow (a measurement of its own) before Par 2, and Par 2 is one part: RDL, side plank and
  // rotation after each other, as the programme runs a pair (D57).
  const parts = await plan.locator('.day-part h2').allTextContents();
  expect(parts.filter((label) => label === 'Par 2')).toHaveLength(1);
  expect(parts[parts.indexOf('Par 2') - 1]).toBe('Måling');
  const pair2 = plan.locator('.day-part').filter({ has: page.locator('h2', { hasText: 'Par 2' }) });
  await expect(pair2.locator('.day-item-name')).toHaveText([
    'Etbens RDL',
    'Sideplanke på albuen',
    'Planke med skulder-tap',
  ]);
  await page.getByTestId('day-start').click();
  await stillFigures(page);
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
  await closeIntro(page);

  // To the pause before the wall sit's hold (set 2: the first set is the measurement), where the
  // intro card of the wall sit's first working set stands (D44).
  for (let i = 0; i < 300; i++) {
    const wallSitIntro =
      (await intro(page).isVisible()) &&
      (await intro(page).locator('h1').allTextContents())[0] === 'Wall sit · Wall sit, 90°';
    if (wallSitIntro) break;
    if (await page.getByTestId('intro-close').isVisible()) {
      await page.getByTestId('intro-close').click();
      continue;
    }
    if (await page.getByTestId('as-planned').isVisible()) {
      await page.getByTestId('as-planned').click();
      continue;
    }
    const skip = page.getByRole('button', { name: 'Spring pausen over' });
    if (await skip.isVisible()) {
      await skip.click();
      continue;
    }
    for (const name of ['Start uret', 'Stop']) {
      const button = page.getByRole('button', { name, exact: true });
      if (await button.isVisible()) {
        await button.click();
        if (name === 'Start uret') await page.clock.runFor(20_000);
        break;
      }
    }
    const save = page.getByRole('button', { name: 'Gem målingen' });
    if (await save.isVisible()) {
      const input = page.locator('.session-body input[type="number"]');
      if ((await input.count()) > 0 && (await input.first().inputValue()) === '')
        await input.first().fill('10');
      if (await save.isEnabled()) {
        await save.click();
        continue;
      }
    }
    const yes = page.getByRole('button', { name: 'Ja', exact: true });
    if (await yes.isVisible()) {
      await yes.click();
      continue;
    }
    await page.clock.runFor(5_000);
  }
  await expect(intro(page).locator('.intro-line')).toHaveText('Sæt 2 af 2 · 45 sek');
  await expect(intro(page).locator('.countdown-label')).toHaveText('Pause');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // From here no touch (SK3): the card closes itself when the pause runs out, »Klar« counts down,
  // the figure glides into the wall sit at the end of »Klar« and holds while the hold is counted
  // down, and the hold logs itself.
  const waiting = page.locator('.session .rest').or(intro(page)).first();
  for (let i = 0; i < 120 && (await waiting.isVisible()); i++) await page.clock.runFor(1_000);
  await expect(now(page).locator('.set-name')).toHaveText('Wall sit, 90°');
  await expect(page.locator('.countdown-label')).toHaveText('Klar');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await expect.poll(() => runningPhase(page)).toBe('');
  await page.clock.runFor(3_400);
  await expect.poll(() => runningPhase(page)).toBe('Glid ned');
  await page.clock.runFor(2_000);
  await expect(page.locator('.countdown-label')).toHaveText('Hold');
  await expect.poll(() => runningPhase(page)).toBe('Hold');
  await page.clock.runFor(30_000);
  await expect.poll(() => runningPhase(page)).toBe('Hold');
  await expectNowAndNext(page);
  await page.screenshot({ path: 'screenshots/pas-hold.png', scale: 'css', animations: 'disabled' });
  await page.clock.resume();
  await stillFigures(page);
  for (let i = 0; i < 30 && (await now(page).locator('.set-name').isVisible()); i++)
    await page.clock.runFor(2_000);
  await expect(page.locator('.session .rest').or(intro(page)).first()).toBeVisible();

  // The club sequence after its pause, then the neck: its intro counts down by itself (no pause
  // before it), and the neck's holds run to the end without a touch (SK3).
  for (let i = 0; i < 200; i++) {
    if (await page.getByRole('heading', { name: 'Ren runde?' }).isVisible()) break;
    if (await page.getByTestId('as-planned').isVisible()) {
      await page.getByTestId('as-planned').click();
      continue;
    }
    const yes = page.getByRole('button', { name: 'Ja', exact: true });
    if (await yes.isVisible()) {
      await yes.click();
      continue;
    }
    await page.clock.runFor(5_000);
  }
  await expect(nextUp(page).locator('.next-title')).toHaveText('Nakke · Hage-ind liggende');
  await page.getByRole('button', { name: 'Ja', exact: true }).click();
  await expect(intro(page).getByRole('heading', { level: 1 })).toHaveText(
    'Nakke · Hage-ind liggende',
  );
  for (let i = 0; i < 60; i++) {
    if (await page.getByRole('heading', { name: 'Hvordan føltes trinnet?' }).isVisible()) break;
    await page.clock.runFor(5_000);
  }
  await expect(page.getByRole('heading', { name: 'Hvordan føltes trinnet?' })).toBeVisible();
  await page.getByRole('button', { name: 'Passende', exact: true }).click();
  await runSessionToSummary(page);
  await page.getByTestId('done').click();
});

test('motoren i tidsmaskinen: dagens pas, faserne som nu og næste, så målingen @date', async ({
  page,
}) => {
  await openApp(page, '2026-11-06');
  await onboard(page);
  await startSimulation(page, '2026-11-12');
  await page.getByTestId('start-session').click();
  const plan = page.getByTestId('day-plan');
  await expect(plan.getByRole('heading', { level: 1 })).toHaveText('Motor');
  await expect(plan.locator('.day-part h2')).toHaveText(['Base-check i tale-tempo', 'Måling']);
  await expect(plan.locator('.day-item', { hasText: 'Base-check' }).last()).toContainText(
    'Distance i meter',
  );
  await page.screenshot({
    path: 'screenshots/dagens-pas-motor.png',
    scale: 'css',
    animations: 'disabled',
  });
  await page.getByTestId('day-start').click();
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
  await expect(strip(page).locator('.next-name')).toHaveText('Base-check i tale-tempo');
  await page.getByRole('button', { name: 'Start uret' }).click();
  await expect(progress(page)).toHaveText('Fase 1 af 2');
  await expect(now(page).locator('.now-label')).toHaveText('Nu');
  await expect(strip(page).locator('.next-name')).toHaveText('Måling · Base-check');
  // The motor runs without a touch (SK3).
  await page.clock.runFor(30 * 60_000 + 5_000);
  await expect(page.getByRole('heading', { name: 'Base-check' })).toBeVisible();
  await expect(progress(page)).toHaveText('Fase 2 af 2');
  await expect(strip(page).locator('.next-name')).toHaveText('Opsummering');
  await page.locator('.session-body input[type="number"]').fill('5200');
  await page.getByRole('button', { name: 'Gem målingen' }).click();
  await page.getByTestId('finish').click();
  await page.getByTestId('done').click();
  await expect(page.locator('.main-card.done')).toContainText('Logget i dag');
});

test('Open & Strong i tidsmaskinen: listen før start, figuren følger uret, ingen berøring @date', async ({
  page,
}) => {
  await openApp(page, '2026-11-06');
  await onboard(page);
  const stored = await storedEventCount(page);
  await startSimulation(page, '2026-11-11');
  await page.getByTestId('os-start').click();
  const list = page.getByTestId('day-plan');
  await expect(list.getByRole('heading', { level: 1 })).toHaveText('Open & Strong');
  await expect(list.locator('.day-item')).toHaveCount(6);
  await expect(list.locator('.day-item').first()).toContainText('Brystryg over håndklæde');
  await page.screenshot({ path: 'screenshots/os-liste.png', scale: 'css', animations: 'disabled' });
  // The clock stands still from the start, so the item's clock starts at a known time.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.getByTestId('os-go').click();

  // The first item: the figure follows the item's clock – three deep breaths, then a move.
  await expect(now(page).locator('.set-name')).toHaveText('Brystryg over håndklæde');
  await expect(strip(page).locator('.next-name')).toHaveText('Åben bog');
  await page.clock.runFor(5_000);
  await expect.poll(() => runningPhase(page)).toBe('3 dybe vejrtrækninger');
  await page.clock.runFor(14_500);
  await expect.poll(() => runningPhase(page)).toBe('Ryk en håndsbredde');
  await expect(page.locator('.session-progress')).toHaveText('Øvelse 1 af 6');
  await page.screenshot({ path: 'screenshots/os-nu.png', scale: 'css', animations: 'disabled' });
  await page.clock.resume();

  // From here to the end without a touch (SK3).
  for (let i = 0; i < 100; i++) {
    if (await page.getByTestId('os-close').isVisible()) break;
    await page.clock.runFor(5_000);
  }
  await expect(page.getByText('Denne uge: 1 af 7.')).toBeVisible();
  await page.getByTestId('os-close').click();
  expect(await storedEventCount(page)).toBe(stored);
});

test('»Hold pause« fører til fanerne midt i et pas, og passet venter samme sted', async ({
  page,
}) => {
  await openApp(page, '2026-11-17');
  await onboard(page);
  await startSession(page);
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
  await closeIntro(page);
  await page.getByTestId('as-planned').click();
  await expect(page.getByText('Spring pausen over')).toBeVisible();
  await page.clock.runFor(10_000);
  const left = await secondsLeft(page);
  const events = await storedEventCount(page);

  // »Hold pause«: the tabs, with the session waiting above them.
  await page.getByTestId('session-pause').click();
  await expect(page.locator('.tabbar')).toBeVisible();
  await expect(page.getByTestId('paused-banner')).toContainText('Passet holder pause');
  await expect(page.getByTestId('main-card')).toContainText('Passet holder pause');
  await page.screenshot({
    path: 'screenshots/hold-pause.png',
    scale: 'css',
    animations: 'disabled',
  });
  // Time goes by, and the user looks something up in Stiger.
  await page.clock.runFor(300_000);
  await page.getByRole('button', { name: 'Stiger', exact: true }).click();
  await page.locator('.ladder-row', { hasText: 'Pres · trin 1' }).click();
  await page.locator('.step-open', { hasText: 'Push-up med tempo' }).click();
  await expect(page.locator('.exercise-card h1')).toHaveText('Push-up med tempo');
  await page.locator('.exercise-card').getByRole('button', { name: 'Tilbage' }).first().click();
  await expect(page.getByTestId('paused-banner')).toBeVisible();

  // »Fortsæt passet«: the same pause with the same time left; nothing was logged or lost.
  await page.getByTestId('resume-session').click();
  await expect(page.locator('.tabbar')).toBeHidden();
  await expect(page.getByText('Spring pausen over')).toBeVisible();
  expect(Math.abs((await secondsLeft(page)) - left)).toBeLessThanOrEqual(2);
  expect(await storedEventCount(page)).toBe(events);
  await page.getByText('Spring pausen over').click();
  await expect(page.locator('.set-count')).toHaveText('Sæt 2 af 3');

  // The tabs come back on the tab you left (Stiger); I dag's card goes back to the session too.
  await page.getByTestId('session-pause').click();
  await expect(page.getByRole('heading', { name: 'Stiger', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'I dag', exact: true }).click();
  await page.getByTestId('main-card').getByRole('button', { name: 'Fortsæt passet' }).click();
  await expect(page.locator('.set-count')).toHaveText('Sæt 2 af 3');
});

test('skater-hop er ét sæt, og ét »Som planlagt« logger begge sider (P54)', async ({ page }) => {
  await stillFigures(page);
  // Programme week 2, Tuesday: power legs at step 3, skater-hop (3 × 3–4 pr. side).
  await openApp(page, '2026-11-17');
  await onboardPowerLegs(page, 3);
  await page.getByTestId('start-session').click();
  await expect(dayItem(page, 'Skater-hop')).toContainText('3 × 3 pr. side, skiftevis');
  await page.getByTestId('day-start').click();
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
  await expect(intro(page).getByRole('heading', { level: 1 })).toHaveText('Power ben · Skater-hop');
  await expect(intro(page).locator('.intro-line')).toHaveText(
    'Sæt 1 af 3 · skiftevis · 3 pr. side',
  );
  await closeIntro(page);

  // One set with both sides: the target counts each side, one tap logs it.
  await expect(now(page).locator('.set-name')).toHaveText('Skater-hop');
  await expect(page.locator('.session-title')).toHaveText('Power · sæt 1/3');
  await expect(page.locator('.set-count')).toHaveText('Sæt 1 af 3 · skiftevis');
  await expect(page.getByTestId('target').locator('.unit')).toHaveText('reps pr. side');
  await expect(page.getByTestId('as-planned')).toHaveText('Som planlagt (3 reps pr. side)');
  await expect(strip(page).locator('.next-line')).toHaveText('Sæt 2 af 3 · skiftevis · 3 pr. side');
  expect(await a11yProblems(page, '.session', SESSION_RULES)).toEqual([]);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.screenshot({
    path: 'screenshots/pas-skiftevis.png',
    scale: 'css',
    animations: 'disabled',
  });
  await stillFigures(page);
  const before = await storedEventCount(page);
  await page.getByTestId('as-planned').click();
  // Left and right, as the engine counts per-side sets, and straight on to the pause.
  await expect.poll(() => storedEventCount(page)).toBe(before + 2);
  await expect(page.getByText('Spring pausen over')).toBeVisible();
  await page.getByText('Spring pausen over').click();
  await expect(page.locator('.set-count')).toHaveText('Sæt 2 af 3 · skiftevis');

  // The previous version had a step per side: »set 2, left« was step 3, which is now the pause
  // after set 2. A session it saved there resumes from the log, at set 2, with nothing lost.
  const events = await storedEventCount(page);
  await saveAsPreviousVersion(page, 3);
  await page.reload();
  await expect(page.locator('.set-count')).toHaveText('Sæt 2 af 3 · skiftevis');
  expect(await storedEventCount(page)).toBe(events);
});

test('et pas gemt af den forrige version genoptages samme sted uden fejl og tab', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await stillFigures(page);
  await openApp(page, '2026-11-17');
  await onboard(page);
  await startSession(page);
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
  await closeIntro(page);
  await page.getByTestId('as-planned').click();
  await page.getByText('Spring pausen over').click();
  await expect(page.locator('.set-count')).toHaveText('Sæt 2 af 3');
  const events = await storedEventCount(page);

  // `comeback.run` as main 2894827 wrote it: the same fields, no step key.
  await saveAsPreviousVersion(page);
  await page.reload();
  await expect(page.locator('.set-count')).toHaveText('Sæt 2 af 3');
  await expect(now(page).locator('.set-name')).toHaveText('Squat jump');
  expect(await storedEventCount(page)).toBe(events);
  await page.getByTestId('as-planned').click();
  await expect.poll(() => storedEventCount(page)).toBe(events + 1);
  expect(errors).toEqual([]);
});

test('et dobbelttryk på introkortets »Luk« logger og springer intet over (D57)', async ({
  page,
}) => {
  await stillFigures(page);
  // Programme week 2, Tuesday, in the real app (a fresh profile), so every event can be counted.
  await openApp(page, '2026-11-17');
  await onboard(page);
  await startSession(page);
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  const title = page.locator('.session-title');

  // The warm-up's card: under »Luk« is the first item's »Videre«.
  await expect(intro(page)).toContainText('Opvarmning · 8 min');
  await doubleTap(page, 'intro-close');
  await expect(intro(page)).toHaveCount(0);
  await expect(title).toHaveText('Opvarmning · 1/4');
  await expect(now(page).locator('.set-name')).toHaveText('Hæv pulsen');
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();

  // Power's card closes by itself after 10 sek; a tap at »Luk« in that moment changes nothing.
  await expect(intro(page).getByRole('heading', { level: 1 })).toHaveText('Power ben · Squat jump');
  const close = await page.getByTestId('intro-close').boundingBox();
  const events = await storedEventCount(page);
  await page.clock.runFor(10_000);
  await expect(intro(page)).toHaveCount(0);
  await page.mouse.click((close?.x ?? 0) + 100, (close?.y ?? 0) + 20);
  await page.waitForTimeout(100);
  expect(await storedEventCount(page)).toBe(events);
  await expect(page.getByTestId('as-planned')).toHaveText('Som planlagt (3 reps)');

  // The pause before Pres with its intro card: under »Luk« is »Spring pausen over«.
  for (let i = 0; i < 2; i++) {
    await page.getByTestId('as-planned').click();
    await page.getByText('Spring pausen over').click();
  }
  await page.getByTestId('as-planned').click();
  await expect(intro(page).getByRole('heading', { level: 1 })).toHaveText(
    'Pres · Push-up med tempo',
  );
  await doubleTap(page, 'intro-close');
  await expect(page.locator('.session .rest')).toBeVisible();
  await expect(nextUp(page).locator('.next-title')).toHaveText('Pres · Push-up med tempo');
  await expect(page.getByText('Spring pausen over')).toBeVisible();

  // To the neck's card (no pause before it): under »Luk« is the neck's »Stop«.
  await driveUntil(
    page,
    async () =>
      (await intro(page).isVisible()) &&
      (await intro(page).locator('h1').allTextContents())[0] === 'Nakke · Hage-ind liggende',
  );
  const beforeNeck = await storedEventCount(page);
  await doubleTap(page, 'intro-close');
  await expect(intro(page)).toHaveCount(0);
  await expect(now(page).locator('.set-name')).toHaveText('Hage-ind liggende');
  await expect(page.getByRole('button', { name: /^Stop: snurren/ })).toBeVisible();
  await page.waitForTimeout(600);
  expect(await storedEventCount(page)).toBe(beforeNeck);
  await expect(page.getByRole('heading', { name: 'Hvordan føltes trinnet?' })).toHaveCount(0);
});

test('»Lettere variant i dag« efter skarp smerte på trin 1 (N3) @date', async ({ page }) => {
  await stillFigures(page);
  await openApp(page, '2026-11-06');
  await onboard(page);
  // Tuesday 10/11: sharp pain on the first set (squat jump, step 1), the session run to the end.
  await startSimulation(page, '2026-11-10');
  await startSession(page);
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  await page.locator('.session-body input[type="number"]').fill('3');
  await page.getByRole('button', { name: 'Gem målingen' }).click();
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
  await closeIntro(page);
  await expect(now(page).locator('.set-name')).toHaveText('Squat jump');
  await page.getByRole('button', { name: 'Smerte' }).click();
  await page.getByRole('button', { name: 'Skarp eller i et led' }).click();
  await runSessionToSummary(page);
  await page.getByTestId('done').click();

  // A week later: the same set runs the lighter variant, and its card says so at the top.
  for (let i = 0; i < 7; i++) {
    await page.getByTestId('sim-next').click();
    await expect(page.locator('.banner.sim')).toBeVisible();
  }
  await expect(page.locator('.banner.sim')).toContainText('17. november');
  await expect(page.getByTestId('main-card')).toContainText('Styrke A');
  await page.getByTestId('start-session').click();
  await expect(dayItem(page, 'Squat jump')).toContainText('Lettere variant i dag');
  await page.getByTestId('day-start').click();
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  await throughWarmup(page);
  await closeIntro(page);
  await expect(now(page).locator('.step-kicker')).toContainText('· lettere variant');
  await now(page).getByRole('button', { name: 'Sådan gør du' }).click();
  const card = page.locator('.exercise-card');
  await expect(card.locator('.card-lighter')).toContainText('Lettere variant i dag:');
  await expect(card.locator('.card-lighter')).not.toHaveText('Lettere variant i dag:');
});

test('reduceret bevægelse: figurerne står stille, og intet glider ind', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page, '2026-11-17');
  await onboard(page);
  await startSession(page);
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
  await closeIntro(page);
  // One still image of the most typical position, as in »Næste«, not every position side by side
  // next to the target (D54).
  await expect(now(page).locator('.now-stage .figure-still-only')).toHaveCount(1);
  await expect(now(page).locator('.figure-stills')).toHaveCount(0);
  await expect(now(page).locator('.figure-stage')).toHaveCount(0);
  const animation = await now(page)
    .locator('.now-stage')
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(animation).toBe('none');
});
