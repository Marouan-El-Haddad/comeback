// What the exercise card shows for a step or a routine item (docs/SPEC.md 3.8, DECISIONS.md D43):
// the name and the dose from the programme, and the explanation from content/explain when it is
// written. Without it the card shows the programme's own words without page numbers and sources.
// Pure functions: nothing here fetches content, so the tests run them on the programme as it is.
import { withoutSources } from '../../content/refs.ts';
import {
  EQUIPMENT,
  isLike,
  type Equipment,
  type ExplainFile,
  type ExplainItem,
  type Movement,
} from '../../content/types.ts';
import { formatDose } from '../../engine/format.ts';
import type { Dose, Program } from '../../engine/types.ts';

export interface CardItem {
  /** The step id ('press.1') or the routine item id ('warmup.2'). */
  id: string;
  /** The content file it belongs to: the track or the routine id. */
  subject: string;
  /** Above the name: »Pres · trin 1«, »Opvarmning · 2 af 4«. */
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
    case 'always':
      return null;
  }
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
    doseLegend: null,
    execution: withoutSources(routineItem.execution),
    cues: [],
    round: [],
    why: [],
  };
}

/** The explanation of an id in its file; an item explained »like« another gets that one's. */
export function explanationOf(
  file: ExplainFile | null | undefined,
  id: string,
): ExplainItem | null {
  const entry = file?.items.find((e) => e.id === id);
  if (!entry) return null;
  if (!isLike(entry)) return entry;
  const target = file?.items.find((e) => e.id === entry.like);
  return target && !isLike(target) ? target : null;
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
  return movement.phases.map((phase) => phase.label).join(' · ');
}

/** The positions in words: the figure's text alternative (docs/SPEC.md 6). */
export function movementsText(movements: readonly Movement[]): string {
  return movements
    .map((m) => {
      const positions = m.positions.map((p) => `${p.name}: ${p.text}`).join(' ');
      return movements.length > 1 && m.name ? `${m.name}. ${positions}` : positions;
    })
    .join(' ');
}
