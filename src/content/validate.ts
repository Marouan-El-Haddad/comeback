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
  isBorrowed,
  isLike,
  MEASURES,
  PAIRED_PARTS,
  SINGLE_PARTS,
  SURFACES,
  type Equipment,
  type ExplainFile,
  type ExplainItem,
  type FigureFile,
  type Movement,
  type OwnMovement,
  type Phase,
} from './types.ts';

export interface Problem {
  /** Where in the file: »press.1 › cues[2]«. */
  where: string;
  message: string;
}

/** A step, routine item or measurement as the programme has it. */
export interface SubjectItem {
  id: string;
  kind: 'step' | 'routine' | 'measure';
  /** The step's dose; undefined for a routine item or a measurement. */
  dose?: Dose;
  /** The programme's own words about it: execution, cues, a round's parts, a routine's dose. */
  texts: string[];
}

export interface Subject {
  kind: 'track' | 'routine' | 'measures';
  id: string;
  items: SubjectItem[];
}

/**
 * The subject a content file belongs to: a track, a routine (items `<routine>.<key>`) or the
 * measurements (`measures`, items `measures.<id>`).
 */
export function subjectOf(program: Program, id: string): Subject | null {
  const track = program.tracks.find((t) => t.id === id);
  if (track) {
    return {
      kind: 'track',
      id,
      items: track.steps.map((s) => ({
        id: s.id,
        kind: 'step',
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
      items: routine.items.map((i) => ({
        id: `${routine.id}.${i.key}`,
        kind: 'routine',
        texts: [i.execution, i.dose],
      })),
    };
  }
  if (id === MEASURES) {
    return {
      kind: 'measures',
      id,
      items: program.measures.map((m) => ({
        id: `${MEASURES}.${m.id}`,
        kind: 'measure',
        texts: [m.how],
      })),
    };
  }
  return null;
}

/** The subject of an item id: 'press.1' → 'press', 'measures.hollow' → 'measures'. */
export function subjectIdOf(itemId: string): string {
  const dot = itemId.indexOf('.');
  return dot < 0 ? itemId : itemId.slice(0, dot);
}

/** A step, routine item or measurement anywhere in the programme, or null. */
export function programItem(program: Program, itemId: string): SubjectItem | null {
  return subjectOf(program, subjectIdOf(itemId))?.items.find((i) => i.id === itemId) ?? null;
}

const UNKNOWN_SUBJECT = 'er hverken et spor, en rutine eller »measures«';

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
  repeat: [2, 30] as const,
} as const;

const ID = /^[a-z][a-z0-9_]*$/;
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}]/u;
const DOSE = /\d+\s*×\s*\d+/u;
const STATED_SECONDS = /(\d+(?:,\d+)?)(?:\s*[–-]\s*(\d+(?:,\d+)?))?\s*sek\b(?:\s+[\p{L}]+)?/gu;
/** A year: the explanations name no studies (A2). Danish style writes thousands as »2.000«. */
const YEAR = /\b(?:19|20)\d{2}\b/u;
/** Studies and research are sources outside the app (A2). */
const RESEARCH =
  /\b(?:meta-?analyse\p{L}*|studie(?:r|t|rne|ts|rnes)?|forskning\p{L}*|forsker\p{L}*|evidens\p{L}*)(?!\p{L})/iu;
/** A step named in »Lettere« or »Sværere«: »trin 2«, »E3«. */
const STEP_NAME = /\b[Tt]rin\s+[A-Z]?\d+\b|\b[A-Z]\d\b/u;

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
  const year = YEAR.exec(value);
  if (year) r.add(where, `ingen årstal (»${year[0]}«): forklaringen nævner ingen studier`);
  const research = RESEARCH.exec(value);
  if (research) r.add(where, `ingen henvisning til studier eller forskning (»${research[0]}«)`);
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

/** The seconds the programme (or a text) states: »3 sek ned« → [3, 3, '3 sek ned']. */
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

interface Rules {
  /** Whether a phase may (or must) last "dose": seconds "dose" or repeat "dose". */
  dose: 'required' | 'allowed' | 'never';
  /** A repetition ends where it started. */
  loop: boolean;
}

/** Which uses of "dose" and which loops the item allows (docs/SPEC.md 9.1). */
function rulesFor(item: SubjectItem): Rules {
  if (item.kind !== 'step') return { dose: 'allowed', loop: false }; // routine item, measurement
  switch (item.dose?.kind) {
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

const longest = LIMITS.phases.seconds[1];

/** A phase that lasts as long as the dose: its seconds or its repeat is "dose". */
function lastsDose(phase: Phase): boolean {
  return phase.seconds === 'dose' || phase.repeat === 'dose';
}

/** Seconds of the whole phase (one way, or all repeats); null for a "dose" phase. */
function phaseTotal(phase: Phase): number | null {
  if (lastsDose(phase) || !finite(phase.seconds)) return null;
  return phase.seconds * (typeof phase.repeat === 'number' ? phase.repeat : 1);
}

/** The position each phase ends in: a repeat ends where it started. */
function endPositions(movement: OwnMovement): string[] {
  let current = movement.positions[0]?.id ?? '';
  return movement.phases.map((phase) => {
    if (phase.repeat === undefined) current = phase.to;
    return current;
  });
}

interface MovementContext {
  several: boolean;
  equipment: readonly string[];
  item: SubjectItem;
  rules: Rules;
  sessions: readonly string[];
}

function checkSessions(r: Report, where: string, value: unknown, ctx: MovementContext): void {
  if (value === undefined) return;
  if (ctx.item.kind !== 'routine') {
    r.add(where, '»sessions« bruges kun i rutiner (fx pogo-hop kun i Styrke A)');
    return;
  }
  if (!list(r, where, value, 1, ctx.sessions.length, 'pas')) return;
  const seen = new Set<unknown>();
  for (const s of value) {
    if (typeof s !== 'string' || !ctx.sessions.includes(s)) {
      r.add(where, `ukendt pas »${show(s)}« (tilladt: ${ctx.sessions.join(', ')})`);
    } else if (seen.has(s)) r.add(where, `»${s}« står to gange`);
    seen.add(s);
  }
}

function checkMovement(r: Report, where: string, value: unknown, ctx: MovementContext): void {
  if (isObject(value) && 'from' in value) {
    // The warm-up's »Potensér«: the session's first power step, with its own figure and phases.
    if (!shape(r, where, value, ['from', 'name'], ['id', 'sessions'])) return;
    if (ctx.item.kind !== 'routine') {
      r.add(where, '»from« bruges kun i rutiner (opvarmningens »Potensér«)');
    }
    if (value.from !== 'power') r.add(at(where, 'from'), 'skal være "power"');
    if (ctx.several && (typeof value.id !== 'string' || !ID.test(value.id))) {
      r.add(where, 'flere bevægelser kræver et »id« med små bogstaver, tal og _');
    }
    text(r, at(where, 'name'), value.name, { kind: 'short', chars: LIMITS.movements.name });
    checkSessions(r, at(where, 'sessions'), value.sessions, ctx);
    return;
  }
  if (!shape(r, where, value, ['positions', 'phases'], ['id', 'name', 'sessions'])) return;
  if (ctx.several) {
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
  checkSessions(r, at(where, 'sessions'), value.sessions, ctx);

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
        pos.contacts.forEach((c, j) => checkContact(r, at(at(w, 'contacts'), j), c, ctx.equipment));
      }
    });
  }

  const ph = LIMITS.phases;
  const reached = new Set<string>(positionIds.slice(0, 1));
  let current = positionIds[0];
  if (list(r, at(where, 'phases'), value.phases, ph.min, ph.max, 'faser')) {
    value.phases.forEach((phase, i) => {
      const w = at(at(where, 'phases'), i);
      if (!shape(r, w, phase, ['to', 'seconds', 'label'], ['repeat'])) return;
      const known = typeof phase.to === 'string' && positionIds.includes(phase.to);
      if (!known) {
        r.add(
          at(w, 'to'),
          `positionen »${show(phase.to)}« findes ikke (der er: ${positionIds.join(', ')})`,
        );
      } else reached.add(phase.to as string);
      const s = phase.seconds;
      if (s !== 'dose' && (!finite(s) || s < ph.seconds[0] || s > ph.seconds[1])) {
        r.add(at(w, 'seconds'), `${ph.seconds[0]}–${ph.seconds[1]} sek eller "dose"`);
      }
      const repeat = phase.repeat;
      const [fewest, most] = LIMITS.repeat;
      if (repeat !== undefined) {
        if (
          repeat !== 'dose' &&
          (!Number.isInteger(repeat) || (repeat as number) < fewest || (repeat as number) > most)
        ) {
          r.add(at(w, 'repeat'), `et helt tal fra ${fewest} til ${most} eller "dose"`);
        }
        if (repeat === 'dose' && s === 'dose') {
          r.add(
            at(w, 'seconds'),
            'med "repeat": "dose" er »seconds« tiden for én gang frem og tilbage',
          );
        }
        if (known && phase.to === current) {
          r.add(
            at(w, 'repeat'),
            `»repeat« går frem og tilbage: »to« skal være en anden position end »${current}«`,
          );
        }
      } else if (known) current = phase.to as string;
      if (
        text(r, at(w, 'label'), phase.label, {
          kind: 'short',
          chars: ph.label,
          words: ph.labelWords,
        })
      ) {
        checkLabel(r, at(w, 'label'), phase as unknown as Phase);
      }
    });
  }
  for (const id of positionIds) {
    if (!reached.has(id)) r.add(at(where, 'positions'), `ingen fase går til positionen »${id}«`);
  }
}

/** A label that says »N sek« says how long the phase lasts (all its repeats). */
function checkLabel(r: Report, where: string, phase: Phase): void {
  const total = phaseTotal(phase);
  for (const [min, max] of statedSeconds([phase.label])) {
    const said = `»${phase.label}« siger ${min === max ? min : `${min}–${max}`} sek`;
    if (total === null) {
      if (min <= longest) r.add(where, `${said}, men fasen er "dose"; giv den "seconds": ${min}`);
    } else if (total < min - 1e-9 || total > max + 1e-9) {
      r.add(where, `${said}, men fasen varer ${Math.round(total * 10) / 10} sek`);
    }
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

/** The movements with their own positions and phases (a borrowed one has the power step's). */
function ownMovements(movements: readonly unknown[]): OwnMovement[] {
  return movements.filter(
    (m): m is OwnMovement =>
      isObject(m) && !('from' in m) && Array.isArray(m.positions) && Array.isArray(m.phases),
  );
}

/**
 * Phases against the dose: holds need a "dose" phase, repetitions end where they started, and every
 * time the programme states for the item (»3 sek ned«, »8 × 5 sek«) is a phase of that length.
 */
function checkTiming(
  r: Report,
  where: string,
  item: SubjectItem,
  movements: readonly OwnMovement[],
  tempo: string | undefined,
): void {
  const rules = rulesFor(item);
  const phases = movements.flatMap((m) => m.phases.filter((p) => isObject(p)));
  const hasDose = phases.some(lastsDose);
  if (rules.dose === 'required' && !hasDose) {
    r.add(
      where,
      'et hold skal have en fase med "seconds": "dose" eller "repeat": "dose" (selve holdet)',
    );
  }
  if (rules.dose === 'never' && hasDose) {
    r.add(
      where,
      '"dose" bruges kun ved hold, runder, rutiner og målinger; her skal faserne have sekunder',
    );
  }
  if (rules.loop) {
    movements.forEach((m, i) => {
      const first = m.positions[0]?.id;
      const last = endPositions(m).pop();
      if (first && last && first !== last) {
        r.add(
          at(at(where, 'movements'), i),
          `en gentagelse slutter, hvor den startede: sidste fase skal gå til »${first}«`,
        );
      }
    });
  }
  // A time the programme states is a phase of that length (one way or with all repeats); a time
  // longer than any phase (a hold of 45 sek, a part of a round) is a "dose" phase, where allowed.
  const inRange = (value: number, min: number, max: number) =>
    value >= min - 1e-9 && value <= max + 1e-9;
  const matches = ([min, max]: [number, number, string]) =>
    phases.some((p) =>
      lastsDose(p)
        ? rules.dose !== 'never' && min > longest
        : finite(p.seconds) &&
          (inRange(p.seconds, min, max) || inRange(phaseTotal(p) ?? -1, min, max)),
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

function checkItem(
  r: Report,
  where: string,
  value: Json,
  item: SubjectItem,
  sessions: readonly string[],
) {
  const noDose = item.kind === 'step';
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
    const ctx: MovementContext = {
      several: value.movements.length > 1,
      equipment,
      item,
      rules: rulesFor(item),
      sessions,
    };
    value.movements.forEach((mv, i) => checkMovement(r, at(at(where, 'movements'), i), mv, ctx));
    if (ctx.several) {
      const ids = value.movements.map((mv) => (isObject(mv) ? mv.id : undefined));
      if (new Set(ids).size !== ids.length)
        r.add(at(where, 'movements'), 'to bevægelser har samme id');
    }
    const borrowed = value.movements.filter((mv) => isObject(mv) && 'from' in mv).length;
    if (borrowed > 1) r.add(at(where, 'movements'), 'højst én bevægelse med »from«');
    checkTiming(
      r,
      where,
      item,
      ownMovements(value.movements),
      typeof value.tempo === 'string' ? value.tempo : undefined,
    );
  }
}

/** Finds a full explanation in another file, for a »like« across files; undefined = not looked up. */
export type Resolve = (itemId: string) => ExplainItem | null | undefined;

/**
 * Problems in an explanation file (content/explain/<name>.json); an empty list means it is valid.
 * `name` is the file name without .json. `resolve` looks up a »like« that points into another file
 * (a measurement like its step); without it such a target is only checked against the programme.
 */
export function validateExplainFile(
  data: unknown,
  name: string,
  program: Program,
  resolve?: Resolve,
): Problem[] {
  const r = new Report();
  if (!shape(r, '', data, ['format', 'subject', 'why', 'items'])) return r.problems;
  if (data.format !== CONTENT_FORMAT) r.add('format', `skal være ${CONTENT_FORMAT}`);
  if (data.subject !== name) r.add('subject', `skal være filens navn: »${name}«`);
  const subject = subjectOf(program, name);
  if (!subject) {
    r.add('subject', `»${name}« ${UNKNOWN_SUBJECT}`);
    return r.problems;
  }
  const sessions = program.sessions.map((s) => s.id);
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
    checkItem(r, where, entry, item, sessions);
  });

  // »like« points at a full explanation – in this file or, for a step of another subject, in that
  // subject's file – whose fields fit both items; the programme's tempo must fit its phases.
  for (const entry of data.items) {
    if (!isObject(entry) || !('like' in entry) || typeof entry.id !== 'string') continue;
    const id = entry.id;
    const like = entry.like;
    let target: Json | ExplainItem | null | undefined;
    if (typeof like !== 'string' || like === id) {
      target = null;
    } else if (subjectIdOf(like) === name) {
      target = full.get(like) ?? null;
    } else if (!programItem(program, like)) {
      r.add(id, `»like« peger på »${like}«, som ikke findes i programmet`);
      continue;
    } else {
      target = resolve ? resolve(like) : undefined;
      if (target === null) {
        r.add(
          id,
          `»like« peger på »${like}«, som ikke er forklaret fuldt i content/explain/${subjectIdOf(like)}.json`,
        );
        continue;
      }
    }
    if (target === null) {
      r.add(id, `»like« skal pege på et fuldt forklaret trin (ikke »${show(like)}«)`);
      continue;
    }
    if (target === undefined) continue; // another file, not looked up here
    const item = subject.items.find((s) => s.id === id);
    if (item && Array.isArray(target.movements)) {
      checkTiming(r, `${id} (som ${show(like)})`, item, ownMovements(target.movements), undefined);
    }
    for (const key of ['easier', 'harder'] as const) {
      const named = typeof target[key] === 'string' ? STEP_NAME.exec(target[key]) : null;
      if (named) {
        r.add(
          id,
          `»like« deler »${key}« med ${show(like)}, som nævner »${named[0]}«; skriv den uden trin, eller forklar ${id} for sig`,
        );
      }
    }
  }
  return r.problems;
}

// ---------------------------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------------------------

const SEGMENTS = new Set([
  'torso',
  'neck',
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
    r.add('subject', `»${name}« ${UNKNOWN_SUBJECT}`);
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
    if (isLike(explained)) {
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
    if (isBorrowed(movement)) {
      r.add(where, 'bevægelsen viser dagens power-trin med dets egen figur; fjern figuren');
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
    const required = ['id', 'view', 'props', 'highlight', 'keyframes'];
    if (!shape(r, where, entry, required, ['movement', 'facing'])) return;
    const view = entry.view;
    if (view !== 'side' && view !== 'front' && view !== 'top') {
      r.add(at(where, 'view'), 'skal være "side", "front" eller "top"');
    }
    if (view === 'side' && entry.facing !== 1 && entry.facing !== -1) {
      r.add(
        at(where, 'facing'),
        'sidebilledet skal have »facing«: 1, når brystet vender mod højre, efter at figuren er drejet op at stå, ellers -1',
      );
    } else if (view !== 'side' && entry.facing !== undefined) {
      r.add(at(where, 'facing'), '»facing« bruges kun i sidebilledet');
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

/** Steps, routine items and measurements, and which of them have an explanation and a figure. */
export function coverage(
  program: Program,
  explains: readonly ExplainFile[],
  figures: readonly FigureFile[],
): { all: string[]; explained: string[]; drawn: string[] } {
  const all = [
    ...program.tracks.flatMap((t) => t.steps.map((s) => s.id)),
    ...program.routines.flatMap((rt) => rt.items.map((i) => `${rt.id}.${i.key}`)),
    ...program.measures.map((m) => `${MEASURES}.${m.id}`),
  ];
  const entries = new Map(explains.flatMap((f) => f.items.map((e) => [e.id, e] as const)));
  const figured = new Set(
    figures.flatMap((f) => f.figures.map((e) => `${e.id}/${e.movement ?? ''}`)),
  );
  // Drawn = every own movement has a figure; a step explained »like« another is drawn with it, and
  // a borrowed movement uses the power step's figure.
  const isDrawn = (id: string, depth = 0): boolean => {
    const entry = entries.get(id);
    if (!entry || depth > 1) return false;
    if (isLike(entry)) return isDrawn(entry.like, depth + 1);
    return entry.movements
      .filter((m) => !isBorrowed(m))
      .every((m) => figured.has(`${id}/${m.id ?? ''}`));
  };
  return {
    all,
    explained: all.filter((id) => entries.has(id)),
    drawn: all.filter((id) => isDrawn(id)),
  };
}
