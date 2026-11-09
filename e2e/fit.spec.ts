import { expect, test, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { closeIntro, onboard, openApp, startSession, startSimulation } from './helpers.ts';

// What must be read on a session's screen stands above the fixed actions, without rolling, on the
// phone's 414 × 847 (D51, D59; P4 review M1, M2, L1, L2): the intro card's »Gør klar« and first step,
// the pause's »Gør klar« under »Næste«, and the last cue of »Nu« – through the whole of Styrke A on
// Tuesday 10/11 and Styrke B on Friday 13/11, the first week with its measurements. In the time
// machine its banner takes 72 px of the window, and there the cues of »Nu« still stand over »Næste«.
// The figures move as on the phone while a screen is measured (a still image is shorter); the clock
// is fast-forwarded with still figures. And no phase under a figure leaves the card (P2 review M9).

// Four whole sessions: side by side in their own workers.
test.describe.configure({ mode: 'parallel', timeout: 900_000 });

/** What is measured on each kind of screen. */
interface Watch {
  intro?: readonly string[];
  rest?: readonly string[];
  now?: readonly string[];
}

const ALL: Watch = {
  intro: ['.intro-card .get-ready', '.intro-card .intro-steps li:first-child'],
  rest: ['.rest .next-up .get-ready'],
  now: ['.now-cues li:last-child', '.session-body .field input'],
};

const CUES: Watch = { now: ['.now-cues li:last-child'] };

/** The parts named by `selectors` on the screen now that end under the fixed actions, in px. */
function underActions(page: Page, selectors: readonly string[]): Promise<string[]> {
  return page.evaluate((selectors) => {
    const blocks = [...document.querySelectorAll('.session .fixed-actions')]
      .map((el) => el.getBoundingClientRect())
      .filter((box) => box.height > 0);
    if (blocks.length === 0) return [];
    const top = Math.min(...blocks.map((box) => box.top));
    const found: string[] = [];
    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        const box = el.getBoundingClientRect();
        if (box.height === 0 || box.bottom <= top + 0.5) continue;
        const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
        found.push(`${selector} ${Math.round(box.bottom - top)} px under: »${text}«`);
      }
    }
    return found;
  }, selectors);
}

/** The texts of what `selector` finds, on one line. */
async function texts(page: Page, selector: string): Promise<string> {
  return (await page.locator(selector).allTextContents()).join(' ');
}

/** The screen's name for a problem: the exercise in hand, next or on the intro card. */
async function screenName(page: Page): Promise<string> {
  for (const selector of ['.intro-card h1', '.next-up .next-title', '.session .set-name']) {
    const text = (await page.locator(selector).allTextContents())[0];
    if (text) return text.trim();
  }
  return '';
}

/**
 * Taps through a running session from the traffic light to its summary as planned: intro cards are
 * measured and closed with »Luk«, pauses measured and skipped, sets measured and logged with one
 * tap, timers measured once and run by the clock. Returns every part that ended under the actions.
 */
async function driveMeasuring(
  page: Page,
  watch: Watch,
  until?: () => Promise<boolean>,
): Promise<{ problems: string[]; seen: Record<string, number> }> {
  const problems: string[] = [];
  const seen: Record<string, number> = {};
  let lastNow = '';
  const look = async (kind: keyof Watch) => {
    seen[kind] = (seen[kind] ?? 0) + 1;
    const selectors = watch[kind];
    if (!selectors) return;
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const name = await screenName(page);
    for (const problem of await underActions(page, selectors)) problems.push(`${name}: ${problem}`);
  };
  const fast = () => page.emulateMedia({ reducedMotion: 'reduce' });

  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  for (let i = 0; i < 800; i++) {
    if (await page.getByTestId('done').isVisible()) return { problems, seen };
    if (until && (await until())) return { problems, seen };
    if (await page.getByTestId('intro').isVisible()) {
      await look('intro');
      const startEmom = page.getByRole('button', { name: 'Start EMOM' });
      if (await startEmom.isVisible()) {
        await startEmom.click();
        await look('now');
        await fast();
        for (let s = 0; s < 80 && !(await page.getByText('Alle minutter rene?').isVisible()); s++)
          await page.clock.runFor(5_000);
        continue;
      }
      await closeIntro(page);
      continue;
    }
    if (await page.locator('.session .rest').isVisible()) {
      await look('rest');
      await page.getByRole('button', { name: 'Spring pausen over' }).click();
      continue;
    }
    const asPlanned = page.getByTestId('as-planned');
    if (await asPlanned.isVisible()) {
      await look('now');
      await asPlanned.click();
      continue;
    }
    // A measurement: its field or clock in »Nu«, then a value and »Gem målingen«.
    const save = page.getByRole('button', { name: 'Gem målingen' });
    if (await save.isVisible()) {
      const key = `m ${await texts(page, '.session .set-name')}`;
      if (key !== lastNow) {
        lastNow = key;
        await look('now');
      }
      await fast();
      let clocked = false;
      for (const name of ['Start 3 minutter', 'Start uret', 'Stop']) {
        const button = page.getByRole('button', { name, exact: true });
        if (await button.isVisible()) {
          await button.click();
          if (name !== 'Stop') await page.clock.runFor(name === 'Start uret' ? 20_000 : 181_000);
          clocked = true;
          break;
        }
      }
      if (clocked) continue;
      const depth = page.getByRole('button', { name: 'Halvvejs' });
      if (await depth.isVisible()) await depth.click();
      const input = page.locator('.session-body input[type="number"]');
      if ((await input.count()) > 0 && (await input.first().inputValue()) === '')
        await input.first().fill('20');
      if (await save.isEnabled()) await save.click();
      continue;
    }
    const finish = page.getByTestId('finish');
    if (await finish.isVisible()) {
      await finish.click();
      continue;
    }
    // A timer in »Nu« (the warm-up, a hold, the club sequence, a round, the neck): measured once.
    if (await page.locator('.session .stack.now').isVisible()) {
      const key = `${await texts(page, '.session-title')} ${await texts(page, '.session .set-name')}`;
      if (key !== lastNow) {
        lastNow = key;
        await look('now');
        await fast();
      }
    }
    let answered = false;
    for (const name of ['GRØN – kør passet', 'Gem', 'Ja', 'Passende']) {
      const button = page.getByRole('button', { name, exact: true });
      if (await button.isVisible()) {
        await fast();
        // The answer is saved before the screen changes: the same button can be on its way out.
        await button.click({ timeout: 5_000 }).catch(() => undefined);
        answered = true;
        break;
      }
    }
    if (answered) continue;
    await fast();
    await page.clock.runFor(5_000);
  }
  throw new Error('Passet nåede ikke opsummeringen');
}

/** I dag → »Dagens pas« → »Start passet«, on the given day, with or without the time machine. */
async function openSession(page: Page, date: string, banner: boolean): Promise<void> {
  if (banner) {
    await openApp(page, '2026-11-06');
    await onboard(page);
    await startSimulation(page, date);
  } else {
    await openApp(page, date);
    await onboard(page);
  }
  await startSession(page);
  await expect(page.getByRole('heading', { name: 'Før du starter – 10 sekunder' })).toBeVisible();
}

for (const [day, date, kind] of [
  ['tirsdag', '2026-11-10', 'Styrke A'],
  ['fredag', '2026-11-13', 'Styrke B'],
] as const) {
  test(`${kind} ${day}: introkortets trin, pausens »Gør klar« og cues står over bundblokken`, async ({
    page,
  }) => {
    await openSession(page, date, false);
    const { problems, seen } = await driveMeasuring(page, ALL);
    expect(problems).toEqual([]);
    // Every kind of screen was there to be measured.
    expect(seen.intro ?? 0).toBeGreaterThan(8);
    expect(seen.rest ?? 0).toBeGreaterThan(8);
    expect(seen.now ?? 0).toBeGreaterThan(15);
  });

  test(`${kind} ${day} i tidsmaskinen: begge cues i »Nu« står over »Næste«`, async ({ page }) => {
    await openSession(page, date, true);
    const { problems, seen } = await driveMeasuring(page, CUES);
    expect(problems).toEqual([]);
    expect(seen.now ?? 0).toBeGreaterThan(15);
  });
}

// ---------------------------------------------------------------------------------------------
// A phase under the figure never leaves the card (P2 review M9, M13; D61)
// ---------------------------------------------------------------------------------------------

/** Every phase's text in the explanations, with the card it is on. */
function phaseLabels(): Array<{ id: string; label: string }> {
  const dir = 'content/explain';
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .flatMap((file) => {
      const data = JSON.parse(readFileSync(join(dir, file), 'utf8')) as {
        items: Array<{ id: string; movements?: Array<{ phases?: Array<{ label: string }> }> }>;
      };
      return data.items.flatMap((item) =>
        (item.movements ?? []).flatMap((m) =>
          (m.phases ?? []).map((ph) => ({ id: item.id, label: ph.label })),
        ),
      );
    });
}

const LABELS = phaseLabels();

/** The longest phase in the content, by its number of characters. */
const LONGEST = LABELS.reduce((a, b) => (b.label.length > a.label.length ? b : a));

/** Every card with a phase of 20 characters or more: the ones that were wider than the screen. */
const LONG_CARDS = [...new Set(LABELS.filter((l) => l.label.length >= 20).map((l) => l.id))];

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

interface Track {
  short: string;
  /** A step's id is the card's (»burpee_skill.V1«); its key is what the list shows (»1«). */
  steps: Array<{ id: string; key: string; name: string }>;
}

/** A card from Stiger: a ladder's or »Øvrige«'s step, a measurement or a routine's item. */
async function openCardFromLadders(page: Page, id: string): Promise<void> {
  const [subject = '', key = ''] = id.split('.');
  let row: string;
  let title: string;
  if (subject === 'measures') {
    const { measures } = readJson<{ measures: Array<{ id: string; name: string }> }>(
      'program/measures.json',
    );
    row = 'Målinger';
    title = measures.find((m) => m.id === key)?.name ?? key;
  } else if (subject === 'warmup' || subject === 'os') {
    const routine = readJson<Array<{ id: string; name: string; items: Track['steps'] }>>(
      'program/routines.json',
    ).find((r) => r.id === subject);
    row = routine?.name ?? subject;
    title = `${key}. ${routine?.items.find((i) => i.key === key)?.name ?? ''}`;
  } else {
    const track = readJson<Track>(join('program/tracks', `${subject}.json`));
    const step = track.steps.find((s) => s.id === id);
    row = `${track.short} · trin`;
    title = `${step?.key ?? key}. ${step?.name ?? ''}`;
  }
  await page.getByRole('button', { name: 'Stiger', exact: true }).click();
  // A card that cannot be found fails at once, not at the end of the test's time.
  await page
    .locator('.ladder-row, .other-row', { hasText: row })
    .first()
    .click({ timeout: 10_000 });
  await page.locator('.step-open', { hasText: title }).first().click({ timeout: 10_000 });
  await expect(page.locator('.exercise-card')).toBeVisible();
}

/**
 * The page does not roll sideways on 414 px, and every phase on the screen ends inside the 16 px
 * safe zone and inside its own figure (in »Nu« the figure's column beside the target or the clock).
 */
async function phasesInside(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const right = root.clientWidth - 16;
    const found: string[] = [];
    if (root.scrollWidth > root.clientWidth)
      found.push(`siden ruller ${root.scrollWidth - root.clientWidth} px vandret`);
    for (const el of document.querySelectorAll('.figure-phase')) {
      const box = el.getBoundingClientRect();
      if (box.width === 0) continue;
      const text = el.textContent ?? '';
      if (box.right > right + 0.5)
        found.push(`»${text}« ender ${Math.round(box.right - right)} px uden for kortet`);
      const figure = el.closest('.figure')?.getBoundingClientRect();
      if (figure && (box.right > figure.right + 0.5 || box.left < figure.left - 0.5))
        found.push(`»${text}« står uden for sin figur`);
    }
    return found;
  });
}

/** Waits until the figure in »Nu« shows `label` as its running phase. */
async function untilPhase(page: Page, label: string): Promise<void> {
  const current = page.locator('.session .figure-current');
  for (let i = 0; i < 300 && (await current.innerText()).trim() !== label; i++)
    await page.clock.runFor(100);
  await expect(current).toHaveText(label);
}

test('kort med lange faser er ikke bredere end skærmen, heller ikke som stillbilleder', async ({
  page,
}) => {
  // The cards from the figure reviews (M9, M13) are among them: pike, the neck's N3 and N4, balance,
  // V4, tuck jumps and wall sit W3 and W5.
  for (const id of ['measures.pike', 'neck.N3', 'measures.balance', 'wallsit.W3'])
    expect(LONG_CARDS).toContain(id);
  await openApp(page, '2026-11-17');
  await onboard(page);
  const problems: string[] = [];
  for (const id of LONG_CARDS) {
    await openCardFromLadders(page, id);
    await expect(page.locator('.exercise-card .figure-phase').first()).toBeVisible();
    for (const problem of await phasesInside(page)) problems.push(`${id}: ${problem}`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.exercise-card .figure-stills').first()).toBeVisible();
    for (const problem of await phasesInside(page))
      problems.push(`${id} (stillbilleder): ${problem}`);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('.exercise-card').getByRole('button', { name: 'Tilbage' }).first().click();
    await page.getByRole('button', { name: 'Tilbage', exact: true }).click();
  }
  expect(problems).toEqual([]);
});

test('den længste fase i indholdet står inden for sin figur i »Nu«, mens den kører', async ({
  page,
}) => {
  const [trackId = ''] = LONGEST.id.split('.');
  const track = readJson<Track>(join('program/tracks', `${trackId}.json`));
  const key = track.steps.find((s) => s.id === LONGEST.id)?.key ?? '';
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page, '2026-11-17');
  // The phase-in with the longest phase's step on its ladder (tuck jumps: power legs, step 5).
  const harder = track.steps.findIndex((s) => s.id === LONGEST.id);
  for (let i = 0; i < 8; i++) {
    if (await page.getByRole('heading', { name: 'Dit trin på hver stige' }).isVisible()) {
      const button = page.getByRole('button', { name: `${track.short}: sværere trin` });
      for (let s = 0; s < harder; s++) await button.click();
    }
    const done = page.getByTestId('onboarding-done');
    if (await done.isVisible()) {
      await done.click();
      break;
    }
    await page.getByTestId('onboarding-next').click();
  }
  await expect(page.getByTestId('main-card')).toContainText(`${track.short} trin ${key}`);
  // Styrke A: the power step is the first exercise after the warm-up.
  await startSession(page);
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
  await closeIntro(page);
  await expect(page.getByTestId('as-planned')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await untilPhase(page, LONGEST.label);
  expect(await phasesInside(page)).toEqual([]);
});

test('pike-målingen fredag: »Hovedet ned foran hænderne« står inden for sin figur i »Nu«', async ({
  page,
}) => {
  // The measurement's figure stands beside the programme's text, in half the width (D54).
  await openSession(page, '2026-11-13', false);
  await driveMeasuring(page, {}, async () =>
    (await page.locator('.session .set-name').allTextContents()).includes('Pike push-ups'),
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await untilPhase(page, 'Hovedet ned foran hænderne');
  expect(await phasesInside(page)).toEqual([]);
});
