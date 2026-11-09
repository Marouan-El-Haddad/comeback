// The instructions in docs/runs/NAT-3-FIGURES.md to the figure agents in P2, tried (H2 in the P1a
// review): each file in p2/ is a figure on the waiting list (src/figure/waiting.ts), or one that can
// be drawn better, redrawn as its instruction says. It passes the format and every figure check
// against its explanation, so the instruction is known to work. Copy its keyframes, transitions and
// props into content/figures/<subject>.json, and delete the file here when the figure has left the
// waiting list. A file that fails after the coaches change a position's text is out of date.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  isFigureLike,
  type ExplainFile,
  type FigureFile,
  type FigureItem,
} from '../../content/types.ts';
import { validateFigureFile } from '../../content/validate.ts';
import { PROGRAM } from '../../engine/program.ts';
import { checkFigure, movementFor } from '../check.ts';
import { WAITING_FOR_P2 } from '../waiting.ts';

const CONTENT = join(process.cwd(), 'content');
const DIR = join(process.cwd(), 'src', 'figure', '__tests__', 'p2');

interface Tried {
  key: string;
  subject: string;
  figure: FigureItem;
}

const read = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;

const tried: Tried[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => {
    const { subject, figure } = read<{ subject: string; figure: FigureItem }>(join(DIR, f));
    const key = figure.movement ? `${figure.id} › ${figure.movement}` : figure.id;
    return { key, subject, figure };
  });

describe('anvisningerne til P2 er afprøvet (H2 i P1a-reviewet)', () => {
  test('hver figur på ventelisten har en afprøvet anvisning i p2/', () => {
    const keys = new Set(tried.map((t) => t.key));
    expect(WAITING_FOR_P2.filter((key) => !keys.has(key))).toEqual([]);
  });

  test.each(tried.map((t) => [t.key, t] as const))('%s består med anvisningen', (_key, t) => {
    const file = read<FigureFile>(join(CONTENT, 'figures', `${t.subject}.json`));
    const explain = read<ExplainFile>(join(CONTENT, 'explain', `${t.subject}.json`));
    const same = (f: FigureFile['figures'][number]) =>
      !isFigureLike(f) && f.id === t.figure.id && f.movement === t.figure.movement;
    expect(file.figures.some(same), `${t.key} findes ikke i figures/${t.subject}.json`).toBe(true);
    const changed: FigureFile = {
      ...file,
      figures: file.figures.map((f) => (same(f) ? t.figure : f)),
    };
    const format = validateFigureFile(changed, t.subject, PROGRAM, explain);
    expect(format.map((p) => `${p.where}: ${p.message}`)).toEqual([]);
    const movement = movementFor(explain, t.figure.id, t.figure.movement);
    if (!movement) throw new Error(`${t.key}: ingen forklaring`);
    const problems = checkFigure(t.figure, movement, t.key);
    expect(problems.map((p) => `${p.where}: ${p.message}`)).toEqual([]);
  });
});
