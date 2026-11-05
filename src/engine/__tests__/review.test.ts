// Scenarios added to docs/ENGINE.md section 8 after the milestone 1 self-review
// (docs/reviews/m1-selfreview.md, F1–F11).
import { describe, expect, test } from 'vitest';
import {
  chooseStep,
  heroStatus,
  legsLevel,
  planFor,
  sideBranchStatus,
  startSession,
} from '../index.ts';
import { dayOf, Log, mondays, type Steps } from './helpers/log.ts';

const TUE = (k: number) => dayOf(k, 2);
const THU = (k: number) => dayOf(k, 4);
const FRI = (k: number) => dayOf(k, 5);

function from(k: number, steps: Steps = {}) {
  return new Log().onboard({ completedWeeks: mondays(k), steps });
}

describe('Selvreview af milepæl 1', () => {
  test('S-HOLD-04: skulder trin 3 har trin 2-dosis før håndstandsholdet; kun holdet progredierer', () => {
    const log = from(1, { shoulder: { stepId: 'shoulder.3', target: 20 } });
    const blocks = planFor(log.program, log.state(FRI(1)), FRI(1)).session?.blocks ?? [];
    const pair1 = blocks.filter((b) => b.group === 'pair1');
    expect(pair1.map((b) => b.stepId)).toEqual(['shoulder.2', 'shoulder.3', 'backpack_row.1']);
    expect(pair1[0]).toMatchObject({ sets: 3, target: 10, unit: 'reps' });
    expect(pair1[1]).toMatchObject({ sets: 3, target: 20, unit: 'sec' });
    log.session({ date: FRI(1), kind: 'B' });
    const state = log.state(FRI(1));
    expect(state.tracks.shoulder).toMatchObject({ stepId: 'shoulder.3', target: 25 });
  });

  test('S-EMOM-06: en EMOM-nedrykning rydder pendingUp, så næste A-pas ikke rykker op', () => {
    // Clean E3 in programme week 3, then the user's own step down to E2.
    const log = from(2, { burpee_emom: 'burpee_emom.E3' });
    log.session({ date: TUE(2), results: { burpee_emom: { clean: true, rest20: true } } });
    expect(log.state(TUE(2)).emom.pendingUp).toBe(true);
    log.add(
      chooseStep(log.ctx, log.events, {
        trackId: 'burpee_emom',
        stepId: 'burpee_emom.E2',
        date: dayOf(2, 6),
      }).events,
    );
    expect(log.state(dayOf(2, 6)).emom).toMatchObject({
      stepId: 'burpee_emom.E2',
      pendingUp: false,
    });
    log.session({ date: TUE(3) }); // light week: burpee test
    // Week 5 allows E4, but nothing is pending: no step-up.
    const started = startSession(log.ctx, log.events, {
      sessionId: 'x',
      date: TUE(4),
      kind: 'A',
      answers: [true, true, true],
    });
    expect(started.some((e) => e.type === 'step_changed')).toBe(false);

    // Three weeks away.
    const away = new Log().onboard({ steps: { burpee_emom: 'burpee_emom.E2' } });
    away.session({ date: TUE(0), results: { burpee_emom: { clean: true, rest20: true } } });
    away.catchUp(dayOf(4, 1));
    expect(away.state(dayOf(4, 1)).emom).toMatchObject({
      stepId: 'burpee_emom.E1',
      pendingUp: false,
    });
  });

  test('S-VARIANT-01: næste burpee-variant først fra E6, én ad gangen', () => {
    const low = new Log().onboard({ steps: { burpee_emom: 'burpee_emom.E5' } });
    low.push({ type: 'variant_set', stepId: 'burpee_skill.V2' }, TUE(0));
    expect(low.state(TUE(0)).burpeeVariant).toBe('burpee_skill.V1');
    const high = new Log().onboard({ steps: { burpee_emom: 'burpee_emom.E6' } });
    high.push({ type: 'variant_set', stepId: 'burpee_skill.V3' }, TUE(0));
    expect(high.state(TUE(0)).burpeeVariant).toBe('burpee_skill.V1');
    high.push({ type: 'variant_set', stepId: 'burpee_skill.V2' }, TUE(0));
    expect(high.state(TUE(0)).burpeeVariant).toBe('burpee_skill.V2');
  });

  test('S-WEEK-11: tre uger uden giver −2 kg, target min og hits 0 på læg, etbens RDL og rygsæk-row', () => {
    const log = new Log().onboard({
      steps: { backpack_row: { stepId: 'backpack_row.1', target: 15, load: 4 } },
    });
    log.session({ date: FRI(0), kind: 'B', sets: { backpack_row: { values: [15, 15], rir: 3 } } });
    expect(log.state(FRI(0)).tracks.backpack_row).toMatchObject({ hits: 1, load: 4 });
    const events = log.catchUp(dayOf(4, 1));
    expect(
      events.find((e) => e.type === 'load_changed' && e.trackId === 'backpack_row'),
    ).toMatchObject({ from: 4, to: 2 });
    expect(
      events
        .filter((e) => e.type === 'load_changed')
        .map((e) => (e.type === 'load_changed' ? e.trackId : ''))
        .sort(),
    ).toEqual(['backpack_row', 'calf', 'sl_rdl']);
    expect(log.state(dayOf(4, 1)).tracks.backpack_row).toMatchObject({
      load: 2,
      target: 8,
      hits: 0,
    });
    expect(log.state(dayOf(4, 1)).tracks.calf).toMatchObject({ load: 0, hits: 0 });
  });

  test('S-WEEK-12: rejsepassets ben er højst legs.3 (split squat) med arbejdstal min', () => {
    const log = from(1, { legs: { stepId: 'legs.5', target: 4 } });
    log.push(
      { type: 'status_set', status: 'travel', from: dayOf(1, 1), to: dayOf(1, 7) },
      dayOf(1, 1),
    );
    const legs = planFor(log.program, log.state(TUE(1)), TUE(1)).session?.blocks.find(
      (b) => b.trackId === 'legs',
    );
    expect(legs).toMatchObject({ stepId: 'legs.3', target: 6 });
    const low = from(1, { legs: { stepId: 'legs.2', target: 9 } });
    low.push(
      { type: 'status_set', status: 'travel', from: dayOf(1, 1), to: dayOf(1, 7) },
      dayOf(1, 1),
    );
    expect(
      planFor(low.program, low.state(TUE(1)), TUE(1)).session?.blocks.find(
        (b) => b.trackId === 'legs',
      ),
    ).toMatchObject({
      stepId: 'legs.2',
      target: 9,
    });
  });

  test('S-EVENT-02: dagen før en begivenhed er motoren rolig base uden stigningsløb og uden Cooper', () => {
    const three = from(2);
    three.push({ type: 'calendar_event_added', label: 'Kamp', eventDate: FRI(2) }, TUE(2));
    const base = planFor(three.program, three.state(THU(2)), THU(2)).session?.motor;
    expect(base?.variant).toBe('base');
    expect(base?.phases.some((p) => p.kind === 'strides')).toBe(false);
    const four = from(3);
    four.push({ type: 'calendar_event_added', label: 'Kamp', eventDate: FRI(3) }, TUE(3));
    const light = planFor(four.program, four.state(THU(3)), THU(3)).session?.motor;
    expect(light?.variant).toBe('base');
    expect(light?.measureId).toBeUndefined();
    expect(light?.phases.some((p) => p.kind === 'cooper')).toBe(false);
  });

  test('S-MEAS-04: wall sit-målingen på W3 er første sæt, og runderne er én færre', () => {
    const log = from(3, { wallsit: 'wallsit.W3' });
    const blocks = planFor(log.program, log.state(FRI(3)), FRI(3)).session?.blocks ?? [];
    const measures = blocks.filter((b) => b.measureId).map((b) => b.measureId);
    expect(measures).toContain('wall_sit');
    const wall = blocks.find((b) => b.trackId === 'wallsit');
    expect(wall).toMatchObject({ measureId: 'wall_sit', unit: 'rounds', rounds: 1 });
  });

  test('S-MEAS-05: målinger fra et gult A i uge 4 tilbydes ved næste grønne A i uge 5', () => {
    const log = from(3);
    log.session({ date: TUE(3), light: 'yellow' });
    const next = planFor(log.program, log.state(TUE(4)), TUE(4)).session?.blocks ?? [];
    const due = next.filter((b) => b.measureId).map((b) => b.measureId);
    expect(due).toEqual(['wall_test', 'pushups', 'table_rows']);
    expect(next.some((b) => b.unit === 'emom')).toBe(true);
    // Once they are taken, they are not offered again.
    log.session({ date: TUE(4), measures: { wall_test: 2, pushups: 30, table_rows: 12 } });
    // The day's plan does not change once the measurements are logged (the session runs on it).
    const same = planFor(log.program, log.state(TUE(4)), TUE(4)).session?.blocks ?? [];
    expect(same.filter((b) => b.measureId).map((b) => b.measureId)).toEqual(due);
    const later = planFor(log.program, log.state(dayOf(4, 6)), dayOf(4, 6));
    expect(later.session).toBeNull();
    const week6 = planFor(log.program, log.state(TUE(5)), TUE(5)).session?.blocks ?? [];
    expect(week6.some((b) => b.measureId)).toBe(false);
  });

  test('S-IMP-02: pseudo-planche er låst, når pres er under trin 2, selv efter 3 × 10 på trin 2', () => {
    const log = from(1, { press: { stepId: 'press.2', target: 10 } });
    log.session({ date: TUE(1), sets: { press: { values: [10, 10, 10], rir: 3 } } });
    const open = Object.fromEntries(
      sideBranchStatus(log.program, log.state(TUE(1))).map((u) => [u.item.id, u.unlocked]),
    );
    expect(open.pseudo_planche).toBe(true);
    log.add(
      chooseStep(log.ctx, log.events, { trackId: 'press', stepId: 'press.1', date: TUE(1) }).events,
    );
    const locked = Object.fromEntries(
      sideBranchStatus(log.program, log.state(TUE(1))).map((u) => [u.item.id, u.unlocked]),
    );
    expect(locked.pseudo_planche).toBe(false);
  });

  test('S-HERO-02: høje trin uden loggede sæt giver ingen Hero-hints og intet ben-niveau', () => {
    const log = new Log().onboard({
      steps: { press: 'press.7', shoulder: 'shoulder.7', pull: 'pull.7', legs: 'legs.7' },
    });
    const state = log.state(TUE(0));
    expect(heroStatus(log.program, state).filter((h) => h.hint)).toEqual([]);
    expect(legsLevel(log.program, state)).toBeNull();
  });
});
