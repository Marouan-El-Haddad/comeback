import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { a11yProblems, SESSION_RULES } from './a11y.ts';
import {
  closeIntro,
  onboard,
  openApp,
  runSessionToSummary,
  startSession,
  stillFigures,
  storedEventCount,
  throughWarmup,
} from './helpers.ts';

// Milestone 2 flows (docs/PLAN.md): onboarding → I dag → Styrke A green and yellow with »Som
// planlagt« → summary with explanation; Open & Strong without a touch; export/import; the time
// machine never writes to storage. Timers are simulated with page.clock.

const TUESDAY_WEEK2 = '2026-11-17';

// Whole sessions with Firefox' JIT off take a while: as long as in session.spec.ts, so a full suite
// under load does not run out of time on the last step.
test.describe.configure({ timeout: 600_000 });

test('onboarding → I dag → Styrke A grøn start til slut med »Som planlagt« → opsummering', async ({
  page,
}) => {
  await openApp(page, TUESDAY_WEEK2);
  await onboard(page);
  await expect(page.locator('.today-head .date')).toHaveText('Tirsdag 17. november');
  await expect(page.locator('.today-head .week')).toHaveText('Uge 2 · Fundament');
  await expect(page.getByTestId('main-card')).toContainText('Styrke A');
  await expect(page.getByTestId('main-card')).toContainText('Pres trin 1 · 3 × 6');
  await page.screenshot({ path: 'screenshots/i-dag.png', scale: 'css', animations: 'disabled' });

  await startSession(page);
  await expect(page.getByRole('heading', { name: 'Før du starter – 10 sekunder' })).toBeVisible();
  await page.screenshot({
    path: 'screenshots/trafiklys.png',
    scale: 'css',
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await expect(page.getByRole('heading', { name: 'Spørgsmål 3' })).toBeVisible();
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();

  // First set: power legs, one tap logs it (SK2). Its intro card comes first (D44).
  await closeIntro(page);
  await expect(page.getByTestId('as-planned')).toBeVisible();
  await page.screenshot({
    path: 'screenshots/pas-skridt.png',
    scale: 'css',
    animations: 'disabled',
  });
  const before = await storedEventCount(page);
  await page.getByTestId('as-planned').click();
  await expect.poll(() => storedEventCount(page)).toBe(before + 1);
  await expect(page.getByText('Spring pausen over')).toBeVisible();
  await page.clock.runFor(30_000);
  await page.screenshot({
    path: 'screenshots/pausetimer.png',
    scale: 'css',
    animations: 'disabled',
  });
  await stillFigures(page);

  const stats = await runSessionToSummary(page, { quality: true, clean: true, feel: 'Passende' });
  expect(stats.setsLogged).toBeGreaterThan(20);
  const decisions = page.getByTestId('decisions');
  await expect(decisions).toContainText('Pres: 7 reps pr. sæt næste gang.');
  expect(await a11yProblems(page, '.session', SESSION_RULES)).toEqual([]);
  await page.screenshot({
    path: 'screenshots/opsummering.png',
    scale: 'css',
    animations: 'disabled',
    fullPage: true,
  });
  await page.getByTestId('done').click();
  await expect(page.getByTestId('main-card').or(page.locator('.main-card.done'))).toContainText(
    'Logget i dag (grønt)',
  );
});

test('Styrke A gul: kun par 1 og 2 med 2 sæt, opsummeringen siger, at det tæller', async ({
  page,
}) => {
  await stillFigures(page);
  await openApp(page, TUESDAY_WEEK2);
  await onboard(page);
  await startSession(page);
  await page.getByRole('button', { name: 'Nej' }).first().click();
  await page.getByRole('button', { name: 'GUL – start opvarmningen' }).click();
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await page.getByRole('button', { name: 'GUL – minimumsdosis' }).click();
  const stats = await runSessionToSummary(page);
  // Pres 2, træk 2 × 2 sider, ben 2 × 2 sider, bagkæde 2 × 2 sider.
  expect(stats.setsLogged).toBe(2 + 4 + 4 + 4);
  await expect(page.getByText('Gult pas tæller som gennemført.')).toBeVisible();
});

test('»Som planlagt« er ét tryk; en afvigelse er to tryk (SK2)', async ({ page }) => {
  await stillFigures(page);
  await openApp(page, TUESDAY_WEEK2);
  await onboard(page);
  await startSession(page);
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
  await closeIntro(page);
  const start = await storedEventCount(page);
  await page.getByTestId('as-planned').click();
  await expect.poll(() => storedEventCount(page)).toBe(start + 1);
  await page.getByText('Spring pausen over').click();
  // A power set that differs: one tap on −, one on »Log« (power has no reserve, R-POWER).
  await page.getByRole('button', { name: 'Færre' }).click();
  await expect(page.getByTestId('as-planned')).toHaveText('Log 2 reps');
  await page.getByTestId('as-planned').click();
  await expect.poll(() => storedEventCount(page)).toBe(start + 2);
});

test('Open & Strong kører fra start til slut uden tryk', async ({ page }) => {
  await openApp(page, TUESDAY_WEEK2);
  await onboard(page);
  await page.getByTestId('os-start').click();
  await page.getByTestId('os-go').click();
  await expect(page.locator('.session-title')).toContainText('1/6');
  for (let i = 0; i < 80; i++) {
    if (await page.getByTestId('os-close').isVisible()) break;
    await page.clock.runFor(5_000);
  }
  await expect(page.getByText('Denne uge: 1 af 7.')).toBeVisible();
  await page.getByTestId('os-close').click();
  await expect(page.locator('.os-row')).toContainText('Denne uge: 1 af 7');
});

test('eksport og import genskaber dataene', async ({ page }, info) => {
  await openApp(page, TUESDAY_WEEK2);
  await onboard(page);
  const count = await storedEventCount(page);
  await page.getByRole('button', { name: 'Mere' }).click();
  await page.getByRole('button', { name: 'Backup' }).click();
  const download = page.waitForEvent('download');
  await page.getByTestId('export').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('comeback-backup-2026-11-17.json');
  const path = info.outputPath('backup.json');
  await file.saveAs(path);
  const exported = JSON.parse(readFileSync(path, 'utf8')) as { app: string; events: unknown[] };
  expect(exported.app).toBe('comeback');
  expect(exported.events).toHaveLength(count);
  await expect(page.getByTestId('last-backup')).toContainText('17. november');

  await page.getByTestId('import-file').setInputFiles(path);
  await expect(page.getByTestId('import-preview')).toContainText(`${count} hændelser`);
  await page.getByTestId('import-replace').click();
  await expect(page.getByRole('status')).toContainText('Data erstattet');
  await expect.poll(() => storedEventCount(page)).toBe(count);
});

test('tidsmaskinen: et pas i simuleringen ændrer ikke lagerets antal hændelser', async ({
  page,
}) => {
  await stillFigures(page);
  await openApp(page, '2026-11-06');
  await onboard(page);
  const count = await storedEventCount(page);
  await page.getByRole('button', { name: 'Mere' }).click();
  await page.getByRole('button', { name: 'Om' }).click();
  const version = page.getByTestId('version');
  await version.hover();
  await page.mouse.down();
  await page.clock.runFor(2_100);
  await page.mouse.up();
  await expect(page.getByTestId('timemachine')).toBeVisible();
  await page.getByTestId('sim-date').fill('2026-11-10');
  await page.getByTestId('sim-start').click();
  await expect(page.locator('.banner.sim')).toContainText('SIMULERET · tirsdag 10. november');
  await page.getByRole('button', { name: 'I dag' }).click();
  await expect(page.getByTestId('main-card')).toContainText('Styrke A');
  await startSession(page);
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  await throughWarmup(page);
  await runSessionToSummary(page);
  await page.getByTestId('done').click();
  await expect(page.locator('.main-card.done')).toContainText('Logget i dag');
  expect(await storedEventCount(page)).toBe(count);
  await page.getByTestId('sim-exit').click();
  await expect(page.locator('.banner.sim')).toHaveCount(0);
  await expect(page.getByTestId('main-card').or(page.locator('.main-card'))).toContainText(
    'Programmet starter mandag 9. november',
  );
  expect(await storedEventCount(page)).toBe(count);
});

test('I dag viser datoen i dansk tid uanset browserens tidszone @date', async ({ page }) => {
  // 23:30 UTC on 10/11 is 00:30 on 11/11 in Copenhagen (S-DATE-01 in the app).
  await page.clock.install({ time: new Date('2026-11-10T23:30:00Z') });
  await page.goto('/comeback/');
  await onboard(page);
  await expect(page.locator('.today-head .date')).toHaveText('Onsdag 11. november');
  await expect(page.locator('.tomorrow')).toContainText('Motor');
});

test('luk appen midt i et pas og åbn igen: passet fortsætter samme sted', async ({ page }) => {
  await stillFigures(page);
  await openApp(page, TUESDAY_WEEK2);
  await onboard(page);
  await startSession(page);
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  await throughWarmup(page);
  await closeIntro(page);
  await page.getByTestId('as-planned').click(); // power, set 1
  await page.getByText('Spring pausen over').click();
  await page.getByTestId('as-planned').click(); // power, set 2
  await page.getByText('Spring pausen over').click();
  await expect(page.locator('.set-count')).toHaveText('Sæt 3 af 3');

  await page.reload();
  await expect(page.locator('.set-count')).toHaveText('Sæt 3 af 3');

  // Without the saved position the log alone tells where the session is. The key is removed in the
  // new page before the app starts: the session saves its position in an effect after drawing, so
  // a removal from the old page could be overwritten before the reload.
  await page.addInitScript(() => localStorage.removeItem('comeback.run'));
  await page.reload();
  await expect(page.locator('.main-card')).toContainText('Passet er i gang');
  await page.getByRole('button', { name: 'Fortsæt passet' }).click();
  await expect(page.locator('.set-count')).toHaveText('Sæt 3 af 3');
});
