// Structural checks of program/*.json: the counts in docs/ENGINE.md 7.3, the ids in ENGINE.md
// section 2, and that every reference (track, step, measurement, block, pictogram) exists.
// program-source.spec.ts compares the content with docs/PROGRAM_KILDE.md.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROGRAM } from '../program.ts';
import type {
  BoardRow,
  Boss,
  Level,
  Measure,
  Overlay,
  PictoRef,
  Requirement,
  Routine,
  SessionKind,
  SessionTemplate,
  Track,
  Week,
} from '../types.ts';
import { must, readJson, readText } from './helpers/kilde.ts';

const ENGINE = readText('docs/ENGINE.md');

/** The backticked ids in the row of ENGINE.md section 2 whose first cell is `concept`. */
function engineIds(concept: string): string[] {
  const row = ENGINE.split('\n').find((line) => line.startsWith(`| ${concept} |`)) ?? '';
  const ids = [...(row.split('|')[2] ?? '').matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? '');
  if (ids.length === 0) throw new Error(`No ids for ${concept} in ENGINE.md section 2`);
  return ids;
}

const TRACK_IDS = engineIds('Spor (`Track`)');
const tracks = TRACK_IDS.map((id) => readJson<Track>(`program/tracks/${id}.json`));
const steps = tracks.flatMap((t) => t.steps);
const stepIds = new Set(steps.map((s) => s.id));
const trackById = new Map(tracks.map((t) => [t.id, t]));
const weeks = readJson<Week[]>('program/weeks.json');
const { measures, board } = readJson<{ measures: Measure[]; board: BoardRow[] }>(
  'program/measures.json',
);
const routines = readJson<Routine[]>('program/routines.json');
const overlays = readJson<Overlay[]>('program/overlays.json');
const impress = readJson<Requirement[]>('program/impress.json');
const heroes = readJson<Requirement[]>('program/heroes.json');
const sideBranches = readJson<Requirement[]>('program/side_branches.json');
const bosses = readJson<Boss[]>('program/bosses.json');
const pictos = readJson<Record<string, PictoRef>>('program/pictos.json');
const SESSIONS: SessionKind[] = ['A', 'B', 'motor', 'os', 'travel'];
const sessions = SESSIONS.map((id) => readJson<SessionTemplate>(`program/sessions/${id}.json`));

/** »press 7, shoulder 7, …, backpack_row 1; uger 12; målinger 12; …; boss 6« (ENGINE.md 7.3). */
function engineCounts(): { steps: Record<string, number>; other: Record<string, number> } {
  const line = ENGINE.split('\n').find((l) => l.includes('trin-antal pr. spor mod kilden:')) ?? '';
  const list = must(/mod kilden: (.+)\.$/.exec(line), 1, 'ENGINE.md 7.3');
  const [stepPart = '', ...otherParts] = list.split('; ');
  const pair = (text: string): [string, number] => {
    const m = /^(.+) (\d+)$/.exec(text);
    return [must(m, 1, text), Number(must(m, 2, text))];
  };
  return {
    steps: Object.fromEntries(stepPart.split(', ').map(pair)),
    other: Object.fromEntries(otherParts.map(pair)),
  };
}

describe('counts (ENGINE.md 7.3)', () => {
  const counts = engineCounts();

  it('steps per track: press 7, shoulder 7, …, backpack_row 1', () => {
    expect(Object.keys(counts.steps).sort()).toEqual([...TRACK_IDS].sort());
    expect(Object.fromEntries(tracks.map((t) => [t.id, t.steps.length]))).toEqual(counts.steps);
  });

  it('uger 12, målinger 12, sidegrene 4, imponer-varianter 17, hero 12, boss 6', () => {
    expect({
      uger: weeks.length,
      målinger: measures.length,
      sidegrene: sideBranches.length,
      'imponer-varianter': impress.length,
      hero: heroes.length,
      boss: bosses.length,
    }).toEqual(counts.other);
  });
});

describe('ids (ENGINE.md section 2)', () => {
  it('program/tracks has exactly the tracks of section 2, each in the file of its id', () => {
    const files = readdirSync(join(process.cwd(), 'program', 'tracks')).filter((f) =>
      f.endsWith('.json'),
    );
    expect(files.sort()).toEqual(TRACK_IDS.map((id) => `${id}.json`).sort());
    expect(tracks.map((t) => t.id)).toEqual(TRACK_IDS);
  });

  it('program.ts loads every track in the order of section 2', () => {
    expect(PROGRAM.tracks.map((t) => t.id)).toEqual(TRACK_IDS);
    expect(PROGRAM.tracks).toEqual(tracks);
  });

  it('measurements, overlays and side branches have the ids of section 2, in order', () => {
    expect(measures.map((m) => m.id)).toEqual(engineIds('Måling (`Measure`)'));
    expect(overlays.map((o) => o.id)).toEqual(engineIds('Overlejring (`Overlay`)'));
    expect(sideBranches.map((b) => b.id)).toEqual(engineIds('Sidegren'));
  });

  it('step ids are <track>.<key>, with the prefixes of section 2 and consecutive numbers', () => {
    // »`wallsit.W1` … `W5`, `core_side.S1` … `S5`, …, `burpee_skill.V1` … `V5`«
    const prefixes = Object.fromEntries(
      [
        ...engineIds('Trin (`Step`)')
          .join(' ')
          .matchAll(/\b([a-z_]+)\.([A-Z]?)1\b/g),
      ].map((m) => [m[1] ?? '', m[2] ?? '']),
    );
    expect(prefixes).toMatchObject({ press: '', wallsit: 'W', burpee_skill: 'V' });
    for (const track of tracks) {
      const prefix = prefixes[track.id] ?? '';
      track.steps.forEach((step, i) => {
        const number = String(i + 1);
        // The burpee variants keep the source's plain numbers as keys ("1"–"5").
        const key = track.id === 'burpee_skill' ? number : `${prefix}${number}`;
        expect({ id: step.id, key: step.key }).toEqual({
          id: `${track.id}.${prefix}${number}`,
          key,
        });
      });
    }
  });

  it('ids are unique', () => {
    const unique = (ids: string[]) => expect(new Set(ids).size, ids.join(', ')).toBe(ids.length);
    unique(tracks.map((t) => t.id));
    unique(steps.map((s) => s.id));
    unique(measures.map((m) => m.id));
    unique([...impress, ...heroes, ...sideBranches].map((r) => r.id));
    unique(bosses.map((b) => b.id));
    unique(overlays.map((o) => o.id));
    unique(sessions.flatMap((s) => s.blocks.map((b) => b.id)));
    for (const ids of [impress, heroes, sideBranches, bosses].map((list) =>
      list.map((x) => x.id),
    )) {
      for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});

describe('tracks', () => {
  const META: Record<string, Pick<Track, 'short' | 'progression' | 'category' | 'tags'>> = {
    press: { short: 'Pres', progression: 'double', category: 'ladder' },
    shoulder: { short: 'Skuldre', progression: 'double', category: 'ladder' },
    pull: { short: 'Træk', progression: 'double', category: 'ladder' },
    legs: { short: 'Ben', progression: 'double', category: 'ladder', tags: ['heavy_legs'] },
    wallsit: { short: 'Wall sit', progression: 'hold', category: 'ladder' },
    posterior: { short: 'Bagkæde', progression: 'double', category: 'ladder' },
    core_front: { short: 'Mave front', progression: 'double', category: 'ladder' },
    core_side: { short: 'Mave side', progression: 'double', category: 'ladder' },
    core_rot: { short: 'Rotation', progression: 'double', category: 'extra' },
    core_situp: { short: 'Sit-ups', progression: 'double', category: 'ladder' },
    groin: { short: 'Lyske', progression: 'double', category: 'ladder' },
    power_legs: {
      short: 'Power ben',
      progression: 'power',
      category: 'power',
      tags: ['heavy_legs'],
    },
    power_upper: { short: 'Power overkrop', progression: 'power', category: 'power' },
    burpee_emom: { short: 'Burpees', progression: 'emom', category: 'power' },
    burpee_skill: { short: 'Burpee-varianter', progression: 'manual', category: 'extra' },
    club_sequence: { short: 'Klubsekvensen', progression: 'rounds', category: 'extra' },
    neck: { short: 'Nakke', progression: 'neck', category: 'extra' },
    calf: { short: 'Læg', progression: 'load', category: 'extra' },
    sl_rdl: {
      short: 'Etbens RDL',
      progression: 'load',
      category: 'extra',
      tags: ['heavy_legs_if_loaded'],
    },
    backpack_row: { short: 'Rygsæk-row', progression: 'load', category: 'extra' },
  };

  it('short label, progression type, category and tags', () => {
    expect(
      Object.fromEntries(
        tracks.map((t) => [
          t.id,
          { short: t.short, progression: t.progression, category: t.category, tags: t.tags },
        ]),
      ),
    ).toEqual(META);
  });

  it('ten ladders and three power tracks (page 11)', () => {
    expect(tracks.filter((t) => t.category === 'ladder')).toHaveLength(10);
    expect(tracks.filter((t) => t.category === 'power')).toHaveLength(3);
  });

  it('levels are valid and rise along each track', () => {
    const order: Level[] = ['basis', 'staerk', 'imponerende', 'boss'];
    for (const track of tracks) {
      const levels = track.steps.flatMap((s) => (s.level ? [s.level] : []));
      for (const level of levels) expect(order, track.id).toContain(level);
      const ranks = levels.map((level) => order.indexOf(level));
      expect(ranks, track.id).toEqual([...ranks].sort((a, b) => a - b));
      expect(new Set(ranks).size, track.id).toBe(ranks.length);
    }
  });

  it('every dose fits the progression type and has sensible numbers', () => {
    const kinds: Record<Track['progression'], string[]> = {
      double: ['reps', 'hold'],
      hold: ['hold', 'rounds'],
      power: ['power'],
      emom: ['emom'],
      rounds: ['rounds'],
      neck: ['reps', 'hold'],
      load: ['reps'],
      manual: ['always', 'fixed'],
    };
    for (const track of tracks) {
      for (const { id, dose } of track.steps) {
        expect(kinds[track.progression], id).toContain(dose.kind);
        const ranges =
          dose.kind === 'reps' || dose.kind === 'power'
            ? [dose.sets, dose.reps]
            : dose.kind === 'hold'
              ? [dose.sets, dose.seconds]
              : dose.kind === 'rounds'
                ? [dose.rounds]
                : [];
        for (const [min, max] of ranges) {
          expect(min > 0 && min <= max, `${id}: ${min}–${max}`).toBe(true);
        }
      }
    }
  });

  it('the Nordic steps carry the tag nordic, and no other step does', () => {
    const tagged = steps.filter((s) => s.tags?.includes('nordic')).map((s) => s.id);
    expect(tagged).toEqual(['posterior.4', 'posterior.5', 'posterior.6']);
    expect(steps.filter((s) => s.name.includes('Nordic')).map((s) => s.id)).toEqual(tagged);
  });

  it('every step has a page, an execution and one or two cues', () => {
    for (const step of steps) {
      expect(Number.isInteger(step.pdfPage) && step.pdfPage > 0, step.id).toBe(true);
      expect(step.execution.length, step.id).toBeGreaterThan(0);
      expect(step.cues.length >= 1 && step.cues.length <= 2, step.id).toBe(true);
      for (const cue of step.cues) expect(cue.trim(), step.id).toBe(cue);
    }
  });
});

describe('pictograms (program/pictos.json)', () => {
  const osKeys = (routines.find((r) => r.id === 'os')?.items ?? []).map((i) => `os.${i.key}`);

  it('every step and every Open & Strong item has exactly one entry', () => {
    expect(Object.keys(pictos).sort()).toEqual([...stepIds, ...osKeys].sort());
  });

  it('every pictogram exists in public/pictos/', () => {
    for (const [id, ref] of Object.entries(pictos)) {
      expect(existsSync(join(process.cwd(), 'public', 'pictos', `${ref.picto}.svg`)), id).toBe(
        true,
      );
    }
  });

  it('a step without its own pictogram borrows one from its own ladder, never a generic icon', () => {
    const owners = new Map<string, Set<string>>();
    for (const [id, ref] of Object.entries(pictos)) {
      if (ref.fallback) continue;
      const group = id.split('.')[0] ?? '';
      owners.set(group, (owners.get(group) ?? new Set()).add(ref.picto));
    }
    const ownedAnywhere = new Set([...owners.values()].flatMap((set) => [...set]));
    for (const [id, ref] of Object.entries(pictos)) {
      if (!ref.fallback) continue;
      const own = owners.get(id.split('.')[0] ?? '');
      // Tracks without any pictogram of their own (club sequence, neck) borrow the nearest one.
      expect((own ?? ownedAnywhere).has(ref.picto), `${id} → ${ref.picto}`).toBe(true);
    }
  });

  it('the Open & Strong items name the same pictograms', () => {
    const os = routines.find((r) => r.id === 'os');
    for (const item of os?.items ?? []) {
      expect(item.picto, item.name).toBe(pictos[`os.${item.key}`]?.picto);
      expect(pictos[`os.${item.key}`]?.fallback, item.name).toBe(false);
    }
  });
});

describe('references', () => {
  const stepOf = (trackId: string, stepId: string) =>
    trackById.get(trackId)?.steps.some((s) => s.id === stepId) === true;

  it('requirements point at existing tracks, steps and measurements', () => {
    for (const requirement of [...impress, ...heroes, ...sideBranches]) {
      const r = requirement.requires;
      const label = `${requirement.id}: ${JSON.stringify(r)}`;
      if (r.type === 'step') expect(stepOf(r.trackId, r.minStep), label).toBe(true);
      if (r.type === 'performance') {
        expect(stepOf(r.trackId, r.stepId), label).toBe(true);
        expect(r.sets > 0 && (r.reps ?? r.seconds ?? 0) > 0, label).toBe(true);
        expect(r.reps === undefined || r.seconds === undefined, label).toBe(true);
      }
      if (r.type === 'clean') expect(stepOf(r.trackId, r.stepId), label).toBe(true);
      if (r.type === 'measure') {
        expect(measures.some((m) => m.id === r.measureId) && r.min > 0, label).toBe(true);
      }
    }
  });

  it('impress requirements are grouped as on pages 43–44', () => {
    expect([...new Set(impress.map((i) => i.group))]).toEqual([
      'Overkrop og planke',
      'Ben, mave og burpees',
    ]);
    for (const list of [heroes, sideBranches]) {
      for (const item of list) expect(item.group, item.id).toBeUndefined();
    }
  });

  it('session blocks use existing tracks (or the warm-up routine)', () => {
    expect(sessions.map((s) => s.id)).toEqual(SESSIONS);
    for (const session of sessions) {
      for (const block of session.blocks) {
        const known = block.trackId === 'warmup' || trackById.has(block.trackId);
        expect(known, `${block.id} → ${block.trackId}`).toBe(true);
      }
    }
    expect(routines.map((r) => r.id)).toEqual(['warmup', 'os']);
  });

  it('measurement placements point at existing tracks, blocks and steps', () => {
    const blockIds = new Set(sessions.flatMap((s) => s.blocks.map((b) => b.id)));
    const blockTracks = new Set(sessions.flatMap((s) => s.blocks.map((b) => b.trackId)));
    for (const { id, placement } of measures) {
      if (placement.type === 'replace_first_set') {
        expect(blockTracks.has(placement.trackId), id).toBe(true);
      }
      if (placement.type === 'after_block') {
        expect(blockTracks.has(placement.trackId), id).toBe(true);
        expect(stepOf(placement.trackId, placement.minStep), id).toBe(true);
      }
      if (placement.type === 'standalone') {
        const ref = placement.before ?? placement.after;
        expect(ref !== undefined && blockIds.has(ref), id).toBe(true);
      }
    }
  });

  it('Målbrættet points at existing measurements', () => {
    for (const row of board) {
      if (row.measureId) {
        expect(
          measures.some((m) => m.id === row.measureId),
          row.name,
        ).toBe(true);
        expect(row.derived, row.name).toBeUndefined();
      } else {
        expect(row.derived, row.name).toBe('legs');
      }
    }
  });
});

describe('weeks and overlays', () => {
  it('programme weeks 1–12 in order; light weeks 4, 8 and 12 have the burpee test', () => {
    expect(weeks.map((w) => w.pw)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const week of weeks) {
      expect(week.light, `uge ${week.pw}`).toBe(week.phase === 'let');
      expect(week.emomCap === 'test', `uge ${week.pw}`).toBe(week.light);
    }
  });

  it('EMOM caps are existing steps and never fall', () => {
    const emom = trackById.get('burpee_emom')?.steps.map((s) => s.id) ?? [];
    const caps = weeks.filter((w) => w.emomCap !== 'test').map((w) => w.emomCap);
    for (const cap of caps) expect(emom, cap).toContain(cap);
    const ranks = caps.map((cap) => emom.indexOf(cap));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(weeks.filter((w) => w.emomFixed).map((w) => w.pw)).toEqual([1]);
    expect(weeks.filter((w) => w.bossAllowed).map((w) => w.pw)).toEqual([11]);
  });

  it('overlays: the week is a Monday and every date lies in that week', () => {
    // Day numbers since 1970-01-01, which was a Thursday.
    const day = (iso: string): number => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
      return (
        Date.UTC(Number(must(m, 1, iso)), Number(must(m, 2, iso)) - 1, Number(must(m, 3, iso))) /
        86_400_000
      );
    };
    for (const overlay of overlays) {
      const monday = day(overlay.week);
      expect((monday + 3) % 7, overlay.id).toBe(0);
      expect(overlay.moves.length, overlay.id).toBeGreaterThan(0);
      for (const move of overlay.moves) {
        expect(SESSIONS, overlay.id).toContain(move.kind);
        for (const date of [move.default, move.alternative]) {
          const offset = day(date) - monday;
          expect(offset >= 0 && offset <= 6, `${overlay.id}: ${date}`).toBe(true);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Shapes: program.ts casts the JSON to the types in src/engine/types.ts, so the files are
// checked here – every required key, no unknown key, the right kind of value, the allowed words.
// ---------------------------------------------------------------------------------------------

type Kind = 'string' | 'number' | 'boolean' | 'strings' | 'pair' | 'object' | 'array';
type Schema = Record<string, Kind | `${Kind}?` | readonly unknown[]>;

function isKind(value: unknown, kind: Kind): boolean {
  switch (kind) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'strings':
      return Array.isArray(value) && value.every((v) => typeof v === 'string');
    case 'pair':
      return (
        Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === 'number')
      );
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
  }
}

/** Required keys, optional keys (`kind?`), allowed words (an array) and no other keys. */
function expectShape(value: unknown, schema: Schema, label: string): void {
  expect(isKind(value, 'object'), `${label} is an object`).toBe(true);
  const record = value as Record<string, unknown>;
  const unknown = Object.keys(record).filter((key) => !(key in schema));
  expect(unknown, `${label}: unknown keys`).toEqual([]);
  for (const [key, spec] of Object.entries(schema)) {
    const v = record[key];
    if (typeof spec !== 'string') {
      expect(spec, `${label}.${key}`).toContain(v);
      continue;
    }
    const optional = spec.endsWith('?');
    if (v === undefined) {
      expect(optional, `${label}: ${key} is missing`).toBe(true);
      continue;
    }
    expect(isKind(v, spec.replace('?', '') as Kind), `${label}.${key} is ${spec}`).toBe(true);
  }
}

const PER = ['side', 'ben', 'retning'] as const;
const DOSE: Record<string, Schema> = {
  reps: { kind: ['reps'], sets: 'pair', reps: 'pair', per: [...PER, undefined] },
  hold: { kind: ['hold'], sets: 'pair', seconds: 'pair', per: [...PER, undefined] },
  power: { kind: ['power'], sets: 'pair', reps: 'pair', per: [...PER, undefined] },
  fixed: { kind: ['fixed'], sets: 'number', reps: 'number', per: [...PER, undefined] },
  rounds: { kind: ['rounds'], sets: 'number', rounds: 'pair', text: 'string' },
  emom: { kind: ['emom'], minutes: 'number', reps: 'number' },
  always: { kind: ['always'], text: 'string' },
};
const MOTOR: Record<string, Schema> = {
  base: { type: ['base'], minutes: 'number', strides: 'number?' },
  base_check: { type: ['base_check'], minutes: 'number' },
  intervals_30_15: { type: ['intervals_30_15'], series: 'number', reps: 'number' },
  fight_rounds: { type: ['fight_rounds'], rounds: 'number', sprints: 'boolean' },
  cooper_or_base: { type: ['cooper_or_base'], cooperOnly: 'boolean?' },
};
const PLACEMENT: Record<string, Schema> = {
  replace_first_set: { type: ['replace_first_set'], trackId: 'string' },
  standalone: { type: ['standalone'], before: 'string?', after: 'string?' },
  before_warmup: { type: ['before_warmup'] },
  replace_finisher: { type: ['replace_finisher'] },
  motor: { type: ['motor'] },
  after_block: { type: ['after_block'], trackId: 'string', minStep: 'string' },
};
const REQUIRES: Record<string, Schema> = {
  always: { type: ['always'] },
  step: { type: ['step'], trackId: 'string', minStep: 'string' },
  measure: { type: ['measure'], measureId: 'string', min: 'number' },
  performance: {
    type: ['performance'],
    trackId: 'string',
    stepId: 'string',
    sets: 'number',
    reps: 'number?',
    seconds: 'number?',
  },
  clean: { type: ['clean'], trackId: 'string', stepId: 'string' },
};

/** A union member picked by its tag (`kind` or `type`); an unknown tag fails. */
function expectVariant(
  value: unknown,
  tag: string,
  variants: Record<string, Schema>,
  label: string,
) {
  const key = String((value as Record<string, unknown> | undefined)?.[tag]);
  expect(Object.keys(variants), `${label}.${tag}`).toContain(key);
  expectShape(value, variants[key] ?? {}, label);
}

describe('shapes (src/engine/types.ts)', () => {
  it('tracks, steps, doses and Hvorfor boxes', () => {
    for (const track of tracks) {
      expectShape(
        track,
        {
          id: 'string',
          name: 'string',
          short: 'string',
          pdfPage: 'number',
          progression: ['double', 'hold', 'power', 'emom', 'rounds', 'neck', 'load', 'manual'],
          category: ['ladder', 'power', 'extra'],
          tags: 'strings?',
          note: 'string?',
          painCue: 'string?',
          why: 'array?',
          steps: 'array',
        },
        track.id,
      );
      for (const box of track.why ?? []) {
        expectShape(
          box,
          { kind: ['coach', 'fysio', 'evidens'], text: 'string' },
          `${track.id}.why`,
        );
      }
      for (const step of track.steps) {
        expectShape(
          step,
          {
            id: 'string',
            key: 'string',
            name: 'string',
            level: ['basis', 'staerk', 'imponerende', 'boss', undefined],
            dose: 'object',
            execution: 'string',
            cues: 'strings',
            pdfPage: 'number',
            note: 'string?',
            tags: 'strings?',
            with: 'string?',
            round: 'array?',
          },
          step.id,
        );
        expectVariant(step.dose, 'kind', DOSE, `${step.id}.dose`);
      }
    }
  });

  it('weeks', () => {
    for (const week of weeks) {
      const label = `uge ${week.pw}`;
      expectShape(
        week,
        {
          pw: 'number',
          phase: ['fundament', 'opbygning', 'kampform', 'let'],
          light: 'boolean',
          sets: 'object',
          rirPlan: [1, 2, 3],
          powerSets: 'number',
          powerOptionalPlusOne: 'boolean?',
          motor: 'object',
          emomCap: 'string',
          emomFixed: 'boolean?',
          measurements: 'boolean',
          bossAllowed: 'boolean?',
          text: 'object',
        },
        label,
      );
      expectShape(
        week.sets,
        { par12: 'number', other: 'number', optionalPlusOne: 'boolean?' },
        `${label}.sets`,
      );
      expectVariant(week.motor, 'type', MOTOR, `${label}.motor`);
      const text = Object.fromEntries(
        ['from', 'phase', 'strength', 'power', 'motor', 'burpees', 'note'].map((k) => [
          k,
          'string',
        ]),
      ) as Schema;
      expectShape(week.text, text, `${label}.text`);
    }
  });

  it('measurements and Målbrættet', () => {
    for (const measure of measures) {
      expectShape(
        measure,
        {
          id: 'string',
          name: 'string',
          how: 'string',
          unit: ['cm', 'reps', 'sec', 'm', 'depth'],
          weekday: [2, 4, 5],
          placement: 'object',
          levels: 'object?',
          weeks: ['all_light_and_1', 'light_only'],
          optional: 'boolean?',
          depthLabels: 'strings?',
        },
        measure.id,
      );
      expectVariant(measure.placement, 'type', PLACEMENT, `${measure.id}.placement`);
      if (measure.levels) {
        expectShape(
          measure.levels,
          { basis: 'number', staerk: 'number', imponerende: 'number', lowerIsBetter: 'boolean?' },
          `${measure.id}.levels`,
        );
      }
    }
    for (const row of board) {
      expectShape(
        row,
        {
          name: 'string',
          measureId: 'string?',
          derived: ['legs', undefined],
          basis: 'string',
          staerk: 'string',
          imponerende: 'string',
        },
        row.name,
      );
    }
  });

  it('requirements and bosses', () => {
    for (const item of [...impress, ...heroes, ...sideBranches]) {
      expectShape(
        item,
        {
          id: 'string',
          name: 'string',
          how: 'string',
          ready: 'string',
          requires: 'object',
          group: 'string?',
        },
        item.id,
      );
      expectVariant(item.requires, 'type', REQUIRES, `${item.id}.requires`);
    }
    for (const boss of bosses) {
      expectShape(
        boss,
        { id: 'string', name: 'string', how: 'string', staerk: 'string', imponerende: 'string' },
        boss.id,
      );
    }
  });

  it('overlays, routines and pictograms', () => {
    for (const overlay of overlays) {
      expectShape(
        overlay,
        {
          id: 'string',
          week: 'string',
          onlyIfLight: 'boolean?',
          measurements: 'boolean?',
          moves: 'array',
          label: 'string',
          alternativeLabel: 'string',
        },
        overlay.id,
      );
      for (const move of overlay.moves) {
        expectShape(
          move,
          { kind: SESSIONS, default: 'string', alternative: 'string', calmBase: 'boolean?' },
          `${overlay.id}.moves`,
        );
      }
    }
    for (const routine of routines) {
      expectShape(
        routine,
        {
          id: ['warmup', 'os'],
          name: 'string',
          minutes: 'number',
          pdfPage: 'number',
          items: 'array',
        },
        routine.id,
      );
      for (const item of routine.items) {
        expectShape(
          item,
          {
            key: 'string',
            name: 'string',
            dose: 'string',
            execution: 'string',
            seconds: 'number',
            picto: 'string?',
            laterCue: 'string?',
          },
          `${routine.id}.${item.key}`,
        );
      }
    }
    for (const [id, ref] of Object.entries(pictos)) {
      expectShape(ref, { picto: 'string', fallback: 'boolean' }, id);
    }
  });

  it('session templates and blocks', () => {
    for (const session of sessions) {
      expectShape(
        session,
        {
          id: SESSIONS,
          name: 'string',
          defaultWeekday: 'number',
          durationMin: 'pair',
          blocks: 'array',
        },
        session.id,
      );
      for (const block of session.blocks) {
        expectShape(
          block,
          {
            id: 'string',
            trackId: 'string',
            role: ['warmup', 'power', 'pair', 'triset', 'finisher', 'neck'],
            group: ['pair1', 'pair2', 'pair3', 'triset', undefined],
            setsRule: ['par12', 'other', 'power', 'fixed'],
            fixedSets: 'pair?',
            restSec: 'number?',
            inYellow: 'boolean',
            maxStep: 'string?',
          },
          block.id,
        );
      }
    }
  });
});
