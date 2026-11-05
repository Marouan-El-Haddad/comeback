// Every file in content/ passes the validation (docs/SPEC.md 9.1, SK11). The content agents check
// one file at a time with `node scripts/check-explain.ts <fil>`; this test checks them all.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { PROGRAM } from '../../engine/program.ts';
import type { ExplainFile } from '../types.ts';
import { validateExplainFile, validateFigureFile } from '../validate.ts';

const CONTENT = join(process.cwd(), 'content');

function files(sub: 'explain' | 'figures'): string[] {
  const dir = join(CONTENT, sub);
  return existsSync(dir) ? readdirSync(dir).sort() : [];
}

function json(sub: string, file: string): unknown {
  return JSON.parse(readFileSync(join(CONTENT, sub, file), 'utf8'));
}

describe('content/', () => {
  test('kun JSON-filer, opkaldt efter et spor eller en rutine', () => {
    const subjects = new Set([...PROGRAM.tracks, ...PROGRAM.routines].map((s) => s.id));
    const stray = [
      ...(existsSync(CONTENT)
        ? readdirSync(CONTENT).filter((f) => !['explain', 'figures'].includes(f))
        : []),
      ...(['explain', 'figures'] as const).flatMap((sub) =>
        files(sub)
          .filter((f) => !f.endsWith('.json') || !subjects.has(basename(f, '.json')))
          .map((f) => `${sub}/${f}`),
      ),
    ];
    expect(stray).toEqual([]);
  });

  test('alle forklaringer består valideringen', () => {
    const problems = files('explain').flatMap((f) =>
      validateExplainFile(json('explain', f), basename(f, '.json'), PROGRAM).map(
        (p) => `explain/${f} › ${p.where}: ${p.message}`,
      ),
    );
    expect(problems).toEqual([]);
  });

  test('alle figurer består valideringen mod deres forklaring', () => {
    const problems = files('figures').flatMap((f) => {
      const name = basename(f, '.json');
      const explain = files('explain').includes(f) ? (json('explain', f) as ExplainFile) : null;
      return validateFigureFile(json('figures', f), name, PROGRAM, explain).map(
        (p) => `figures/${f} › ${p.where}: ${p.message}`,
      );
    });
    expect(problems).toEqual([]);
  });
});
