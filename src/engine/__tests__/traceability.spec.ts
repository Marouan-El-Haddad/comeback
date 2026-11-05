// Every scenario in docs/ENGINE.md section 8 is a test with the scenario id in its name, and
// every scenario named in section 9 (traceability) exists in section 8 (docs/PLAN.md milestone 1).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const root = process.cwd();
const engine = readFileSync(join(root, 'docs', 'ENGINE.md'), 'utf8');
const section = (title: RegExp) => {
  const start = engine.search(title);
  const rest = engine.slice(start + 1);
  const next = rest.search(/\n## \d/);
  return next < 0 ? rest : rest.slice(0, next);
};

const section8 = section(/\n## 8\. /);
const section9 = section(/\n## 9\. /);
const scenarios = [...section8.matchAll(/\*\*(S-[A-Z0-9]+-\d{2})\*\*/g)].map((m) => m[1] as string);

const testDir = join(root, 'src', 'engine', '__tests__');
const testNames = readdirSync(testDir)
  .filter((f) => f.endsWith('.test.ts'))
  .flatMap((f) => [
    ...readFileSync(join(testDir, f), 'utf8').matchAll(/test\('(S-[A-Z0-9]+-\d{2}):/g),
  ])
  .map((m) => m[1] as string);

/** "S-TL-01..06" → S-TL-01 … S-TL-06; "S-MOVE-01" stays; "S-DP-*" → every S-DP scenario. */
function expand(ref: string): string[] {
  const range = /^(S-[A-Z0-9]+-)(\d{2})\.\.(\d{2})$/.exec(ref);
  if (range) {
    const [, prefix, a, b] = range as unknown as [string, string, string, string];
    const out: string[] = [];
    for (let n = Number(a); n <= Number(b); n++) out.push(`${prefix}${String(n).padStart(2, '0')}`);
    return out;
  }
  const star = /^(S-[A-Z0-9]+-)\*$/.exec(ref);
  if (star) return scenarios.filter((s) => s.startsWith(star[1] as string));
  return [ref];
}

describe('Sporbarhed (ENGINE.md 8 og 9)', () => {
  test('afsnit 8 har scenarier', () => {
    expect(scenarios.length).toBeGreaterThan(80);
    expect(new Set(scenarios).size).toBe(scenarios.length);
  });

  test.each(scenarios)('%s findes som test med samme id', (id) => {
    expect(testNames.filter((n) => n === id)).toHaveLength(1);
  });

  test('alle testnavne med et scenarie-id findes i afsnit 8', () => {
    for (const name of testNames) expect(scenarios).toContain(name);
  });

  test('alle scenarier i afsnit 9 findes i afsnit 8; rækker uden test er markeret »–«', () => {
    const rows = section9.split('\n').filter((l) => /^\| \d/.test(l));
    expect(rows.length).toBeGreaterThan(30);
    for (const row of rows) {
      const cells = row.split('|').map((c) => c.trim());
      const refs = cells[4] ?? '';
      if (refs === '–' || refs.startsWith('– ')) continue;
      const ids = refs.split(',').flatMap((part) => {
        const trimmed = part.trim();
        // "S-PAIN-01..02" and also "S-MOVE-01" or "S-EXTRA-*"
        const pieces = trimmed.split(/\s+/).filter((p) => p.startsWith('S-'));
        return pieces.flatMap((p) => {
          const short = /^(S-[A-Z0-9]+-)(\d{2})\/(\d{2})$/.exec(p);
          if (short) return [`${short[1]}${short[2]}`, `${short[1]}${short[3]}`];
          return expand(p);
        });
      });
      expect(ids.length, row).toBeGreaterThan(0);
      for (const id of ids) expect(scenarios, `${id} fra afsnit 9`).toContain(id);
    }
  });
});
