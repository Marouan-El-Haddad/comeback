// docs/ENGINE.md 8: moving sessions (R-MOVE, R-REST) and the week plan with extra club days.
import { describe, expect, test } from 'vitest';
import { layoutFor, moveSession, planFor, validMoveDays } from '../index.ts';
import { dayOf, Log } from './helpers/log.ts';

describe('Flytning og ugeplan', () => {
  test('S-MOVE-01: A ikke logget tirsdag: torsdag og søndag fuldt, onsdag og lørdag kort, fredag aldrig', () => {
    const log = new Log().onboard();
    const wednesday = dayOf(0, 3);
    log.catchUp(wednesday);
    const state = log.state(wednesday);
    expect(planFor(log.program, state, wednesday).missed).toEqual([
      { kind: 'A', date: dayOf(0, 2) },
    ]);
    const options = validMoveDays(log.program, state, 'A', dayOf(0, 2), wednesday);
    const byDay = Object.fromEntries(options.map((o) => [o.date, o]));
    expect(byDay[dayOf(0, 4)]).toMatchObject({
      mode: 'full',
      motorDropped: true,
      warning: 'B skal efterlade dig frisk',
    });
    expect(byDay[dayOf(0, 7)]).toMatchObject({ mode: 'full', motorDropped: false });
    expect(byDay[dayOf(0, 3)]).toMatchObject({ mode: 'short' });
    expect(byDay[dayOf(0, 6)]).toMatchObject({ mode: 'short' });
    expect(byDay[dayOf(0, 5)]).toBeUndefined();
    expect(options.map((o) => o.date).sort()).toEqual([
      dayOf(0, 3),
      dayOf(0, 4),
      dayOf(0, 6),
      dayOf(0, 7),
    ]);

    // Moving A to Thursday drops the motor that week.
    const moved = moveSession(log.program, state, log.make, {
      kind: 'A',
      fromDate: dayOf(0, 2),
      toDate: dayOf(0, 4),
      today: wednesday,
    });
    expect(moved).toMatchObject({ type: 'session_moved', short: false });
    if (moved) log.add([moved]);
    const after = log.state(wednesday);
    expect(planFor(log.program, after, dayOf(0, 4)).kind).toBe('A');
    expect(planFor(log.program, after, dayOf(0, 2)).kind).toBeNull();
  });

  test('S-MOVE-02: B flyttet til lørdag (klubdag) tilbydes kun som kort version', () => {
    const log = new Log().onboard();
    const state = log.state(dayOf(0, 1));
    const saturday = validMoveDays(log.program, state, 'B', dayOf(0, 5), dayOf(0, 1)).find(
      (o) => o.date === dayOf(0, 6),
    );
    expect(saturday).toMatchObject({ mode: 'short' });
    const moved = moveSession(log.program, state, log.make, {
      kind: 'B',
      fromDate: dayOf(0, 5),
      toDate: dayOf(0, 6),
      today: dayOf(0, 1),
    });
    expect(moved).toMatchObject({ short: true });
    if (moved) log.add([moved]);
    const plan = planFor(log.program, log.state(dayOf(0, 1)), dayOf(0, 6));
    expect(plan).toMatchObject({ kind: 'B', short: true });
    expect(
      plan.session?.blocks.every(
        (b) =>
          b.role === 'warmup' || b.role === 'measure' || b.group === 'pair1' || b.group === 'pair2',
      ),
    ).toBe(true);
  });

  test('S-MOVE-03: en flytning, der fjerner den sidste hviledag, er ugyldig', () => {
    const log = new Log().onboard();
    log.push(
      { type: 'schedule_changed', clubDays: [1, 2, 3, 4, 5, 6], clinch: false },
      dayOf(0, 1),
    );
    const state = log.state(dayOf(0, 1));
    expect(planFor(log.program, state, dayOf(0, 2))).toMatchObject({ kind: 'A', short: true });
    const options = validMoveDays(log.program, state, 'A', dayOf(0, 2), dayOf(0, 1));
    expect(options.some((o) => o.date === dayOf(0, 7))).toBe(false);
    expect(
      moveSession(log.program, state, log.make, {
        kind: 'A',
        fromDate: dayOf(0, 2),
        toDate: dayOf(0, 7),
        today: dayOf(0, 1),
      }),
    ).toBeNull();
  });

  test('S-MOVE-04: to pas på samme dag: det flyttede afvises', () => {
    const log = new Log().onboard();
    const state = log.state(dayOf(0, 1));
    expect(
      moveSession(log.program, state, log.make, {
        kind: 'A',
        fromDate: dayOf(0, 2),
        toDate: dayOf(0, 5),
        today: dayOf(0, 1),
      }),
    ).toBeNull();
    expect(
      moveSession(log.program, state, log.make, {
        kind: 'motor',
        fromDate: dayOf(0, 4),
        toDate: dayOf(0, 2),
        today: dayOf(0, 1),
      }),
    ).toBeNull();
  });

  test('S-EXTRA-01: klub man, ons, fre, lør: hviledag søn, A tir, B tor, motor udgår med valgfri rolig tur', () => {
    const log = new Log().onboard();
    expect(layoutFor(log.program, [1, 3, 5, 6])).toEqual({
      A: 2,
      B: 4,
      motor: null,
      rest: 7,
      short: false,
      motorDropped: true,
    });
    log.push({ type: 'schedule_changed', clubDays: [1, 3, 5, 6], clinch: false }, dayOf(0, 1));
    const state = log.state(dayOf(0, 1));
    expect(planFor(log.program, state, dayOf(0, 4)).kind).toBe('B');
    expect(planFor(log.program, state, dayOf(0, 7)).flags).toContainEqual({
      type: 'motor_dropped',
    });
  });

  test('S-EXTRA-02: klub mandag til lørdag: A og B som kort version på to klubdage med størst afstand, hviledag søn', () => {
    const log = new Log().onboard();
    expect(layoutFor(log.program, [1, 2, 3, 4, 5, 6])).toEqual({
      A: 2,
      B: 5,
      motor: null,
      rest: 7,
      short: true,
      motorDropped: true,
    });
  });
});
