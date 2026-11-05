// Reads docs/PROGRAM_KILDE.md and docs/ENGINE.md for the programme tests: a small markdown reader
// for headings, pipe tables, boxes and blocks – only what the two documents use. It is written
// independently of scripts/convert-program.ts, so the tests do not inherit the converter's mistakes.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** A file relative to the repo root. */
export function readText(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

export function readJson<T>(path: string): T {
  return JSON.parse(readText(path)) as T;
}

/** Removes the bold markers the source uses in names, labels and boxes. */
export function plain(text: string): string {
  return text.replace(/\*\*/g, '');
}

/** A capture group that must be there. */
export function must(match: RegExpExecArray | null, index: number, what: string): string {
  const value = match?.[index];
  if (value === undefined) throw new Error(`Cannot read ${what}`);
  return value;
}

export interface Section {
  title: string;
  lines: string[];
  /** From the section's `<sub>PDF side N</sub>`; undefined when it has none (the appendices). */
  page: number | undefined;
}

/** The document cut at every heading of level 1 or 2. */
export function sections(markdown: string): Section[] {
  const result: Section[] = [];
  for (const line of markdown.split('\n')) {
    const heading = /^#{1,2} (.*)$/.exec(line);
    if (heading) {
      result.push({ title: must(heading, 1, 'heading'), lines: [], page: undefined });
      continue;
    }
    const current = result[result.length - 1];
    if (!current) continue;
    current.lines.push(line);
    const page = /^<sub>PDF side (\d+)<\/sub>$/.exec(line);
    if (page) current.page = Number(page[1]);
  }
  return result;
}

/** The section with this heading; `nth` picks among sections with the same heading. */
export function section(markdown: string, title: string, nth = 0): Section {
  const found = sections(markdown).filter((s) => s.title === title)[nth];
  if (!found) throw new Error(`No section »${title}« (#${nth})`);
  return found;
}

/** The lines under a heading that starts with `prefix`, up to the next heading of any level. */
export function linesUnder(markdown: string, prefix: string): string[] {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.startsWith(prefix));
  if (start < 0) throw new Error(`No heading »${prefix}«`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('#'));
  return end < 0 ? rest : rest.slice(0, end);
}

export interface Table {
  /** The nearest `###` heading above the table, if any. */
  heading: string | undefined;
  header: string[];
  rows: string[][];
  /** The lines after the table. */
  after: string[];
}

function cellsOf(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

export function tables(lines: string[]): Table[] {
  const result: Table[] = [];
  let heading: string | undefined;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (line.startsWith('### ')) heading = line.slice(4);
    if (!line.startsWith('|')) {
      i++;
      continue;
    }
    const block: string[] = [];
    while (i < lines.length && (lines[i] ?? '').startsWith('|')) block.push(lines[i++] ?? '');
    const [header, separator, ...rows] = block;
    if (header === undefined || separator === undefined || !/^\|[-| ]+\|$/.test(separator)) {
      throw new Error(`Not a table: ${block.join('\n')}`);
    }
    result.push({
      heading,
      header: cellsOf(header),
      rows: rows.map(cellsOf),
      after: lines.slice(i),
    });
  }
  return result;
}

/** The only table in `lines` whose header starts with `firstColumn` (and sits under `heading`). */
export function tableWith(lines: string[], firstColumn: string, heading?: string): Table {
  const found = tables(lines).filter(
    (t) => t.header[0] === firstColumn && (heading === undefined || t.heading === heading),
  );
  if (found.length !== 1)
    throw new Error(`Expected one table »${firstColumn}«, found ${found.length}`);
  return found[0] as Table;
}

export type Row = Record<string, string>;

/** The rows as objects keyed by the header cells. */
export function records(table: Table): Row[] {
  return table.rows.map((row) => {
    if (row.length !== table.header.length)
      throw new Error(`Row has wrong width: ${row.join(' | ')}`);
    return Object.fromEntries(table.header.map((name, i) => [name, row[i] ?? '']));
  });
}

/** A cell that must be there. */
export function cell(row: Row, column: string): string {
  const value = row[column];
  if (value === undefined) throw new Error(`No column »${column}« in ${JSON.stringify(row)}`);
  return value;
}

/** The `> **Label:** text` boxes in `lines`. */
export function boxes(lines: string[]): Array<{ label: string; text: string }> {
  return lines.flatMap((line) => {
    const box = /^> \*\*([^*]+):\*\* (.*)$/.exec(line);
    return box ? [{ label: must(box, 1, 'box label'), text: must(box, 2, 'box text') }] : [];
  });
}

/** The first block of non-blank lines (a paragraph or a list). */
export function firstBlock(lines: string[]): string[] {
  const block: string[] = [];
  for (const line of lines) {
    if (line.trim() === '') {
      if (block.length > 0) break;
      continue;
    }
    block.push(line);
  }
  return block;
}

/** The fenced code block right after the heading that starts with `prefix`. */
export function codeUnder(markdown: string, prefix: string): string {
  const lines = linesUnder(markdown, prefix);
  const start = lines.findIndex((line) => line.startsWith('```'));
  const end = lines.findIndex((line, i) => i > start && line.startsWith('```'));
  if (start < 0 || end < 0) throw new Error(`No code block under »${prefix}«`);
  return lines.slice(start + 1, end).join('\n');
}

/**
 * The sentences of a text. A sentence ends at ".", "?" or "!" before a space and a capital letter
 * or a digit; an abbreviation such as "ca." does not end one.
 */
export function sentences(text: string): string[] {
  const pieces = text.split(/(?<=[.?!]) (?=[A-ZÆØÅ0-9])/);
  const result: string[] = [];
  for (const piece of pieces) {
    const previous = result[result.length - 1];
    if (previous !== undefined && /(?:^| )(?:ca|fx|kl|pr)\.$/.test(previous)) {
      result[result.length - 1] = `${previous} ${piece}`;
    } else {
      result.push(piece);
    }
  }
  return result;
}
