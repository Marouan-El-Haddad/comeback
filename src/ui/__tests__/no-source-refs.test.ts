// SK10 (docs/SPEC.md 1, docs/DECISIONS.md A2): no text in the app refers to the PDF, a page number
// or a source outside the app. This test reads every string and JSX text in the app's source code
// and every string in the programme data as the app shows it; content/ is checked by its own
// validation, and e2e/no-source-refs.spec.ts reads the screens themselves.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';
import { findSourceRef, withoutSources } from '../../content/refs.ts';

const ROOT = process.cwd();

/** The detector's own patterns and the content check's messages; the app never shows them. */
const NOT_SHOWN = new Set(['src/content/refs.ts', 'src/content/validate.ts']);

const rel = (file: string) => relative(ROOT, file).split('\\').join('/');

function walk(dir: string, keep: (file: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const path = join(dir, d.name);
    if (d.isDirectory()) return d.name === '__tests__' ? [] : walk(path, keep);
    return keep(path) ? [path] : [];
  });
}

/** Every string literal, template part and JSX text in a TypeScript file, with its line. */
function texts(file: string): Array<{ line: number; text: string }> {
  const code = readFileSync(file, 'utf8');
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, kind);
  const found: Array<{ line: number; text: string }> = [];
  const visit = (node: ts.Node): void => {
    // Module paths are not text the app shows.
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      found.push({ line, text: node.text });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** Every string in a JSON value with its path: »why[0].text«. */
function strings(value: unknown, path = ''): Array<{ path: string; text: string }> {
  if (typeof value === 'string') return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  }
  return [];
}

describe('SK10: ingen henvisninger til PDF, sidetal eller kilder', () => {
  test('ingen tekst i appens kildekode', () => {
    const files = walk(join(ROOT, 'src'), (f) => /\.tsx?$/.test(f) && !f.endsWith('.d.ts'));
    expect(files.length).toBeGreaterThan(30);
    const found = files
      .filter((f) => !NOT_SHOWN.has(rel(f)))
      .flatMap((file) =>
        texts(file)
          .filter((t) => findSourceRef(t.text))
          .map((t) => `${rel(file)}:${t.line}: »${t.text.trim()}«`),
      );
    expect(found).toEqual([]);
  });

  test('programdata har kun henvisninger i sporenes »why«, og appen viser dem uden', () => {
    const files = walk(join(ROOT, 'program'), (f) => f.endsWith('.json'));
    const refs = files.flatMap((file) =>
      strings(JSON.parse(readFileSync(file, 'utf8')))
        .filter((s) => findSourceRef(s.text))
        .map((s) => ({ where: `${rel(file)} › ${s.path}`, text: s.text })),
    );
    // The programme's own boxes cite pages and studies; those are the only places.
    expect(refs.length).toBeGreaterThan(0);
    const elsewhere = refs.filter(
      (r) => !/^program\/tracks\/\w+\.json › why\[\d+\]\.text$/.test(r.where),
    );
    expect(elsewhere.map((r) => `${r.where}: »${r.text}«`)).toEqual([]);
    const left = refs.filter((r) => findSourceRef(withoutSources(r.text)));
    expect(left.map((r) => `${r.where}: »${withoutSources(r.text)}«`)).toEqual([]);
  });

  test('withoutSources fjerner sidetal og kildehenvisninger og lader resten stå', () => {
    expect(withoutSources('Ugens loft står i ugeoversigten (side 37).')).toBe(
      'Ugens loft står i ugeoversigten.',
    );
    expect(
      withoutSources(
        'Nordic-programmer har cirka halveret baglårsskader (van Dyk 2019); en genanalyse.',
      ),
    ).toBe('Nordic-programmer har cirka halveret baglårsskader; en genanalyse.');
    expect(withoutSources('Ingen sikker forebyggelse (meget lav sikkerhed).')).toBe(
      'Ingen sikker forebyggelse (meget lav sikkerhed).',
    );
    expect(findSourceRef('45 sek pr. side')).toBeNull();
    // innerText separates table cells with a tab: »pr. side⇥40« is not a page.
    expect(findSourceRef('Sideplanke pr. side\t40 sek\n4 dage')).toBeNull();
    expect(findSourceRef('se side 47')).not.toBeNull();
    expect(findSourceRef(`se side${String.fromCharCode(0xa0)}47`)).not.toBeNull();
    expect(findSourceRef('Kilderne står i programmets side 54.')).not.toBeNull();
  });
});
