import { expect, test, type Page } from '@playwright/test';
import { a11yProblems, APP_RULES, SESSION_RULES } from './a11y.ts';
import { closeIntro, onboard, openApp, startSession, stillFigures } from './helpers.ts';

// SPEC 5 and 6 on every screen (DECISIONS.md D39, D59): text size and the type scale, contrast,
// tap targets of 56 px with 8 px between them, and the primary button 64 px high. Here the tabs,
// Mere, the phase-in and the parts of a session the session's own flows do not check (the traffic
// light, the warm-up, question 3, Open & Strong and the summary of a session ended early); »Dagens
// pas«, »Nu«, the pause, the intro card and the timers in session.spec.ts, the exercise card in
// card.spec.ts and figure.spec.ts. Screenshots of the screens no other flow takes.

test.describe.configure({ timeout: 300_000 });

async function expectClean(page: Page, where: string, selector: string, session = false) {
  const problems = await a11yProblems(page, selector, session ? SESSION_RULES : APP_RULES);
  expect.soft(problems, where).toEqual([]);
}

test('designkravene holder i indfasningen, på fanerne og i Mere', async ({ page }) => {
  await openApp(page, '2026-11-17');
  // The phase-in, page by page (docs/SPEC.md 4.1).
  await expect(page.getByTestId('onboarding')).toBeVisible();
  for (let i = 0; i < 8; i++) {
    const heading = (await page.locator('.onboarding h1').allTextContents())[0] ?? '';
    await expectClean(page, `Indfasning: ${heading}`, '[data-testid="onboarding"]');
    const done = page.getByTestId('onboarding-done');
    if (await done.isVisible()) {
      await done.click();
      break;
    }
    await page.getByTestId('onboarding-next').click();
  }
  await expect(page.getByTestId('today')).toBeVisible();
  await expectClean(page, 'I dag', '.app');

  await page.getByRole('button', { name: 'Uge', exact: true }).click();
  await expect(page.getByTestId('week')).toBeVisible();
  await expectClean(page, 'Uge', '.app');

  await page.getByRole('button', { name: 'Stiger', exact: true }).click();
  await expect(page.locator('.ladder-row')).toHaveCount(13);
  await expectClean(page, 'Stiger', '.app');
  await page.locator('.ladder-row', { hasText: 'Pres · trin 1' }).click();
  await expect(page.locator('.ladder-detail')).toBeVisible();
  await expectClean(page, 'Stiger → Pres', '.app');
  await page.getByRole('button', { name: 'Vælg selv dette trin' }).first().click();
  await expectClean(page, 'Stiger → Pres → vælg trin', '.app');
  await page.getByRole('button', { name: 'Fortryd' }).click();
  await page.getByRole('button', { name: 'Tilbage', exact: true }).click();
  await page.locator('.other-row', { hasText: 'Opvarmning' }).click();
  await expect(page.locator('.other-detail')).toBeVisible();
  await expectClean(page, 'Stiger → Øvrige → Opvarmning', '.app');
  await page.getByRole('button', { name: 'Tilbage', exact: true }).click();

  await page.getByRole('button', { name: 'Mere', exact: true }).click();
  await expect(page.getByTestId('more')).toBeVisible();
  await expectClean(page, 'Mere', '.app');
  await page.screenshot({ path: 'screenshots/mere.png', scale: 'css', animations: 'disabled' });
  await page.getByRole('button', { name: 'Historik', exact: true }).click();
  await expect(page.getByTestId('history')).toBeVisible();
  await expectClean(page, 'Historik uden pas', '.app');
  await page.screenshot({
    path: 'screenshots/historik-tom.png',
    scale: 'css',
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Tilbage', exact: true }).click();
  await page.getByRole('button', { name: 'Backup', exact: true }).click();
  await expect(page.getByTestId('backup')).toBeVisible();
  await expectClean(page, 'Backup', '.app');
  await page.getByRole('button', { name: 'Tilbage', exact: true }).click();
  await page.getByRole('button', { name: 'Om', exact: true }).click();
  await expect(page.getByTestId('about')).toBeVisible();
  await expectClean(page, 'Om', '.app');
  await page.getByTestId('diagnose-open').click();
  await expect(page.getByTestId('diagnose')).toBeVisible();
  await expectClean(page, 'Diagnose', '.app');
});

test('designkravene holder på trafiklyset, i opvarmningen, Open & Strong og opsummeringen', async ({
  page,
}) => {
  await stillFigures(page);
  await openApp(page, '2026-11-17');
  await onboard(page);

  // Open & Strong: its list before the start, then »Nu« with the clock (docs/SPEC.md 4.4).
  await page.getByTestId('os-start').click();
  await expect(page.getByTestId('open-strong')).toBeVisible();
  await expectClean(page, 'Open & Strong før start', '.session', true);
  await page.getByTestId('os-go').click();
  await expect(page.locator('.session .stack.now')).toBeVisible();
  await expectClean(page, 'Open & Strong: Nu', '.session', true);
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
  await expect(page.getByTestId('today')).toBeVisible();

  // The traffic light, the warm-up's card and an item, question 3 (docs/SPEC.md 3.3, 4.2).
  await startSession(page);
  await expect(page.getByRole('heading', { name: 'Før du starter – 10 sekunder' })).toBeVisible();
  await expectClean(page, 'Trafiklyset', '.session', true);
  await page.getByRole('button', { name: 'Nej' }).first().click();
  await expectClean(page, 'Trafiklyset gult', '.session', true);
  await page.getByRole('button', { name: 'Ja' }).first().click();
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  await expect(page.getByTestId('intro')).toBeVisible();
  await expectClean(page, 'Opvarmningens introkort', '.session', true);
  await closeIntro(page);
  await expect(page.locator('.session .stack.now')).toBeVisible();
  await expectClean(page, 'Opvarmningen: Nu', '.session', true);
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await expect(page.getByRole('heading', { name: 'Spørgsmål 3' })).toBeVisible();
  await expectClean(page, 'Spørgsmål 3', '.session', true);
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
  await closeIntro(page);
  await page.getByTestId('as-planned').click();
  await expect(page.locator('.session .rest')).toBeVisible();

  // »Afslut« asks first; the summary of a session ended early says so (docs/SPEC.md 4.2).
  await page.getByRole('button', { name: 'Afslut passet' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await expectClean(page, 'Afslut passet?', '.session', true);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Afslut' }).click();
  await expect(page.getByTestId('done')).toBeVisible();
  await expect(page.getByText('Passet blev afsluttet før tid.')).toBeVisible();
  await expectClean(page, 'Opsummering', '.session', true);
});
