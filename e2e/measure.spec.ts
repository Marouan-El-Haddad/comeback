import { expect, test, type Page } from '@playwright/test';
import { onboard, openApp, startSimulation, storedEventCount } from './helpers.ts';

// Side plank and balance are measured on both sides (docs/SPEC.md 4.8, DECISIONS.md P59, D49): a
// clock for the left side, then one for the right, each started with »Start uret«; both times are
// shown, and the shorter is saved as the measurement's one number. Friday of programme week 1 has
// both measurements in Styrke B.

test.describe.configure({ timeout: 600_000 });

/** Taps through a session as planned, with every other measurement, until `done` holds. */
async function driveUntil(page: Page, done: () => Promise<boolean>, what: string): Promise<void> {
  for (let i = 0; i < 400; i++) {
    if (await done()) return;
    const asPlanned = page.getByTestId('as-planned');
    if (await asPlanned.isVisible()) {
      await asPlanned.click();
      continue;
    }
    const skip = page.getByRole('button', { name: 'Spring pausen over' });
    if (await skip.isVisible()) {
      await skip.click();
      continue;
    }
    // Other measurements: a stopwatch (hollow, wall sit) or a number (pike push-ups).
    const start = page.getByRole('button', { name: 'Start uret', exact: true });
    if (await start.isVisible()) {
      await start.click();
      await page.clock.runFor(20_500);
      continue;
    }
    const stop = page.getByRole('button', { name: 'Stop', exact: true });
    if (await stop.isVisible()) {
      await stop.click();
      continue;
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
    for (const name of ['Ja', 'Passende']) {
      const answer = page.getByRole('button', { name, exact: true });
      if (await answer.isVisible()) {
        await answer.click();
        break;
      }
    }
    await page.clock.runFor(5_000);
  }
  throw new Error(`Passet nåede ikke ${what}`);
}

const heading = (page: Page, name: string) =>
  page.getByRole('heading', { level: 1, name, exact: true });

/** »Start passet«, a green traffic light and the warm-up's four timers (no wall test on Friday). */
async function startGreen(page: Page): Promise<void> {
  await page.getByTestId('start-session').click();
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
}

/** Both sides with their own clock; returns after the second side is stopped. */
async function measureBothSides(
  page: Page,
  [first, second]: [string, string],
  [left, right]: [number, number],
  screenshot?: string,
): Promise<void> {
  const body = page.locator('.session-body');
  await expect(body.getByRole('heading', { level: 2, name: first })).toBeVisible();
  await expect(body.getByRole('heading', { level: 2, name: second })).toHaveCount(0);
  // Nothing runs before »Start uret«.
  await expect(page.getByTestId('stopwatch')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start uret', exact: true }).click();
  await page.clock.runFor(left * 1000 + 500);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(body.getByLabel(`${first} (sek)`)).toHaveValue(String(left));
  // The second side waits for its own »Start uret«, so you can get ready.
  await expect(body.getByRole('heading', { level: 2, name: second })).toBeVisible();
  await expect(page.getByTestId('stopwatch')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Gem målingen' })).toBeDisabled();
  if (screenshot) await page.screenshot({ path: screenshot, scale: 'css' });
  await page.clock.runFor(10_000);
  await page.getByRole('button', { name: 'Start uret', exact: true }).click();
  await page.clock.runFor(right * 1000 + 500);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(body.getByLabel(`${first} (sek)`)).toHaveValue(String(left));
  await expect(body.getByLabel(`${second} (sek)`)).toHaveValue(String(right));
}

/** The values of the measurement in IndexedDB (database 'comeback', store 'events'). */
async function storedValues(page: Page, measureId: string): Promise<number[]> {
  return page.evaluate(
    (id) =>
      new Promise<number[]>((resolve, reject) => {
        const open = indexedDB.open('comeback');
        open.onerror = () => reject(new Error(String(open.error)));
        open.onsuccess = () => {
          const db = open.result;
          const all = db.transaction('events', 'readonly').objectStore('events').getAll();
          all.onsuccess = () => {
            const events = all.result as Array<{
              type: string;
              measureId?: string;
              value?: number;
            }>;
            resolve(
              events
                .filter((e) => e.type === 'measurement_logged' && e.measureId === id)
                .map((e) => e.value ?? -1),
            );
            db.close();
          };
          all.onerror = () => reject(new Error(String(all.error)));
        };
      }),
    measureId,
  );
}

test('sideplanke og balance i tidsmaskinen: venstre, så højre, og den korteste tid gemmes @date', async ({
  page,
}) => {
  await openApp(page, '2026-11-06');
  await onboard(page);
  const stored = await storedEventCount(page);
  // Friday of programme week 1: Styrke B with its measurements.
  await startSimulation(page, '2026-11-13');
  await expect(page.getByTestId('main-card')).toContainText('Styrke B');
  await startGreen(page);

  await driveUntil(page, () => heading(page, 'Sideplanke').isVisible(), 'sideplanken');
  await expect(page.locator('.session-body .step-kicker')).toContainText('første sæt i Mave side');
  await measureBothSides(page, ['Venstre side', 'Højre side'], [40, 35]);
  await expect(page.locator('.session-body')).toContainText('Den korteste tid gemmes: 35 sek.');
  // A time can be corrected; the shorter one is still what is saved.
  await page.getByLabel('Venstre side (sek)').fill('30');
  await expect(page.locator('.session-body')).toContainText('Den korteste tid gemmes: 30 sek.');
  await page.getByRole('button', { name: 'Gem målingen' }).click();
  await expect(heading(page, 'Sideplanke')).toHaveCount(0);

  await driveUntil(page, () => heading(page, 'Balance').isVisible(), 'balancen');
  await measureBothSides(page, ['Venstre ben', 'Højre ben'], [30, 20]);
  await expect(page.locator('.session-body')).toContainText('Den korteste tid gemmes: 20 sek.');
  await page.getByRole('button', { name: 'Gem målingen' }).click();
  await expect(page.getByTestId('finish')).toBeVisible();

  // The time machine never writes to storage (SPEC 3.7).
  expect(await storedEventCount(page)).toBe(stored);
});

test('sideplanken gemmer den korteste af de to tider som målingens ene tal', async ({ page }) => {
  await openApp(page, '2026-11-13');
  await onboard(page);
  await expect(page.getByTestId('main-card')).toContainText('Styrke B');
  await startGreen(page);
  await driveUntil(page, () => heading(page, 'Sideplanke').isVisible(), 'sideplanken');
  await measureBothSides(
    page,
    ['Venstre side', 'Højre side'],
    [40, 35],
    'screenshots/maaling-hoejre-side.png',
  );
  await expect(page.locator('.session-body')).toContainText('Den korteste tid gemmes: 35 sek.');
  await page.screenshot({ path: 'screenshots/maaling-pr-side.png', scale: 'css' });
  await page.getByRole('button', { name: 'Gem målingen' }).click();
  await expect(heading(page, 'Sideplanke')).toHaveCount(0);
  await expect.poll(() => storedValues(page, 'side_plank')).toEqual([35]);
});
