// Look-ups in the programme data by id. Nothing here knows an exercise by name.
import type { Dose, Program, SessionKind, SessionTemplate, Step, Track, Week } from './types.ts';

export function trackIdOf(stepId: string): string {
  const dot = stepId.indexOf('.');
  return dot < 0 ? stepId : stepId.slice(0, dot);
}

interface Index {
  tracks: Map<string, Track>;
  steps: Map<string, { step: Step; index: number }>;
}

const indexes = new WeakMap<Program, Index>();

function indexOf(program: Program): Index {
  let index = indexes.get(program);
  if (!index) {
    index = { tracks: new Map(), steps: new Map() };
    for (const track of program.tracks) {
      index.tracks.set(track.id, track);
      track.steps.forEach((step, i) => index?.steps.set(step.id, { step, index: i }));
    }
    indexes.set(program, index);
  }
  return index;
}

export function findTrack(program: Program, trackId: string): Track | undefined {
  return indexOf(program).tracks.get(trackId);
}

export function getTrack(program: Program, trackId: string): Track {
  const track = findTrack(program, trackId);
  if (!track) throw new Error(`Unknown track ${trackId}`);
  return track;
}

export function findStep(program: Program, stepId: string): Step | undefined {
  return indexOf(program).steps.get(stepId)?.step;
}

export function getStep(program: Program, stepId: string): Step {
  const step = findStep(program, stepId);
  if (!step) throw new Error(`Unknown step ${stepId}`);
  return step;
}

export function stepIndex(program: Program, stepId: string): number {
  return indexOf(program).steps.get(stepId)?.index ?? -1;
}

export function nextStep(program: Program, stepId: string): Step | undefined {
  const track = getTrack(program, trackIdOf(stepId));
  return track.steps[stepIndex(program, stepId) + 1];
}

export function previousStep(program: Program, stepId: string): Step | undefined {
  const index = stepIndex(program, stepId);
  return index > 0 ? getTrack(program, trackIdOf(stepId)).steps[index - 1] : undefined;
}

/** True when step `a` is at or above step `b` on the same ladder. */
export function atLeast(program: Program, a: string, b: string): boolean {
  return trackIdOf(a) === trackIdOf(b) && stepIndex(program, a) >= stepIndex(program, b);
}

export function getSession(program: Program, kind: SessionKind): SessionTemplate {
  const session = program.sessions.find((s) => s.id === kind);
  if (!session) throw new Error(`Unknown session ${kind}`);
  return session;
}

export function getWeek(program: Program, pw: number): Week {
  const week = program.weeks.find((w) => w.pw === pw);
  if (!week) throw new Error(`Unknown programme week ${pw}`);
  return week;
}

export type WorkUnit = 'reps' | 'sec';

/** The working range of a step whose sets are counted in reps or seconds. */
export function workRange(dose: Dose): { min: number; max: number; unit: WorkUnit } | null {
  switch (dose.kind) {
    case 'reps':
    case 'power':
      return { min: dose.reps[0], max: dose.reps[1], unit: 'reps' };
    case 'hold':
      return { min: dose.seconds[0], max: dose.seconds[1], unit: 'sec' };
    case 'fixed':
      return { min: dose.reps, max: dose.reps, unit: 'reps' };
    default:
      return null;
  }
}

/** The working number a step starts on (its minimum), or 0 for steps without one. */
export function minTarget(program: Program, stepId: string): number {
  return workRange(getStep(program, stepId).dose)?.min ?? 0;
}

export function perSide(dose: Dose): boolean {
  return 'per' in dose && dose.per !== undefined;
}

/** How a step progresses: by the track's rule, refined by the step's dose (W3 and W5 are rounds). */
export type Rule = 'double' | 'hold' | 'power' | 'emom' | 'rounds' | 'neck' | 'load' | 'manual';

export function ruleOf(track: Track, step: Step): Rule {
  if (track.progression === 'load' || track.progression === 'manual') return track.progression;
  if (track.progression === 'neck' || track.progression === 'emom') return track.progression;
  if (track.progression === 'power') return 'power';
  if (step.dose.kind === 'rounds') return 'rounds';
  if (step.dose.kind === 'hold') return 'hold';
  return 'double';
}

export function hasTag(item: { tags?: string[] }, tag: string): boolean {
  return item.tags?.includes(tag) ?? false;
}

/** The session kind whose default weekday matches (2 → A, 4 → motor, 5 → B). */
export function kindForWeekday(program: Program, day: number): SessionKind | undefined {
  return program.sessions.find((s) => s.defaultWeekday === day)?.id;
}
