// »Næste« in the pause and at the questions (docs/SPEC.md 3.2, DECISIONS.md D47): the next exercise
// of any kind – a set, a round, the EMOM, the club sequence, the neck or a measurement – skipping
// questions and pauses and the sets of a block ended by pain.
import { describe, expect, test } from 'vitest';
import type { BlockPlan } from '../../engine/plan.ts';
import { nextExercise, type Step } from '../session/steps.ts';

function block(blockId: string, extra: Partial<BlockPlan> = {}): BlockPlan {
  return {
    blockId,
    trackId: 'press',
    role: 'pair',
    stepId: 'press.1',
    sets: 2,
    target: 6,
    unit: 'reps',
    rirPlan: 2,
    restSec: 60,
    inYellow: true,
    ...extra,
  };
}

const press = block('A.pair1.press');
const pull = block('A.pair1.pull', { trackId: 'pull', stepId: 'pull.1' });
const emom = block('A.finisher', {
  trackId: 'burpee_emom',
  role: 'finisher',
  stepId: 'burpee_emom.E1',
  unit: 'emom',
  emom: { stepId: 'burpee_emom.E1', minutes: 4, reps: 3 },
});
const club = block('B.finisher', {
  trackId: 'club_sequence',
  role: 'finisher',
  stepId: 'club_sequence.C1',
  unit: 'rounds',
});
const neck = block('A.neck', { trackId: 'neck', role: 'neck', stepId: 'neck.N1', unit: 'sec' });
const hollow = block('B.measure.hollow', { role: 'measure', stepId: '', measureId: 'hollow' });

const rest = (b: BlockPlan): Step => ({
  type: 'rest',
  seconds: 60,
  group: 'Par 1',
  blockId: b.blockId,
});

describe('nextExercise', () => {
  test('efter en pause: det næste sæt, også i den anden øvelse i parret', () => {
    const steps: Step[] = [
      { type: 'set', block: press, setIndex: 1, measure: false, group: 'Par 1' },
      rest(press),
      { type: 'set', block: pull, setIndex: 1, measure: false, group: 'Par 1' },
    ];
    expect(nextExercise(steps, 1, new Set())).toBe(steps[2]);
  });

  test('EMOM, klubsekvensen, nakken og en måling er også »Næste«', () => {
    const steps: Step[] = [
      rest(press),
      { type: 'emom', block: emom, group: 'Burpees' },
      { type: 'emom-q', block: emom, group: 'Burpees' },
      { type: 'neck', block: neck, group: 'Nakke' },
      { type: 'neck-q', block: neck, group: 'Nakke' },
      { type: 'measure', block: hollow, group: 'Måling' },
      { type: 'club', block: club, set: 1, group: 'Klubsekvensen' },
      { type: 'finish', group: '' },
    ];
    expect(nextExercise(steps, 0, new Set())).toBe(steps[1]);
    // The question after the EMOM shows the neck, which starts by itself.
    expect(nextExercise(steps, 2, new Set())).toBe(steps[3]);
    expect(nextExercise(steps, 4, new Set())).toBe(steps[5]);
    expect(nextExercise(steps, 5, new Set())).toBe(steps[6]);
  });

  test('spørgsmål springes over, og et sæt i en blok, der er stoppet af smerte, vises ikke', () => {
    const steps: Step[] = [
      rest(press),
      { type: 'power-q', block: press, group: 'Power' },
      { type: 'set', block: pull, setIndex: 2, measure: false, group: 'Par 1' },
      rest(pull),
      { type: 'set', block: press, setIndex: 2, measure: false, group: 'Par 1' },
    ];
    expect(nextExercise(steps, 0, new Set())).toBe(steps[2]);
    expect(nextExercise(steps, 0, new Set([pull.blockId]))).toBe(steps[4]);
  });

  test('intet efter den sidste øvelse', () => {
    const steps: Step[] = [
      { type: 'neck', block: neck, group: 'Nakke' },
      { type: 'neck-q', block: neck, group: 'Nakke' },
      { type: 'finish', group: '' },
    ];
    expect(nextExercise(steps, 1, new Set())).toBeUndefined();
  });
});
