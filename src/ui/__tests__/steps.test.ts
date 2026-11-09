// »Næste« in the pause and at the questions (docs/SPEC.md 3.2, DECISIONS.md D47): the next exercise
// of any kind – a set, a round, the EMOM, the club sequence, the neck or a measurement – skipping
// questions and pauses and the sets of a block ended by pain. Exercises done alternately left and
// right are one set with one »Som planlagt« that logs both sides (DECISIONS.md P54, D54), and a
// session saved by an earlier version resumes without an error or a lost set (D54).
import { describe, expect, test } from 'vitest';
import { Log } from '../../engine/__tests__/helpers/log.ts';
import {
  finishSession,
  logBlockResult,
  PROGRAM,
  resolvePlan,
  startSession,
} from '../../engine/index.ts';
import type { BlockPlan } from '../../engine/plan.ts';
import { alternates } from '../session/sides.ts';
import {
  buildSteps,
  nextExercise,
  resumeIndex,
  setEvents,
  stepKey,
  type Step,
} from '../session/steps.ts';

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

// Styrke A on Tuesday of programme week 2 with skater-hop (power legs step 3), green.
const TUESDAY = '2026-11-17';

/** A session started the way the app starts it, and its steps. */
function skaterSession(steps: Record<string, string> = { power_legs: 'power_legs.3' }): {
  log: Log;
  sessionId: string;
  steps: Step[];
} {
  const log = new Log().onboard({ completedWeeks: ['2026-11-09'], steps });
  log.catchUp(TUESDAY);
  const sessionId = 's-skater';
  log.add(
    startSession(log.ctx, log.events, {
      sessionId,
      date: TUESDAY,
      kind: 'A',
      answers: [true, true, true],
    }),
  );
  const plan = resolvePlan(PROGRAM, log.state(TUESDAY), {
    date: TUESDAY,
    kind: 'A',
    light: 'green',
  });
  return { log, sessionId, steps: buildSteps(plan) };
}

type SetStep = Extract<Step, { type: 'set' }>;
const isSet = (s: Step): s is SetStep => s.type === 'set';

describe('skiftevise øvelser (P54)', () => {
  test('skater-hop og split jumps laves skiftevis; alle andre øvelser pr. side tages side for side', () => {
    const alternating = PROGRAM.tracks
      .flatMap((t) => t.steps)
      .filter(alternates)
      .map((s) => s.id);
    expect(alternating).toEqual(['power_legs.3', 'power_legs.4']);
  });

  test('et skiftevist sæt er ét skridt i passet; rygsæk-row tages stadig venstre og så højre', () => {
    const { steps } = skaterSession();
    const sets = steps.filter(isSet);
    const power = sets.filter((s) => s.block.trackId === 'power_legs');
    expect(power.map((s) => [s.setIndex, s.side, s.alternate])).toEqual([
      [1, undefined, true],
      [2, undefined, true],
      [3, undefined, true],
    ]);
    // A pause after each set, none between the sides.
    const first = steps.indexOf(power[0] as Step);
    expect(steps[first + 1]?.type).toBe('rest');
    const row = sets.filter((s) => s.block.trackId === 'pull');
    expect(row.slice(0, 2).map((s) => [s.setIndex, s.side, s.alternate ?? false])).toEqual([
      [1, 'L', false],
      [1, 'R', false],
    ]);
  });

  test('etbens bounds (pr. ben, tre spring i træk på samme ben) tages side for side', () => {
    const { steps } = skaterSession({ power_legs: 'power_legs.6' });
    const power = steps.filter(isSet).filter((s) => s.block.trackId === 'power_legs');
    expect(power.slice(0, 2).map((s) => [s.setIndex, s.side])).toEqual([
      [1, 'L'],
      [1, 'R'],
    ]);
  });

  test('ét tryk på »Som planlagt« logger begge sider med samme tal', () => {
    const { log, sessionId, steps } = skaterSession();
    const step = steps.filter(isSet)[0] as SetStep;
    const events = setEvents(log.ctx, { sessionId, date: TUESDAY, step });
    expect(
      events.map((e) => (e.type === 'set_logged' ? [e.side, e.setIndex, e.reps, e.asPlanned] : [])),
    ).toEqual([
      ['L', 1, step.block.target, true],
      ['R', 1, step.block.target, true],
    ]);
    // A correction and pain go to both sides, as the set was one.
    const changed = setEvents(log.ctx, { sessionId, date: TUESDAY, step, value: 2, pain: 'light' });
    expect(
      changed.map((e) => (e.type === 'set_logged' ? [e.side, e.reps, e.pain, e.asPlanned] : [])),
    ).toEqual([
      ['L', 2, 'light', false],
      ['R', 2, 'light', false],
    ]);
    // A set taken side by side logs its own side only.
    const row = steps.filter(isSet).find((s) => s.block.trackId === 'pull' && s.side === 'R');
    expect(
      setEvents(log.ctx, { sessionId, date: TUESDAY, step: row as SetStep }).map((e) =>
        e.type === 'set_logged' ? e.side : null,
      ),
    ).toEqual(['R']);
  });

  test('motoren får venstre og højre som før: alle sæt på målet og ens hop giver +1 rep', () => {
    const { log, sessionId, steps } = skaterSession();
    const power = steps.filter(isSet).filter((s) => s.block.trackId === 'power_legs');
    for (const step of power) log.add(setEvents(log.ctx, { sessionId, date: TUESDAY, step }));
    const block = (power[0] as SetStep).block;
    log.add([
      logBlockResult(log.ctx, { sessionId, date: TUESDAY, block, result: { quality: true } }),
    ]);
    log.add(finishSession(log.ctx, log.events, { sessionId }));
    const session = log.state(TUESDAY).sessions.find((s) => s.sessionId === sessionId);
    const evaluation = session?.evaluations[block.blockId];
    expect(session?.sets.filter((s) => s.blockId === block.blockId)).toHaveLength(6);
    expect(evaluation?.qualifying).toBe(true);
    expect(evaluation?.targetAfter).toBe(block.target + 1);
  });
});

describe('et gemt pas genoptages samme sted (D54)', () => {
  const { steps } = skaterSession({});
  const { steps: skater } = skaterSession();

  test('hvert skridt har sin egen nøgle, også pauserne', () => {
    const keys = steps.map((_, i) => stepKey(steps, i));
    expect(new Set(keys).size).toBe(steps.length);
    expect(stepKey(steps, steps.length)).toBeUndefined();
  });

  test('samme skridt, også når listen har flyttet sig; ukendt skridt: fra loggen', () => {
    const at = steps.findIndex(isSet) + 1;
    const key = stepKey(steps, at);
    expect(resumeIndex(steps, { stepIndex: at, stepKey: key })).toBe(at);
    expect(resumeIndex(steps, { stepIndex: at + 3, stepKey: key })).toBe(at);
    expect(resumeIndex(steps, { stepIndex: at, stepKey: 'set:A.pair9.x:1:' })).toBe(-1);
    expect(resumeIndex(steps, { stepIndex: -1, stepKey: key })).toBe(-1);
  });

  test('gemt af den forrige version (uden nøgle): samme skridt, medmindre et sæt er skiftevist', () => {
    expect(resumeIndex(steps, { stepIndex: 7 })).toBe(7);
    expect(resumeIndex(steps, { stepIndex: steps.length + 2 })).toBe(-1);
    // The earlier version had two steps per alternating set: the log decides where it was.
    expect(resumeIndex(skater, { stepIndex: 7 })).toBe(-1);
  });
});
