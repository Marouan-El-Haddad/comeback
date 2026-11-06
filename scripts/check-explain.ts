// Checks explanation and figure files in content/ (docs/SPEC.md 9.1) for the content agents:
//   node scripts/check-explain.ts content/explain/press.json [more files]
//   node scripts/check-explain.ts                      (every file in content/, with coverage)
// A figure file is checked against the explanation file of the same name, and a »like« into another
// file is looked up there. Prints short Danish messages and exits with code 1 when a file has a
// problem, also when prettier would change it.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { PROGRAM } from '../src/engine/program.ts';
import { isLike, type ExplainFile, type FigureFile } from '../src/content/types.ts';
import {
  coverage,
  subjectIdOf,
  validateExplainFile,
  validateFigureFile,
  type Problem,
  type Resolve,
} from '../src/content/validate.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'content');

type Kind = 'explain' | 'figures';

function kindOf(file: string, data: unknown): Kind | null {
  const dir = basename(dirname(file));
  if (dir === 'explain' || dir === 'figures') return dir;
  if (typeof data === 'object' && data !== null) {
    if ('items' in data) return 'explain';
    if ('figures' in data) return 'figures';
  }
  return null;
}

function read(file: string): { text: string; data: unknown } | { error: string } {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return { error: 'filen findes ikke' };
  }
  try {
    return { text, data: JSON.parse(text) as unknown };
  } catch (error) {
    return { error: `ugyldig JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** Looks up a »like« into another explanation file next to this one (content/explain/<subject>). */
function resolverFor(dir: string): Resolve {
  return (itemId) => {
    const loaded = read(join(dir, `${subjectIdOf(itemId)}.json`));
    if ('error' in loaded) return null;
    const items = (loaded.data as { items?: unknown }).items;
    if (!Array.isArray(items)) return null;
    const entry = (items as ExplainFile['items']).find((e) => e.id === itemId);
    return entry && !isLike(entry) ? entry : null;
  };
}

async function formatted(file: string, text: string): Promise<boolean> {
  // The repo's prettier settings, also for a file outside the repo (the tests write to a temp dir).
  const options = (await prettier.resolveConfig(join(ROOT, 'content', 'x.json'))) ?? {};
  return prettier.check(text, { ...options, filepath: file });
}

interface Result {
  file: string;
  problems: Problem[];
  summary: string;
  explain?: ExplainFile;
  figures?: FigureFile;
}

async function check(file: string): Promise<Result> {
  const shown = relative(process.cwd(), file).split('\\').join('/') || file;
  const name = basename(file, '.json');
  const loaded = read(file);
  if ('error' in loaded)
    return { file: shown, problems: [{ where: '', message: loaded.error }], summary: '' };
  const kind = kindOf(file, loaded.data);
  if (!kind) {
    const message = 'ukendt fil: læg den i content/explain/ eller content/figures/';
    return { file: shown, problems: [{ where: '', message }], summary: '' };
  }
  let problems: Problem[];
  let summary: string;
  const result: Partial<Result> = {};
  if (kind === 'explain') {
    problems = validateExplainFile(loaded.data, name, PROGRAM, resolverFor(dirname(file)));
    const items = (loaded.data as { items?: unknown[] }).items?.length ?? 0;
    const routine = PROGRAM.routines.some((r) => r.id === name);
    const unit = name === 'measures' ? 'målinger' : routine ? 'punkter' : 'trin';
    summary = `${items} ${items === 1 && unit !== 'trin' ? unit.replace(/er$/, '') : unit}`;
    if (problems.length === 0) result.explain = loaded.data as ExplainFile;
  } else {
    // The figures build on the explanation's positions; it must be valid itself first.
    const explainFile = join(dirname(file), '..', 'explain', `${name}.json`);
    const other = existsSync(explainFile) ? read(explainFile) : null;
    let explain: ExplainFile | null = null;
    problems = [];
    if (other && 'data' in other) {
      const own = validateExplainFile(other.data, name, PROGRAM, resolverFor(dirname(explainFile)));
      if (own.length === 0) explain = other.data as ExplainFile;
      else {
        problems.push({
          where: '',
          message: `ret først forklaringen (${own.length} fejl): node scripts/check-explain.ts ${relative(process.cwd(), explainFile).split('\\').join('/')}`,
        });
      }
    }
    if (problems.length === 0) problems = validateFigureFile(loaded.data, name, PROGRAM, explain);
    const figures = (loaded.data as { figures?: unknown[] }).figures?.length ?? 0;
    summary = `${figures} ${figures === 1 ? 'figur' : 'figurer'}`;
    if (problems.length === 0) result.figures = loaded.data as FigureFile;
  }
  if (!(await formatted(file, loaded.text))) {
    problems.push({
      where: '',
      message: `formatet passer ikke: kør npx prettier --write ${shown}`,
    });
  }
  return { file: shown, problems, summary, ...result };
}

function filesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => join(dir, f));
}

const args = process.argv.slice(2);
const all = args.length === 0;
const files = all
  ? [...filesIn(join(CONTENT, 'explain')), ...filesIn(join(CONTENT, 'figures'))]
  : args.map((a) => resolve(a));

const results: Result[] = [];
for (const file of files) results.push(await check(file));

let failed = 0;
for (const r of results) {
  if (r.problems.length === 0) {
    console.log(`OK    ${r.file} (${r.summary})`);
    continue;
  }
  failed++;
  console.log(`FEJL  ${r.file}: ${r.problems.length} fejl`);
  for (const p of r.problems) console.log(`      ${p.where ? `${p.where}: ` : ''}${p.message}`);
}

if (all) {
  const cov = coverage(
    PROGRAM,
    results.flatMap((r) => (r.explain ? [r.explain] : [])),
    results.flatMap((r) => (r.figures ? [r.figures] : [])),
  );
  console.log(
    `\n${files.length === 0 ? 'Ingen filer i content/ endnu. ' : ''}Forklaret: ${cov.explained.length} af ${cov.all.length} trin, rutinepunkter og målinger. Med figur: ${cov.drawn.length}.`,
  );
}
if (files.length > 0 && failed === 0) console.log(`\nAlle ${files.length} filer er i orden.`);
if (failed > 0) {
  console.log(`\n${failed} af ${files.length} filer har fejl.`);
  process.exitCode = 1;
}
