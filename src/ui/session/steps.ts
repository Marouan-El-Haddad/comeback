// The guided session as a list of steps (docs/SPEC.md 3.2): pairs and tri-sets alternate set by
// set (A1, pause, B1, pause, A2 …), per-side sets run left then right, then the finisher and neck.
import type { BlockPlan, SessionPlan } from '../../engine/plan.ts';
import type { Side } from '../../engine/types.ts';

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
    }
  | { type: 'rest'; seconds: number; group: string; blockId: string }
  | { type: 'measure'; block: BlockPlan; group: string }
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

function sides(block: BlockPlan): Array<Side | undefined> {
  return block.per === 'side' || block.per === 'ben' ? ['L', 'R'] : [undefined];
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
    // A pair, a tri-set or a single block (power): alternate the blocks set by set.
    const group: BlockPlan[] = [block];
    while (block.group && blocks[i + group.length]?.group === block.group) {
      group.push(blocks[i + group.length] as BlockPlan);
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
          for (const side of measure ? [undefined] : sides(b)) {
            sequence.push({ type: 'set', block: b, setIndex: s, side, measure, group: label });
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
    i += group.length;
  }
  // No rest straight before the finish.
  while (steps[steps.length - 1]?.type === 'rest') steps.pop();
  steps.push({ type: 'finish', group: '' });
  return steps;
}
