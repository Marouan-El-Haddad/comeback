// Compares program/*.json with the source, docs/PROGRAM_KILDE.md, and with the parts of
// docs/ENGINE.md that turn the source into data (5.12, 6.3, 7.2). The programme data must never
// need checking by hand: every text is compared character for character, every dose is rendered
// back to the source's wording, and structured fields are derived from the source's wording.
// Bold markers (**) are removed from the source's text; everything else is kept as it is.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTrackFiles } from '../../../scripts/convert-program.ts';
import { formatDose } from '../format.ts';
import type {
  BoardRow,
  Boss,
  Dose,
  Level,
  Measure,
  MotorPlan,
  PictoRef,
  Requirement,
  Requires,
  Routine,
  Step,
  Track,
  Week,
} from '../types.ts';
import {
  boxes,
  cell,
  codeUnder,
  firstBlock,
  linesUnder,
  must,
  plain,
  readJson,
  readText,
  records,
  section,
  sentences,
  tableWith,
  type Row,
  type Section,
} from './helpers/kilde.ts';

const KILDE = readText('docs/PROGRAM_KILDE.md');
const ENGINE = readText('docs/ENGINE.md');

const track = (id: string): Track => readJson<Track>(`program/tracks/${id}.json`);
const PICTOS = readJson<Record<string, PictoRef>>('program/pictos.json');

const LEVELS: Record<string, Level | undefined> = {
  '': undefined,
  Basis: 'basis',
  Stærk: 'staerk',
  Imponerende: 'imponerende',
  Boss: 'boss',
};

/** The level of a "Niveau" cell; unknown words fail instead of silently meaning »no level«. */
function levelOf(text: string): Level | undefined {
  if (!(text in LEVELS)) throw new Error(`Unknown level »${text}«`);
  return LEVELS[text];
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** The structured dose a "Dosis" cell must give: the kind follows from the wording and the track. */
function expectedKind(text: string, progression: Track['progression']): Dose['kind'] {
  if (text === 'Altid') return 'always';
  if (/runder?$/.test(text)) return 'rounds';
  if (progression === 'manual') return 'fixed';
  if (/ sek( |$)/.test(text)) return 'hold';
  return progression === 'power' ? 'power' : 'reps';
}

/** For rounds: sets and rounds read from the wording ("2–3 runder", "2 × 1 runde", "5 runder i træk"). */
function roundsOf(text: string): { sets: number; rounds: [number, number] } {
  const range = /^(\d+)(?:–(\d+))? runder?$/.exec(text);
  if (range) {
    const min = Number(must(range, 1, text));
    return { sets: 1, rounds: [min, Number(range[2] ?? min)] };
  }
  const times = /^(\d+) × (\d+)(?: runder?)?$/.exec(text);
  if (times) {
    const rounds = Number(must(times, 2, text));
    return { sets: Number(must(times, 1, text)), rounds: [rounds, rounds] };
  }
  const inARow = /^(\d+) runder i træk/.exec(text);
  const rounds = Number(must(inARow, 1, text));
  return { sets: 1, rounds: [rounds, rounds] };
}

/** The page's Coach, Fysio and Evidens boxes as `Track.why`. */
function whyOf(page: Section): Track['why'] {
  const why = boxes(page.lines)
    .filter((box) => ['Coach', 'Fysio', 'Evidens'].includes(box.label))
    .map((box) => ({
      kind: box.label.toLowerCase() as 'coach' | 'fysio' | 'evidens',
      text: plain(box.text),
    }));
  return why.length > 0 ? why : undefined;
}

/** The text right under a table: a paragraph, or a list as lines. Boxes and run-in paragraphs are not notes. */
function noteUnder(after: string[]): string | undefined {
  const block = firstBlock(after);
  const first = block[0];
  if (first === undefined || /^(>|<sub>|#|\*\*)/.test(first)) return undefined;
  if (block.every((line) => line.startsWith('- '))) {
    return block.map((line) => plain(line.slice(2))).join('\n');
  }
  return plain(block.join(' '));
}

// ---------------------------------------------------------------------------------------------
// Tracks with a step table
// ---------------------------------------------------------------------------------------------

interface TableSource {
  id: string;
  /** The page's `##` heading. */
  section: string;
  /** The `###` heading above the table, when the page has more than one. */
  heading?: string;
  /** The track's name is "<section before the colon>: <heading in lower case>". */
  nameFromHeading?: boolean;
}

const TABLE_TRACKS: TableSource[] = [
  { id: 'press', section: 'Pres: push-ups' },
  { id: 'shoulder', section: 'Skuldre: pike til håndstand' },
  { id: 'pull', section: 'Træk: rows' },
  { id: 'legs', section: 'Ben: split squat til pistol' },
  { id: 'wallsit', section: 'Wall sit, squats og lægge' },
  { id: 'posterior', section: 'Bagkæde: baglår og baller' },
  { id: 'core_front', section: 'Mave 1: front' },
  { id: 'core_side', section: 'Mave 2: side og rotation', heading: 'Side', nameFromHeading: true },
  {
    id: 'core_rot',
    section: 'Mave 2: side og rotation',
    heading: 'Rotation',
    nameFromHeading: true,
  },
  { id: 'core_situp', section: 'Mave 3: sit-ups' },
  { id: 'groin', section: 'Lyske: Copenhagen' },
  { id: 'power_legs', section: 'Power: ben' },
  { id: 'power_upper', section: 'Power: overkrop' },
  { id: 'burpee_skill', section: 'Teknik og varianter', heading: 'Varianterne' },
  { id: 'neck', section: 'Nakke-stigen' },
];

/** Tracks with text under their table (a guard against the note rule silently finding nothing). */
const WITH_NOTE = [
  'pull',
  'core_front',
  'core_rot',
  'power_legs',
  'power_upper',
  'burpee_skill',
  'neck',
];

/** The step-id prefix before the source's number (ENGINE.md section 2: burpee_skill.V1 … V5). */
const ID_PREFIX: Record<string, string> = { burpee_skill: 'V' };

function stepRows(source: TableSource): Row[] {
  return records(tableWith(section(KILDE, source.section).lines, 'Trin', source.heading));
}

describe('tracks with a step table (PROGRAM_KILDE.md)', () => {
  for (const source of TABLE_TRACKS) {
    const page = section(KILDE, source.section);
    const table = tableWith(page.lines, 'Trin', source.heading);
    const rows = records(table);
    const data = track(source.id);

    it(`${source.id}: name and page from »${source.section}«`, () => {
      const name = source.nameFromHeading
        ? `${source.section.split(':')[0]}: ${(source.heading ?? '').toLowerCase()}`
        : source.section;
      expect({ name: data.name, pdfPage: data.pdfPage }).toEqual({ name, pdfPage: page.page });
    });

    it(`${source.id}: every step is its row in the table (Trin, Øvelse, Niveau, Dosis, Udførelse)`, () => {
      const fromData = data.steps.map((step) => ({
        id: step.id,
        key: step.key,
        name: step.name,
        level: step.level,
        dose: formatDose(step.dose),
        kind: step.dose.kind,
        // formatDose prints only the text of a rounds dose; its numbers must match the text.
        rounds:
          step.dose.kind === 'rounds'
            ? { sets: step.dose.sets, rounds: step.dose.rounds }
            : undefined,
        execution: step.execution,
        pdfPage: step.pdfPage,
      }));
      const fromSource = rows.map((row) => {
        const kind = expectedKind(cell(row, 'Dosis'), data.progression);
        return {
          id: `${source.id}.${ID_PREFIX[source.id] ?? ''}${cell(row, 'Trin')}`,
          key: cell(row, 'Trin'),
          name: cell(row, 'Øvelse'),
          level: levelOf(cell(row, 'Niveau')),
          dose: cell(row, 'Dosis'),
          kind,
          rounds: kind === 'rounds' ? roundsOf(cell(row, 'Dosis')) : undefined,
          execution: cell(row, 'Udførelse'),
          pdfPage: page.page,
        };
      });
      expect(fromData).toEqual(fromSource);
    });

    it(`${source.id}: note is the text under the table, Hvorfor the page's boxes`, () => {
      expect(data.note).toEqual(noteUnder(table.after));
      expect(data.note !== undefined).toBe(WITH_NOTE.includes(source.id));
      expect(data.why).toEqual(whyOf(page));
    });
  }
});

// ---------------------------------------------------------------------------------------------
// Tracks without a step table
// ---------------------------------------------------------------------------------------------

describe('tracks without a step table (PROGRAM_KILDE.md)', () => {
  it('calf: the »Læg og fødder« paragraph on page 17', () => {
    const page = section(KILDE, 'Wall sit, squats og lægge');
    const line = page.lines.find((l) => l.startsWith('**Læg og fødder')) ?? '';
    const [text] = line.split(' _(piktogram: ');
    const data = track('calf');
    const [step] = data.steps;
    expect(data.steps).toHaveLength(1);
    if (!step) return;
    expect(text).toBe(
      `**${data.name} (Styrke A):** ${lowerFirst(step.name)}, ${formatDose(step.dose)}. ${step.execution}`,
    );
    expect(step).toMatchObject({ id: 'calf.1', key: '1', pdfPage: page.page });
    expect(step.level).toBeUndefined();
    expect(step.dose).toMatchObject({ kind: 'reps', per: 'ben' });
    expect(data.pdfPage).toBe(page.page);
    expect(data.note).toBeUndefined();
    expect(data.why).toBeUndefined();
  });

  it('sl_rdl: the »Etbens RDL« paragraph on page 18', () => {
    const page = section(KILDE, 'Bagkæde: baglår og baller');
    const line = page.lines.find((l) => l.startsWith('**Etbens RDL')) ?? '';
    const [text] = line.split(' _(piktogram: ');
    const data = track('sl_rdl');
    const [step] = data.steps;
    expect(data.steps).toHaveLength(1);
    if (!step) return;
    expect(text).toBe(`**${data.name} (Styrke B):** ${formatDose(step.dose)}. ${step.execution}`);
    expect(step).toMatchObject({ id: 'sl_rdl.1', key: '1', name: data.name, pdfPage: page.page });
    expect(step.level).toBeUndefined();
    expect(step.dose).toMatchObject({ kind: 'reps', per: 'ben' });
    expect(data.pdfPage).toBe(page.page);
    expect(data.note).toBeUndefined();
    expect(data.why).toBeUndefined();
  });

  it('backpack_row: »I Styrke B laver du altid rygsæk-row …« (page 15) and pull step 1', () => {
    const page = section(KILDE, 'Træk: rows');
    const pullFirst = records(tableWith(page.lines, 'Trin'))[0] ?? {};
    const prefix = 'I Styrke B laver du altid rygsæk-row, ';
    const line = page.lines.find((l) => l.startsWith(prefix)) ?? '';
    const data = track('backpack_row');
    const [step] = data.steps;
    expect(data.steps).toHaveLength(1);
    if (!step) return;
    // The exercise is pull step 1; the paragraph gives the dose and the load rule.
    expect(step.name).toBe(cell(pullFirst, 'Øvelse'));
    const pullExecution = cell(pullFirst, 'Udførelse');
    expect(step.execution.startsWith(`${pullExecution} `)).toBe(true);
    const rest = step.execution.slice(pullExecution.length + 1);
    expect(line).toBe(`${prefix}${formatDose(step.dose)}. ${rest}`);
    expect(step).toMatchObject({ id: 'backpack_row.1', key: '1', pdfPage: page.page });
    expect(step.level).toBeUndefined();
    // The name is the one Styrke B's table uses (page 30).
    const pair1 = records(tableWith(section(KILDE, 'Styrke B').lines, 'Del')).find(
      (row) => row.Del === 'Par 1',
    );
    expect(pair1?.['Øvelse']?.endsWith(`+ ${data.name}`)).toBe(true);
    expect(data.pdfPage).toBe(page.page);
    expect(data.note).toBeUndefined();
    expect(data.why).toBeUndefined();
  });

  it('burpee_emom: the EMOM table in appendix A, explained on page 25', () => {
    const page = section(KILDE, 'Burpees: kapacitet');
    const appendix = section(KILDE, 'Appendiks A: data bag diagrammerne');
    const rows = records(tableWith(appendix.lines, 'Trin'));
    const data = track('burpee_emom');
    const fromData = data.steps.map((step) => ({
      id: step.id,
      key: step.key,
      name: step.name,
      dose: formatDose(step.dose),
      kind: step.dose.kind,
      total: step.dose.kind === 'emom' ? step.dose.minutes * step.dose.reps : NaN,
      execution: step.execution,
      pdfPage: step.pdfPage,
    }));
    const fromSource = rows.map((row) => {
      const [minutes, reps] = cell(row, 'Minutter × burpees').split(' × ');
      return {
        id: `burpee_emom.${cell(row, 'Trin')}`,
        key: cell(row, 'Trin'),
        name: `EMOM ${cell(row, 'Minutter × burpees')}`,
        dose: cell(row, 'Minutter × burpees'),
        kind: 'emom',
        total: Number(cell(row, 'Reps i alt')),
        execution: `${minutes} minutter med ${reps} burpees i starten af hvert minut.`,
        pdfPage: page.page,
      };
    });
    expect(fromData).toEqual(fromSource);
    expect({ name: data.name, pdfPage: data.pdfPage }).toEqual({
      name: page.title,
      pdfPage: page.page,
    });
    const explanation = plain(page.lines.find((l) => l.startsWith('**EMOM**')) ?? '');
    expect(data.note).toBe(explanation);
    const e3 = data.steps.find((s) => s.key === 'E3')?.dose;
    expect(
      e3?.kind === 'emom' &&
        explanation.endsWith(`E3 er ${e3.minutes} minutter med ${e3.reps} burpees.`),
    ).toBe(true);
    expect(data.why).toEqual(whyOf(page));
  });

  it('burpee_emom: E1 is Basis and E9 Imponerende (the Burpees row on page 11)', () => {
    const rows = records(tableWith(section(KILDE, 'Ti stiger og tre power-spor').lines, 'Spor'));
    const burpees = rows.find((row) => row.Spor === 'Burpees') ?? {};
    const levels = Object.fromEntries(
      track('burpee_emom')
        .steps.filter((step) => step.level)
        .map((step) => [step.name, step.level]),
    );
    expect(levels).toEqual({
      [cell(burpees, 'Start')]: 'basis',
      [cell(burpees, 'Imponerende')]: 'imponerende',
    });
  });

  it('club_sequence: the round and the progression on page 13 (DECISIONS.md P6)', () => {
    const page = section(KILDE, 'Klubsekvensen');
    const data = track('club_sequence');
    expect({ name: data.name, pdfPage: data.pdfPage }).toEqual({
      name: page.title,
      pdfPage: page.page,
    });
    expect(data.note).toBe(page.lines.filter((line) => /^\d+\. /.test(line)).join('\n'));
    expect(data.why).toEqual(whyOf(page));
    // »2 × 1 runde, så 2 × 2, så 1 × 3 og til sidst 5 runder i træk. Derefter på knoer, så som diamond.«
    const progression =
      /^\*\*Progression:\*\* (.+), så (.+), så (.+) og til sidst (.+)\. Derefter (.+), så (.+)\.$/.exec(
        page.lines.find((line) => line.startsWith('**Progression:**')) ?? '',
      );
    const part = (i: number): string => must(progression, i, 'the progression');
    const [first, second, third, last, knuckles, diamond] = [1, 2, 3, 4, 5, 6].map(part) as [
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    const doses = [
      first,
      `${second} runder`,
      `${third} runder`,
      last,
      `${last} ${knuckles}`,
      `${last} ${diamond}`,
    ];
    const variants = ['', '', '', '', knuckles, diamond];
    const fromData = data.steps.map((step) => ({
      id: step.id,
      key: step.key,
      name: step.name,
      level: step.level,
      dose: formatDose(step.dose),
      structure:
        step.dose.kind === 'rounds' ? { sets: step.dose.sets, rounds: step.dose.rounds } : null,
      execution: step.execution,
      pdfPage: step.pdfPage,
    }));
    const fromSource = doses.map((dose, i) => ({
      id: `club_sequence.C${i + 1}`,
      key: `C${i + 1}`,
      name: variants[i] ? `${page.title} ${variants[i]}` : page.title,
      level: undefined,
      dose,
      structure: roundsOf(dose),
      execution: `${dose}.`,
      pdfPage: page.page,
    }));
    expect(fromData).toEqual(fromSource);
  });
});

describe('the ladders on page 11', () => {
  const SPOR: Record<string, string> = {
    Pres: 'press',
    Skuldre: 'shoulder',
    Træk: 'pull',
    Ben: 'legs',
    'Wall sit': 'wallsit',
    Bagkæde: 'posterior',
    'Mave: front': 'core_front',
    'Mave: side': 'core_side',
    'Mave: sit-ups': 'core_situp',
    Lyske: 'groin',
    'Power: ben': 'power_legs',
    'Power: overkrop': 'power_upper',
    Burpees: 'burpee_emom',
  };
  const rows = records(tableWith(section(KILDE, 'Ti stiger og tre power-spor').lines, 'Spor'));

  it('every row is a track; its start is step 1 (Basis) and its Imponerende step is named', () => {
    expect(rows.map((row) => row.Spor)).toEqual(Object.keys(SPOR));
    for (const row of rows) {
      const data = track(SPOR[cell(row, 'Spor')] ?? '');
      const [first] = data.steps;
      const impressive = data.steps.filter((step) => step.level === 'imponerende');
      expect(first?.level, data.id).toBe('basis');
      expect(first?.name.toLowerCase(), data.id).toContain(cell(row, 'Start').toLowerCase());
      expect(impressive, data.id).toHaveLength(1);
      expect(impressive[0]?.name.toLowerCase(), data.id).toContain(
        cell(row, 'Imponerende').toLowerCase(),
      );
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Cues and the press.json example
// ---------------------------------------------------------------------------------------------

interface ExampleStep {
  id: string;
  key: string;
  name: string;
  level?: Level;
  dose: { kind: string; sets: [number, number]; reps: [number, number]; perSide?: boolean };
  execution: string;
  cues: string[];
  picto: string;
  pdfPage: number;
}

const EXAMPLE = JSON.parse(codeUnder(ENGINE, '### 7.2')) as {
  id: string;
  name: string;
  pdfPage: number;
  progression: string;
  steps: ExampleStep[];
};

describe('cues', () => {
  it('press: the cues of the press.json example in ENGINE.md 7.2', () => {
    expect(track('press').steps.map((step) => step.cues)).toEqual(
      EXAMPLE.steps.map((step) => step.cues),
    );
  });

  it('every other step: the first one or two sentences of its execution, without the full stop', () => {
    const ids = readdirSync(join(process.cwd(), 'program', 'tracks'))
      .map((file) => file.replace(/\.json$/, ''))
      .filter((id) => id !== 'press');
    for (const id of ids) {
      for (const step of track(id).steps) {
        const expected = sentences(step.execution)
          .slice(0, 2)
          .map((sentence) => sentence.replace(/\.$/, ''));
        expect(step.cues, step.id).toEqual(expected);
      }
    }
  });

  it('pain cue: only press has one, the wrist sentence of »Comeback-fælden« (page 46, ENGINE.md 5.5)', () => {
    const page = section(KILDE, 'Reglerne');
    const trap = linesUnder(page.lines.join('\n'), '### Comeback-fælden');
    const onPage = firstBlock(trap).flatMap((line) => sentences(line.replace(/^- /, '')));
    const press = track('press');
    expect(onPage).toContain(press.painCue);
    expect(press.painCue).toContain('tag dem på knoer');
    const ids = readdirSync(join(process.cwd(), 'program', 'tracks')).map((f) =>
      f.replace(/\.json$/, ''),
    );
    expect(ids.filter((id) => track(id).painCue !== undefined)).toEqual(['press']);
  });
});

describe('the press.json example in ENGINE.md 7.2', () => {
  it('agrees with press.json except the set count (the table says 3 ×) and the moved picto field', () => {
    const press = track('press');
    expect({
      id: press.id,
      name: press.name,
      pdfPage: press.pdfPage,
      progression: press.progression,
    }).toEqual({
      id: EXAMPLE.id,
      name: EXAMPLE.name,
      pdfPage: EXAMPLE.pdfPage,
      progression: EXAMPLE.progression,
    });
    const view = (step: Step) => ({
      id: step.id,
      key: step.key,
      name: step.name,
      level: step.level,
      kind: step.dose.kind,
      reps: step.dose.kind === 'reps' ? step.dose.reps : null,
      perSide: step.dose.kind === 'reps' && step.dose.per === 'side',
      execution: step.execution,
      cues: step.cues,
      picto: PICTOS[step.id]?.picto,
      pdfPage: step.pdfPage,
    });
    expect(press.steps.map(view)).toEqual(
      EXAMPLE.steps.map((step) => ({
        id: step.id,
        key: step.key,
        name: step.name,
        level: step.level,
        kind: step.dose.kind,
        reps: step.dose.reps,
        perSide: step.dose.perSide === true,
        execution: step.execution,
        cues: step.cues,
        picto: step.picto,
        pdfPage: step.pdfPage,
      })),
    );
  });
});

// ---------------------------------------------------------------------------------------------
// Weeks
// ---------------------------------------------------------------------------------------------

/** A motor cell of ENGINE.md 6.3 as a MotorPlan. */
function motorOf(text: string): MotorPlan {
  const check = /^base (\d+) \(base-check\)$/.exec(text);
  if (check) return { type: 'base_check', minutes: Number(check[1]) };
  const base = /^base (\d+)(?: \+ (\d+) stigningsløb)?$/.exec(text);
  if (base) {
    const minutes = Number(base[1]);
    return base[2]
      ? { type: 'base', minutes, strides: Number(base[2]) }
      : { type: 'base', minutes };
  }
  if (text === 'cooper/base-check') return { type: 'cooper_or_base' };
  if (text === 'cooper') return { type: 'cooper_or_base', cooperOnly: true };
  const intervals = /^30\/15: (\d+) × (\d+)$/.exec(text);
  if (intervals) {
    return { type: 'intervals_30_15', series: Number(intervals[1]), reps: Number(intervals[2]) };
  }
  const fight = /^kamp-runder (\d+) × 3$/.exec(text);
  if (fight) return { type: 'fight_rounds', rounds: Number(fight[1]), sprints: false };
  const sprints = /^(\d+) × 3 \+ 2 × 6 sprints$/.exec(text);
  if (sprints) return { type: 'fight_rounds', rounds: Number(sprints[1]), sprints: true };
  throw new Error(`Unknown motor cell »${text}«`);
}

/** A row of the week table in ENGINE.md 6.3 as the structured fields of a Week. */
function weekOf(row: Row): Partial<Week> {
  const par12 = /^(\d+)( \(\+1 valgfrit\))?$/.exec(cell(row, 'Sæt par 1–2'));
  const power = /^(\d+)( \(\+1 valgfrit\)| \(maks fart\))?$/.exec(cell(row, 'Power-sæt'));
  const cap = cell(row, 'EMOM-loft');
  const capStep = /^E\d+/.exec(cap)?.[0];
  return {
    pw: Number(cell(row, 'pw')),
    phase: cell(row, 'Fase') as Week['phase'],
    light: cell(row, 'Let') === 'ja',
    sets: {
      par12: Number(must(par12, 1, 'Sæt par 1–2')),
      other: Number(cell(row, 'Sæt øvrige')),
      ...(par12?.[2] ? { optionalPlusOne: true } : {}),
    },
    rirPlan: Number(cell(row, 'Reserve-plan')) as Week['rirPlan'],
    powerSets: Number(must(power, 1, 'Power-sæt')),
    ...(power?.[2] === ' (+1 valgfrit)' ? { powerOptionalPlusOne: true } : {}),
    motor: motorOf(cell(row, 'Motor')),
    emomCap: cap === 'test' ? 'test' : `burpee_emom.${capStep ?? '?'}`,
    ...(cap.endsWith(' fast') ? { emomFixed: true } : {}),
    ...(cap.includes('boss') ? { bossAllowed: true } : {}),
  };
}

describe('weeks', () => {
  const weeks = readJson<Week[]>('program/weeks.json');

  it('text: the wording of the week tables »Uge 1–6« and »Uge 7–12« (pages 37–38)', () => {
    const rows = ['Uge 1–6', 'Uge 7–12'].flatMap((title) =>
      records(tableWith(section(KILDE, title).lines, 'Uge')),
    );
    expect(weeks.map((week) => ({ uge: `Uge ${week.pw}`, ...week.text }))).toEqual(
      rows.map((row) => ({
        uge: cell(row, 'Uge'),
        from: cell(row, 'Fra'),
        phase: cell(row, 'Fase'),
        strength: cell(row, 'Styrke'),
        power: cell(row, 'Power'),
        motor: cell(row, 'Motor (tor)'),
        burpees: cell(row, 'Burpees (tir)'),
        note: cell(row, 'Note'),
      })),
    );
  });

  it('structured fields: the week table in ENGINE.md 6.3', () => {
    const rows = records(tableWith(linesUnder(ENGINE, '### 6.3'), 'pw'));
    // Everything except the source's wording (above) and the measurement flag (below).
    const structured = weeks.map((week) =>
      Object.fromEntries(
        Object.entries(week).filter(([key]) => key !== 'text' && key !== 'measurements'),
      ),
    );
    expect(structured).toEqual(rows.map(weekOf));
  });

  it('measurement weeks: »Uge 1, 4, 8 og 12« (page 40)', () => {
    const context = section(KILDE, 'Målinger').lines.find((l) => l.startsWith('_Kontekst:')) ?? '';
    const listed = must(/^_Kontekst: Uge (.+)_$/.exec(context), 1, 'the weeks')
      .split(/, | og /)
      .map(Number);
    expect(weeks.filter((week) => week.measurements).map((week) => week.pw)).toEqual(listed);
  });

  it('EMOM cap and boss agree with the Burpees column of the source', () => {
    for (const week of weeks) {
      const step = /\bE(\d)\b/.exec(week.text.burpees)?.[1];
      const cap = week.text.burpees.startsWith('Burpee-test') ? 'test' : `burpee_emom.E${step}`;
      expect(week.emomCap, `uge ${week.pw}`).toBe(cap);
      expect(week.bossAllowed === true, `uge ${week.pw}`).toBe(week.text.burpees.includes('boss'));
      expect(week.light, `uge ${week.pw}`).toBe(week.text.phase === 'Let uge');
    }
  });

  it('reserve plan agrees with the load table in appendix A (»1–2« is plan 1)', () => {
    const appendix = section(KILDE, 'Appendiks A: data bag diagrammerne');
    const table = tableWith(appendix.lines, 'Uge');
    const reserve = table.rows.find((row) => row[0] === 'Reserve (RIR)') ?? [];
    expect(weeks.map((week) => week.rirPlan)).toEqual(
      reserve.slice(1).map((value) => Number(value.split('–')[0])),
    );
  });
});

// ---------------------------------------------------------------------------------------------
// Measurements and Målbrættet
// ---------------------------------------------------------------------------------------------

describe('measurements and Målbrættet', () => {
  const { measures, board } = readJson<{ measures: Measure[]; board: BoardRow[] }>(
    'program/measures.json',
  );
  const WEEKDAY: Record<string, Measure['weekday']> = { Tir: 2, Tor: 4, Fre: 5 };

  it('the measurements on page 40: name, Sådan, day, weeks and optional', () => {
    const rows = records(tableWith(section(KILDE, 'Målinger').lines, 'Dag'));
    let day = '';
    const fromSource = rows.map((row) => {
      day = plain(cell(row, 'Dag')) || day;
      const how = cell(row, 'Sådan');
      return {
        name: plain(cell(row, 'Måling')),
        how,
        weekday: WEEKDAY[day],
        weeks: how.startsWith('Uge 4, 8 og 12') ? 'light_only' : 'all_light_and_1',
        optional: how.includes('valgfri') ? true : undefined,
      };
    });
    const fromData = measures.slice(0, rows.length).map((m) => ({
      name: m.name,
      how: m.how,
      weekday: m.weekday,
      weeks: m.weeks,
      optional: m.optional,
    }));
    expect(fromData).toEqual(fromSource);
  });

  it('nordic_depth: the Nordic row of Målbrættet, measured how Nordic-negativer are done', () => {
    const nordic = measures.find((m) => m.id === 'nordic_depth');
    const row = board.find((b) => b.measureId === 'nordic_depth');
    const negatives = stepRows({ id: 'posterior', section: 'Bagkæde: baglår og baller' }).find(
      (r) => r['Øvelse'] === 'Nordic-negativer',
    );
    expect(nordic?.name).toBe(row?.name);
    expect(sentences(cell(negatives ?? {}, 'Udførelse'))).toContain(nordic?.how);
    expect(nordic?.placement).toEqual({
      type: 'after_block',
      trackId: 'posterior',
      minStep: `posterior.${cell(negatives ?? {}, 'Trin')}`,
    });
    expect(measures.indexOf(nordic as Measure)).toBe(measures.length - 1);
  });

  it('Målbrættet: the twelve rows of page 41', () => {
    const rows = records(tableWith(section(KILDE, 'Målbrættet').lines, 'Måling'));
    expect(
      board.map((b) => ({
        name: b.name,
        basis: b.basis,
        staerk: b.staerk,
        imponerende: b.imponerende,
      })),
    ).toEqual(
      rows.map((row) => ({
        name: cell(row, 'Måling'),
        basis: cell(row, 'Basis'),
        staerk: cell(row, 'Stærk'),
        imponerende: cell(row, 'Imponerende'),
      })),
    );
  });

  it('levels and unit of every measure come from its row on Målbrættet', () => {
    const number = (text: string): number => {
      const clock = /^(\d+):(\d\d)$/.exec(text);
      if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
      if (/^\d{1,3}(\.\d{3})*$/.test(text)) return Number(text.replace(/\./g, ''));
      throw new Error(`Not a number on Målbrættet: »${text}«`);
    };
    const unitOf = (name: string): Measure['unit'] => {
      if (name.endsWith(', cm')) return 'cm';
      if (name.endsWith(', meter')) return 'm';
      if (name.endsWith('min:sek') || /, sek\b/.test(name)) return 'sec';
      if (name === 'Nordic') return 'depth';
      return 'reps';
    };
    for (const row of board) {
      if (row.derived) {
        expect(row, row.name).toMatchObject({ derived: 'legs' });
        expect(row.name.startsWith('Ben')).toBe(true);
        expect(row.measureId).toBeUndefined();
        continue;
      }
      const measure = measures.find((m) => m.id === row.measureId);
      expect(measure, row.name).toBeDefined();
      if (!measure) continue;
      expect(measure.unit, row.name).toBe(unitOf(row.name));
      if (measure.unit === 'depth') {
        expect(measure.depthLabels, row.name).toEqual([row.basis, row.staerk, row.imponerende]);
        expect(measure.levels, row.name).toEqual({ basis: 1, staerk: 2, imponerende: 3 });
        continue;
      }
      const [basis, staerk, imponerende] = [row.basis, row.staerk, row.imponerende].map(number);
      expect(measure.levels, row.name).toEqual({
        basis,
        staerk,
        imponerende,
        ...((basis ?? 0) > (imponerende ?? 0) ? { lowerIsBetter: true } : {}),
      });
    }
    const onBoard = board.flatMap((row) => (row.measureId ? [row.measureId] : []));
    expect(new Set(onBoard).size).toBe(onBoard.length);
    expect(
      measures
        .filter((m) => m.levels)
        .map((m) => m.id)
        .sort(),
    ).toEqual([...onBoard].sort());
    expect(board.filter((row) => row.derived)).toHaveLength(1);
  });

  it('base_check has no level and is measured in metres (»Notér distancen«)', () => {
    const baseCheck = measures.find((m) => m.id === 'base_check');
    expect(baseCheck?.levels).toBeUndefined();
    expect(baseCheck?.how).toContain('Notér distancen');
    expect(baseCheck?.unit).toBe('m');
  });
});

// ---------------------------------------------------------------------------------------------
// Requirements: Hero-tavlen, imponer-kataloget, sidegrene; boss-udfordringer
// ---------------------------------------------------------------------------------------------

/** The step with this exact name in a track's source table, as a step id. */
function stepNamed(source: TableSource, name: string): string {
  const row = stepRows(source).find((r) => r['Øvelse'] === name);
  if (!row) throw new Error(`No step »${name}« in ${source.id}`);
  return `${source.id}.${cell(row, 'Trin')}`;
}

function sourceOf(id: string): TableSource {
  const source = TABLE_TRACKS.find((t) => t.id === id);
  if (!source) throw new Error(`No table track ${id}`);
  return source;
}

function performance(
  stepId: string,
  sets: number,
  amount: Partial<Record<'reps' | 'seconds', number>>,
): Requires {
  return { type: 'performance', trackId: stepId.split('.')[0] ?? '', stepId, sets, ...amount };
}

/** A »Klar når« text as a requirement; the words name tracks, steps and measurements in the source. */
function requiresOf(text: string): Requires {
  if (text === 'Altid') return { type: 'always' };
  let m: RegExpExecArray | null;
  if ((m = /^(\d+) push-ups$/.exec(text))) {
    return { type: 'measure', measureId: 'pushups', min: Number(m[1]) };
  }
  if ((m = /^(\d+) på burpee-testen$/.exec(text))) {
    return { type: 'measure', measureId: 'burpee_3min', min: Number(m[1]) };
  }
  if ((m = /^(Pres|Skulder|Power-ben) trin (\d+)$/.exec(text))) {
    const trackId = { Pres: 'press', Skulder: 'shoulder', 'Power-ben': 'power_legs' }[
      m[1] as 'Pres' | 'Skulder' | 'Power-ben'
    ];
    return { type: 'step', trackId, minStep: `${trackId}.${m[2]}` };
  }
  if ((m = /^Burpee-variant (\d+)$/.exec(text))) {
    return { type: 'step', trackId: 'burpee_skill', minStep: `burpee_skill.V${m[1]}` };
  }
  if ((m = /^([WS])\d$/.exec(text))) {
    const trackId = m[1] === 'W' ? 'wallsit' : 'core_side';
    return { type: 'step', trackId, minStep: `${trackId}.${text}` };
  }
  if ((m = /^(\d+) × (\d+) sek RKC$/.exec(text))) {
    const stepId = stepNamed(sourceOf('core_front'), 'RKC-planke');
    return performance(stepId, Number(m[1]), { seconds: Number(m[2]) });
  }
  if ((m = /^(\d+) × (\d+) archer pr\. side$/.exec(text))) {
    const stepId = stepNamed(sourceOf('press'), 'Archer push-up');
    return performance(stepId, Number(m[1]), { reps: Number(m[2]) });
  }
  if ((m = /^(\d+) × (\d+) klap push-ups$/.exec(text))) {
    const stepId = stepNamed(sourceOf('power_upper'), 'Klap push-up');
    return performance(stepId, Number(m[1]), { reps: Number(m[2]) });
  }
  if ((m = /^(\d+) pistols pr\. ben$/.exec(text))) {
    const stepId = stepNamed(sourceOf('legs'), 'Pistol squat');
    return performance(stepId, 1, { reps: Number(m[1]) });
  }
  if ((m = /^(\d+) × (\d+) på trin (\d+)$/.exec(text))) {
    // The side branches belong to the push-up ladder (page 13).
    return performance(`press.${m[3]}`, Number(m[1]), { reps: Number(m[2]) });
  }
  throw new Error(`No rule for »${text}«`);
}

describe('requirements', () => {
  const impress = readJson<Requirement[]>('program/impress.json');
  const heroes = readJson<Requirement[]>('program/heroes.json');
  const sideBranches = readJson<Requirement[]>('program/side_branches.json');

  it('Hero-tavlen (page 42): names and goals', () => {
    const lines = section(KILDE, 'Hero-tavlen').lines.filter((l) => l.startsWith('- [ ] '));
    expect(heroes.map((h) => ({ name: h.name, how: h.how, ready: h.ready }))).toEqual(
      lines.map((line) => {
        const hero = /^- \[ \] \*\*(.+?):\*\* (.+)$/.exec(line);
        return { name: must(hero, 1, line), how: '', ready: must(hero, 2, line) };
      }),
    );
  });

  it('Hero-tavlen: the hints are the ones in ENGINE.md 5.12 (R-HERO), in the same order', () => {
    const line = linesUnder(ENGINE, '### 5.12').find((l) => l.includes('**R-HERO:**')) ?? '';
    const hints = must(/\(fx (.+)\)\.$/.exec(line), 1, 'R-HERO').split('; ');
    expect(heroes.map((h) => h.requires)).toEqual(
      hints.map((hint): Requires => {
        const stepId = must(/^`([^`]+)`/.exec(hint), 1, hint);
        const trackId = stepId.split('.')[0] ?? '';
        if (hint.endsWith(' ren')) return { type: 'clean', trackId, stepId };
        const seconds = /med (\d+) sek/.exec(hint);
        if (seconds)
          return { type: 'performance', trackId, stepId, sets: 1, seconds: Number(seconds[1]) };
        const reps = Number(must(/med (\d+)/.exec(hint), 1, hint));
        return { type: 'performance', trackId, stepId, sets: 1, reps };
      }),
    );
  });

  it('Imponer-kataloget (pages 43–44): variants, Sådan, Klar når and groups', () => {
    const rows = [0, 1].flatMap((nth) => {
      const page = section(KILDE, 'Imponer-kataloget', nth);
      const table = tableWith(page.lines, 'Variant');
      return records(table).map((row) => ({ ...row, group: table.heading ?? '' }));
    });
    expect(
      impress.map((i) => ({ name: i.name, how: i.how, ready: i.ready, group: i.group })),
    ).toEqual(
      rows.map((row) => ({
        name: cell(row, 'Variant'),
        how: cell(row, 'Sådan'),
        ready: cell(row, 'Klar når'),
        group: row.group,
      })),
    );
  });

  it('Imponer-kataloget: every requirement follows from its »Klar når«', () => {
    for (const item of impress) expect(item.requires, item.id).toEqual(requiresOf(item.ready));
  });

  it('Sidegrene til push-ups (page 13): variants, Hvad den giver, Klar når and requirements', () => {
    const rows = records(
      tableWith(section(KILDE, 'Klubsekvensen').lines, 'Variant', 'Sidegrene til push-ups'),
    );
    expect(sideBranches.map((b) => ({ name: b.name, how: b.how, ready: b.ready }))).toEqual(
      rows.map((row) => ({
        name: plain(cell(row, 'Variant')),
        how: cell(row, 'Hvad den giver'),
        ready: cell(row, 'Klar når'),
      })),
    );
    for (const branch of sideBranches) {
      expect(branch.requires, branch.id).toEqual(requiresOf(branch.ready));
    }
  });

  it('Boss-udfordringer (page 45): name, description, Stærk and Imponerende', () => {
    const bosses = readJson<Boss[]>('program/bosses.json');
    const lines = section(KILDE, 'Boss-udfordringer').lines.filter((l) => l.startsWith('- **'));
    expect(
      bosses.map(({ name, how, staerk, imponerende }) => ({ name, how, staerk, imponerende })),
    ).toEqual(
      lines.map((line) => {
        const boss = /^- \*\*(.+?):\*\* (.+) \(Stærk: (.+); Imponerende: (.+)\)$/.exec(line);
        return {
          name: must(boss, 1, line),
          how: must(boss, 2, line),
          staerk: must(boss, 3, line),
          imponerende: must(boss, 4, line),
        };
      }),
    );
  });
});

// ---------------------------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------------------------

describe('routines', () => {
  const routines = readJson<Routine[]>('program/routines.json');

  it('warm-up: »Opvarmning: 8 minutter« (page 28)', () => {
    const page = section(KILDE, 'Opvarmning: 8 minutter');
    const title = /^(.+): (\d+) minutter$/.exec(page.title);
    const warmup = routines.find((r) => r.id === 'warmup');
    expect({ name: warmup?.name, minutes: warmup?.minutes, pdfPage: warmup?.pdfPage }).toEqual({
      name: must(title, 1, 'warm-up'),
      minutes: Number(must(title, 2, 'warm-up')),
      pdfPage: page.page,
    });
    const rows = records(tableWith(page.lines, 'Trin'));
    expect(warmup?.items).toEqual(
      rows.map((row) => ({
        key: cell(row, 'Trin'),
        name: cell(row, 'Øvelse'),
        dose: cell(row, 'Dosis'),
        execution: cell(row, 'Udførelse'),
        seconds: Number(must(/^(\d+) min$/.exec(cell(row, 'Dosis')), 1, 'dose')) * 60,
      })),
    );
    expect(rows.every((row) => row.Niveau === '')).toBe(true);
  });

  it('Open & Strong (page 33): the six exercises, their pictograms and the cue after 4 weeks', () => {
    const page = section(KILDE, 'Open & Strong');
    const os = routines.find((r) => r.id === 'os');
    const context = page.lines.find((l) => l.startsWith('_Kontekst:')) ?? '';
    expect({ name: os?.name, minutes: os?.minutes, pdfPage: os?.pdfPage }).toEqual({
      name: page.title,
      minutes: Number(must(/(\d+) minutter_$/.exec(context), 1, 'minutes')),
      pdfPage: page.page,
    });
    const items = page.lines.flatMap((line) => {
      const item = /^(\d)\. \*\*(.+?)\*\* – (.+) _\(piktogram: .+\)_$/.exec(line);
      return item
        ? [{ key: must(item, 1, line), name: must(item, 2, line), text: must(item, 3, line) }]
        : [];
    });
    expect(
      os?.items.map((item) => ({
        key: item.key,
        name: item.name,
        text: `${item.execution} ${item.dose}.`,
      })),
    ).toEqual(items);
    for (const item of os?.items ?? []) {
      expect(item.picto, item.name).toBe(PICTOS[`os.${item.key}`]?.picto);
      expect(Number.isInteger(item.seconds) && item.seconds > 0, item.name).toBe(true);
    }
    // »Efter 4 uger: Y-løft med to små vandflasker.«
    const later = os?.items.filter((item) => item.laterCue) ?? [];
    expect(later).toHaveLength(1);
    const paragraph = page.lines.find((line) => line.includes('Efter 4 uger: ')) ?? '';
    const after = must(/Efter 4 uger: (.+)\.$/.exec(paragraph), 1, 'Efter 4 uger');
    expect(later[0]?.laterCue).toBe(after);
    expect(after.startsWith(later[0]?.name.split(' ')[0] ?? '?')).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// The converter
// ---------------------------------------------------------------------------------------------

describe('scripts/convert-program.ts', () => {
  it('reproduces program/tracks byte for byte', async () => {
    const files = await buildTrackFiles();
    const committed = readdirSync(join(process.cwd(), 'program', 'tracks')).filter((f) =>
      f.endsWith('.json'),
    );
    expect(committed.sort()).toEqual([...files.keys()].sort());
    for (const [name, content] of files) {
      expect(readText(`program/tracks/${name}`), name).toBe(content);
    }
  }, 30_000);
});
