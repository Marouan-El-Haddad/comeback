// What the guided session shows around the exercise in hand (docs/SPEC.md 3.2, DECISIONS.md D44 and
// D50–D53): the parts of the session (»Del 3 af 7«), where each exercise's intro card stands, what
// »Næste« says about an exercise, and the parts of the clock that the timers run and the figure in
// »Nu« follows. Pure functions on the session's steps and the programme, so the tests run them.
import { formatDose } from '../../engine/format.ts';
import { getStep, getTrack } from '../../engine/lookup.ts';
import type { BlockPlan } from '../../engine/plan.ts';
import { PROGRAM } from '../../engine/program.ts';
import type { Program, Side } from '../../engine/types.ts';
import { MEASURES } from '../../content/types.ts';
import type { ClockPart } from '../../figure/sync.ts';
import { setCount, type ExerciseStep, type Step } from './steps.ts';
import type { Phase } from './timers.tsx';

// ---------------------------------------------------------------------------------------------
// The parts of the session: »Del 3 af 7«
// ---------------------------------------------------------------------------------------------

/** A part of the session: the wall test, the warm-up, power, a pair, the finisher, the neck. */
export interface Section {
  label: string;
  /** The first and last step of the part in the session's steps; -1 for the parts before them. */
  from: number;
  to: number;
  /** Where the part is before the session's steps: the wall test or the warm-up. */
  pre?: 'wallTest' | 'warmup';
}

/**
 * The parts of a session in order: the wall test and the warm-up before its steps, then each group
 * of steps that follow each other (a pause and a question belong to the part they stand in).
 */
export function sessionSections(
  steps: readonly Step[],
  before: { wallTest: boolean; warmup: boolean },
): Section[] {
  const parts: Section[] = [];
  if (before.wallTest) parts.push({ label: 'Måling', from: -1, to: -1, pre: 'wallTest' });
  if (before.warmup) parts.push({ label: 'Opvarmning', from: -1, to: -1, pre: 'warmup' });
  steps.forEach((step, i) => {
    if (step.type === 'finish' || step.type === 'walk' || step.group === '') return;
    const last = parts.at(-1);
    if (last && last.pre === undefined && last.label === step.group) last.to = i;
    else parts.push({ label: step.group, from: i, to: i });
  });
  return parts;
}

/** The part (1-based) a place in the session is in; 0 when it is in none (the summary). */
export function sectionOf(
  parts: readonly Section[],
  where: 'wallTest' | 'warmup' | 'run',
  stepIndex: number,
): number {
  if (where !== 'run') return parts.findIndex((p) => p.pre === where) + 1;
  return (
    parts.findIndex((p) => p.pre === undefined && p.from <= stepIndex && stepIndex <= p.to) + 1
  );
}

// ---------------------------------------------------------------------------------------------
// The exercise of a step
// ---------------------------------------------------------------------------------------------

/** The id of the card an exercise step opens: a measurement's own card, the EMOM's step (D45). */
export function stepCardId(step: ExerciseStep): string {
  switch (step.type) {
    case 'set':
      return step.measure && step.block.measureId
        ? `${MEASURES}.${step.block.measureId}`
        : step.block.stepId;
    case 'emom':
      return step.block.emom?.stepId ?? step.block.stepId;
    case 'measure':
      return `${MEASURES}.${step.block.measureId ?? ''}`;
    default:
      return step.block.stepId;
  }
}

/** The pictogram of a step's exercise until it has its figure (a measurement set: the step's). */
export function stepPictoId(step: ExerciseStep): string | null {
  if (step.type === 'measure') return null;
  if (step.type === 'emom') return step.block.emom?.stepId ?? step.block.stepId;
  return step.block.stepId || null;
}

const QUESTIONS = new Set<Step['type']>(['power-q', 'emom-q', 'club-q', 'rounds-q', 'neck-q']);
const EXERCISES = new Set<Step['type']>(['set', 'round', 'emom', 'club', 'neck', 'measure']);

/** An exercise's intro card: the step it shows on, and whether it has its own 10-second clock. */
export interface IntroHost {
  cardId: string;
  /** The exercise's first step. */
  target: number;
  /** No pause before the exercise: the card counts down »Gør klar« for 10 sek by itself. */
  own: boolean;
}

/**
 * Where the intro cards stand (DECISIONS.md D44), keyed by the step they show on: the first time an
 * exercise comes in the session, in the pause before its first set (questions in between are
 * passed over); with no pause before it, on the exercise's own step with its own countdown. The
 * EMOM shows its intro on its own screen until »Start EMOM«, so it has none here.
 */
export function introHosts(steps: readonly Step[]): Map<number, IntroHost> {
  const hosts = new Map<number, IntroHost>();
  const seen = new Set<string>();
  steps.forEach((step, i) => {
    if (!EXERCISES.has(step.type)) return;
    const cardId = stepCardId(step as ExerciseStep);
    if (seen.has(cardId)) return;
    seen.add(cardId);
    if (step.type === 'emom') return;
    let j = i - 1;
    while (j >= 0 && QUESTIONS.has((steps[j] as Step).type)) j--;
    if (j >= 0 && steps[j]?.type === 'rest') hosts.set(j, { cardId, target: i, own: false });
    else hosts.set(i, { cardId, target: i, own: true });
  });
  return hosts;
}

// ---------------------------------------------------------------------------------------------
// »Næste«
// ---------------------------------------------------------------------------------------------

export interface Upcoming {
  /** The card of the exercise (»Sådan gør du«, the figure); null for the summary. */
  cardId: string | null;
  /** Its pictogram until it has a figure. */
  pictoId: string | null;
  /** »Træk · Rygsæk-row med én arm«. */
  title: string;
  /** »Sæt 1 af 3 · Venstre side · mål 8 reps«. */
  line: string;
}

export function unitWord(block: BlockPlan): string {
  return block.unit === 'sec' ? 'sek' : 'reps';
}

export function sideWord(side: Side | undefined, block: BlockPlan): string {
  if (!side) return '';
  if (block.per === 'ben') return side === 'L' ? 'Venstre ben' : 'Højre ben';
  return side === 'L' ? 'Venstre side' : 'Højre side';
}

/** »Pres · Push-up med tempo«; a step named as its track gets its key: »Nakke · trin N1«. */
export function exerciseTitle(program: Program, trackId: string, stepId: string): string {
  const track = getTrack(program, trackId);
  const step = getStep(program, stepId);
  return step.name === track.short
    ? `${track.short} · trin ${step.key}`
    : `${track.short} · ${step.name}`;
}

/** What »Næste« says about an exercise step (docs/SPEC.md 3.2, DECISIONS.md D47). */
export function upcomingOf(step: ExerciseStep, program: Program = PROGRAM): Upcoming {
  const block = step.block;
  const cardId = stepCardId(step);
  const pictoId = stepPictoId(step);
  switch (step.type) {
    case 'set':
      return {
        cardId,
        pictoId,
        title: exerciseTitle(program, block.trackId, block.stepId),
        line:
          `Sæt ${step.setIndex} af ${setCount(block)}` +
          (step.side ? ` · ${sideWord(step.side, block)}` : '') +
          (step.measure ? ' · måling: max' : ` · mål ${block.target} ${unitWord(block)}`),
      };
    case 'round':
      return {
        cardId,
        pictoId,
        title: exerciseTitle(program, block.trackId, block.stepId),
        line: `Runde ${step.round} af ${block.rounds ?? 1}`,
      };
    case 'emom': {
      const emom = block.emom;
      return {
        cardId,
        pictoId,
        title: exerciseTitle(program, block.trackId, emom?.stepId ?? block.stepId),
        line: emom ? `${emom.minutes} min · ${emom.reps} i starten af hvert minut` : '',
      };
    }
    case 'club':
      return {
        cardId,
        pictoId,
        title: exerciseTitle(program, block.trackId, block.stepId),
        line: `Sæt ${step.set} af ${block.sets}`,
      };
    case 'neck':
      return {
        cardId,
        pictoId,
        title: exerciseTitle(program, block.trackId, block.stepId),
        line: formatDose(getStep(program, block.stepId).dose),
      };
    case 'measure': {
      const measure = program.measures.find((m) => m.id === block.measureId);
      return { cardId, pictoId, title: `Måling · ${measure?.name ?? ''}`, line: '' };
    }
  }
}

/** After the last exercise: the summary. */
export const SUMMARY_NEXT: Upcoming = {
  cardId: null,
  pictoId: null,
  title: 'Opsummering',
  line: 'Det, der ændres til næste gang',
};

// ---------------------------------------------------------------------------------------------
// The clock: the timers' phases and the parts the figure follows
// ---------------------------------------------------------------------------------------------

/** »Klar« before a hold, the EMOM, a round and the neck (docs/SPEC.md 3.2). */
export const READY_SECONDS = 5;

const READY: ClockPart = { kind: 'ready', seconds: READY_SECONDS };

/** A hold: »Klar« for 5 sek, then the hold. */
export function holdClock(seconds: number): ClockPart[] {
  return [READY, { kind: 'work', seconds }];
}

export interface StepClock {
  /** The timer's phases, one per clock part. */
  phases: Phase[];
  parts: ClockPart[];
}

/** The EMOM: »Klar«, then a minute per minute with its burpees at the start. */
export function emomClock(block: BlockPlan): StepClock {
  const emom = block.emom;
  const minutes = emom?.minutes ?? 0;
  const phases: Phase[] = [
    { label: 'Klar', seconds: READY_SECONDS },
    ...Array.from({ length: minutes }, (_, i) => ({
      label: `Minut ${i + 1} af ${minutes}`,
      detail: `${emom?.reps ?? 0} burpees, resten af minuttet er pause`,
      seconds: 60,
      sound: 'minut' as const,
    })),
  ];
  return {
    phases,
    parts: phases.map((p, i) => ({ kind: i === 0 ? 'ready' : 'work', seconds: p.seconds })),
  };
}

/** The club sequence: »Klar«, then the round's timed parts from the data, once per round. */
export function clubClock(block: BlockPlan, program: Program = PROGRAM): StepClock {
  const rounds = block.rounds ?? 1;
  const parts = getStep(program, block.stepId).round ?? [];
  const phases: Phase[] = [{ label: 'Klar', seconds: READY_SECONDS }];
  for (let r = 1; r <= rounds; r++) {
    for (const p of parts) {
      phases.push({ label: rounds > 1 ? `Runde ${r}: ${p.label}` : p.label, seconds: p.seconds });
    }
  }
  return {
    phases,
    parts: phases.map((p, i) => ({ kind: i === 0 ? 'ready' : 'work', seconds: p.seconds })),
  };
}

/** A round of wall sit W3/W5: »Klar«, then the round's timed parts (P49). */
export function roundClock(block: BlockPlan, program: Program = PROGRAM): StepClock {
  const step = getStep(program, block.stepId);
  const phases: Phase[] = [
    { label: 'Klar', seconds: READY_SECONDS },
    ...(step.round ?? []).map((p) => ({ label: p.label, seconds: p.seconds })),
  ];
  return {
    phases,
    parts: phases.map((p, i) => ({ kind: i === 0 ? 'ready' : 'work', seconds: p.seconds })),
  };
}

/** The neck between its holds rests 10 sek (P49). */
const NECK_PAUSE = 10;

/**
 * The neck: »Klar«, then each set's holds (one per direction) with a 10-second pause between them.
 * `direction(index)` is the direction (0-based) a part shows: a pause shows the hold after it.
 */
export function neckClock(block: BlockPlan): StepClock & { direction: (index: number) => number } {
  const directions = block.per === 'retning' ? 4 : 1;
  const holds = block.unit === 'sec';
  const phases: Phase[] = [{ label: 'Klar', seconds: READY_SECONDS }];
  const parts: ClockPart[] = [READY];
  const of: number[] = [0];
  for (let s = 1; s <= block.sets; s++) {
    for (let d = 1; d <= directions; d++) {
      const where = directions > 1 ? ` · retning ${d} af ${directions}` : '';
      phases.push(
        holds
          ? {
              label: `Sæt ${s}${where}`,
              detail: `Hold ${block.target} sek.`,
              seconds: block.target,
            }
          : { label: `Sæt ${s}${where}`, detail: `${block.target} langsomme reps.`, seconds: 0 },
      );
      parts.push({ kind: 'work', seconds: holds ? block.target : 0 });
      of.push(d - 1);
      phases.push({ label: 'Pause', seconds: NECK_PAUSE });
      parts.push({ kind: 'rest', seconds: NECK_PAUSE });
      of.push(d % directions);
    }
  }
  phases.pop();
  parts.pop();
  of.pop();
  return { phases, parts, direction: (index) => of[index] ?? 0 };
}
