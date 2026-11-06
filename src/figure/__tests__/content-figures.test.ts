// Every figure in content/figures passes the figure system's checks (docs/SPEC.md 9.1, PLAN M6): the
// joints bend the right way, the contacts fit, nothing slides, and the animation's phases last as
// long as the tempo in the dose. The figure agents check one file with
// `node scripts/check-explain.ts content/figures/<spor>.json`; this test checks them all.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { isFigureLike, type ExplainFile, type FigureFile } from '../../content/types.ts';
import { programItem, statedSeconds } from '../../content/validate.ts';
import { PROGRAM } from '../../engine/program.ts';
import { checkFigureFile, movementFor } from '../check.ts';
import { phaseSeconds, timeline } from '../motion.ts';

const CONTENT = join(process.cwd(), 'content');
const files = existsSync(join(CONTENT, 'figures'))
  ? readdirSync(join(CONTENT, 'figures')).filter((f) => f.endsWith('.json'))
  : [];

function load(file: string): { figures: FigureFile; explain: ExplainFile } {
  const read = (dir: string) =>
    JSON.parse(readFileSync(join(CONTENT, dir, file), 'utf8')) as unknown;
  return { figures: read('figures') as FigureFile, explain: read('explain') as ExplainFile };
}

describe('figurerne i content/figures', () => {
  test('der er figurer at tjekke', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test('består figursystemets tjek: led, kontakter, glidning og rækkevidde', () => {
    const problems = files.flatMap((file) => {
      const { figures, explain } = load(file);
      return checkFigureFile(figures, explain).map(
        (p) => `figures/${file} › ${p.where}: ${p.message}`,
      );
    });
    expect(problems).toEqual([]);
  });

  test('fasernes varighed i animationen passer til tempoet i dosis', () => {
    const problems: string[] = [];
    for (const file of files) {
      const { figures, explain } = load(file);
      for (const entry of figures.figures) {
        if (isFigureLike(entry)) continue;
        const movement = movementFor(explain, entry.id, entry.movement);
        const item = programItem(PROGRAM, entry.id);
        if (!movement || !item) continue;
        const where = `${basename(file, '.json')} › ${entry.id}`;
        const line = timeline(movement);
        // Each phase's moves follow each other without a gap and last the phase's seconds.
        movement.phases.forEach((phase, i) => {
          const moves = line.moves.filter((m) => m.phase === i);
          const sum = moves.reduce((n, m) => n + m.seconds, 0);
          if (Math.abs(sum - phaseSeconds(phase)) > 1e-9) {
            problems.push(`${where} › fase ${i}: varer ${sum} sek, ikke ${phaseSeconds(phase)}`);
          }
        });
        line.moves.forEach((m, i) => {
          const next = line.moves[i + 1];
          if (next && Math.abs(m.start + m.seconds - next.start) > 1e-9) {
            problems.push(`${where}: hul i tidslinjen ved ${m.start + m.seconds} sek`);
          }
        });
        // Every time the programme states for the step (up to 10 sek) is a phase that long.
        const lengths = movement.phases.flatMap((p) =>
          p.seconds === 'dose' ? [] : [p.seconds, phaseSeconds(p)],
        );
        for (const [min, max, words] of statedSeconds(item.texts)) {
          if (min > 10) continue; // a hold's time is its "dose" phase
          if (!lengths.some((s) => s >= min - 1e-9 && s <= max + 1e-9)) {
            problems.push(`${where}: programmet siger »${words}«, men ingen fase varer så længe`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
