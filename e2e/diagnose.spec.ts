import { expect, test, type Page } from '@playwright/test';
import { onboard } from './helpers.ts';

// Diagnose (Mere → Om → Diagnose) counts only a clean start from the icon (docs/SPEC.md 7,
// docs/DECISIONS.md D34): the installed app (display-mode standalone), a new page load (navigation
// type »navigate«), I dag as the first screen, and neither the onboarding nor the time machine in
// use before I dag is on screen. Playwright cannot install the app, so the test – not the app –
// makes matchMedia report standalone. No page.clock here: it fakes the performance entries.

const STARTUP_KEY = 'comeback.startup';
const MS = /^\d{1,3}(\.\d{3})* ms$/;

/** matchMedia('(display-mode: standalone)') matches, as in the app opened from its icon. */
async function pretendInstalled(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      real(query.includes('display-mode: standalone') ? 'all' : query);
  });
}

/** Closed and opened from the icon: a new page load of the manifest's start URL. */
async function openFromIcon(page: Page): Promise<void> {
  await page.goto('about:blank');
  await page.goto('/comeback/?source=pwa');
  await expect(page.getByTestId('today')).toBeVisible();
}

async function openDiagnose(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Mere', exact: true }).click();
  await page.getByRole('button', { name: 'Om' }).click();
  await page.getByTestId('diagnose-open').click();
  await expect(page.getByTestId('diagnose')).toBeVisible();
}

/** The long press on the version (2 seconds, real time) and »Start simulering«. */
async function startTimeMachine(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Mere', exact: true }).click();
  await page.getByRole('button', { name: 'Om' }).click();
  await page.getByTestId('version').hover();
  await page.mouse.down();
  await page.waitForTimeout(2_300);
  await page.mouse.up();
  await expect(page.getByTestId('timemachine')).toBeVisible();
  await page.getByTestId('sim-start').click();
  await expect(page.locator('.banner.sim')).toBeVisible();
}

/** Clean starts kept in localStorage. */
async function storedStarts(page: Page): Promise<number> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown[]).length : 0;
  }, STARTUP_KEY);
}

test('en ren opstart fra ikonet giver en måling; indfasning og genindlæsning giver ingen', async ({
  page,
}) => {
  await pretendInstalled(page);
  await page.goto('/comeback/?source=pwa');
  await onboard(page);
  await openDiagnose(page);
  await expect(page.getByTestId('startup-this')).toHaveText(
    'Denne opstart tæller ikke: indfasningen var i brug.',
  );
  await expect(page.getByTestId('startup-none')).toHaveText(
    'Ingen måling endnu. Luk appen helt, og åbn den fra ikonet.',
  );
  // The mirror is written 1.5 seconds after a save (D30); Diagnose shows its status.
  await expect(page.getByTestId('diag-Spejl')).toContainText(/^\d+ hændelser · gemt kl\. /);

  await page.reload();
  await expect(page.getByTestId('today')).toBeVisible();
  await openDiagnose(page);
  await expect(page.getByTestId('startup-this')).toHaveText(
    'Denne opstart tæller ikke: genindlæsning.',
  );
  await expect(page.getByTestId('startup-none')).toBeVisible();
  expect(await storedStarts(page)).toBe(0);

  await openFromIcon(page);
  await expect.poll(() => storedStarts(page)).toBe(1);
  await openDiagnose(page);
  await expect(page.getByTestId('startup-this')).toHaveText('Denne opstart er talt med.');
  await expect(page.getByTestId('startup-none')).toHaveCount(0);
  await expect(page.getByTestId('startup-median')).toHaveText('Median af 1');
  for (const id of ['paint-last', 'today-last', 'paint-median', 'today-median']) {
    await expect(page.getByTestId(`startup-${id}`)).toHaveText(MS);
  }
  await expect(page.getByTestId('startup-when')).toContainText('Seneste: ');

  await page.reload();
  await expect(page.getByTestId('today')).toBeVisible();
  await openDiagnose(page);
  await expect(page.getByTestId('startup-this')).toHaveText(
    'Denne opstart tæller ikke: genindlæsning.',
  );
  expect(await storedStarts(page)).toBe(1);

  await openFromIcon(page);
  await expect.poll(() => storedStarts(page)).toBe(2);
  await openDiagnose(page);
  await expect(page.getByTestId('startup-median')).toHaveText('Median af 2');
});

test('tidsmaskinen giver ingen måling', async ({ page }) => {
  await pretendInstalled(page);
  await page.goto('/comeback/?source=pwa');
  // The phone's case (docs/runs/NAT-2-PHONE.md): onboarding, then the time machine in one load.
  await onboard(page);
  await startTimeMachine(page);
  await page.getByRole('button', { name: 'I dag', exact: true }).click();
  await expect(page.getByTestId('today')).toBeVisible();
  await openDiagnose(page);
  await expect(page.getByTestId('startup-none')).toBeVisible();
  await page.getByTestId('sim-exit').click();
  await expect(page.locator('.banner.sim')).toHaveCount(0);
  expect(await storedStarts(page)).toBe(0);

  // A clean start, then the time machine: only the clean start is kept.
  await openFromIcon(page);
  await expect.poll(() => storedStarts(page)).toBe(1);
  await startTimeMachine(page);
  await page.getByTestId('sim-next').click();
  await page.getByRole('button', { name: 'I dag', exact: true }).click();
  await expect(page.getByTestId('today')).toBeVisible();
  await openDiagnose(page);
  await expect(page.getByTestId('startup-median')).toHaveText('Median af 1');
  await page.getByTestId('sim-exit').click();
  await page.getByRole('button', { name: 'I dag', exact: true }).click();
  await expect(page.getByTestId('today')).toBeVisible();
  expect(await storedStarts(page)).toBe(1);
});

test('Diagnose med syntetiske målinger (skærmbillede)', async ({ page }) => {
  await pretendInstalled(page);
  await page.goto('/comeback/?source=pwa');
  await onboard(page);
  // Five made-up clean starts, oldest first.
  const times = [
    ['2026-11-01T18:02:11.000Z', 3712, 3790],
    ['2026-11-02T06:45:40.000Z', 3655, 3721],
    ['2026-11-03T19:12:05.000Z', 3830, 3902],
    ['2026-11-04T07:30:52.000Z', 3540, 3608],
    ['2026-11-05T20:40:18.000Z', 3767, 3833],
  ].map(([at, paint, today]) => ({ at, paint, today }));
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: STARTUP_KEY,
    value: JSON.stringify(times),
  });
  await openDiagnose(page);
  await expect(page.getByTestId('startup-median')).toHaveText('Median af 5');
  await expect(page.getByTestId('startup-paint-last')).toHaveText('3.767 ms');
  await expect(page.getByTestId('startup-today-last')).toHaveText('3.833 ms');
  await expect(page.getByTestId('startup-paint-median')).toHaveText('3.712 ms');
  await expect(page.getByTestId('startup-today-median')).toHaveText('3.790 ms');
  await expect(page.getByTestId('startup-when')).toHaveText('Seneste: 5. november kl. 21.40');
  await expect(page.getByTestId('diag-Spejl')).toContainText(/^\d+ hændelser · gemt kl\. /);
  // Scrolled to the bottom as on the phone (a full-page shot would put the fixed tab bar mid-page).
  await page.getByTestId('startup-this').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'screenshots/diagnose.png', scale: 'css' });
});
