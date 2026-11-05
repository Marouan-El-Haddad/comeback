// docs/ENGINE.md 8: weeks, absence, calendar, events and the flat rule.
import { describe, expect, test } from 'vitest';
import { planFor, startSession } from '../index.ts';
import { dayOf, Log, mondays, type Steps } from './helpers/log.ts';

const TUE = (k: number) => dayOf(k, 2);
const THU = (k: number) => dayOf(k, 4);
const FRI = (k: number) => dayOf(k, 5);

function from(k: number, steps: Steps = {}) {
  return new Log().onboard({ completedWeeks: mondays(k), steps });
}

describe('Uger og fravær', () => {
  test('S-WEEK-01: k0 gennemført med et grønt A giver programuge 2 i k1', () => {
    const log = new Log().onboard();
    log.session({ date: TUE(0) });
    expect(log.state(TUE(1)).weeks[1]?.pw).toBe(2);
  });

  test('S-WEEK-02: k0 og k1 gennemført, k2 uden A/B: k3 gentager uge 2, og k4 er uge 3, når k3 gennemføres', () => {
    const log = new Log().onboard();
    log.session({ date: TUE(0) });
    log.session({ date: TUE(1) });
    const state = log.state(TUE(3));
    expect(state.weeks.map((w) => w.pw)).toEqual([1, 2, 3, 2]);
    log.session({ date: TUE(3) });
    expect(log.state(TUE(4)).weeks[4]?.pw).toBe(3);
  });

  test('S-WEEK-03: kun et gult A i ugen gennemfører ugen', () => {
    const log = new Log().onboard();
    log.session({ date: TUE(0), light: 'yellow' });
    expect(log.state(TUE(1)).weeks[0]?.completed).toBe(true);
  });

  test('S-WEEK-04: kun et rødt A og Open & Strong gennemfører ikke ugen', () => {
    const log = new Log().onboard();
    log.session({ date: TUE(0), light: 'red' });
    log.push({ type: 'os_done' }, TUE(0));
    expect(log.state(TUE(1)).weeks[0]?.completed).toBe(false);
  });

  test('S-WEEK-05: tre uger uden gennemført uge: alle stiger, EMOM og klubsekvens ét trin ned, én gang pr. spor', () => {
    const log = new Log().onboard({
      steps: {
        press: 'press.3',
        legs: 'legs.2',
        burpee_emom: 'burpee_emom.E3',
        club_sequence: 'club_sequence.C2',
        neck: 'neck.N2',
      },
    });
    const events = log.catchUp(dayOf(3, 1));
    const absence = events.filter((e) => e.type === 'step_changed' && e.reason === 'absence');
    const tracks = absence.map((e) => (e.type === 'step_changed' ? e.trackId : ''));
    expect(new Set(tracks).size).toBe(tracks.length);
    expect(absence.find((e) => e.type === 'step_changed' && e.trackId === 'press')).toMatchObject({
      from: 'press.3',
      to: 'press.2',
    });
    expect(absence.find((e) => e.type === 'step_changed' && e.trackId === 'legs')).toMatchObject({
      to: 'legs.1',
    });
    expect(
      absence.find((e) => e.type === 'step_changed' && e.trackId === 'burpee_emom'),
    ).toMatchObject({ to: 'burpee_emom.E2' });
    expect(
      absence.find((e) => e.type === 'step_changed' && e.trackId === 'club_sequence'),
    ).toMatchObject({ to: 'club_sequence.C1' });
    expect(absence.find((e) => e.type === 'step_changed' && e.trackId === 'pull')).toMatchObject({
      from: 'pull.1',
      to: 'pull.1',
    });
    for (const id of [
      'press',
      'shoulder',
      'pull',
      'legs',
      'wallsit',
      'posterior',
      'core_front',
      'core_side',
      'core_rot',
      'core_situp',
      'groin',
      'power_legs',
      'power_upper',
      'burpee_emom',
      'club_sequence',
      'neck',
    ]) {
      expect(tracks).toContain(id);
    }
    for (const e of absence) expect(e.type === 'step_changed' && e.explanation).toMatch(/side 47/);
    const state = log.state(dayOf(3, 1));
    expect(state.weeks[3]?.pw).toBe(1);
    expect(state.tracks.press).toMatchObject({ stepId: 'press.2', hits: 0, target: 6 });
  });

  test('S-WEEK-06: fire uger uden giver kun ét sæt fraværsændringer', () => {
    const log = new Log().onboard({ steps: { press: 'press.4' } });
    log.catchUp(dayOf(3, 1));
    log.catchUp(dayOf(3, 2));
    log.catchUp(dayOf(4, 1));
    const absence = log.events.filter(
      (e) => e.type === 'step_changed' && e.reason === 'absence' && e.trackId === 'press',
    );
    expect(absence).toHaveLength(1);
    expect(log.state(dayOf(4, 1)).tracks.press?.stepId).toBe('press.3');
  });

  test('S-WEEK-07: syg 10.–16. november giver røde dage, og ugen er ikke gennemført', () => {
    const log = new Log().onboard();
    log.push(
      { type: 'status_set', status: 'ill', from: '2026-11-10', to: '2026-11-16' },
      '2026-11-10',
    );
    const state = log.state('2026-11-17');
    for (let d = 10; d <= 16; d++) {
      const plan = planFor(log.program, state, `2026-11-${d}`);
      expect(plan.red).toBe(true);
      expect(plan.session).toBeNull();
    }
    expect(planFor(log.program, state, '2026-11-17').red).toBe(false);
    expect(state.weeks[0]?.completed).toBe(false);
    // A session started anyway on a sick day is red and does not complete the week (R-ILL).
    const { started, finished } = log.session({ date: '2026-11-10', kind: 'A' });
    expect(started.find((e) => e.type === 'session_started')).toMatchObject({ light: 'red' });
    expect(finished[0]).toMatchObject({ status: 'red', done: false });
    expect(log.state('2026-11-17').weeks[0]?.completed).toBe(false);
    expect(log.state('2026-11-17').weeks[1]?.pw).toBe(1);
  });

  test('S-WEEK-08: rejse om tirsdagen giver rejsepasset med EMOM på min(E3, trin); done gennemfører ugen uden at ændre hits', () => {
    const log = from(1, {
      burpee_emom: 'burpee_emom.E5',
      press: { stepId: 'press.2', target: 12 },
    });
    log.push(
      { type: 'status_set', status: 'travel', from: dayOf(1, 1), to: dayOf(1, 7) },
      dayOf(1, 1),
    );
    const plan = planFor(log.program, log.state(TUE(1)), TUE(1));
    expect(plan.kind).toBe('travel');
    const emom = plan.session?.blocks.find((b) => b.unit === 'emom');
    expect(emom?.emom).toMatchObject({ stepId: 'burpee_emom.E3', minutes: 6 });
    expect(plan.session?.blocks.map((b) => b.trackId)).toEqual([
      'warmup',
      'press',
      'backpack_row',
      'legs',
      'burpee_emom',
    ]);
    const { finished } = log.session({
      date: TUE(1),
      kind: 'travel',
      sets: { press: { values: [12, 12, 12], rir: 2 } },
    });
    expect(finished[0]).toMatchObject({ status: 'travel', done: true });
    const state = log.state(TUE(2));
    expect(state.weeks[1]?.completed).toBe(true);
    expect(state.tracks.press).toMatchObject({ hits: 0, target: 12 });
  });

  test('S-WEEK-09: onboarding 30/11 med uge 9/11 og 16/11 gennemført, ikke 23/11: programuge 2 og trin fra step_set', () => {
    const log = new Log().onboard({
      date: '2026-11-30',
      completedWeeks: ['2026-11-09', '2026-11-16'],
      steps: { press: { stepId: 'press.2', target: 9 } },
    });
    const state = log.state('2026-11-30');
    expect(state.weeks.map((w) => w.pw)).toEqual([1, 2, 3, 2]);
    expect(planFor(log.program, state, '2026-11-30').pw).toBe(2);
    expect(state.tracks.press).toMatchObject({ stepId: 'press.2', target: 9 });
  });

  test('S-WEEK-10: uge 12 gennemført giver uge 5 i runde 2 og ingen uge-1-målinger', () => {
    const log = from(12);
    const state = log.state(TUE(12));
    expect(state.weeks[11]?.pw).toBe(12);
    expect(state.weeks[12]).toMatchObject({ pw: 5, round: 2 });
    expect(state.round).toBe(2);
    for (const day of [TUE(12), THU(12), FRI(12)]) {
      const plan = planFor(log.program, state, day);
      expect(plan.session?.blocks.some((b) => b.measureId)).toBe(false);
      expect(plan.session?.motor?.measureId).toBeUndefined();
    }
  });
});

describe('Jul, nytår og begivenheder', () => {
  test('S-XMAS-01: 21/12 i uge 7 foreslår motor 23/12 og Styrke B 26/12', () => {
    const log = from(6);
    const state = log.state('2026-12-21');
    expect(state.weeks[6]?.pw).toBe(7);
    const monday = planFor(log.program, state, '2026-12-21');
    expect(monday.overlays.map((o) => o.overlayId)).toEqual(['xmas_2026_motor', 'xmas_2026_B']);
    expect(planFor(log.program, state, '2026-12-23')).toMatchObject({ kind: 'motor' });
    expect(planFor(log.program, state, '2026-12-23').session?.motor?.variant).toBe('base');
    expect(planFor(log.program, state, '2026-12-24').kind).toBeNull();
    expect(planFor(log.program, state, '2026-12-25').kind).toBeNull();
    expect(planFor(log.program, state, '2026-12-26').kind).toBe('B');
    log.push(
      { type: 'overlay_choice', overlayId: 'xmas_2026_B', choice: 'alternative' },
      '2026-12-21',
    );
    expect(planFor(log.program, log.state('2026-12-21'), '2026-12-27').kind).toBe('B');
  });

  test('S-XMAS-02: ugen fra 28/12 i uge 8 foreslår målinger 29.–30/12; i uge 6 ingen', () => {
    const light = from(7);
    const state = light.state('2026-12-28');
    expect(state.weeks[7]?.pw).toBe(8);
    expect(planFor(light.program, state, '2026-12-28').overlays.map((o) => o.overlayId)).toEqual([
      'newyear_2026_measure',
    ]);
    const tuesday = planFor(light.program, state, '2026-12-29');
    const wednesday = planFor(light.program, state, '2026-12-30');
    expect(tuesday.kind).toBe('A');
    expect(tuesday.session?.blocks.some((b) => b.measureId === 'pushups')).toBe(true);
    expect(wednesday.kind).toBe('B');
    expect(wednesday.session?.blocks.some((b) => b.measureId === 'pike')).toBe(true);

    const normal = new Log().onboard({ completedWeeks: [...mondays(5), dayOf(6, 1)] });
    const s2 = normal.state('2026-12-28');
    expect(s2.weeks[7]?.pw).toBe(6);
    expect(planFor(normal.program, s2, '2026-12-28').overlays).toEqual([]);
    expect(planFor(normal.program, s2, '2026-12-29').kind).toBe('A');
    expect(planFor(normal.program, s2, '2026-12-29').session?.blocks.some((b) => b.measureId)).toBe(
      false,
    );
  });

  test('S-XMAS-03: klubben lukket 24/12–3/1 giver kamp-runder på Muay Thai-dagene', () => {
    const log = from(6);
    log.push(
      { type: 'status_set', status: 'club_closed', from: '2026-12-24', to: '2027-01-03' },
      '2026-12-21',
    );
    const state = log.state('2026-12-21');
    for (const date of ['2026-12-26', '2026-12-28', '2026-12-30', '2027-01-02']) {
      expect(planFor(log.program, state, date).club).toMatchObject({ day: true, closed: true });
    }
    expect(planFor(log.program, state, '2026-12-23').club.closed).toBe(false);
  });

  test('S-EVENT-01: kamp 20/1: planen for 19/1 har ingen power-ben, ben-stige, Nordic, intervaller eller boss', () => {
    const log = from(10, { posterior: 'posterior.4' });
    log.push(
      { type: 'calendar_event_added', label: 'Kamp', eventDate: '2027-01-20' },
      '2027-01-10',
    );
    const state = log.state('2027-01-19');
    const plan = planFor(log.program, state, '2027-01-19');
    expect(plan.pw).toBe(11);
    const tracks = plan.session?.blocks.map((b) => b.trackId) ?? [];
    expect(tracks).not.toContain('power_legs');
    expect(tracks).not.toContain('legs');
    expect(tracks).not.toContain('posterior');
    expect(tracks).toContain('press');
    expect(plan.session?.bossOffered).toBe(false);
    expect(plan.flags).toContainEqual({ type: 'event_tomorrow', label: 'Kamp' });
    const without = from(10, { posterior: 'posterior.4' });
    expect(
      planFor(without.program, without.state('2027-01-19'), '2027-01-19').session?.bossOffered,
    ).toBe(true);

    // Intervals: an event on Friday makes Thursday's fight rounds a calm base.
    log.push(
      { type: 'calendar_event_added', label: 'Kamp', eventDate: '2027-01-22' },
      '2027-01-10',
    );
    const thursday = planFor(log.program, log.state('2027-01-21'), '2027-01-21');
    expect(thursday.session?.motor?.variant).toBe('base');
    expect(thursday.session?.intervalsOption).toBeUndefined();
  });
});

describe('Flad i klassen', () => {
  test('S-FLAT-01: flad i k4 og karakter 4 i k5 giver k6 en tredjedel færre sæt og ingen EMOM-oprykning; k7 normal', () => {
    const log = from(6);
    log.push({ type: 'club_logged', attended: true, freshness: 'flat' }, dayOf(4, 3));
    log.push({ type: 'club_logged', attended: true, technique: 4 }, dayOf(5, 6));
    log.session({ date: TUE(5), results: { burpee_emom: { clean: true, rest20: true } } });
    const state = log.state(TUE(6));
    expect(state.weeks.slice(4, 7).map((w) => w.pw)).toEqual([5, 6, 7]);
    expect(state.weeks[6]?.volumeFactor).toBe(0.67);
    const plan = planFor(log.program, state, TUE(6));
    expect(plan.flags).toContainEqual({ type: 'reduced_volume' });
    const sets = Object.fromEntries((plan.session?.blocks ?? []).map((b) => [b.trackId, b.sets]));
    expect(sets.press).toBe(2); // 4 → 2
    expect(sets.groin).toBe(2); // 3 → 2
    expect(sets.power_legs).toBe(2); // 4 → 2
    expect(state.emom.pendingUp).toBe(true);
    const started = startSession(log.ctx, log.events, {
      sessionId: 'x',
      date: TUE(6),
      kind: 'A',
      answers: [true, true, true],
    });
    expect(started.some((e) => e.type === 'step_changed')).toBe(false);
    const later = log.state(TUE(7));
    expect(later.weeks[7]?.volumeFactor).toBe(1);
  });

  test('S-FLAT-02: flad i k5 og k6 skubber reduktionen forbi den lette uge k7 til k8', () => {
    const log = from(8);
    log.push({ type: 'club_logged', attended: true, freshness: 'flat' }, dayOf(5, 1));
    log.push({ type: 'club_logged', attended: true, freshness: 'flat' }, dayOf(6, 3));
    const state = log.state(TUE(8));
    expect(state.weeks[7]).toMatchObject({ pw: 8, volumeFactor: 1 });
    expect(state.weeks[8]).toMatchObject({ pw: 9, volumeFactor: 0.67 });
  });
});
