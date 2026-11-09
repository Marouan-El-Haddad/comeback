// The guided session as a list of steps (docs/SPEC.md 3.2): pairs and tri-sets alternate set by
// set (A1, pause, B1, pause, A2 …), per-side sets run left then right, then the finisher and neck.
// A set done alternately left and right (skater-hop, split jumps) is one step, and its one »Som
// planlagt« logs both sides, so the engine gets the left and right sets it counts (P54, D54).
import { getStep } from '../../engine/lookup.ts';
import type { BlockPlan, SessionPlan } from '../../engine/plan.ts';
import { PROGRAM } from '../../engine/program.ts';
import { logSet, type Ctx } from '../../engine/session.ts';
import type { AppEvent, ISODate, Pain, Rir, SessionSummary, Side } from '../../engine/types.ts';
import { alternates } from './sides.ts';

export type Step =
  | {
      type: 'set';
      block: BlockPlan;
      /** 1-based, counting a measurement set as set 1. */
      setIndex: number;
      side?: Side;
      /** This set is the block's measurement (max test, rir 0). */
      measure: boolean;
      group: string;
      /** Both sides in one set, alternately (P54): no side of its own, both logged. */
      alternate?: boolean;
    }
  | { type: 'rest'; seconds: number; group: string; blockId: string }
  | {
      type: 'measure';
      block: BlockPlan;
      group: string;
      /** A standalone measurement the plan places inside a pair, taken before the pair (D57). */
      hoisted?: boolean;
    }
  | { type: 'power-q'; block: BlockPlan; group: string }
  | { type: 'emom'; block: BlockPlan; group: string }
  | { type: 'emom-q'; block: BlockPlan; group: string }
  | { type: 'club'; block: BlockPlan; set: number; group: string }
  | { type: 'club-q'; block: BlockPlan; group: string }
  /** One round of a rounds step in a pair (wall sit W3, W5). */
  | { type: 'round'; block: BlockPlan; round: number; group: string }
  | { type: 'rounds-q'; block: BlockPlan; group: string }
  | { type: 'neck'; block: BlockPlan; group: string }
  | { type: 'neck-q'; block: BlockPlan; group: string }
  | { type: 'motor'; group: string }
  | { type: 'distance'; group: string }
  | { type: 'walk'; group: string }
  | { type: 'finish'; group: string };

const GROUP_LABEL: Record<string, string> = {
  pair1: 'Par 1',
  pair2: 'Par 2',
  pair3: 'Par 3',
  triset: 'Tri-sæt',
};

export function groupLabel(block: BlockPlan): string {
  if (block.role === 'power') return 'Power';
  if (block.role === 'neck') return 'Nakke';
  if (block.role === 'measure') return 'Måling';
  if (block.role === 'finisher') return block.unit === 'rounds' ? 'Klubsekvensen' : 'Burpees';
  return GROUP_LABEL[block.group ?? ''] ?? '';
}

/** Total sets in a block including its measurement set. */
export function setCount(block: BlockPlan): number {
  return block.sets + (block.measureId ? 1 : 0);
}

/** A step where you do an exercise: what »Næste« can show. */
export type ExerciseStep = Extract<
  Step,
  { type: 'set' | 'round' | 'emom' | 'club' | 'neck' | 'measure' }
>;

const EXERCISES = new Set<Step['type']>(['set', 'round', 'emom', 'club', 'neck', 'measure']);

function isExercise(step: Step): step is ExerciseStep {
  return EXERCISES.has(step.type);
}

/**
 * »Næste« in the pause and at the questions (docs/SPEC.md 3.2, DECISIONS.md D47): the next exercise
 * of any kind after `from`, skipping pauses and questions and the sets of a block that pain ended.
 */
export function nextExercise(
  steps: readonly Step[],
  from: number,
  ended: ReadonlySet<string>,
): ExerciseStep | undefined {
  for (const step of steps.slice(from + 1)) {
    if (!isExercise(step)) continue;
    if (step.type === 'set' && ended.has(step.block.blockId)) continue;
    return step;
  }
  return undefined;
}

/** The block's step is done alternately left and right in one set (P54). */
export function isAlternating(block: BlockPlan): boolean {
  return block.stepId !== '' && alternates(getStep(PROGRAM, block.stepId));
}

function sides(block: BlockPlan): Array<Side | undefined> {
  if (block.per !== 'side' && block.per !== 'ben') return [undefined];
  return isAlternating(block) ? [undefined] : ['L', 'R'];
}

/** The steps after the traffic light, from the session's resolved plan. */
export function buildSteps(plan: SessionPlan): Step[] {
  const steps: Step[] = [];
  if (plan.light === 'red')
    return [
      { type: 'walk', group: 'Rød dag' },
      { type: 'finish', group: '' },
    ];
  if (plan.kind === 'motor') {
    steps.push({ type: 'motor', group: 'Motor' });
    if (plan.motor?.measureId) steps.push({ type: 'distance', group: 'Motor' });
    steps.push({ type: 'finish', group: '' });
    return steps;
  }
  const blocks = plan.blocks.filter(
    (b) => b.role !== 'warmup' && !(b.role === 'measure' && b.measureId === 'wall_test'),
  );
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i] as BlockPlan;
    const label = groupLabel(block);
    if (block.role === 'measure') {
      steps.push({ type: 'measure', block, group: label });
      i++;
      continue;
    }
    if (block.unit === 'emom') {
      steps.push({ type: 'emom', block, group: label }, { type: 'emom-q', block, group: label });
      i++;
      continue;
    }
    if (block.role === 'finisher' && block.unit === 'rounds') {
      for (let s = 1; s <= block.sets; s++) {
        steps.push({ type: 'club', block, set: s, group: label });
        if (s < block.sets) {
          steps.push({
            type: 'rest',
            seconds: block.restSec,
            group: label,
            blockId: block.blockId,
          });
        }
      }
      steps.push({ type: 'club-q', block, group: label });
      i++;
      continue;
    }
    if (block.role === 'neck') {
      steps.push({ type: 'neck', block, group: label }, { type: 'neck-q', block, group: label });
      i++;
      continue;
    }
    // A pair, a tri-set or a single block (power): alternate the blocks set by set. A standalone
    // measurement the plan places between two blocks of the group (hollow before Mave 2 in Styrke
    // B) is taken before the group, so the pair stays one part that alternates, and the measurement
    // still comes before the block it must precede (ENGINE 5.6, D57).
    const group: BlockPlan[] = [block];
    let end = i + 1;
    while (block.group) {
      const next = blocks[end];
      if (next?.group === block.group) {
        group.push(next);
        end++;
      } else if (next?.role === 'measure' && blocks[end + 1]?.group === block.group) {
        steps.push({ type: 'measure', block: next, group: groupLabel(next), hoisted: true });
        end++;
      } else break;
    }
    const rounds = Math.max(...group.map(setCount));
    const sequence: Step[] = [];
    for (let s = 1; s <= rounds; s++) {
      for (const b of group) {
        if (s > setCount(b)) continue;
        const measure = b.measureId !== undefined && s === 1;
        if (b.unit === 'rounds' && !measure) {
          sequence.push({
            type: 'round',
            block: b,
            round: s - (b.measureId ? 1 : 0),
            group: label,
          });
        } else {
          const alternate = !measure && isAlternating(b);
          for (const side of measure ? [undefined] : sides(b)) {
            sequence.push({
              type: 'set',
              block: b,
              setIndex: s,
              side,
              measure,
              group: label,
              ...(alternate ? { alternate } : {}),
            });
          }
        }
        sequence.push({ type: 'rest', seconds: b.restSec, group: label, blockId: b.blockId });
      }
    }
    steps.push(...sequence);
    if (block.role === 'power') steps.push({ type: 'power-q', block, group: label });
    for (const b of group) {
      if (b.unit === 'rounds' && (b.rounds ?? 0) > 0)
        steps.push({ type: 'rounds-q', block: b, group: label });
    }
    i = end;
  }
  // No rest straight before the finish.
  while (steps[steps.length - 1]?.type === 'rest') steps.pop();
  steps.push({ type: 'finish', group: '' });
  return steps;
}

// ---------------------------------------------------------------------------------------------
// Logging a set
// ---------------------------------------------------------------------------------------------

export interface SetLog {
  sessionId: string;
  date: ISODate;
  step: Extract<Step, { type: 'set' }>;
  /** Without value, reserve and pain: »Som planlagt«. */
  value?: number;
  rir?: Rir;
  pain?: Pain;
  measureId?: string;
}

/**
 * The set_logged events of a set: its own side, or – for a set done alternately – the left and the
 * right side with the same numbers, as the per-side sets the engine counts (P54, D54). The events
 * and their fields are the same as for two sets taken side by side. A side already in the log (the
 * previous version logged a side per tap) is not logged again (D57).
 */
export function setEvents(
  ctx: Ctx,
  input: SetLog,
  logged: ReadonlyArray<Side | undefined> = [],
): AppEvent[] {
  const { step } = input;
  const sides: Array<Side | undefined> = step.alternate
    ? (['L', 'R'] as const).filter((side) => !logged.includes(side))
    : [step.side];
  return sides.map((side) =>
    logSet(ctx, {
      sessionId: input.sessionId,
      date: input.date,
      block: step.block,
      setIndex: step.setIndex,
      side,
      value: input.value,
      rir: input.rir,
      pain: input.pain,
      measureId: input.measureId,
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// Resuming a saved session
// ---------------------------------------------------------------------------------------------

function ownKey(step: Step): string {
  switch (step.type) {
    case 'set':
      return `set:${step.block.blockId}:${step.setIndex}:${step.side ?? ''}`;
    case 'round':
      return `round:${step.block.blockId}:${step.round}`;
    case 'club':
      return `club:${step.block.blockId}:${step.set}`;
    case 'rest':
      return `rest:${step.blockId}`;
    case 'motor':
    case 'distance':
    case 'walk':
    case 'finish':
      return step.type;
    default:
      return `${step.type}:${step.block.blockId}`;
  }
}

/**
 * What a step is, kept with the saved session (`comeback.run`) beside its index, so a session saved
 * by one version resumes at the same step in the next even if the list of steps changed: a set by
 * its block, set and side, a pause by the step before it.
 */
export function stepKey(steps: readonly Step[], index: number): string | undefined {
  const step = steps[index];
  if (!step) return undefined;
  if (step.type !== 'rest') return ownKey(step);
  const before = steps[index - 1];
  return `${ownKey(step)}<${before ? ownKey(before) : ''}`;
}

/**
 * Where a saved session goes on (D54): the saved step when its key still fits, the step with that
 * key when the list moved, and -1 – the first step not logged, found from the log – when the step
 * is gone. A session saved by the version before the keys has the same steps, except that a set done
 * alternately was two (P54); such a session is resumed from the log too, so nothing is lost.
 */
export function resumeIndex(
  steps: readonly Step[],
  saved: { stepIndex: number; stepKey?: string },
): number {
  if (saved.stepIndex < 0) return -1;
  if (saved.stepKey === undefined) {
    // What the version before the keys built differently: a set done alternately (two steps then)
    // and a measurement inside a pair (taken between its blocks then, D57).
    const changed = steps.some(
      (s) => (s.type === 'set' && s.alternate) || (s.type === 'measure' && s.hoisted),
    );
    return changed || saved.stepIndex >= steps.length ? -1 : saved.stepIndex;
  }
  if (stepKey(steps, saved.stepIndex) === saved.stepKey) return saved.stepIndex;
  return steps.findIndex((_, i) => stepKey(steps, i) === saved.stepKey);
}

/**
 * The step a session resumed from the log goes on with: the first set, result or measurement
 * not logged. A set done alternately is logged when both its sides are; the sets of a block that
 * sharp pain or »Stop« ended are passed, as the session passes them; a standalone measurement is
 * done when `measured` finds it in the log for the session's day (D57).
 */
export function firstNotLogged(
  steps: readonly Step[],
  session: SessionSummary,
  measured: (measureId: string) => boolean,
): number {
  const ended = new Set(
    session.sets.filter((s) => s.pain === 'sharp' || s.pain === 'stop').map((s) => s.blockId),
  );
  const done = (step: Step): boolean => {
    switch (step.type) {
      case 'set':
        if (ended.has(step.block.blockId)) return true;
        return session.sets.some(
          (s) =>
            s.blockId === step.block.blockId &&
            s.setIndex === step.setIndex &&
            (step.alternate ? s.side === 'R' : s.side === step.side),
        );
      case 'power-q':
      case 'emom-q':
      case 'club-q':
      case 'neck-q':
      case 'rounds-q':
      case 'emom':
      case 'club':
      case 'neck':
      case 'round':
        return session.results.some((r) => r.blockId === step.block.blockId);
      case 'measure':
        return measured(step.block.measureId ?? '');
      default:
        return false;
    }
  };
  const index = steps.findIndex((step) => step.type !== 'rest' && !done(step));
  return index < 0 ? steps.length - 1 : index;
}
