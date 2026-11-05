// Converts the step tables in docs/PROGRAM_KILDE.md to program/tracks/<id>.json (docs/ENGINE.md 7).
// Run `npm run convert-program` after a change in the source. What the source does not say (ids,
// short labels, progression type, tags, the press cues from docs/ENGINE.md 7.2, the club sequence
// steps C1–C6 from DECISIONS.md P6) sits in the configuration below. The output is formatted with
// the repo's Prettier settings, so an unchanged source reproduces the committed files byte for byte;
// src/engine/__tests__/program-source.spec.ts checks that, and compares the files with the source.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import type { Dose, Level, Per, Progression, Step, Track } from '../src/engine/types.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = join(ROOT, 'docs', 'PROGRAM_KILDE.md');
const OUT_DIR = join(ROOT, 'program', 'tracks');

// ---------------------------------------------------------------------------------------------
// Configuration: everything that is not in the source's tables
// ---------------------------------------------------------------------------------------------

interface Meta {
  id: string;
  short: string;
  progression: Progression;
  category: Track['category'];
  tags?: string[];
  /** A sentence of »Comeback-fælden« (page 46) the engine adds when the track hurts. */
  painCue?: string;
}

/** A track with a step table: Trin | Øvelse | Niveau | Dosis | Udførelse. */
interface TableTrack extends Meta {
  /** The `##` heading of the page. */
  section: string;
  /** The `###` heading above the table, when the page has more than one. */
  sub?: string;
  /** The track's name when it is not the page heading. */
  name?: string;
  /** Prefix of the step id before the source's number ('V' for the burpee variants). */
  idPrefix?: string;
  stepTags?: Record<string, string[]>;
  /** Steps done after another step's dose in the same block (shoulder 3: P17). */
  stepWith?: Record<string, string>;
  /** Cues when they are not the first sentences of the execution (press: docs/ENGINE.md 7.2). */
  cues?: Record<string, string[]>;
}

const TABLE_TRACKS: TableTrack[] = [
  {
    id: 'press',
    section: 'Pres: push-ups',
    short: 'Pres',
    progression: 'double',
    category: 'ladder',
    painCue: 'Gør push-ups ondt i håndleddet, så tag dem på knoer.',
    cues: {
      '1': ['3 sek ned, 1 sek stille', 'Albuerne 45° ud'],
      '2': ['Samme planke', 'Hoften i niveau'],
      '3': ['Nederste arm arbejder'],
      '4': ['Dobbelt skulderbredde', 'Strakt arm hjælper mindst'],
      '5': ['Fødderne bredt', 'Hoften i niveau'],
      '6': ['Frie hånd på lænden'],
      '7': ['Ingen vridning'],
    },
  },
  {
    id: 'shoulder',
    section: 'Skuldre: pike til håndstand',
    short: 'Skuldre',
    progression: 'double',
    category: 'ladder',
    stepWith: { '3': 'shoulder.2' },
  },
  { id: 'pull', section: 'Træk: rows', short: 'Træk', progression: 'double', category: 'ladder' },
  {
    id: 'legs',
    section: 'Ben: split squat til pistol',
    short: 'Ben',
    progression: 'double',
    category: 'ladder',
    tags: ['heavy_legs'],
  },
  {
    id: 'wallsit',
    section: 'Wall sit, squats og lægge',
    short: 'Wall sit',
    progression: 'hold',
    category: 'ladder',
  },
  {
    id: 'posterior',
    section: 'Bagkæde: baglår og baller',
    short: 'Bagkæde',
    progression: 'double',
    category: 'ladder',
    stepTags: { '4': ['nordic'], '5': ['nordic'], '6': ['nordic'] },
  },
  {
    id: 'core_front',
    section: 'Mave 1: front',
    short: 'Mave front',
    progression: 'double',
    category: 'ladder',
  },
  {
    id: 'core_side',
    section: 'Mave 2: side og rotation',
    sub: 'Side',
    name: 'Mave 2: side',
    short: 'Mave side',
    progression: 'double',
    category: 'ladder',
  },
  {
    id: 'core_rot',
    section: 'Mave 2: side og rotation',
    sub: 'Rotation',
    name: 'Mave 2: rotation',
    short: 'Rotation',
    progression: 'double',
    category: 'extra',
  },
  {
    id: 'core_situp',
    section: 'Mave 3: sit-ups',
    short: 'Sit-ups',
    progression: 'double',
    category: 'ladder',
  },
  {
    id: 'groin',
    section: 'Lyske: Copenhagen',
    short: 'Lyske',
    progression: 'double',
    category: 'ladder',
  },
  {
    id: 'power_legs',
    section: 'Power: ben',
    short: 'Power ben',
    progression: 'power',
    category: 'power',
    tags: ['heavy_legs'],
  },
  {
    id: 'power_upper',
    section: 'Power: overkrop',
    short: 'Power overkrop',
    progression: 'power',
    category: 'power',
  },
  {
    id: 'burpee_skill',
    section: 'Teknik og varianter',
    sub: 'Varianterne',
    short: 'Burpee-varianter',
    progression: 'manual',
    category: 'extra',
    idPrefix: 'V',
  },
  { id: 'neck', section: 'Nakke-stigen', short: 'Nakke', progression: 'neck', category: 'extra' },
];

const EMOM: Meta & { section: string; levels: Record<string, Level> } = {
  id: 'burpee_emom',
  section: 'Burpees: kapacitet',
  short: 'Burpees',
  progression: 'emom',
  category: 'power',
  // The page-11 table: Start »EMOM 4 × 3«, Imponerende »EMOM 10 × 8«.
  levels: { E1: 'basis', E9: 'imponerende' },
};

/** DECISIONS.md P6: 2 × 1, 2 × 2, 1 × 3, 5 i træk, 5 på knoer, 5 som diamond (page 13). */
const CLUB: Meta & {
  section: string;
  steps: Array<{ key: string; name: string; sets: number; rounds: number; text: string }>;
} = {
  id: 'club_sequence',
  section: 'Klubsekvensen',
  short: 'Klubsekvensen',
  progression: 'rounds',
  category: 'extra',
  steps: [
    { key: 'C1', name: 'Klubsekvensen', sets: 2, rounds: 1, text: '2 × 1 runde' },
    { key: 'C2', name: 'Klubsekvensen', sets: 2, rounds: 2, text: '2 × 2 runder' },
    { key: 'C3', name: 'Klubsekvensen', sets: 1, rounds: 3, text: '1 × 3 runder' },
    { key: 'C4', name: 'Klubsekvensen', sets: 1, rounds: 5, text: '5 runder i træk' },
    {
      key: 'C5',
      name: 'Klubsekvensen på knoer',
      sets: 1,
      rounds: 5,
      text: '5 runder i træk på knoer',
    },
    {
      key: 'C6',
      name: 'Klubsekvensen som diamond',
      sets: 1,
      rounds: 5,
      text: '5 runder i træk som diamond',
    },
  ],
};

const CALF: Meta = { id: 'calf', short: 'Læg', progression: 'load', category: 'extra' };
const SL_RDL: Meta = {
  id: 'sl_rdl',
  short: 'Etbens RDL',
  progression: 'load',
  category: 'extra',
  tags: ['heavy_legs_if_loaded'],
};
const BACKPACK_ROW: Meta = {
  id: 'backpack_row',
  short: 'Rygsæk-row',
  progression: 'load',
  category: 'extra',
};

// ---------------------------------------------------------------------------------------------
// Reading the source
// ---------------------------------------------------------------------------------------------

interface Section {
  title: string;
  /** From the section's `<sub>PDF side N</sub>`; 0 for the appendix. */
  page: number;
  lines: string[];
}

interface Table {
  /** The nearest `###` heading above the table. */
  sub: string | undefined;
  header: string[];
  rows: string[][];
  /** The section's lines after the table. */
  after: string[];
}

function group(match: RegExpExecArray | null, index: number, what: string): string {
  const value = match?.[index];
  if (value === undefined) throw new Error(`convert-program: cannot read ${what}`);
  return value;
}

/** Removes the source's bold markers. */
function plain(text: string): string {
  return text.replaceAll('**', '');
}

function parseSections(markdown: string): Section[] {
  const sections: Section[] = [];
  for (const line of markdown.split('\n')) {
    const heading = /^#{1,2} (.+)$/.exec(line);
    if (heading) {
      sections.push({ title: group(heading, 1, 'heading'), page: 0, lines: [] });
      continue;
    }
    const current = sections.at(-1);
    if (!current) continue;
    current.lines.push(line);
    const page = /^<sub>PDF side (\d+)<\/sub>$/.exec(line);
    if (page) current.page = Number(group(page, 1, 'page'));
  }
  return sections;
}

function cells(line: string): string[] {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function tablesIn(section: Section): Table[] {
  const tables: Table[] = [];
  const lines = section.lines;
  let sub: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const heading = /^### (.+)$/.exec(line);
    if (heading) sub = group(heading, 1, 'sub-heading');
    if (!line.startsWith('|')) continue;
    let end = i;
    while ((lines[end] ?? '').startsWith('|')) end++;
    const [header = [], , ...rows] = lines.slice(i, end).map(cells);
    tables.push({ sub, header, rows, after: lines.slice(end) });
    i = end - 1;
  }
  return tables;
}

const SECTIONS = parseSections(readFileSync(SOURCE, 'utf8'));

function sectionNamed(title: string): Section {
  const section = SECTIONS.find((s) => s.title === title);
  if (!section) throw new Error(`convert-program: no section »${title}« in PROGRAM_KILDE.md`);
  return section;
}

function lineStarting(section: Section, prefix: string): string {
  const line = section.lines.find((l) => l.startsWith(prefix));
  if (line === undefined)
    throw new Error(`convert-program: no line »${prefix}…« in ${section.title}`);
  return line;
}

/** The text block right after a table, unless it is a box, a heading, a page number or a run-in paragraph. */
function noteAfter(lines: string[]): string | undefined {
  const start = lines.findIndex((line) => line.trim() !== '');
  if (start < 0) return undefined;
  const end = lines.indexOf('', start);
  const block = lines.slice(start, end < 0 ? undefined : end);
  if (/^(>|<sub>|#|\*\*)/.test(block[0] ?? '')) return undefined;
  if (block.every((line) => line.startsWith('- '))) {
    return block.map((line) => plain(line.slice(2))).join('\n');
  }
  return plain(block.join(' '));
}

/** The page's Coach, Fysio and Evidens boxes. */
function whyOf(section: Section): Track['why'] {
  const why = section.lines.flatMap((line) => {
    const box = /^> \*\*(Coach|Fysio|Evidens):\*\* (.+)$/.exec(line);
    if (!box) return [];
    const kind = group(box, 1, 'box').toLowerCase() as 'coach' | 'fysio' | 'evidens';
    return [{ kind, text: plain(group(box, 2, 'box text')) }];
  });
  return why.length > 0 ? why : undefined;
}

// ---------------------------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------------------------

const LEVELS: Record<string, Level | undefined> = {
  '': undefined,
  Basis: 'basis',
  Stærk: 'staerk',
  Imponerende: 'imponerende',
  Boss: 'boss',
};

const DOSE = /^(\d+)(?:–(\d+))? × (\d+)(?:–(\d+))?( sek)?(?: pr\. (side|ben|retning))?$/;
const DOSE_IN_TEXT =
  /^(\d+(?:–\d+)? × \d+(?:–\d+)?(?: sek)?(?: pr\. (?:side|ben|retning))?)\. (.+)$/;

function withPer<T extends object>(dose: T, per: string | undefined): T & { per?: Per } {
  return per === undefined ? dose : { ...dose, per: per as Per };
}

/** "3 × 6–12 pr. side" → a structured dose; the track's progression decides the kind. */
function parseDose(text: string, progression: Progression): Dose {
  if (text === 'Altid') return { kind: 'always', text };
  const rounds = /^(\d+)(?:–(\d+))? runder?$/.exec(text);
  if (rounds) {
    const min = Number(group(rounds, 1, text));
    return { kind: 'rounds', sets: 1, rounds: [min, Number(rounds[2] ?? min)], text };
  }
  const match = DOSE.exec(text);
  if (!match) throw new Error(`convert-program: unknown dose »${text}«`);
  const setsMin = Number(group(match, 1, text));
  const amountMin = Number(group(match, 3, text));
  const sets: [number, number] = [setsMin, Number(match[2] ?? setsMin)];
  const amount: [number, number] = [amountMin, Number(match[4] ?? amountMin)];
  const per = match[6];
  if (progression === 'manual') {
    if (sets[0] !== sets[1] || amount[0] !== amount[1]) {
      throw new Error(`convert-program: a fixed dose has no range: »${text}«`);
    }
    return withPer({ kind: 'fixed' as const, sets: sets[0], reps: amount[0] }, per);
  }
  if (match[5]) return withPer({ kind: 'hold' as const, sets, seconds: amount }, per);
  if (progression === 'power') return withPer({ kind: 'power' as const, sets, reps: amount }, per);
  return withPer({ kind: 'reps' as const, sets, reps: amount }, per);
}

/** Sentences of an execution text; "ca. 45°" does not end a sentence. */
function sentences(text: string): string[] {
  const result: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (!'.?!'.includes(text.charAt(i))) continue;
    const atEnd = i === text.length - 1;
    if (!atEnd && !/^ [A-ZÆØÅ0-9]/.test(text.slice(i + 1, i + 3))) continue;
    if (/(^|\s)(ca|fx|kl|pr)\.$/.test(text.slice(start, i + 1))) continue;
    result.push(text.slice(start, i + 1));
    start = i + 2;
  }
  if (start < text.length) result.push(text.slice(start));
  return result;
}

/** The first one or two sentences of the execution, without the final full stop. */
function cuesOf(execution: string): string[] {
  return sentences(execution)
    .slice(0, 2)
    .map((sentence) => sentence.replace(/\.$/, ''));
}

function makeStep(fields: {
  id: string;
  key: string;
  name: string;
  level?: Level | undefined;
  dose: Dose;
  execution: string;
  cues?: string[] | undefined;
  pdfPage: number;
  tags?: string[] | undefined;
  with?: string | undefined;
}): Step {
  return {
    id: fields.id,
    key: fields.key,
    name: fields.name,
    ...(fields.level ? { level: fields.level } : {}),
    dose: fields.dose,
    execution: fields.execution,
    cues: fields.cues ?? cuesOf(fields.execution),
    pdfPage: fields.pdfPage,
    ...(fields.tags ? { tags: fields.tags } : {}),
    ...(fields.with ? { with: fields.with } : {}),
  };
}

function makeTrack(
  meta: Meta,
  fields: {
    name: string;
    pdfPage: number;
    note?: string | undefined;
    why?: Track['why'];
    steps: Step[];
  },
): Track {
  return {
    id: meta.id,
    name: fields.name,
    short: meta.short,
    pdfPage: fields.pdfPage,
    progression: meta.progression,
    category: meta.category,
    ...(meta.tags ? { tags: meta.tags } : {}),
    ...(fields.note !== undefined ? { note: fields.note } : {}),
    ...(meta.painCue ? { painCue: meta.painCue } : {}),
    ...(fields.why ? { why: fields.why } : {}),
    steps: fields.steps,
  };
}

// ---------------------------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------------------------

function tableTrack(config: TableTrack): Track {
  const section = sectionNamed(config.section);
  const table = tablesIn(section).find((t) => t.sub === config.sub && t.header[0] === 'Trin');
  if (!table) throw new Error(`convert-program: no step table for ${config.id}`);
  const column = (row: string[], name: string): string => {
    const value = row[table.header.indexOf(name)];
    if (value === undefined) throw new Error(`convert-program: no column ${name} in ${config.id}`);
    return value;
  };
  const steps = table.rows.map((row) => {
    const key = column(row, 'Trin');
    const level = LEVELS[column(row, 'Niveau')];
    return makeStep({
      id: `${config.id}.${config.idPrefix ?? ''}${key}`,
      key,
      name: column(row, 'Øvelse'),
      level,
      dose: parseDose(column(row, 'Dosis'), config.progression),
      execution: column(row, 'Udførelse'),
      cues: config.cues?.[key],
      pdfPage: section.page,
      tags: config.stepTags?.[key],
      with: config.stepWith?.[key],
    });
  });
  return makeTrack(config, {
    name: config.name ?? section.title,
    pdfPage: section.page,
    note: noteAfter(table.after),
    why: whyOf(section),
    steps,
  });
}

/** E1–E9 from the EMOM table in appendix A; the explanation on page 25. */
function emomTrack(): Track {
  const section = sectionNamed(EMOM.section);
  const appendix = sectionNamed('Appendiks A: data bag diagrammerne');
  const table = tablesIn(appendix).find((t) => t.header[1] === 'Minutter × burpees');
  if (!table) throw new Error('convert-program: no EMOM table in appendix A');
  const steps = table.rows.map(([key = '', cell = '']) => {
    const match = /^(\d+) × (\d+)$/.exec(cell);
    const minutes = Number(group(match, 1, `EMOM ${key}`));
    const reps = Number(group(match, 2, `EMOM ${key}`));
    return makeStep({
      id: `${EMOM.id}.${key}`,
      key,
      name: `EMOM ${cell}`,
      level: EMOM.levels[key],
      dose: { kind: 'emom', minutes, reps },
      execution: `${minutes} minutter med ${reps} burpees i starten af hvert minut.`,
      pdfPage: section.page,
    });
  });
  return makeTrack(EMOM, {
    name: section.title,
    pdfPage: section.page,
    note: plain(lineStarting(section, '**EMOM**')),
    why: whyOf(section),
    steps,
  });
}

/** C1–C6 (P6); the round itself is the numbered list on page 13 and becomes the note. */
function clubTrack(): Track {
  const section = sectionNamed(CLUB.section);
  const round = section.lines.filter((line) => /^\d+\. /.test(line));
  const steps = CLUB.steps.map((step) =>
    makeStep({
      id: `${CLUB.id}.${step.key}`,
      key: step.key,
      name: step.name,
      dose: {
        kind: 'rounds',
        sets: step.sets,
        rounds: [step.rounds, step.rounds],
        text: step.text,
      },
      execution: `${step.text}.`,
      pdfPage: section.page,
    }),
  );
  return makeTrack(CLUB, {
    name: section.title,
    pdfPage: section.page,
    note: round.join('\n'),
    why: whyOf(section),
    steps,
  });
}

/** "**Læg og fødder (Styrke A):** etbens tåløft på et trappetrin, 2 × 12–20 pr. ben. 3 sek ned, …" */
function calfTrack(): Track {
  const section = sectionNamed('Wall sit, squats og lægge');
  const line = lineStarting(section, '**Læg og fødder');
  const match = /^\*\*(.+) \(Styrke A\):\*\* (.+?), (.+?) _\(piktogram: .+\)_$/.exec(line);
  const name = group(match, 2, 'calf exercise');
  const dose = DOSE_IN_TEXT.exec(group(match, 3, 'calf dose'));
  return makeTrack(CALF, {
    name: group(match, 1, 'calf heading'),
    pdfPage: section.page,
    steps: [
      makeStep({
        id: `${CALF.id}.1`,
        key: '1',
        name: name.charAt(0).toUpperCase() + name.slice(1),
        dose: parseDose(group(dose, 1, 'calf dose'), CALF.progression),
        execution: group(dose, 2, 'calf execution'),
        pdfPage: section.page,
      }),
    ],
  });
}

/** "**Etbens RDL (Styrke B):** 3 × 6–10 pr. ben. Skub hoften bagud med lang ryg; …" */
function slRdlTrack(): Track {
  const section = sectionNamed('Bagkæde: baglår og baller');
  const line = lineStarting(section, '**Etbens RDL');
  const match = /^\*\*(.+) \(Styrke B\):\*\* (.+?) _\(piktogram: .+\)_$/.exec(line);
  const name = group(match, 1, 'RDL heading');
  const dose = DOSE_IN_TEXT.exec(group(match, 2, 'RDL dose'));
  return makeTrack(SL_RDL, {
    name,
    pdfPage: section.page,
    steps: [
      makeStep({
        id: `${SL_RDL.id}.1`,
        key: '1',
        name,
        dose: parseDose(group(dose, 1, 'RDL dose'), SL_RDL.progression),
        execution: group(dose, 2, 'RDL execution'),
        pdfPage: section.page,
      }),
    ],
  });
}

/**
 * "I Styrke B laver du altid rygsæk-row, 3 × 8–15 pr. side. Læg mere i tasken, når du rammer 15."
 * (page 15). The exercise is step 1 of the pull ladder; the name comes from the Styrke B table.
 */
function backpackRowTrack(): Track {
  const section = sectionNamed('Træk: rows');
  const pullTable = tablesIn(section).find((t) => t.header[0] === 'Trin');
  const first = pullTable?.rows[0];
  const header = pullTable?.header ?? [];
  const exercise = first?.[header.indexOf('Øvelse')];
  const execution = first?.[header.indexOf('Udførelse')];
  if (exercise === undefined || execution === undefined) {
    throw new Error('convert-program: no rygsæk-row in the pull table');
  }
  const line = lineStarting(section, 'I Styrke B laver du altid rygsæk-row, ');
  const dose = DOSE_IN_TEXT.exec(line.slice('I Styrke B laver du altid rygsæk-row, '.length));
  const sessionB = tablesIn(sectionNamed('Styrke B'))[0];
  const pair1 = sessionB?.rows.find((row) => row[0] === 'Par 1')?.[1] ?? '';
  const name = group(/\+ (Træk: rygsæk-row)$/.exec(pair1), 1, 'Styrke B, par 1');
  return makeTrack(BACKPACK_ROW, {
    name,
    pdfPage: section.page,
    steps: [
      makeStep({
        id: `${BACKPACK_ROW.id}.1`,
        key: '1',
        name: exercise,
        dose: parseDose(group(dose, 1, 'rygsæk-row dose'), BACKPACK_ROW.progression),
        execution: `${execution} ${group(dose, 2, 'rygsæk-row text')}`,
        pdfPage: section.page,
      }),
    ],
  });
}

// ---------------------------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------------------------

function isPrimitive(value: unknown): boolean {
  return value === null || typeof value !== 'object';
}

/** JSON with small objects on one line; Prettier then breaks what does not fit. */
function toJson(value: unknown, indent = ''): string {
  if (Array.isArray(value)) {
    if (value.every(isPrimitive)) return `[${value.map((v) => JSON.stringify(v)).join(', ')}]`;
    const inner = `${indent}  `;
    return `[\n${value.map((v) => inner + toJson(v, inner)).join(',\n')}\n${indent}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    const leaf = entries.every(
      ([, v]) => isPrimitive(v) || (Array.isArray(v) && v.every(isPrimitive)),
    );
    if (leaf)
      return `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${toJson(v)}`).join(', ')} }`;
    const inner = `${indent}  `;
    const body = entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${toJson(v, inner)}`);
    return `{\n${body.join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
}

export function buildTracks(): Track[] {
  return [
    ...TABLE_TRACKS.map(tableTrack),
    emomTrack(),
    clubTrack(),
    calfTrack(),
    slRdlTrack(),
    backpackRowTrack(),
  ];
}

/** File name → formatted content for program/tracks/. */
export async function buildTrackFiles(): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  for (const track of buildTracks()) {
    const path = join(OUT_DIR, `${track.id}.json`);
    const options = (await resolveConfig(path)) ?? {};
    files.set(`${track.id}.json`, await format(toJson(track), { ...options, filepath: path }));
  }
  return files;
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const files = await buildTrackFiles();
  for (const [name, content] of files) writeFileSync(join(OUT_DIR, name), content);
  console.log(`convert-program: wrote ${files.size} files to program/tracks/`);
}

if (import.meta.main) await main();
