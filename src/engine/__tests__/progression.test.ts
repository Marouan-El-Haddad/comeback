// docs/ENGINE.md 8: double progression, hold, power, EMOM, club sequence, neck, load, W3.
import { describe, expect, test } from 'vitest';
import { finishSession, logHoldSet, planFor, startSession } from '../index.ts';
import { dayOf, explanationOf, Log, mondays, type Steps } from './helpers/log.ts';

const TUE = (k: number) => dayOf(k, 2);
const FRI = (k: number) => dayOf(k, 5);

/** Onboarded so that calendar week k has programme week k + 1 (weeks before are completed). */
function from(k: number, steps: Steps = {}) {
  return new Log().onboard({ completedWeeks: mondays(k), steps });
}

describe('Dobbelt progression', () => {
  test('S-DP-01: target 6 i uge 2, 3 × 6 med 3 i reserve giver target 7 og hits 0', () => {
    const log = from(1, { press: { stepId: 'press.1', target: 6 } });
    log.session({ date: TUE(1), sets: { press: { values: [6, 6, 6], rir: 3 } } });
    const t = log.state(TUE(1)).tracks.press;
    expect(t?.target).toBe(7);
    expect(t?.hits).toBe(0);
  });

  test('S-DP-02: 3 × 12 med 2 i reserve ved max giver hits 1 og samme trin', () => {
    const log = from(2, { press: { stepId: 'press.1', target: 12 } });
    log.session({ date: TUE(2), sets: { press: { values: [12, 12, 12], rir: 2 } } });
    const t = log.state(TUE(2)).tracks.press;
    expect(t?.hits).toBe(1);
    expect(t?.stepId).toBe('press.1');
    expect(t?.target).toBe(12);
  });

  test('S-DP-03: to hits i træk giver press.1 → press.2 med target 6, hits 0 og forklaring', () => {
    const log = from(1, { press: { stepId: 'press.1', target: 12 } });
    log.session({ date: TUE(1), sets: { press: { values: [12, 12, 12], rir: 2 } } });
    expect(log.state(TUE(1)).tracks.press?.hits).toBe(1);
    const { finished } = log.session({
      date: TUE(2),
      sets: { press: { values: [12, 12, 12], rir: 2 } },
    });
    const change = finished.find((e) => e.type === 'step_changed' && e.trackId === 'press');
    expect(change).toMatchObject({
      from: 'press.1',
      to: 'press.2',
      reason: 'progression',
      by: 'engine',
    });
    expect(explanationOf(finished, 'press')).toMatch(/\S/);
    const t = log.state(TUE(2)).tracks.press;
    expect(t).toMatchObject({ stepId: 'press.2', target: 6, hits: 0 });
  });

  test('S-DP-04: 12, 12, 11 efter et hit nulstiller hits og holder target 12', () => {
    const log = from(1, { press: { stepId: 'press.1', target: 12 } });
    log.session({ date: TUE(1), sets: { press: { values: [12, 12, 12], rir: 2 } } });
    log.session({ date: TUE(2), sets: { press: { values: [12, 12, 11], rir: 2 } } });
    expect(log.state(TUE(2)).tracks.press).toMatchObject({
      stepId: 'press.1',
      hits: 0,
      target: 12,
    });
  });

  test('S-DP-05: 12 med kun 1 i reserve er ikke et hit', () => {
    const log = from(1, { press: { stepId: 'press.1', target: 12 } });
    log.session({ date: TUE(1), sets: { press: { values: [12, 12, 12], rir: 2 } } });
    log.session({ date: TUE(2), sets: { press: { values: [12, 12, 12], rir: 1 } } });
    expect(log.state(TUE(2)).tracks.press).toMatchObject({ hits: 0, target: 12 });
  });

  test('S-DP-06: et gult pas er neutralt for hits og target', () => {
    const log = from(1, { press: { stepId: 'press.1', target: 12 } });
    log.session({ date: TUE(1), sets: { press: { values: [12, 12, 12], rir: 2 } } });
    log.session({ date: TUE(2), light: 'yellow', sets: { press: { values: [12, 12], rir: 3 } } });
    expect(log.state(TUE(2)).tracks.press).toMatchObject({
      hits: 1,
      target: 12,
      stepId: 'press.1',
    });
  });

  test('S-DP-07: en let uge (uge 4) er neutral for hits og target', () => {
    const log = from(2, { press: { stepId: 'press.1', target: 12 } });
    log.session({ date: TUE(2), sets: { press: { values: [12, 12, 12], rir: 2 } } });
    expect(log.state(TUE(3)).weeks[3]?.pw).toBe(4);
    log.session({ date: TUE(3), sets: { press: { values: [12, 12], rir: 3, count: 2 } } });
    expect(log.state(TUE(3)).tracks.press).toMatchObject({
      hits: 1,
      target: 12,
      stepId: 'press.1',
    });
  });

  test('S-DP-08: pr. side med 10, 10, 10 og 10, 10, 9 giver intet hit og samme target', () => {
    const log = from(2, { press: { stepId: 'press.3', target: 10 } });
    log.session({
      date: TUE(2),
      sets: { press: { left: [10, 10, 10], right: [10, 10, 9], rir: 2 } },
    });
    expect(log.state(TUE(2)).tracks.press).toMatchObject({
      hits: 0,
      target: 10,
      stepId: 'press.3',
    });
  });

  test('S-DP-09: uge 6 (plan 1 i reserve), 4 × 8 med 1 i reserve giver target 9', () => {
    const log = from(5, { press: { stepId: 'press.1', target: 8 } });
    const { plan } = log.session({
      date: TUE(5),
      sets: { press: { values: [8, 8, 8, 8], rir: 1 } },
    });
    expect(plan.blocks.find((b) => b.trackId === 'press')?.sets).toBe(4);
    expect(log.state(TUE(5)).tracks.press).toMatchObject({ target: 9, hits: 0 });
  });

  test('S-DP-10: boss-trinnet har intet næste trin; hits bliver 2', () => {
    const log = from(1, { press: { stepId: 'press.7', target: 5 } });
    log.session({ date: TUE(1), sets: { press: { values: [5, 5, 5], rir: 2 } } });
    const { finished } = log.session({
      date: TUE(2),
      sets: { press: { values: [5, 5, 5], rir: 2 } },
    });
    expect(finished.some((e) => e.type === 'step_changed' && e.trackId === 'press')).toBe(false);
    expect(log.state(TUE(2)).tracks.press).toMatchObject({ stepId: 'press.7', hits: 2 });
  });

  test('S-DP-11: afbrudt efter par 1 – pres tæller, ben er neutralt, ugen er gennemført', () => {
    const log = from(1, {
      press: { stepId: 'press.1', target: 8 },
      legs: { stepId: 'legs.1', target: 8 },
    });
    const { finished } = log.session({
      date: TUE(1),
      only: ['power_legs', 'press', 'pull'],
      aborted: true,
    });
    expect(finished[0]).toMatchObject({
      type: 'session_completed',
      status: 'green',
      aborted: true,
      done: true,
    });
    const state = log.state(TUE(1));
    expect(state.tracks.press?.target).toBe(9);
    expect(state.tracks.legs?.target).toBe(8);
    const session = state.sessions[0];
    expect(session?.evaluations['A.pair1.press']?.qualifying).toBe(true);
    expect(session?.evaluations['A.pair2.legs']?.qualifying).toBe(false);
    expect(log.state(TUE(2)).weeks[1]?.completed).toBe(true);
  });

  test('S-DP-12: uge 6, max og »Som planlagt« logger 2 i reserve, så det er et hit og press.2 → press.3', () => {
    const log = from(4, { press: { stepId: 'press.2', target: 12 } });
    log.session({ date: TUE(4), sets: { press: { values: [12, 12, 12], rir: 2 } } });
    expect(log.state(TUE(4)).tracks.press?.hits).toBe(1);
    const { finished } = log.session({ date: TUE(5) });
    const sets = log.events.filter(
      (e) => e.type === 'set_logged' && e.trackId === 'press' && e.date === TUE(5),
    );
    expect(sets).toHaveLength(4);
    for (const s of sets) expect(s).toMatchObject({ reps: 12, rir: 2, asPlanned: true });
    expect(finished.find((e) => e.type === 'step_changed' && e.trackId === 'press')).toMatchObject({
      from: 'press.2',
      to: 'press.3',
    });
  });

  test('S-DP-13: uge 6 under max: »Som planlagt« logger 1 i reserve, og target stiger til 10', () => {
    const log = from(5, { press: { stepId: 'press.1', target: 9 } });
    log.session({ date: TUE(5) });
    const sets = log.events.filter((e) => e.type === 'set_logged' && e.trackId === 'press');
    for (const s of sets) expect(s).toMatchObject({ reps: 9, rir: 1, asPlanned: true });
    expect(log.state(TUE(5)).tracks.press?.target).toBe(10);
  });
});

describe('Hold, power, EMOM, klubsekvens, nakke, load og W3', () => {
  test('S-HOLD-01: hollow target 20, 3 × 20 sek giver target 25', () => {
    const log = from(1, { core_front: { stepId: 'core_front.2', target: 20 } });
    log.session({ date: TUE(1) });
    expect(log.state(TUE(1)).tracks.core_front?.target).toBe(25);
  });

  test('S-HOLD-02: 3 × 45 sek ved max to pas i træk giver core_front.2 → core_front.3 med target 15', () => {
    const log = from(1, { core_front: { stepId: 'core_front.2', target: 45 } });
    log.session({ date: TUE(1) });
    expect(log.state(TUE(1)).tracks.core_front?.hits).toBe(1);
    log.session({ date: TUE(2) });
    expect(log.state(TUE(2)).tracks.core_front).toMatchObject({
      stepId: 'core_front.3',
      target: 15,
      hits: 0,
    });
  });

  test('S-HOLD-03: stoppet ved 17 af 20 sek logges 17, ikke som planlagt, og target er uændret', () => {
    const log = from(1, { core_front: { stepId: 'core_front.2', target: 20 } });
    const { plan, sessionId } = log.session({ date: TUE(1), open: true, only: [] });
    const block = plan.blocks.find((b) => b.trackId === 'core_front');
    if (!block) throw new Error('no hollow block');
    const event = logHoldSet(log.ctx, {
      sessionId,
      date: TUE(1),
      block,
      setIndex: 1,
      secondsHeld: 17,
    });
    expect(event).toMatchObject({ type: 'set_logged', seconds: 17, asPlanned: false });
    log.add([event]);
    for (let i = 2; i <= block.sets; i++) {
      log.add([
        logHoldSet(log.ctx, { sessionId, date: TUE(1), block, setIndex: i, secondsHeld: 20 }),
      ]);
    }
    log.add(finishSession(log.ctx, log.events, { sessionId }));
    expect(log.state(TUE(1)).tracks.core_front?.target).toBe(20);
  });

  test('S-POW-01: power_legs.1 target 3 i uge 2, 3 × 3 og kvalitet giver target 4', () => {
    const log = from(1, { power_legs: { stepId: 'power_legs.1', target: 3 } });
    log.session({
      date: TUE(1),
      sets: { power_legs: [3, 3, 3] },
      results: { power_legs: { quality: true } },
    });
    expect(log.state(TUE(1)).tracks.power_legs?.target).toBe(4);
  });

  test('S-POW-02: 3 × 5 med kvalitet to pas i træk giver power_legs.1 → power_legs.2', () => {
    const log = from(1, { power_legs: { stepId: 'power_legs.1', target: 5 } });
    log.session({
      date: TUE(1),
      sets: { power_legs: [5, 5, 5] },
      results: { power_legs: { quality: true } },
    });
    const { finished } = log.session({
      date: TUE(2),
      sets: { power_legs: [5, 5, 5] },
      results: { power_legs: { quality: true } },
    });
    expect(
      finished.find((e) => e.type === 'step_changed' && e.trackId === 'power_legs'),
    ).toMatchObject({
      from: 'power_legs.1',
      to: 'power_legs.2',
    });
  });

  test('S-POW-03: kvalitet nej nulstiller hits og holder target', () => {
    const log = from(1, { power_legs: { stepId: 'power_legs.1', target: 5 } });
    log.session({
      date: TUE(1),
      sets: { power_legs: [5, 5, 5] },
      results: { power_legs: { quality: true } },
    });
    log.session({
      date: TUE(2),
      sets: { power_legs: [5, 5, 5] },
      results: { power_legs: { quality: false } },
    });
    expect(log.state(TUE(2)).tracks.power_legs).toMatchObject({
      hits: 0,
      target: 5,
      stepId: 'power_legs.1',
    });
  });

  test('S-EMOM-01: rent E1 i uge 1 giver pendingUp, men trinnet er stadig E1', () => {
    const log = new Log().onboard();
    log.session({ date: TUE(0), results: { burpee_emom: { clean: true, rest20: true } } });
    const state = log.state(dayOf(0, 6));
    expect(state.emom).toMatchObject({ pendingUp: true, stepId: 'burpee_emom.E1' });
    expect(planFor(log.program, state, dayOf(0, 6)).session).toBeNull();
  });

  test('S-EMOM-02: pendingUp og uge 2 (loft E2): når A startes, er trinnet E2 og lastStepUpWeek (1, 2)', () => {
    const log = new Log().onboard();
    log.session({ date: TUE(0), results: { burpee_emom: { clean: true, rest20: true } } });
    const started = startSession(log.ctx, log.events, {
      sessionId: 'x',
      date: TUE(1),
      kind: 'A',
      answers: [true, true, true],
    });
    expect(started[0]).toMatchObject({
      type: 'step_changed',
      to: 'burpee_emom.E2',
      week: { round: 1, pw: 2 },
    });
    log.add(started);
    const state = log.state(TUE(1));
    expect(state.emom).toMatchObject({
      stepId: 'burpee_emom.E2',
      lastStepUpWeek: { round: 1, pw: 2 },
      pendingUp: false,
    });
    const begun = started.find((e) => e.type === 'session_started');
    expect(
      begun?.type === 'session_started' &&
        begun.blocks.find((b) => b.trackId === 'burpee_emom')?.stepId,
    ).toBe('burpee_emom.E2');
  });

  test('S-EMOM-03: E3 med pendingUp i uge 4 (let): burpee-test, pendingUp bevares; uge 5 giver E4', () => {
    const log = from(2, { burpee_emom: 'burpee_emom.E3' });
    log.session({ date: TUE(2), results: { burpee_emom: { clean: true, rest20: true } } });
    const light = log.session({ date: TUE(3) });
    expect(light.plan.blocks.some((b) => b.unit === 'emom')).toBe(false);
    expect(light.plan.blocks.some((b) => b.measureId === 'burpee_3min')).toBe(true);
    expect(light.started.some((e) => e.type === 'step_changed')).toBe(false);
    expect(log.state(TUE(3)).emom.pendingUp).toBe(true);
    const next = log.session({ date: TUE(4) });
    expect(next.started[0]).toMatchObject({
      type: 'step_changed',
      from: 'burpee_emom.E3',
      to: 'burpee_emom.E4',
    });
  });

  test('S-EMOM-04: A i en gentaget programuge med en tidligere oprykning rykker ikke op igen', () => {
    const log = new Log().onboard();
    log.session({ date: TUE(0), results: { burpee_emom: { clean: true, rest20: true } } });
    const up = log.session({
      date: TUE(1),
      results: { burpee_emom: { clean: true, rest20: true } },
    });
    expect(up.started[0]).toMatchObject({ type: 'step_changed', to: 'burpee_emom.E2' });
    // k2 is missed, so k3 repeats programme week 2 (R-PW).
    expect(log.state(TUE(3)).weeks[3]?.pw).toBe(2);
    expect(log.state(TUE(3)).emom.pendingUp).toBe(true);
    const again = log.session({ date: TUE(3) });
    expect(again.started.some((e) => e.type === 'step_changed')).toBe(false);
    expect(log.state(TUE(3)).emom.stepId).toBe('burpee_emom.E2');
  });

  test('S-EMOM-05: runde 2, uge 5 med E7 ved rundens start: loftet er E7, ikke E4', () => {
    const log = from(12, { burpee_emom: 'burpee_emom.E7' });
    const state = log.state(TUE(12));
    expect(state.round).toBe(2);
    expect(state.weeks[12]?.pw).toBe(5);
    expect(state.emom.stepAtRoundStart).toBe('burpee_emom.E7');
    const plan = planFor(log.program, state, TUE(12));
    expect(plan.session?.blocks.find((b) => b.unit === 'emom')?.emom?.stepId).toBe(
      'burpee_emom.E7',
    );
  });

  test('S-CLUB-01: C2 og to rene B-pas i træk giver C3', () => {
    const log = from(1, { club_sequence: 'club_sequence.C2' });
    log.session({ date: FRI(1), kind: 'B', results: { club_sequence: { clean: true } } });
    const { finished } = log.session({
      date: FRI(2),
      kind: 'B',
      results: { club_sequence: { clean: true } },
    });
    expect(
      finished.find((e) => e.type === 'step_changed' && e.trackId === 'club_sequence'),
    ).toMatchObject({
      to: 'club_sequence.C3',
    });
  });

  test('S-NECK-01: N1 og »let« to gange i grønne pas giver N2; »hårdt« nulstiller hits', () => {
    const log = from(1);
    log.session({ date: TUE(1), results: { neck: { feel: 'easy' } } });
    log.session({ date: FRI(1), kind: 'B', results: { neck: { feel: 'easy' } } });
    expect(log.state(FRI(1)).tracks.neck?.stepId).toBe('neck.N2');
    log.session({ date: TUE(2), results: { neck: { feel: 'easy' } } });
    expect(log.state(TUE(2)).tracks.neck?.hits).toBe(1);
    log.session({ date: FRI(2), kind: 'B', results: { neck: { feel: 'hard' } } });
    expect(log.state(FRI(2)).tracks.neck?.hits).toBe(0);
  });

  test('S-LOAD-01: rygsæk-row 3 × 15 med 2 i reserve to pas i træk giver +2 kg og target 8 på samme trin', () => {
    const log = from(1, { backpack_row: { stepId: 'backpack_row.1', target: 15 } });
    log.session({
      date: FRI(1),
      kind: 'B',
      sets: { backpack_row: { values: [15, 15, 15], rir: 2 } },
    });
    expect(log.state(FRI(1)).tracks.backpack_row).toMatchObject({ hits: 1, load: 0 });
    const { finished } = log.session({
      date: FRI(2),
      kind: 'B',
      sets: { backpack_row: { values: [15, 15, 15], rir: 2 } },
    });
    expect(finished.find((e) => e.type === 'load_changed')).toMatchObject({ from: 0, to: 2 });
    expect(explanationOf(finished, 'backpack_row')).toMatch(/2 kg/);
    expect(log.state(FRI(2)).tracks.backpack_row).toMatchObject({
      load: 2,
      target: 8,
      stepId: 'backpack_row.1',
      hits: 0,
    });
  });

  test('S-W3-01: W3 med 3 runder og to rene pas i træk giver W4', () => {
    const log = from(1, { wallsit: 'wallsit.W3' });
    const first = log.session({ date: FRI(1), kind: 'B', results: { wallsit: { clean: true } } });
    expect(first.plan.blocks.find((b) => b.trackId === 'wallsit')?.rounds).toBe(3);
    const { finished } = log.session({
      date: FRI(2),
      kind: 'B',
      results: { wallsit: { clean: true } },
    });
    expect(
      finished.find((e) => e.type === 'step_changed' && e.trackId === 'wallsit'),
    ).toMatchObject({
      to: 'wallsit.W4',
    });
  });
});
