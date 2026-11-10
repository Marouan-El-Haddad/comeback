// docs/ENGINE.md 8: moving sessions (R-MOVE, R-REST) and the week plan with extra club days.
import { describe, expect, test } from 'vitest';
import { calmTourDay, layoutFor, moveSession, planFor, validMoveDays } from '../index.ts';
import type { SessionKind } from '../types.ts';
import { dayOf, Log, mondays } from './helpers/log.ts';

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

    // Moves in the log that were never checked against the rules (an import that merged two logs):
    // A onto B's Friday, the motor onto A's Tuesday and B into the next week do not count.
    log.push(
      {
        type: 'session_moved',
        kind: 'A',
        fromDate: dayOf(0, 2),
        toDate: dayOf(0, 5),
        short: false,
      },
      dayOf(0, 1),
    );
    log.push(
      {
        type: 'session_moved',
        kind: 'motor',
        fromDate: dayOf(0, 4),
        toDate: dayOf(0, 2),
        short: false,
      },
      dayOf(0, 1),
    );
    log.push(
      { type: 'session_moved', kind: 'B', fromDate: dayOf(0, 5), toDate: dayOf(1, 3), short: true },
      dayOf(0, 1),
    );
    const merged = log.state(dayOf(0, 1));
    expect(planFor(log.program, merged, dayOf(0, 2))).toMatchObject({ kind: 'A', short: false });
    expect(planFor(log.program, merged, dayOf(0, 4))).toMatchObject({ kind: 'motor' });
    expect(planFor(log.program, merged, dayOf(0, 5))).toMatchObject({ kind: 'B', short: false });
    expect(planFor(log.program, merged, dayOf(1, 3)).kind).toBeNull();
    // A valid move afterwards still works from the day the session stands on.
    const moved = moveSession(log.program, merged, log.make, {
      kind: 'A',
      fromDate: dayOf(0, 2),
      toDate: dayOf(0, 7),
      today: dayOf(0, 1),
    });
    expect(moved).toMatchObject({ type: 'session_moved', toDate: dayOf(0, 7), short: false });
  });

  test('S-MOVE-05: syge- og feriedage tilbydes ikke; en rejsedag kan tage A som rejsepasset', () => {
    const log = new Log().onboard();
    log.push(
      { type: 'status_set', status: 'ill', from: dayOf(0, 4), to: dayOf(0, 4) },
      dayOf(0, 1),
    );
    log.push(
      { type: 'status_set', status: 'holiday', from: dayOf(0, 6), to: dayOf(0, 7) },
      dayOf(0, 1),
    );
    const wednesday = dayOf(0, 3);
    log.catchUp(wednesday);
    const state = log.state(wednesday);
    const options = validMoveDays(log.program, state, 'A', dayOf(0, 2), wednesday);
    expect(options.map((o) => [o.date, o.mode])).toEqual([[wednesday, 'short']]);
    for (const day of [dayOf(0, 4), dayOf(0, 6), dayOf(0, 7)]) {
      expect(
        moveSession(log.program, state, log.make, {
          kind: 'A',
          fromDate: dayOf(0, 2),
          toDate: day,
          today: wednesday,
        }),
      ).toBeNull();
    }

    const travel = new Log().onboard();
    travel.push(
      { type: 'status_set', status: 'travel', from: dayOf(0, 4), to: dayOf(0, 4) },
      dayOf(0, 1),
    );
    travel.catchUp(wednesday);
    const moved = moveSession(travel.program, travel.state(wednesday), travel.make, {
      kind: 'A',
      fromDate: dayOf(0, 2),
      toDate: dayOf(0, 4),
      today: wednesday,
    });
    expect(moved).toMatchObject({ type: 'session_moved', toDate: dayOf(0, 4), short: false });
    if (moved) travel.add([moved]);
    expect(planFor(travel.program, travel.state(wednesday), dayOf(0, 4)).kind).toBe('travel');
  });

  test('S-MOVE-06: når en flytning tager motorens dag, er den valgfri rolige tur på den første dag, motoren selv kunne flyttes til', () => {
    const log = new Log().onboard();
    const wednesday = dayOf(0, 3);
    log.catchUp(wednesday);
    expect(calmTourDay(log.program, log.state(wednesday), wednesday, wednesday)).toBeNull();
    const moved = moveSession(log.program, log.state(wednesday), log.make, {
      kind: 'A',
      fromDate: dayOf(0, 2),
      toDate: dayOf(0, 4),
      today: wednesday,
    });
    if (moved) log.add([moved]);
    // Wednesday and Saturday are club days, Thursday has A and Friday B: Sunday.
    expect(calmTourDay(log.program, log.state(wednesday), wednesday, wednesday)).toBe(dayOf(0, 7));
    expect(calmTourDay(log.program, log.state(dayOf(0, 6)), dayOf(0, 6), dayOf(0, 6))).toBe(
      dayOf(0, 7),
    );

    // Moved on Tuesday itself, the free Tuesday is the first such day.
    const early = new Log().onboard();
    const tuesday = dayOf(0, 2);
    const first = moveSession(early.program, early.state(tuesday), early.make, {
      kind: 'A',
      fromDate: tuesday,
      toDate: dayOf(0, 4),
      today: tuesday,
    });
    if (first) early.add([first]);
    expect(calmTourDay(early.program, early.state(tuesday), tuesday, tuesday)).toBe(tuesday);
    // The run was offered on Tuesday, and A and B were taken on Thursday and Friday: Sunday offers
    // none, or the week had no whole rest day.
    early.session({ date: dayOf(0, 4), kind: 'A' });
    early.session({ date: dayOf(0, 5), kind: 'B' });
    const sunday = dayOf(0, 7);
    expect(calmTourDay(early.program, early.state(sunday), sunday, sunday)).toBeNull();

    // The motor moved to Sunday on Monday, and Tuesday's A to Sunday on Wednesday: the motor's
    // own Thursday is free now, and the run is there.
    const own = new Log().onboard();
    const monday = dayOf(0, 1);
    const motor = moveSession(own.program, own.state(monday), own.make, {
      kind: 'motor',
      fromDate: dayOf(0, 4),
      toDate: sunday,
      today: monday,
    });
    if (motor) own.add([motor]);
    own.catchUp(wednesday);
    const a = moveSession(own.program, own.state(wednesday), own.make, {
      kind: 'A',
      fromDate: dayOf(0, 2),
      toDate: sunday,
      today: wednesday,
    });
    expect(a).not.toBeNull();
    if (a) own.add([a]);
    expect(calmTourDay(own.program, own.state(wednesday), wednesday, wednesday)).toBe(dayOf(0, 4));

    // A week plan without a motor (5.10) has none here.
    const extra = new Log().onboard();
    extra.push({ type: 'schedule_changed', clubDays: [1, 3, 5, 6], clinch: false }, dayOf(0, 1));
    expect(
      calmTourDay(extra.program, extra.state(dayOf(0, 1)), dayOf(0, 1), dayOf(0, 1)),
    ).toBeNull();
  });

  test('S-MOVE-07: advarslen om A og B to dage i træk kun ved et partnerpas, der blev taget', () => {
    const saturday = dayOf(0, 6);
    const shortToday = (log: Log) =>
      validMoveDays(log.program, log.state(saturday), 'A', dayOf(0, 2), saturday).find(
        (o) => o.date === saturday,
      );
    const missed = new Log().onboard();
    missed.catchUp(saturday);
    expect(shortToday(missed)).toMatchObject({ mode: 'short' });
    expect(shortToday(missed)?.warning).toBeUndefined();

    const taken = new Log().onboard();
    taken.session({ date: dayOf(0, 5), kind: 'B' });
    taken.catchUp(saturday);
    expect(shortToday(taken)).toMatchObject({
      mode: 'short',
      warning: 'B skal efterlade dig frisk',
    });
  });

  test('S-MOVE-08: dagen før en begivenhed tager hverken A eller en motor med intervaller, men B og en rolig motor', () => {
    const days = (log: Log, kind: SessionKind, from: string, today: string) =>
      validMoveDays(log.program, log.state(today), kind, from, today).map((o) => o.date);
    // Week 1: the motor is a calm base. The event is on Monday, so Sunday is the day before.
    const base = new Log().onboard();
    base.push({ type: 'calendar_event_added', label: 'Kamp', eventDate: dayOf(1, 1) }, dayOf(0, 1));
    expect(days(base, 'A', dayOf(0, 2), dayOf(0, 1))).not.toContain(dayOf(0, 7));
    expect(days(base, 'B', dayOf(0, 5), dayOf(0, 1))).toContain(dayOf(0, 7));
    expect(days(base, 'motor', dayOf(0, 4), dayOf(0, 1))).toContain(dayOf(0, 7));
    // Programme week 5: the motor runs 30/15 intervals.
    const intervals = new Log().onboard({ completedWeeks: mondays(4) });
    intervals.push(
      { type: 'calendar_event_added', label: 'Kamp', eventDate: dayOf(5, 1) },
      dayOf(4, 1),
    );
    expect(days(intervals, 'motor', dayOf(4, 4), dayOf(4, 1))).not.toContain(dayOf(4, 7));
    expect(days(intervals, 'B', dayOf(4, 5), dayOf(4, 1))).toContain(dayOf(4, 7));
  });

  test('S-MOVE-09: en dag, der er gået uden pas, tæller som hviledag (R-REST)', () => {
    const friday = dayOf(0, 5);
    const sunday = dayOf(0, 7);
    // Club Monday to Wednesday, Friday and Saturday: A and B as short versions, Sunday the rest
    // day. A goes to Thursday, the only other free day.
    const week = () => {
      const log = new Log().onboard();
      log.push({ type: 'schedule_changed', clubDays: [1, 2, 3, 5, 6], clinch: false }, dayOf(0, 1));
      const moved = moveSession(log.program, log.state(dayOf(0, 1)), log.make, {
        kind: 'A',
        fromDate: dayOf(0, 2),
        toDate: dayOf(0, 4),
        today: dayOf(0, 1),
      });
      expect(moved).toMatchObject({ toDate: dayOf(0, 4), short: false });
      if (moved) log.add([moved]);
      return log;
    };
    const bDays = (log: Log) =>
      validMoveDays(log.program, log.state(friday), 'B', friday, friday).map((o) => o.date);
    const free = week();
    free.catchUp(friday);
    expect(bDays(free)).toContain(sunday);
    const taken = week();
    taken.session({ date: dayOf(0, 4), kind: 'A' });
    taken.catchUp(friday);
    expect(bDays(taken)).not.toContain(sunday);
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
