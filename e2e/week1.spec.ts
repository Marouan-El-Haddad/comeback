import { expect, test, type Page } from '@playwright/test';
import {
  onboard,
  openApp,
  runSessionToSummary,
  startSession,
  stillFigures,
  storedEventCount,
} from './helpers.ts';

// Whole sessions with Firefox' JIT off take a while; the figures are drawn as stills.
test.describe.configure({ timeout: 300_000 });
test.beforeEach(async ({ page }) => stillFigures(page));

// Programme week 1 (from Monday 9 November): Styrke A with the zero-point measurements, the motor
// with base-check and Styrke B with its measurements, as the program will run from 10/11.

async function startStrength(page: Page): Promise<void> {
  await startSession(page);
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
}

async function measureCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('comeback');
        open.onerror = () => reject(new Error(String(open.error)));
        open.onsuccess = () => {
          const db = open.result;
          const all = db.transaction('events', 'readonly').objectStore('events').getAll();
          all.onsuccess = () => {
            resolve(
              (all.result as Array<{ type: string }>).filter((e) => e.type === 'measurement_logged')
                .length,
            );
            db.close();
          };
        };
      }),
  );
}

test('uge 1 tirsdag: Styrke A med væg-test, push-ups og bord-rows som første sæt, E1 og nakke', async ({
  page,
}) => {
  await openApp(page, '2026-11-10');
  await onboard(page);
  await expect(page.locator('.today-head .week')).toHaveText('Uge 1 · Fundament');
  const card = page.getByTestId('main-card');
  await expect(card).toContainText('Måling: Væg-testen');
  await expect(card).toContainText('Pres trin 1 · 1 × 6 + måling');
  await expect(card).toContainText('Burpees EMOM E1 · 4 × 3');
  await startStrength(page);
  // The wall test comes before the warm-up.
  await expect(page.getByRole('heading', { name: 'Væg-testen' })).toBeVisible();
  await page.locator('.session-body input[type="number"]').fill('3');
  await expect(page.getByText('Målbrættet: Basis')).toBeVisible();
  await page.getByRole('button', { name: 'Gem målingen' }).click();
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
  const stats = await runSessionToSummary(page);
  expect(stats.measurements).toBe(2); // push-ups and table rows (the wall test was before)
  expect(await measureCount(page)).toBe(3);
  await page.getByTestId('done').click();
  await expect(page.locator('.main-card.done')).toContainText('Logget i dag (grønt)');
});

test('uge 1 torsdag: motor med base-check og distance', async ({ page }) => {
  await openApp(page, '2026-11-12');
  await onboard(page);
  await expect(page.getByTestId('main-card')).toContainText('Motor');
  await expect(page.getByTestId('main-card')).toContainText('Rolig base, 30 min');
  await startSession(page);
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
  await page.getByRole('button', { name: 'Start uret' }).click();
  await page.clock.runFor(30 * 60_000 + 5_000);
  await expect(page.getByRole('heading', { name: 'Base-check' })).toBeVisible();
  await page.locator('.session-body input[type="number"]').fill('5200');
  await page.getByRole('button', { name: 'Gem målingen' }).click();
  await page.getByTestId('finish').click();
  await expect(page.getByTestId('done')).toBeVisible();
  await page.getByTestId('done').click();
  await expect(page.locator('.main-card.done')).toContainText('Logget i dag (grønt)');
});

test('uge 1 fredag: Styrke B med pike, hollow, sideplanke, wall sit og balance', async ({
  page,
}) => {
  await openApp(page, '2026-11-13');
  await onboard(page);
  await expect(page.locator('.today-head .date')).toHaveText('Fredag 13. november');
  await expect(page.getByTestId('main-card')).toContainText('Styrke B');
  const before = await storedEventCount(page);
  await startStrength(page);
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
  const stats = await runSessionToSummary(page, { clean: true, feel: 'Let' });
  // Pike, hollow, side plank, wall sit and balance.
  expect(stats.measurements).toBe(5);
  expect(await storedEventCount(page)).toBeGreaterThan(before + 20);
});

test('Styrke B med wall sit W3: runder med timer og »Rene runder?«', async ({ page }) => {
  await openApp(page, '2026-11-20');
  await expect(page.getByTestId('onboarding')).toBeVisible();
  for (let i = 0; i < 3; i++) await page.getByTestId('onboarding-next').click();
  // The step page: Wall sit two steps up (W1 → W3).
  const wall = page.locator('[data-track="wallsit"]');
  await wall.getByRole('button', { name: 'Wall sit: sværere trin' }).click();
  await wall.getByRole('button', { name: 'Wall sit: sværere trin' }).click();
  await expect(wall).toContainText('Trin W3 · Wall sit til squats');
  await page.getByTestId('onboarding-next').click(); // the week-1 measurements page
  await page.getByTestId('onboarding-done').click();
  await expect(page.getByTestId('main-card')).toContainText('Wall sit trin W3 · 3 runder');
  await startStrength(page);
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
  const stats = await runSessionToSummary(page);
  expect(stats.clicks).toBeGreaterThan(10);
  await expect(page.locator('.logged')).toContainText('Wall sit trin W3: udført (plan 2–3 runder)');
});
