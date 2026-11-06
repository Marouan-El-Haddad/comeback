// Draws the contact sheet of a figure file as a PNG for review (docs/SPEC.md 9.1, DECISIONS.md D36
// and D48): every position of every figure, the chest's direction, the contacts, the movement as an
// onion skin, the phases and the problems the checks found.
//   node scripts/figure-sheet.ts <figurfil> [ud.png]
// Without ud.png the sheet goes to screenshots/figures/<subject>.png. The figure file may lie outside
// the repo: its explanation is ../explain/<subject>.json next to it, or else the repo's. The page is
// drawn by Playwright's own browser without a web server or a port, so several agents can run it at
// the same time. Exits with 1 when the file cannot be drawn; problems in the figures are printed and
// drawn on the sheet (check them with node scripts/check-explain.ts).
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, type Browser } from '@playwright/test';
import type { ExplainFile, FigureFile } from '../src/content/types.ts';
import { validateExplainFile, validateFigureFile, type Problem } from '../src/content/validate.ts';
import { PROGRAM } from '../src/engine/program.ts';
import { checkFigureFile } from '../src/figure/check.ts';
import { sheetHtml } from '../src/figure/sheet.ts';
import tokens from '../src/ui/design-tokens.json' with { type: 'json' };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message: string): never {
  console.error(`FEJL  ${message}`);
  process.exit(1);
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as unknown;
  } catch (error) {
    fail(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function font(name: string): string {
  const file = join(ROOT, 'public', 'fonts', name);
  return `data:font/woff2;base64,${readFileSync(file).toString('base64')}`;
}

async function launch(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch {
    try {
      return await firefox.launch();
    } catch {
      fail('ingen browser: kør npx playwright install chromium');
    }
  }
}

const [input, output] = process.argv.slice(2);
if (!input) fail('brug: node scripts/figure-sheet.ts <figurfil> [ud.png]');
const figureFile = resolve(input);
const subject = basename(figureFile, '.json');
const data = readJson(figureFile);

// The explanation next to the file (content/explain beside content/figures), else the repo's.
const besides = join(dirname(figureFile), '..', 'explain', `${subject}.json`);
const explainFile = existsSync(besides)
  ? besides
  : join(ROOT, 'content', 'explain', `${subject}.json`);
if (!existsSync(explainFile)) fail(`forklaringen mangler: ${explainFile}`);
const explain = readJson(explainFile);
// A »like« into another file is not looked up here: the figures only use this file's positions.
if (validateExplainFile(explain, subject, PROGRAM, () => undefined).length > 0) {
  fail(`ret først forklaringen: node scripts/check-explain.ts ${explainFile}`);
}
const format = validateFigureFile(data, subject, PROGRAM, explain as ExplainFile);
if (format.length > 0) {
  for (const p of format) console.error(`      ${p.where ? `${p.where}: ` : ''}${p.message}`);
  fail(
    `${input} har ${format.length} fejl i formatet; ret dem først (node scripts/check-explain.ts ${input})`,
  );
}
const problems: Problem[] = checkFigureFile(data as FigureFile, explain as ExplainFile);

const out = resolve(output ?? join(ROOT, 'screenshots', 'figures', `${subject}.png`));
mkdirSync(dirname(out), { recursive: true });
const shown = relative(process.cwd(), figureFile).split('\\').join('/') || figureFile;
const html = sheetHtml(
  {
    file: data as FigureFile,
    explain: explain as ExplainFile,
    program: PROGRAM,
    source: shown,
    problems,
  },
  {
    tokens,
    fonts: {
      body: font('bai-jamjuree-latin-400-normal.woff2'),
      bodyBold: font('bai-jamjuree-latin-600-normal.woff2'),
      display: font('kanit-latin-600-normal.woff2'),
    },
  },
);

const browser = await launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 800 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, fullPage: true });
} finally {
  await browser.close();
}

const figures = (data as FigureFile).figures.length;
console.log(
  `Kontaktark: ${relative(process.cwd(), out).split('\\').join('/') || out} (${figures} ${figures === 1 ? 'figur' : 'figurer'}, ${problems.length} ${problems.length === 1 ? 'problem' : 'problemer'})`,
);
for (const p of problems) console.log(`      ${p.where}: ${p.message}`);
