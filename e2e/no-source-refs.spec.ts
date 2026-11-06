import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { findSourceRef } from '../src/content/refs.ts';
import { onboard, openApp } from './helpers.ts';

// SK10 (docs/SPEC.md 1, docs/DECISIONS.md A2): no screen refers to the PDF, a page number or a
// source outside the app – I dag, Uge, every ladder, Mere, Om, Diagnose, the data page /program/
// and »Hvorfor« in a session, where the track's own words replace the programme's evidence box,
// which cites a study (power legs).

test.describe.configure({ timeout: 180_000 });

async function expectNoRefs(page: Page, where: string): Promise<void> {
  const text = await page.locator('body').innerText();
  const ref = findSourceRef(text);
  expect(ref, `${where} henviser til »${ref}«`).toBeNull();
}

test('ingen skærm henviser til PDF, sidetal eller kilder (SK10)', async ({ page }) => {
  await openApp(page, '2026-11-17');
  await onboard(page);
  await expectNoRefs(page, 'I dag');

  await page.getByRole('button', { name: 'Uge', exact: true }).click();
  await expect(page.getByTestId('week')).toBeVisible();
  await expectNoRefs(page, 'Uge');

  await page.getByRole('button', { name: 'Stiger', exact: true }).click();
  const rows = page.locator('.ladder-row');
  await expect(rows).toHaveCount(13);
  await expectNoRefs(page, 'Stiger');
  for (let i = 0; i < 13; i++) {
    const name = (await rows.nth(i).locator('.ladder-name').innerText()).trim();
    await rows.nth(i).click();
    await expect(page.locator('.ladder-detail')).toBeVisible();
    await expectNoRefs(page, `Stiger → ${name}`);
    // Exact: a step is a button too, and its execution can contain »tilbage«.
    await page.getByRole('button', { name: 'Tilbage', exact: true }).click();
  }

  await page.getByRole('button', { name: 'Mere', exact: true }).click();
  await expectNoRefs(page, 'Mere');
  for (const item of ['Historik', 'Backup']) {
    await page.getByRole('button', { name: item, exact: true }).click();
    await expectNoRefs(page, `Mere → ${item}`);
    await page.getByRole('button', { name: 'Tilbage' }).click();
  }
  await page.getByRole('button', { name: 'Om', exact: true }).click();
  await expect(page.getByTestId('about')).toContainText('Programversion');
  await expectNoRefs(page, 'Om');
  await page.screenshot({ path: 'screenshots/om.png', scale: 'css' });
  await page.getByTestId('diagnose-open').click();
  await expect(page.getByTestId('diagnose')).toBeVisible();
  await expectNoRefs(page, 'Diagnose');

  // A session: the first set is power legs. Its »Hvorfor« comes from content/explain and replaces
  // the programme's evidence box and its citation (SPEC 3.2).
  await page.getByRole('button', { name: 'I dag', exact: true }).click();
  await page.getByTestId('start-session').click();
  await expectNoRefs(page, 'Trafiklyset');
  await page.getByRole('button', { name: 'Start opvarmningen' }).click();
  await expectNoRefs(page, 'Opvarmningen');
  for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
  await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
  await expect(page.getByTestId('as-planned')).toBeVisible();
  await page.locator('details.why summary').click();
  const why = page.locator('details.why');
  const own = JSON.parse(readFileSync('content/explain/power_legs.json', 'utf8')) as {
    why: string[];
  };
  await expect(why).toContainText(own.why[0] ?? '');
  await expect(why).not.toContainText('At stoppe ved ca. 20 % fartfald');
  await expect(why).not.toContainText('Pareja-Blanco');
  await expect(why).not.toContainText('PDF');
  await expectNoRefs(page, 'Hvorfor i passet');
  await page.screenshot({ path: 'screenshots/hvorfor.png', scale: 'css', fullPage: true });

  await page.goto('/comeback/program/');
  await expect(page.locator('.prog-track')).toHaveCount(20);
  await expectNoRefs(page, '/program/');
});

// Without the track's explanation file (not written, or not fetched), »Hvorfor« falls back to the
// programme's own evidence box through withoutSources: its text without the study it cites.
test.describe('uden forklaringsfilen', () => {
  // The service worker would answer the fetch from its cache and bypass the route below.
  test.use({ serviceWorkers: 'block' });

  test('»Hvorfor« viser programmets tekst uden kildehenvisning (SK10)', async ({ page }) => {
    await page.route(/\/assets\/power_legs-[\w-]+\.json$/, (route) => route.abort());
    await openApp(page, '2026-11-17');
    await onboard(page);
    await page.getByTestId('start-session').click();
    await page.getByRole('button', { name: 'Start opvarmningen' }).click();
    for (let i = 0; i < 4; i++) await page.clock.runFor(181_000);
    await page.getByRole('button', { name: 'GRØN – kør passet' }).click();
    await expect(page.getByTestId('as-planned')).toBeVisible();
    await page.locator('details.why summary').click();
    const why = page.locator('details.why');
    await expect(why).toContainText('At stoppe ved ca. 20 % fartfald');
    await expect(why).not.toContainText('Pareja-Blanco');
    await expectNoRefs(page, 'Hvorfor uden forklaringsfil');
  });
});
