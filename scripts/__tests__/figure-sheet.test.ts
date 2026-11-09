// The contact sheet (docs/SPEC.md 9.1, DECISIONS.md D48): the page shows every position, the phases
// and the problems; `node scripts/figure-sheet.ts <figurfil> <ud.png>` draws it for a file outside the
// repo, without a web server or a port, and two runs at the same time do not get in each other's way.
// The PNG needs Playwright's browser, which CI does not install: that part is skipped there.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { afterAll, describe, expect, test } from 'vitest';
import { PRESS, PRESS_FIGURES } from '../../src/content/__tests__/fixtures.ts';
import type { FigureItem, IkLimb, Pose } from '../../src/content/types.ts';
import { PROGRAM } from '../../src/engine/program.ts';
import { checkFigureFile } from '../../src/figure/check.ts';
import { sheetHtml } from '../../src/figure/sheet.ts';
import tokens from '../../src/ui/design-tokens.json' with { type: 'json' };

const dir = mkdtempSync(join(tmpdir(), 'comeback-sheet-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('kontaktarkets side', () => {
  test('viser hver position, kontakterne, faserne og ingen problemer for en god figur', () => {
    const html = sheetHtml(
      { file: PRESS_FIGURES, explain: PRESS, program: PROGRAM, source: 'press.json', problems: [] },
      { tokens },
    );
    expect(html).toContain('press.1 · Pres · trin 1 · Push-up med tempo');
    expect(html).toContain('Oppe <span>(top)</span>');
    expect(html).toContain('Nede <span>(bottom)</span>');
    expect(html).toContain('hånd → floor, tæer → floor');
    expect(html).toContain('<b>3 sek ned</b> (3 sek) → Nede');
    expect(html).toContain('i alt 5 sek i kortet');
    expect(html).toContain('ingen problemer');
    // The middle of the move as a frame of its own, and the angles of knees and elbows (H1, M2);
    // the cells are as wide as their figure, so wide figures do not overlap (D56).
    expect(html).toContain('Midt i: Oppe → Nede');
    expect(html).not.toContain('Midt i: Nede → Oppe');
    expect(html).toMatch(/knæ 180°\/180° · albuer 1[5-8]\d°\/1[5-8]\d°/);
    expect(html).toContain('width:min-content');
    // The figure in the app's colours, from the tokens; the facing arrow in blue.
    expect(html).toContain(`--c-picto-near:${tokens.pictogram.near}`);
    expect(html).toContain('stroke="var(--c-blue)"');
    expect(html).not.toMatch(/https?:\/\//);
  });

  test('viser en overgangs via-pose med blå ramme og midten af hver halvdel (H2 i P1a-reviewet)', () => {
    const file = structuredClone(PRESS_FIGURES);
    const figure = file.figures[0] as FigureItem;
    const via = structuredClone(figure.keyframes.top as Pose);
    figure.transitions = [{ from: 'top', to: 'bottom', via }];
    const html = sheetHtml(
      { file, explain: PRESS, program: PROGRAM, source: 'press.json', problems: [] },
      { tokens },
    );
    expect(html).toContain('Overgange: Oppe → Nede: gennem en via-pose (blå ramme)');
    expect(html).toContain('<div class="cell via">');
    expect(html).toContain('Via: Oppe → Nede');
    expect(html).toContain('Midt i: Oppe → via-posen');
    expect(html).toContain('Midt i: via-posen → Nede');
  });

  test('viser problemerne ved deres position og en rød ring om kontakten', () => {
    const file = structuredClone(PRESS_FIGURES);
    const top = (file.figures[0] as FigureItem).keyframes.top as Pose;
    (top.arms.near as IkLimb).to = [69.17, 6];
    (top.arms.far as IkLimb).to = [70.57, 6];
    const problems = checkFigureFile(file, PRESS);
    const html = sheetHtml(
      { file, explain: PRESS, program: PROGRAM, source: 'press.json', problems },
      { tokens },
    );
    expect(problems.length).toBeGreaterThan(0);
    expect(html).toContain('near.hand skal røre gulvet, men er 6 over');
    expect(html).toContain('stroke="var(--c-red)"');
  });
});

/** Whether Playwright's Chromium is installed (it is not in CI). */
const browser = (() => {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
})();

function run(...args: string[]): Promise<{ status: number | null; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/figure-sheet.ts', ...args]);
    let out = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.stderr.on('data', (d: Buffer) => (out += d.toString()));
    child.on('close', (status) => resolve({ status, out }));
  });
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe.skipIf(!browser)('node scripts/figure-sheet.ts', () => {
  test('tegner en fil uden for repoet som PNG, to gange samtidig', async () => {
    // content/figures and content/explain side by side, outside the repo.
    for (const [sub, data] of [
      ['figures', PRESS_FIGURES],
      ['explain', PRESS],
    ] as const) {
      mkdirSync(join(dir, sub), { recursive: true });
      writeFileSync(join(dir, sub, 'press.json'), JSON.stringify(data));
    }
    const figure = join(dir, 'figures', 'press.json');
    const [a, b] = await Promise.all([
      run(figure, join(dir, 'a.png')),
      run(figure, join(dir, 'b.png')),
    ]);
    for (const [result, png] of [
      [a, 'a.png'],
      [b, 'b.png'],
    ] as const) {
      expect(result.out).toContain('(1 figur, 0 problemer)');
      expect(result.status).toBe(0);
      expect(readFileSync(join(dir, png)).subarray(0, 4)).toEqual(PNG);
    }
  }, 60_000);

  test('en fil med fejl i formatet tegnes ikke', async () => {
    mkdirSync(join(dir, 'figures'), { recursive: true });
    writeFileSync(join(dir, 'figures', 'pull.json'), '{ "format": 1, "subject": "pull" }');
    const result = await run(join(dir, 'figures', 'pull.json'), join(dir, 'c.png'));
    expect(result.status).toBe(1);
    expect(existsSync(join(dir, 'c.png'))).toBe(false);
  });
});
