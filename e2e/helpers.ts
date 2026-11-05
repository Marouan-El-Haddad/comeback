import { expect, type Page } from '@playwright/test';

/** 08:00 in Copenhagen on the given date (winter time, UTC+1). */
export function morning(date: string): Date {
  return new Date(`${date}T07:00:00Z`);
}

/** Opens the app with the clock set to `date` and a fresh profile. */
export async function openApp(page: Page, date: string): Promise<void> {
  await page.clock.install({ time: morning(date) });
  await page.goto('/comeback/');
}

/** Onboarding with the defaults: every week since the start completed, step 1 everywhere. */
export async function onboard(page: Page): Promise<void> {
  await expect(page.getByTestId('onboarding')).toBeVisible();
  for (let i = 0; i < 6; i++) {
    const done = page.getByTestId('onboarding-done');
    if (await done.isVisible()) {
      await done.click();
      break;
    }
    await page.getByTestId('onboarding-next').click();
  }
  await expect(page.getByTestId('today')).toBeVisible();
}

/** Number of events stored in IndexedDB (database 'comeback', store 'events'). */
export async function storedEventCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('comeback');
        open.onerror = () => reject(new Error(String(open.error)));
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('events', 'readonly');
          const count = tx.objectStore('events').count();
          count.onsuccess = () => {
            resolve(count.result);
            db.close();
          };
          count.onerror = () => reject(new Error(String(count.error)));
        };
      }),
  );
}

/** From the traffic light's first screen to the session's first set: wall test (week 1 and light
 * weeks), the warm-up's four timed steps, then question 3. */
export async function throughWarmup(
  page: Page,
  light: 'GRØN – kør passet' | 'GUL – minimumsdosis' = 'GRØN – kør passet',
): Promise<void> {
  const wallTest = page.getByRole('heading', { name: 'Væg-testen' });
  const warmup = page.locator('.session-title', { hasText: /^Opvarmning ·/ });
  await expect(wallTest.or(warmup).first()).toBeVisible();
  if (await wallTest.isVisible()) {
    await page.locator('.session-body input[type="number"]').fill('3');
    await page.getByRole('button', { name: 'Gem målingen' }).click();
  }
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await page.getByRole('button', { name: light }).click();
}

export interface RunStats {
  setsLogged: number;
  measurements: number;
  clicks: number;
  steps: number;
}

/**
 * Drives a running session to its summary like a user who does everything as planned: one tap per
 * set, timers run out by themselves (the clock is fast-forwarded), questions answered as given.
 */
export async function runSessionToSummary(
  page: Page,
  answers: { quality?: boolean; clean?: boolean; feel?: 'Let' | 'Passende' | 'Hårdt' } = {},
): Promise<RunStats> {
  const stats: RunStats = { setsLogged: 0, measurements: 0, clicks: 0, steps: 0 };
  for (let i = 0; i < 400; i++) {
    stats.steps++;
    // The summary ends with its »Færdig« button (the decision list can be empty).
    if (await page.getByTestId('done').isVisible()) return stats;
    const asPlanned = page.getByTestId('as-planned');
    if (await asPlanned.isVisible()) {
      await asPlanned.click();
      stats.clicks++;
      stats.setsLogged++;
      continue;
    }
    // Measurements: start the clock or the 3 minutes, stop it, or type a value, then save.
    for (const name of ['Start 3 minutter', 'Start uret', 'Stop']) {
      const button = page.getByRole('button', { name, exact: true });
      if (await button.isVisible()) {
        await button.click();
        stats.clicks++;
        if (name !== 'Stop') await page.clock.runFor(name === 'Start uret' ? 30_000 : 181_000);
        break;
      }
    }
    const saveMeasure = page.getByRole('button', { name: 'Gem målingen' });
    if (await saveMeasure.isVisible()) {
      const depth = page.getByRole('button', { name: 'Halvvejs' });
      if (await depth.isVisible()) await depth.click();
      const input = page.locator('.session-body input[type="number"]');
      if ((await input.count()) > 0 && (await input.first().inputValue()) === '')
        await input.first().fill('20');
      if (await saveMeasure.isEnabled()) {
        await saveMeasure.click();
        stats.clicks++;
        stats.measurements++;
        continue;
      }
    }
    const finish = page.getByTestId('finish');
    if (await finish.isVisible()) {
      await finish.click();
      stats.clicks++;
      continue;
    }
    const question = page.locator('.session-body h1');
    // allTextContents() does not wait: a rest or timer screen has no heading.
    const title = (await question.allTextContents())[0] ?? '';
    if (/lige høje og hurtige/.test(title) || /Ren runde/.test(title)) {
      const yes = /Ren runde/.test(title) ? (answers.clean ?? true) : (answers.quality ?? true);
      await page.getByRole('button', { name: yes ? 'Ja' : 'Nej', exact: true }).click();
      stats.clicks++;
      continue;
    }
    if (/Hvordan føltes trinnet/.test(title)) {
      await page.getByRole('button', { name: answers.feel ?? 'Passende', exact: true }).click();
      stats.clicks++;
      continue;
    }
    const save = page.getByRole('button', { name: 'Gem', exact: true });
    if (await save.isVisible()) {
      await save.click();
      stats.clicks++;
      continue;
    }
    const startEmom = page.getByRole('button', { name: 'Start EMOM' });
    if (await startEmom.isVisible()) {
      await startEmom.click();
      stats.clicks++;
      continue;
    }
    // A timer is running (rest, hold, EMOM, club sequence, neck): let time pass.
    await page.clock.runFor(5_000);
  }
  throw new Error('The session did not reach its summary');
}
