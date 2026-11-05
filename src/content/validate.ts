// Validation of the explanation and figure files in content/ (docs/SPEC.md 9.1). Used by
// `node scripts/check-explain.ts <fil>` and by Vitest. The messages are short and in Danish because
// the content agents read them; the app never shows them. Geometry (joints that bend the right way,
// hands and feet on the floor) is checked by the figure system's own tests (milestone 6).
import type { Dose, Program } from '../engine/types.ts';
import { findSourceRef } from './refs.ts';
import {
  BODY,
  CONTENT_FORMAT,
  EQUIPMENT,
  isLike,
  PAIRED_PARTS,
  SINGLE_PARTS,
  SURFACES,
  type Equipment,
  type ExplainFile,
  type ExplainItem,
  type FigureFile,
  type Movement,
} from './types.ts';

export interface Problem {
  /** Where in the file: »press.1 › cues[2]«. */
  where: string;
  message: string;
}

/** A step or routine item as the programme has it. */
export interface SubjectItem {
  id: string;
  /** The step's dose; undefined for a routine item. */
  dose?: Dose;
  /** The programme's own words about it: execution, cues and the parts of a round. */
  texts: string[];
}

export interface Subject {
  kind: 'track' | 'routine';
  id: string;
  items: SubjectItem[];
}

/** The track or routine a content file belongs to; routine items get the id `<routine>.<key>`. */
export function subjectOf(program: Program, id: string): Subject | null {
  const track = program.tracks.find((t) => t.id === id);
  if (track) {
    return {
      kind: 'track',
      id,
      items: track.steps.map((s) => ({
        id: s.id,
        dose: s.dose,
        texts: [s.execution, ...s.cues, ...(s.round ?? []).map((r) => r.label)],
      })),
    };
  }
  const routine = program.routines.find((r) => r.id === id);
  if (routine) {
    return {
      kind: 'routine',
      id,
      items: routine.items.map((i) => ({ id: `${routine.id}.${i.key}`, texts: [i.execution] })),
    };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Limits (docs/SPEC.md 9.1)
// ---------------------------------------------------------------------------------------------

export const LIMITS = {
  why: { min: 1, max: 3, chars: 280 },
  trains: 150,
  start: 220,
  steps: { min: 2, max: 4, chars: 140 },
  tempo: 120,
  breathing: 120,
  cues: { min: 2, max: 3, words: 6, chars: 40 },
  mistakes: { min: 2, max: 3, mistake: 90, fix: 140 },
  easier: 160,
  harder: 160,
  getReady: 140,
  movements: { max: 4, name: 40 },
  positions: { min: 1, max: 6, name: 24, nameWords: 3, text: 240 },
  phases: { min: 1, max: 12, label: 32, labelWords: 5, seconds: [0.2, 10] as const },
} as const;

const ID = /^[a-z][a-z0-9_]*$/;
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}]/u;
const DOSE = /\d+\s*×\s*\d+/u;
const STATED_SECONDS = /(\d+(?:,\d+)?)(?:\s*[–-]\s*(\d+(?:,\d+)?))?\s*sek\b(?:\s+[\p{L}]+)?/gu;

// ---------------------------------------------------------------------------------------------
// A small reader for untyped JSON that collects problems with their place in the file
// ---------------------------------------------------------------------------------------------

type Json = Record<string, unknown>;

class Report {
  readonly problems: Problem[] = [];
  add(where: string, message: string): void {
    this.problems.push({ where, message });
  }
}

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A value from the file as text for a message. */
function show(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value) ?? 'undefined';
}

function at(where: string, key: string | number): string {
  const part = typeof key === 'number' ? `[${key}]` : key;
  if (!where) return part;
  return typeof key === 'number' ? `${where}${part}` : `${where} › ${part}`;
}

/** Reports unknown and missing keys; returns false when the value is not an object. */
function shape(
  r: Report,
  where: string,
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): value is Json {
  if (!isObject(value)) {
    r.add(where, 'skal være et objekt { … }');
    return false;
  }
  const missing = required.filter((key) => !(key in value));
  if (missing.length > 0) {
    const names = missing.map((key) => `»${key}«`).join(', ');
    r.add(where, `${missing.length === 1 ? 'feltet' : 'felterne'} ${names} mangler`);
  }
  for (const key of Object.keys(value)) {
    if (!required.includes(key) && !optional.includes(key)) {
      r.add(where, `ukendt felt »${key}« (tilladt: ${[...required, ...optional].join(', ')})`);
    }
  }
  return true;
}

function list(
  r: Report,
  where: string,
  value: unknown,
  min: number,
  max: number,
  what: string,
): value is unknown[] {
  if (value === undefined) return false; // shape() has reported the missing field
  if (!Array.isArray(value)) {
    r.add(where, 'skal være en liste [ … ]');
    return false;
  }
  if (value.length < min || value.length > max) {
    const range = min === max ? `${min}` : max === Infinity ? `mindst ${min}` : `${min}–${max}`;
    r.add(where, `skal have ${range} ${what} (har ${value.length})`);
  }
  return true;
}

interface TextRule {
  /** Prose ends with a full stop; short texts (cues, names, labels) do not. */
  kind: 'prose' | 'short';
  chars: number;
  words?: number;
  /** Dose notation such as »3 × 8« is not allowed (the dose comes from the programme). */
  noDose?: boolean;
}

function text(r: Report, where: string, value: unknown, rule: TextRule): value is string {
  if (value === undefined) return false; // shape() has reported the missing field
  if (typeof value !== 'string') {
    r.add(where, 'skal være en tekst');
    return false;
  }
  if (value.trim() === '') {
    r.add(where, 'må ikke være tom');
    return false;
  }
  const quote = value.length > 40 ? `»${value.slice(0, 37)}…«` : `»${value}«`;
  if (value !== value.trim()) r.add(where, `mellemrum i starten eller slutningen: ${quote}`);
  if (/[\n\r\t]/.test(value)) r.add(where, 'ingen linjeskift eller tabulatorer');
  if (/ {2}/.test(value)) r.add(where, `dobbelt mellemrum: ${quote}`);
  if (value.length > rule.chars) r.add(where, `højst ${rule.chars} tegn (har ${value.length})`);
  const words = value.trim().split(/\s+/).length;
  if (rule.words && words > rule.words) {
    r.add(where, `højst ${rule.words} ord (har ${words}): ${quote}`);
  }
  if (!/^[\p{Lu}\d]/u.test(value.trim())) {
    r.add(where, `skal starte med stort bogstav eller et tal: ${quote}`);
  }
  const end = value.trim().slice(-1);
  if (rule.kind === 'prose' && end !== '.' && end !== '?') {
    r.add(where, `skal slutte med punktum: ${quote}`);
  }
  if (rule.kind === 'short' && end === '.') r.add(where, `uden punktum til sidst: ${quote}`);
  if (value.includes('!')) r.add(where, `ingen udråbstegn: ${quote}`);
  if (EMOJI.test(value)) r.add(where, `ingen emojis: ${quote}`);
  const ref = findSourceRef(value);
  if (ref) r.add(where, `ingen henvisning til PDF, sidetal eller kilder (»${ref}«)`);
  if (rule.noDose) {
    const dose = DOSE.exec(value);
    if (dose) r.add(where, `skriv ikke dosis (»${dose[0]}«); den står på kortet fra programmet`);
  }
  return true;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

// ---------------------------------------------------------------------------------------------
// Explanations
// ---------------------------------------------------------------------------------------------

const ITEM_KEYS = [
  'id',
  'trains',
  'start',
  'steps',
  'tempo',
  'breathing',
  'cues',
  'mistakes',
  'easier',
  'harder',
  'equipment',
  'getReady',
  'movements',
] as const;

/** The seconds the programme (or the tempo text) states: »3 sek ned« → [3, 3, '3 sek ned']. */
export function statedSeconds(texts: readonly string[]): Array<[number, number, string]> {
  const found: Array<[number, number, string]> = [];
  for (const t of texts) {
    for (const m of t.matchAll(STATED_SECONDS)) {
      const min = Number((m[1] ?? '').replace(',', '.'));
      const max = m[2] ? Number(m[2].replace(',', '.')) : min;
      found.push([min, max, m[0]]);
    }
  }
  return found;
}

/** Which uses of `"dose"` and which loops the item's dose allows (docs/SPEC.md 9.1). */
function rulesFor(item: SubjectItem): { dose: 'required' | 'allowed' | 'never'; loop: boolean } {
  switch (item.dose?.kind) {
    case undefined:
      return { dose: 'allowed', loop: false }; // a routine item
    case 'hold':
      return { dose: 'required', loop: false };
    case 'rounds':
      return { dose: 'allowed', loop: false };
    case 'power':
      return { dose: 'never', loop: false };
    default:
      return { dose: 'never', loop: true };
  }
}

function checkMovement(
  r: Report,
  where: string,
  value: unknown,
  several: boolean,
  equipment: readonly string[],
): void {
  if (!shape(r, where, value, ['positions', 'phases'], ['id', 'name'])) return;
  if (several) {
    if (typeof value.id !== 'string' || !ID.test(value.id)) {
      r.add(where, 'flere bevægelser kræver et »id« med små bogstaver, tal og _');
    }
    if (value.name === undefined) r.add(where, 'flere bevægelser kræver et »name«');
  } else if (value.id !== undefined || value.name !== undefined) {
    r.add(where, '»id« og »name« bruges kun, når et punkt har flere bevægelser');
  }
  if (value.name !== undefined) {
    text(r, at(where, 'name'), value.name, { kind: 'short', chars: LIMITS.movements.name });
  }

  const positionIds: string[] = [];
  const p = LIMITS.positions;
  if (list(r, at(where, 'positions'), value.positions, p.min, p.max, 'positioner')) {
    value.positions.forEach((pos, i) => {
      const w = at(at(where, 'positions'), i);
      if (!shape(r, w, pos, ['id', 'name', 'text', 'contacts'])) return;
      if (typeof pos.id !== 'string' || !ID.test(pos.id)) {
        r.add(at(w, 'id'), 'små bogstaver a–z, tal og _ (fx »top«, »bund«)');
      } else if (positionIds.includes(pos.id)) {
        r.add(at(w, 'id'), `positionen »${pos.id}« findes to gange`);
      } else positionIds.push(pos.id);
      text(r, at(w, 'name'), pos.name, { kind: 'short', chars: p.name, words: p.nameWords });
      text(r, at(w, 'text'), pos.text, { kind: 'prose', chars: p.text });
      if (list(r, at(w, 'contacts'), pos.contacts, 0, 8, 'kontakter')) {
        pos.contacts.forEach((c, j) => checkContact(r, at(at(w, 'contacts'), j), c, equipment));
      }
    });
  }

  const ph = LIMITS.phases;
  const reached = new Set<string>(positionIds.slice(0, 1));
  if (list(r, at(where, 'phases'), value.phases, ph.min, ph.max, 'faser')) {
    value.phases.forEach((phase, i) => {
      const w = at(at(where, 'phases'), i);
      if (!shape(r, w, phase, ['to', 'seconds', 'label'])) return;
      if (typeof phase.to !== 'string' || !positionIds.includes(phase.to)) {
        r.add(
          at(w, 'to'),
          `positionen »${show(phase.to)}« findes ikke (der er: ${positionIds.join(', ')})`,
        );
      } else reached.add(phase.to);
      const s = phase.seconds;
      if (s !== 'dose' && (!finite(s) || s < ph.seconds[0] || s > ph.seconds[1])) {
        r.add(at(w, 'seconds'), `${ph.seconds[0]}–${ph.seconds[1]} sek eller "dose"`);
      }
      text(r, at(w, 'label'), phase.label, {
        kind: 'short',
        chars: ph.label,
        words: ph.labelWords,
      });
    });
  }
  for (const id of positionIds) {
    if (!reached.has(id)) r.add(at(where, 'positions'), `ingen fase går til positionen »${id}«`);
  }
}

function checkContact(r: Report, where: string, value: unknown, equipment: readonly string[]) {
  if (!shape(r, where, value, ['part', 'on'], ['count'])) return;
  const paired = (PAIRED_PARTS as readonly unknown[]).includes(value.part);
  const single = (SINGLE_PARTS as readonly unknown[]).includes(value.part);
  if (!paired && !single) {
    r.add(
      at(where, 'part'),
      `ukendt kropsdel »${show(value.part)}« (tilladt: ${[...PAIRED_PARTS, ...SINGLE_PARTS].join(', ')})`,
    );
  }
  if (value.count !== undefined) {
    if (!paired) r.add(at(where, 'count'), '»count« bruges kun ved kropsdele, der er to af');
    else if (value.count !== 1 && value.count !== 2)
      r.add(at(where, 'count'), 'skal være 1 eller 2');
  }
  if (!(SURFACES as readonly unknown[]).includes(value.on)) {
    r.add(at(where, 'on'), `ukendt flade »${show(value.on)}« (tilladt: ${SURFACES.join(', ')})`);
  } else if (value.on !== 'floor' && !equipment.includes(value.on as string)) {
    r.add(at(where, 'on'), `»${show(value.on)}« skal også stå i »equipment«`);
  }
}

/** Phases against the dose: holds need a "dose" phase, repetitions end where they started. */
function checkTiming(
  r: Report,
  where: string,
  item: SubjectItem,
  movements: readonly Movement[],
  tempo: string | undefined,
): void {
  const rules = rulesFor(item);
  const phases = movements.flatMap((m) => (Array.isArray(m.phases) ? m.phases : []));
  const hasDose = phases.some((p) => p.seconds === 'dose');
  if (rules.dose === 'required' && !hasDose) {
    r.add(where, 'et hold skal have en fase med "seconds": "dose" (selve holdet)');
  }
  if (rules.dose === 'never' && hasDose) {
    r.add(where, '"dose" bruges kun ved hold, runder og rutiner; her skal faserne have sekunder');
  }
  if (rules.loop) {
    movements.forEach((m, i) => {
      if (!Array.isArray(m.positions) || !Array.isArray(m.phases)) return;
      const first = m.positions[0]?.id;
      const last = m.phases[m.phases.length - 1]?.to;
      if (first && last && first !== last) {
        r.add(
          at(at(where, 'movements'), i),
          `en gentagelse slutter, hvor den startede: sidste fase skal gå til »${first}«`,
        );
      }
    });
  }
  // A time the programme states is a phase of that length; a time longer than any phase (a hold of
  // 45 sek, a part of a round) is the "dose" phase, where the dose allows one.
  const longest = LIMITS.phases.seconds[1];
  const matches = ([min, max]: [number, number, string]) =>
    phases.some((p) =>
      p.seconds === 'dose'
        ? rules.dose !== 'never' && min > longest
        : finite(p.seconds) && p.seconds >= min - 1e-9 && p.seconds <= max + 1e-9,
    );
  for (const stated of statedSeconds(item.texts)) {
    if (matches(stated)) continue;
    const [min, max, words] = stated;
    r.add(
      where,
      min > longest && rules.dose !== 'never'
        ? `programmet siger »${words}«: giv den fase "seconds": "dose"`
        : `programmet siger »${words}«, men ingen fase varer ${min === max ? min : `${min}–${max}`} sek`,
    );
  }
  if (tempo) {
    for (const stated of statedSeconds([tempo])) {
      if (!matches(stated)) r.add(at(where, 'tempo'), `»${stated[2]}« passer ikke med faserne`);
    }
  }
}

function checkItem(r: Report, where: string, value: Json, item: SubjectItem, subject: Subject) {
  const noDose = subject.kind === 'track';
  const prose = (key: string, chars: number) =>
    text(r, at(where, key), value[key], { kind: 'prose', chars, noDose });
  prose('trains', LIMITS.trains);
  prose('start', LIMITS.start);
  prose('tempo', LIMITS.tempo);
  prose('breathing', LIMITS.breathing);
  prose('easier', LIMITS.easier);
  prose('harder', LIMITS.harder);
  prose('getReady', LIMITS.getReady);

  const s = LIMITS.steps;
  if (list(r, at(where, 'steps'), value.steps, s.min, s.max, 'trin')) {
    value.steps.forEach((step, i) =>
      text(r, at(at(where, 'steps'), i), step, { kind: 'prose', chars: s.chars, noDose }),
    );
  }
  const c = LIMITS.cues;
  if (list(r, at(where, 'cues'), value.cues, c.min, c.max, 'cues')) {
    value.cues.forEach((cue, i) =>
      text(r, at(at(where, 'cues'), i), cue, {
        kind: 'short',
        chars: c.chars,
        words: c.words,
        noDose,
      }),
    );
  }
  const m = LIMITS.mistakes;
  if (list(r, at(where, 'mistakes'), value.mistakes, m.min, m.max, 'typiske fejl')) {
    value.mistakes.forEach((mistake, i) => {
      const w = at(at(where, 'mistakes'), i);
      if (!shape(r, w, mistake, ['mistake', 'fix'])) return;
      text(r, at(w, 'mistake'), mistake.mistake, { kind: 'prose', chars: m.mistake, noDose });
      text(r, at(w, 'fix'), mistake.fix, { kind: 'prose', chars: m.fix, noDose });
    });
  }

  const equipment: string[] = [];
  if (list(r, at(where, 'equipment'), value.equipment, 0, Infinity, 'ting')) {
    value.equipment.forEach((e, i) => {
      if (typeof e !== 'string' || !(e in EQUIPMENT)) {
        r.add(
          at(at(where, 'equipment'), i),
          `ukendt udstyr »${show(e)}« (tilladt: ${Object.keys(EQUIPMENT).join(', ')})`,
        );
      } else if (equipment.includes(e)) {
        r.add(at(at(where, 'equipment'), i), `»${e}« står to gange`);
      } else equipment.push(e);
    });
  }

  if (list(r, at(where, 'movements'), value.movements, 1, LIMITS.movements.max, 'bevægelser')) {
    const several = value.movements.length > 1;
    value.movements.forEach((mv, i) =>
      checkMovement(r, at(at(where, 'movements'), i), mv, several, equipment),
    );
    if (several) {
      const ids = value.movements.map((mv) => (isObject(mv) ? mv.id : undefined));
      if (new Set(ids).size !== ids.length)
        r.add(at(where, 'movements'), 'to bevægelser har samme id');
    }
    checkTiming(
      r,
      where,
      item,
      value.movements.filter(isObject) as unknown as Movement[],
      typeof value.tempo === 'string' ? value.tempo : undefined,
    );
  }
}

/**
 * Problems in an explanation file (content/explain/<name>.json); an empty list means it is valid.
 * `name` is the file name without .json.
 */
export function validateExplainFile(data: unknown, name: string, program: Program): Problem[] {
  const r = new Report();
  if (!shape(r, '', data, ['format', 'subject', 'why', 'items'])) return r.problems;
  if (data.format !== CONTENT_FORMAT) r.add('format', `skal være ${CONTENT_FORMAT}`);
  if (data.subject !== name) r.add('subject', `skal være filens navn: »${name}«`);
  const subject = subjectOf(program, name);
  if (!subject) {
    r.add(
      'subject',
      `»${name}« er hverken et spor i program/tracks eller en rutine i program/routines.json`,
    );
    return r.problems;
  }
  const w = LIMITS.why;
  if (list(r, 'why', data.why, w.min, w.max, 'afsnit')) {
    data.why.forEach((p, i) => text(r, at('why', i), p, { kind: 'prose', chars: w.chars }));
  }
  if (!list(r, 'items', data.items, 1, Infinity, 'trin')) return r.problems;

  const full = new Map<string, Json>();
  const order = subject.items.map((i) => i.id);
  let lastIndex = -1;
  const seen = new Set<string>();
  data.items.forEach((entry, i) => {
    const where = isObject(entry) && typeof entry.id === 'string' ? entry.id : at('items', i);
    if (!isObject(entry)) {
      r.add(where, 'skal være et objekt { … }');
      return;
    }
    const item = subject.items.find((s) => s.id === entry.id);
    if (!item) {
      r.add(where, `»${show(entry.id)}« er ikke et trin i »${name}« (der er: ${order.join(', ')})`);
      return;
    }
    if (seen.has(item.id)) r.add(where, 'står to gange');
    seen.add(item.id);
    const index = order.indexOf(item.id);
    if (index < lastIndex) r.add(where, 'trinene skal stå i programmets rækkefølge');
    lastIndex = Math.max(lastIndex, index);
    if ('like' in entry) {
      shape(r, where, entry, ['id', 'like']);
      return;
    }
    if (!shape(r, where, entry, ITEM_KEYS)) return;
    full.set(item.id, entry);
    checkItem(r, where, entry, item, subject);
  });

  // »like« points at a full explanation in the same file, and the programme's tempo must fit it.
  for (const entry of data.items) {
    if (!isObject(entry) || !('like' in entry) || typeof entry.id !== 'string') continue;
    const target = typeof entry.like === 'string' ? full.get(entry.like) : undefined;
    if (!target) {
      r.add(
        entry.id,
        `»like« skal pege på et fuldt forklaret trin i filen (ikke »${show(entry.like)}«)`,
      );
      continue;
    }
    const item = subject.items.find((s) => s.id === entry.id);
    if (item && Array.isArray(target.movements)) {
      const movements = target.movements.filter(isObject) as unknown as Movement[];
      checkTiming(r, `${entry.id} (som ${show(entry.like)})`, item, movements, undefined);
    }
  }
  return r.problems;
}

// ---------------------------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------------------------

const SEGMENTS = new Set([
  'torso',
  ...['near', 'far'].flatMap((s) =>
    ['upperArm', 'forearm', 'thigh', 'shin'].map((g) => `${s}.${g}`),
  ),
]);
const ANCHORS = new Set(['near.hand', 'far.hand', 'near.foot', 'far.foot', 'back']);
const FURNITURE = new Set(['chair', 'bed', 'table', 'step']);

function point(r: Report, where: string, value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(finite)) {
    r.add(where, 'skal være et punkt [x, y]');
    return false;
  }
  const [x, y] = value as [number, number];
  if (x < -300 || x > 300 || y < -10 || y > 250)
    r.add(where, `[${x}, ${y}] ligger langt uden for figuren`);
  return true;
}

function positive(r: Report, where: string, value: unknown, max: number): void {
  if (!finite(value) || value <= 0 || value > max)
    r.add(where, `skal være et tal over 0 og højst ${max}`);
}

function checkProp(r: Report, where: string, value: unknown): string | null {
  if (!isObject(value) || typeof value.type !== 'string') {
    r.add(where, 'en rekvisit skal have en »type«');
    return null;
  }
  const t = value.type;
  if (t === 'wall') {
    if (shape(r, where, value, ['type', 'x', 'side'])) {
      if (!finite(value.x)) r.add(at(where, 'x'), 'skal være et tal');
      if (value.side !== 1 && value.side !== -1) r.add(at(where, 'side'), 'skal være 1 eller -1');
    }
  } else if (FURNITURE.has(t) || t === 'sofa') {
    const optional = t === 'sofa' ? ['back', 'backSide'] : [];
    if (shape(r, where, value, ['type', 'x', 'width', 'height'], optional)) {
      if (!finite(value.x)) r.add(at(where, 'x'), 'skal være et tal');
      positive(r, at(where, 'width'), value.width, 200);
      positive(r, at(where, 'height'), value.height, 120);
      if (value.back !== undefined) positive(r, at(where, 'back'), value.back, 150);
      if (value.backSide !== undefined && value.backSide !== 'left' && value.backSide !== 'right') {
        r.add(at(where, 'backSide'), 'skal være "left" eller "right"');
      }
    }
  } else if (
    t === 'books' ||
    t === 'pillow' ||
    t === 'towel' ||
    t === 'backpack' ||
    t === 'bottles'
  ) {
    const attached = 'attach' in value;
    if (attached && (t === 'books' || t === 'pillow'))
      r.add(where, `»${t}« kan ikke bæres; brug »at«`);
    if (!attached && t === 'bottles') r.add(where, '»bottles« holdes i hånden; brug »attach«');
    const place = attached ? 'attach' : 'at';
    const required = ['type', place, ...(t === 'pillow' || t === 'towel' ? ['width'] : [])];
    const optional =
      t === 'books' ? ['width', 'count'] : t === 'towel' && !attached ? ['rolled'] : [];
    if (shape(r, where, value, required, optional)) {
      if (attached && !ANCHORS.has(value.attach as string)) {
        r.add(at(where, 'attach'), `skal være en af: ${[...ANCHORS].join(', ')}`);
      }
      if (!attached) point(r, at(where, 'at'), value.at);
      if (value.width !== undefined) positive(r, at(where, 'width'), value.width, 80);
      if (
        value.count !== undefined &&
        (!Number.isInteger(value.count) ||
          (value.count as number) < 1 ||
          (value.count as number) > 8)
      ) {
        r.add(at(where, 'count'), 'skal være et helt tal fra 1 til 8');
      }
      if (value.rolled !== undefined && typeof value.rolled !== 'boolean') {
        r.add(at(where, 'rolled'), 'skal være true eller false');
      }
    }
  } else {
    r.add(at(where, 'type'), `ukendt rekvisit »${t}«`);
    return null;
  }
  return t;
}

const NOMINAL = {
  arms: { upper: BODY.upperArm, lower: BODY.forearm },
  legs: { upper: BODY.thigh, lower: BODY.shin },
} as const;

/** Checks a limb; returns whether it is shown (not null). */
function checkLimb(
  r: Report,
  where: string,
  value: unknown,
  view: string,
  kind: 'arms' | 'legs',
): boolean | undefined {
  if (value === null) return false;
  if (isObject(value) && 'joint' in value) {
    if (!shape(r, where, value, ['joint', 'end'], ['tip'])) return true;
    point(r, at(where, 'joint'), value.joint);
    point(r, at(where, 'end'), value.end);
    if (value.tip !== undefined) point(r, at(where, 'tip'), value.tip);
    return true;
  }
  if (!shape(r, where, value, ['to'], ['bend', 'tip', 'upper', 'lower'])) return undefined;
  point(r, at(where, 'to'), value.to);
  if (view === 'side' && value.bend !== undefined) {
    r.add(
      at(where, 'bend'),
      'i sidebilledet bøjer albuer og knæ selv den rigtige vej; fjern »bend«',
    );
  }
  if (view !== 'side' && value.bend !== 1 && value.bend !== -1) {
    r.add(
      at(where, 'bend'),
      `skal være 1 eller -1 i ${view === 'front' ? 'frontbilledet' : 'billedet ovenfra'}`,
    );
  }
  if (value.tip !== undefined && !finite(value.tip)) point(r, at(where, 'tip'), value.tip);
  for (const seg of ['upper', 'lower'] as const) {
    const length = value[seg];
    const nominal = NOMINAL[kind][seg];
    if (length !== undefined && (!finite(length) || length < nominal / 2 || length > nominal)) {
      r.add(at(where, seg), `skal være mellem ${nominal / 2} og ${nominal} (forkortet led)`);
    }
  }
  return true;
}

function checkPose(
  r: Report,
  where: string,
  value: unknown,
  view: string,
): Record<string, boolean> {
  const shown: Record<string, boolean> = {};
  if (!shape(r, where, value, ['hip', 'torso', 'arms', 'legs'], ['head', 'width'])) return shown;
  point(r, at(where, 'hip'), value.hip);
  if (!finite(value.torso) || Math.abs(value.torso) > 360)
    r.add(at(where, 'torso'), 'en vinkel i grader');
  if (value.head !== undefined && (!finite(value.head) || Math.abs(value.head) > 90)) {
    r.add(at(where, 'head'), 'en vinkel mellem -90 og 90 grader');
  }
  if (value.width !== undefined) {
    if (view !== 'front') r.add(at(where, 'width'), '»width« bruges kun i frontbilledet');
    else if (shape(r, at(where, 'width'), value.width, ['shoulders', 'hips'])) {
      positive(r, at(at(where, 'width'), 'shoulders'), value.width.shoulders, 40);
      positive(r, at(at(where, 'width'), 'hips'), value.width.hips, 40);
    }
  }
  for (const kind of ['arms', 'legs'] as const) {
    const pair = value[kind];
    if (!shape(r, at(where, kind), pair, ['near', 'far'])) continue;
    for (const side of ['near', 'far'] as const) {
      const visible = checkLimb(r, at(at(where, kind), side), pair[side], view, kind);
      if (visible !== undefined) shown[`${side}.${kind}`] = visible;
    }
  }
  return shown;
}

function movementOf(item: ExplainItem, id: unknown): Movement | undefined {
  if (item.movements.length === 1 && id === undefined) return item.movements[0];
  return item.movements.find((m) => m.id === id);
}

/**
 * Problems in a figure file (content/figures/<name>.json). The figures build on the positions in
 * the explanation file of the same name, so `explain` is that file (null when it is missing).
 */
export function validateFigureFile(
  data: unknown,
  name: string,
  program: Program,
  explain: ExplainFile | null,
): Problem[] {
  const r = new Report();
  if (!shape(r, '', data, ['format', 'subject', 'figures'])) return r.problems;
  if (data.format !== CONTENT_FORMAT) r.add('format', `skal være ${CONTENT_FORMAT}`);
  if (data.subject !== name) r.add('subject', `skal være filens navn: »${name}«`);
  const subject = subjectOf(program, name);
  if (!subject) {
    r.add(
      'subject',
      `»${name}« er hverken et spor i program/tracks eller en rutine i program/routines.json`,
    );
    return r.problems;
  }
  if (!explain) {
    r.add(
      '',
      `forklaringen content/explain/${name}.json mangler; figurerne bygger på dens positioner`,
    );
    return r.problems;
  }
  if (!list(r, 'figures', data.figures, 1, Infinity, 'figurer')) return r.problems;

  const items = new Map(explain.items.map((e) => [e.id, e]));
  const drawn = new Set<string>();
  const keyOf = (id: unknown, movement: unknown) => `${show(id)}/${show(movement ?? '')}`;
  for (const entry of data.figures) {
    if (isObject(entry) && !('like' in entry)) drawn.add(keyOf(entry.id, entry.movement));
  }

  const seen = new Set<string>();
  data.figures.forEach((entry, i) => {
    let where = at('figures', i);
    if (!isObject(entry)) {
      r.add(where, 'skal være et objekt { … }');
      return;
    }
    where = `${show(entry.id)}${entry.movement === undefined ? '' : ` › ${show(entry.movement)}`}`;
    const explained = items.get(entry.id as string);
    if (!subject.items.some((s) => s.id === entry.id)) {
      r.add(where, `»${show(entry.id)}« er ikke et trin i »${name}«`);
      return;
    }
    if (!explained) {
      r.add(where, `»${show(entry.id)}« har ingen forklaring i content/explain/${name}.json`);
      return;
    }
    if ('like' in explained) {
      r.add(where, `forklares som »${explained.like}« og bruger dens figur; fjern figuren`);
      return;
    }
    const movement = movementOf(explained, entry.movement);
    if (!movement) {
      const ids = explained.movements.map((m) => m.id).join(', ');
      r.add(
        where,
        explained.movements.length > 1
          ? `»movement« skal være en af bevægelserne: ${ids}`
          : '»movement« bruges kun, når forklaringen har flere bevægelser',
      );
      return;
    }
    const key = keyOf(entry.id, entry.movement);
    if (seen.has(key)) r.add(where, 'står to gange');
    seen.add(key);

    if ('like' in entry) {
      if (
        shape(r, where, entry, ['id', 'like'], ['movement']) &&
        !drawn.has(keyOf(entry.like, entry.movement))
      ) {
        r.add(
          at(where, 'like'),
          `skal pege på en tegnet figur i filen (ikke »${show(entry.like)}«)`,
        );
      }
      return;
    }
    if (
      !shape(
        r,
        where,
        entry,
        ['id', 'view', 'props', 'highlight', 'keyframes'],
        ['movement', 'facing'],
      )
    ) {
      return;
    }
    const view = entry.view;
    if (view !== 'side' && view !== 'front' && view !== 'top') {
      r.add(at(where, 'view'), 'skal være "side", "front" eller "top"');
    }
    if (entry.facing !== undefined) {
      if (view !== 'side') r.add(at(where, 'facing'), '»facing« bruges kun i sidebilledet');
      else if (entry.facing !== 1 && entry.facing !== -1)
        r.add(at(where, 'facing'), 'skal være 1 eller -1');
    }

    const equipment: readonly Equipment[] = explained.equipment;
    const props = new Set<string>();
    if (list(r, at(where, 'props'), entry.props, 0, 8, 'rekvisitter')) {
      entry.props.forEach((p, j) => {
        const type = checkProp(r, at(at(where, 'props'), j), p);
        if (!type) return;
        props.add(type);
        if (!(equipment as readonly string[]).includes(type)) {
          r.add(at(at(where, 'props'), j), `»${type}« står ikke i forklaringens »equipment«`);
        }
      });
    }
    for (const pos of movement.positions) {
      for (const c of pos.contacts) {
        if (c.on !== 'floor' && !props.has(c.on)) {
          r.add(
            at(where, 'props'),
            `positionen »${pos.id}« rører »${c.on}«, men figuren har ingen ${c.on}`,
          );
        }
      }
    }

    if (list(r, at(where, 'highlight'), entry.highlight, 1, 8, 'røde segmenter')) {
      entry.highlight.forEach((h, j) => {
        if (typeof h !== 'string' || !SEGMENTS.has(h)) {
          r.add(
            at(at(where, 'highlight'), j),
            `ukendt segment »${show(h)}« (tilladt: ${[...SEGMENTS].join(', ')})`,
          );
        }
      });
    }

    if (!isObject(entry.keyframes)) {
      r.add(at(where, 'keyframes'), 'skal være et objekt med én pose pr. position');
      return;
    }
    const ids = movement.positions.map((p) => p.id);
    for (const id of ids)
      if (!(id in entry.keyframes)) r.add(at(where, 'keyframes'), `mangler positionen »${id}«`);
    const visibility: Record<string, Set<boolean>> = {};
    for (const [id, pose] of Object.entries(entry.keyframes)) {
      if (!ids.includes(id)) {
        r.add(
          at(where, 'keyframes'),
          `»${id}« er ikke en position i forklaringen (der er: ${ids.join(', ')})`,
        );
        continue;
      }
      const shown = checkPose(r, at(at(where, 'keyframes'), id), pose, show(view));
      for (const [limb, visible] of Object.entries(shown))
        (visibility[limb] ??= new Set()).add(visible);
    }
    for (const [limb, values] of Object.entries(visibility)) {
      if (values.size > 1)
        r.add(
          at(where, 'keyframes'),
          `${limb} er skjult (null) i nogle positioner og vist i andre`,
        );
    }
  });
  return r.problems;
}

// ---------------------------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------------------------

/** Steps and routine items, and which of them have an explanation and a figure. */
export function coverage(
  program: Program,
  explains: readonly ExplainFile[],
  figures: readonly FigureFile[],
): { all: string[]; explained: string[]; drawn: string[] } {
  const all = [
    ...program.tracks.flatMap((t) => t.steps.map((s) => s.id)),
    ...program.routines.flatMap((rt) => rt.items.map((i) => `${rt.id}.${i.key}`)),
  ];
  const entries = new Map(explains.flatMap((f) => f.items.map((e) => [e.id, e] as const)));
  const figured = new Set(
    figures.flatMap((f) => f.figures.map((e) => `${e.id}/${e.movement ?? ''}`)),
  );
  // Drawn = every movement has a figure; a step explained »like« another is drawn with it.
  const isDrawn = (id: string, depth = 0): boolean => {
    const entry = entries.get(id);
    if (!entry || depth > 1) return false;
    if (isLike(entry)) return isDrawn(entry.like, depth + 1);
    return entry.movements.every((m) => figured.has(`${id}/${m.id ?? ''}`));
  };
  return {
    all,
    explained: all.filter((id) => entries.has(id)),
    drawn: all.filter((id) => isDrawn(id)),
  };
}
