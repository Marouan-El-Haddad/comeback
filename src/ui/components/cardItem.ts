// What the exercise card shows for a step, a routine item or a measurement (docs/SPEC.md 3.8,
// DECISIONS.md D43): the name and the dose from the programme, and the explanation from
// content/explain when it is written. Without it the card shows the programme's own words without
// page numbers and sources. Pure functions: nothing here fetches content, so the tests run them on
// the programme as it is.
import { withoutSources } from '../../content/refs.ts';
import {
  EQUIPMENT,
  isBorrowed,
  isLike,
  MEASURES,
  type Equipment,
  type ExplainFile,
  type ExplainItem,
  type FigureFile,
  type FigureItem,
  type Movement,
  type OwnMovement,
} from '../../content/types.ts';
import { formatDose } from '../../engine/format.ts';
import type { Dose, Measure, Program, SessionKind } from '../../engine/types.ts';

/**
 * Where a card is opened from in a session: its kind and its first power step. The warm-up's
 * »Potensér« shows that step, and a movement for other sessions is left out (docs/SPEC.md 9.1).
 */
export interface CardContext {
  session: SessionKind;
  /** The session's first power step, or null when it has none. */
  power: string | null;
  /**
   * The set runs the lighter variant (sharp pain on step 1, ENGINE R-PAIN-SHARP): the card shows the
   * explanation's »Lettere« at the top (docs/SPEC.md 3.8, DECISIONS.md D47).
   */
  lighter?: boolean;
}

/** A measurement's »dose«: what is measured (docs/SPEC.md 4.8). */
const MEASURE_DOSE: Record<Measure['unit'], string> = {
  reps: 'Så mange som muligt',
  sec: 'Så længe du kan',
  cm: 'Afstand i cm',
  m: 'Distance i meter',
  depth: 'Så langt ned, du kan styre',
};

export interface CardItem {
  /** The step id ('press.1'), the routine item id ('warmup.2') or 'measures.<id>'. */
  id: string;
  /** The content file it belongs to: the track, the routine or 'measures'. */
  subject: string;
  /** Above the name: »Pres · trin 1«, »Opvarmning · 2 af 4«, »Måling«. */
  kicker: string;
  name: string;
  /** The dose as the programme writes it: »3 × 6–12«, »2 min«. */
  dose: string;
  /** What the numbers in the dose are, for someone new to training; null when the dose says it. */
  doseLegend: string | null;
  /** The programme's execution without sources; null when it only repeats the dose. */
  execution: string | null;
  /** The programme's cues that do not just repeat the execution. */
  cues: string[];
  /** The parts of one round (club sequence, wall sit rounds), in order. */
  round: string[];
  /** The track's »Hvorfor« from the programme without sources; content/explain replaces it. */
  why: string[];
}

/** Lower case, single spaces, no full stop at the end: to see whether one text repeats another. */
function plain(text: string): string {
  return text
    .toLocaleLowerCase('da-DK')
    .replace(/\s+/g, ' ')
    .replace(/[.\s]+$/, '')
    .trim();
}

/** What the numbers in a dose mean (»3 × 6–12« = sets × reps). */
export function doseLegend(dose: Dose): string | null {
  switch (dose.kind) {
    case 'reps':
    case 'power':
    case 'fixed':
      return 'sæt × gentagelser';
    case 'hold':
      return 'sæt × sekunder';
    case 'emom':
      return 'minutter × gentagelser i starten af hvert minut';
    case 'rounds':
      // »2 × 1 runde«: the first number is sets (D47); »5 runder i træk« says it itself.
      return dose.text.includes('×') ? 'sæt × runder' : null;
    case 'always':
      return null;
  }
}

/**
 * What the numbers in a routine item's dose mean, read from its text (D47): »2 × 8« is sets ×
 * repetitions, »8 × 5 sek« repetitions × seconds; a dose in words says it itself.
 */
export function routineLegend(dose: string): string | null {
  const range = String.raw`\d+(?:–\d+)?`;
  if (new RegExp(`^${range} × ${range} sek$`).test(dose)) return 'gentagelser × sekunder';
  if (new RegExp(`^${range} × ${range}$`).test(dose)) return 'sæt × gentagelser';
  return null;
}

/** The card of a step or routine item, or null when the programme has no such id. */
export function cardItem(program: Program, id: string): CardItem | null {
  const dot = id.indexOf('.');
  if (dot < 0) return null;
  const subject = id.slice(0, dot);
  const track = program.tracks.find((t) => t.id === subject);
  if (track) {
    const step = track.steps.find((s) => s.id === id);
    if (!step) return null;
    const dose = formatDose(step.dose);
    const execution = withoutSources(step.execution);
    const shown = plain(execution) === plain(dose) ? null : execution;
    const cues = step.cues
      .map((cue) => withoutSources(cue))
      .filter((cue) => cue !== '' && !(shown && plain(shown).includes(plain(cue))))
      .filter((cue) => plain(cue) !== plain(dose));
    return {
      id,
      subject,
      kicker: `${track.short} · trin ${step.key}`,
      name: step.name,
      dose,
      doseLegend: doseLegend(step.dose),
      execution: shown,
      cues,
      round: (step.round ?? []).map((part) => withoutSources(part.label)),
      why: (track.why ?? []).map((box) => withoutSources(box.text)),
    };
  }
  if (subject === MEASURES) {
    const measure = program.measures.find((m) => `${MEASURES}.${m.id}` === id);
    if (!measure) return null;
    return {
      id,
      subject,
      kicker: 'Måling',
      name: measure.name,
      dose: MEASURE_DOSE[measure.unit],
      doseLegend: null,
      execution: withoutSources(measure.how),
      cues: [],
      round: [],
      why: [],
    };
  }
  const routine = program.routines.find((r) => r.id === subject);
  if (!routine) return null;
  const index = routine.items.findIndex((i) => `${routine.id}.${i.key}` === id);
  const routineItem = routine.items[index];
  if (!routineItem) return null;
  return {
    id,
    subject,
    kicker: `${routine.name} · ${index + 1} af ${routine.items.length}`,
    name: routineItem.name,
    dose: routineItem.dose,
    doseLegend: routineLegend(routineItem.dose),
    execution: withoutSources(routineItem.execution),
    cues: [],
    round: [],
    why: [],
  };
}

/**
 * The explanation of an id in its file; an item explained »like« another gets that one's, from the
 * same file or from `other`, the file of another subject it points into (a measurement like a step).
 */
export function explanationOf(
  file: ExplainFile | null | undefined,
  id: string,
  other?: ExplainFile | null,
): ExplainItem | null {
  const entry = file?.items.find((e) => e.id === id);
  if (!entry) return null;
  if (!isLike(entry)) return entry;
  const target = [...(file?.items ?? []), ...(other?.items ?? [])].find((e) => e.id === entry.like);
  return target && !isLike(target) ? target : null;
}

/** The subject of another file an item's »like« points into ('core_front'), or null. */
export function likeSubject(file: ExplainFile | null | undefined, id: string): string | null {
  const entry = file?.items.find((e) => e.id === id);
  if (!entry || !isLike(entry)) return null;
  const subject = entry.like.slice(0, Math.max(0, entry.like.indexOf('.')));
  return subject && subject !== file?.subject ? subject : null;
}

/** A movement on the card, with where its positions come from, so its figure can be found. */
export type CardMovement = OwnMovement & {
  /** The item whose explanation holds the positions (a like's target, the power step) and the movement's id there. */
  source?: { item: string; movement?: string };
};

/**
 * The movements a card shows. In a session, a movement for other sessions is left out, and the
 * warm-up's borrowed movement becomes the session's first power step: its movements under its name,
 * or its name alone until its explanation is there; without a power step it is left out. Outside a
 * session every movement is shown, a borrowed one by its own name. `ownId` is the id of the item
 * whose explanation the movements are (the item itself, or the one it is explained like).
 */
export function cardMovements(
  movements: readonly Movement[],
  context: CardContext | null,
  power: { name: string; explained: ExplainItem | null } | null,
  ownId?: string,
): CardMovement[] {
  return movements.flatMap((m): CardMovement[] => {
    if (context && m.sessions && !m.sessions.includes(context.session)) return [];
    if (!isBorrowed(m)) return [ownId ? { ...m, source: { item: ownId, movement: m.id } } : m];
    if (context && !context.power) return [];
    const name = context && power ? power.name : m.name;
    const explained = context && power ? power.explained : null;
    const own = explained?.movements.filter((x): x is OwnMovement => !isBorrowed(x));
    if (!explained || !own || own.length === 0) {
      return [{ id: m.id, name, positions: [], phases: [] }];
    }
    return own.map((x, i) => ({
      ...x,
      id: m.id && own.length > 1 ? `${m.id}-${x.id ?? i}` : m.id,
      name: own.length > 1 && x.name ? `${name}: ${x.name}` : name,
      source: { item: explained.id, movement: x.id },
    }));
  });
}

/**
 * The drawn figure of an item's movement in a figure file, following a figure »like« in the file;
 * null when it is not drawn yet (the card then shows the pictogram, docs/SPEC.md 3.8).
 */
export function figureIn(
  file: FigureFile | null | undefined,
  id: string,
  movement?: string,
): FigureItem | null {
  const find = (target: string) =>
    file?.figures.find((f) => f.id === target && f.movement === movement);
  const entry = find(id);
  // »like« checked here, not with isFigureLike: src/content/types.ts is in the start files.
  if (!entry) return null;
  if (!('like' in entry)) return entry;
  const target = find(entry.like);
  return target && !('like' in target) ? target : null;
}

/** The first letter in lower case: a label inside a sentence (»Op« → »op«). */
function lowerFirst(text: string): string {
  return text.slice(0, 1).toLocaleLowerCase('da-DK') + text.slice(1);
}

/** »a, b og c«. */
function andList(items: readonly string[]): string {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} og ${items[items.length - 1] ?? ''}`;
}

/**
 * The figure's text alternative (docs/SPEC.md 6): the name, each position in words and the phases:
 * »Push-up med tempo. Oppe: Strakte arme … Nede: Brystet … Faserne: 3 sek ned, 1 sek stille og op.«
 */
export function figureText(name: string, movement: OwnMovement): string {
  const positions = movement.positions.map((p) => `${p.name}: ${p.text}`).join(' ');
  const phases = andList(movement.phases.map((p) => lowerFirst(p.label)));
  return [`${name}.`, positions, phases ? `Faserne: ${phases}.` : '']
    .filter((t) => t !== '')
    .join(' ');
}

/** »Stol og væg«; nothing but the floor is »Kun gulvet«. */
export function equipmentText(equipment: readonly Equipment[]): string {
  if (equipment.length === 0) return 'Kun gulvet';
  const names = equipment.map((e, i) =>
    i === 0 ? EQUIPMENT[e] : EQUIPMENT[e].toLocaleLowerCase('da-DK'),
  );
  const last = names.pop() ?? '';
  return names.length > 0 ? `${names.join(', ')} og ${last}` : last;
}

/** One repetition as the figure's phases: »3 sek ned · 1 sek stille · Op«. */
export function phasesText(movement: Movement): string {
  if (isBorrowed(movement)) return '';
  return movement.phases.map((phase) => phase.label).join(' · ');
}

/** The positions in words: the figure's text alternative (docs/SPEC.md 6). */
export function movementsText(movements: readonly Movement[]): string {
  return movements
    .map((m) => {
      if (isBorrowed(m)) return `${m.name}.`;
      const positions = m.positions.map((p) => `${p.name}: ${p.text}`).join(' ');
      if (!positions) return m.name ? `${m.name}.` : '';
      return movements.length > 1 && m.name ? `${m.name}. ${positions}` : positions;
    })
    .filter((text) => text !== '')
    .join(' ');
}
