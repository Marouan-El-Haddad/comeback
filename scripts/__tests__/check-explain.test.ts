// `node scripts/check-explain.ts <fil>` as the content agents run it: OK for a valid file, short
// Danish messages and exit code 1 for a file with problems (docs/SPEC.md 9.1).
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as prettier from 'prettier';
import { afterAll, describe, expect, test } from 'vitest';
import { PRESS, PRESS_FIGURES } from '../../src/content/__tests__/fixtures.ts';
import type { ExplainItem } from '../../src/content/types.ts';

const dir = mkdtempSync(join(tmpdir(), 'comeback-content-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function write(sub: string, name: string, data: unknown, format = true): Promise<string> {
  const options = (await prettier.resolveConfig(join(process.cwd(), 'content', 'x.json'))) ?? {};
  const raw = JSON.stringify(data);
  const text = format ? await prettier.format(raw, { ...options, parser: 'json' }) : `${raw}\n`;
  mkdirSync(join(dir, sub), { recursive: true });
  const file = join(dir, sub, `${name}.json`);
  writeFileSync(file, text);
  return file;
}

function run(...files: string[]) {
  const result = spawnSync(process.execPath, ['scripts/check-explain.ts', ...files], {
    encoding: 'utf8',
  });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}

describe('check-explain', () => {
  test('en gyldig forklaring og dens figur er OK', async () => {
    const explain = await write('explain', 'press', PRESS);
    const figures = await write('figures', 'press', PRESS_FIGURES);
    const result = run(explain, figures);
    expect(result.out).toContain('OK    ');
    expect(result.out).toContain('(1 trin)');
    expect(result.out).toContain('(1 figur)');
    expect(result.status).toBe(0);
  });

  test('en fejl giver sted, besked og exit-kode 1', async () => {
    const bad = structuredClone(PRESS);
    (bad.items[0] as ExplainItem).cues[0] = 'Hold kroppen helt stiv fra hæl til hoved';
    const file = await write('explain', 'press', bad);
    const result = run(file);
    expect(result.status).toBe(1);
    expect(result.out).toContain('FEJL');
    expect(result.out).toContain('press.1 › cues[0]: højst 6 ord (har 8)');
  });

  test('en figur kræver en gyldig forklaring', async () => {
    const bad = structuredClone(PRESS);
    (bad.items[0] as ExplainItem).trains = 'Som på side 12.';
    await write('explain', 'press', bad);
    const result = run(await write('figures', 'press', PRESS_FIGURES));
    expect(result.status).toBe(1);
    expect(result.out).toContain('ret først forklaringen');
  });

  test('en fil, prettier ville ændre, og ugyldig JSON', async () => {
    const unformatted = run(await write('explain', 'press', PRESS, false));
    expect(unformatted.status).toBe(1);
    expect(unformatted.out).toContain('formatet passer ikke: kør npx prettier --write');
    mkdirSync(join(dir, 'explain'), { recursive: true });
    writeFileSync(join(dir, 'explain', 'pull.json'), '{ "format": 1,');
    const broken = run(join(dir, 'explain', 'pull.json'));
    expect(broken.status).toBe(1);
    expect(broken.out).toContain('ugyldig JSON');
  });

  test('uden fil tjekkes alt i content/ med dækning', () => {
    const result = run();
    expect(result.out).toContain('Forklaret:');
    expect(result.status).toBe(0);
  });
});
