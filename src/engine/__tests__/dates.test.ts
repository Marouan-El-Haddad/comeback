// docs/ENGINE.md 8: dates in Europe/Copenhagen whatever the device's time zone. The Vitest
// project "utc" runs this file again with TZ=UTC (docs/DECISIONS.md D25).
import { describe, expect, test } from 'vitest';
import {
  addDays,
  calendarWeek,
  deriveState,
  finishSession,
  formatDay,
  formatLong,
  PROGRAM,
  startSession,
  todayIn,
  weekday,
} from '../index.ts';
import type { AppEvent, EventBody, ISODate } from '../types.ts';

describe('Datoer', () => {
  test('kører i projektets tidszone', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(process.env.TZ);
  });

  test('visning på dansk uanset browserens sprog (SPEC 8)', () => {
    expect(formatLong('2026-11-17')).toBe('tirsdag 17. november');
    expect(formatLong('2027-03-28')).toBe('søndag 28. marts');
    expect(formatDay('2027-01-03')).toBe('3. januar');
  });

  test('S-DATE-01: 23:30 UTC den 10/11 er 11/11 i dansk tid, uanset browserens tidszone', () => {
    expect(todayIn(Date.parse('2026-11-10T23:30:00Z'))).toBe('2026-11-11');
    expect(todayIn(Date.parse('2026-11-10T22:59:59Z'))).toBe('2026-11-10');
    expect(todayIn(Date.parse('2026-11-10T23:00:00Z'))).toBe('2026-11-11');
  });

  test('S-DATE-02: et pas startet 23:55 og afsluttet 00:10 hører til startdatoen', () => {
    // Started Sunday 15/11 at 23:55 and finished Monday 16/11 at 00:10 (Copenhagen).
    const startAt = Date.parse('2026-11-15T22:55:00Z');
    const endAt = Date.parse('2026-11-15T23:10:00Z');
    expect(todayIn(startAt)).toBe('2026-11-15');
    expect(todayIn(endAt)).toBe('2026-11-16');
    let clock = startAt;
    let n = 0;
    const make = (body: EventBody, date: ISODate): AppEvent => ({
      ...body,
      id: `d${++n}`,
      at: new Date(clock).toISOString(),
      date,
      v: 1,
    });
    const ctx = { program: PROGRAM, make };
    const events: AppEvent[] = [
      make(
        { type: 'onboarding_completed', startDate: '2026-11-09', completedWeeks: [] },
        '2026-11-08',
      ),
    ];
    const date = todayIn(startAt);
    events.push(
      ...startSession(ctx, events, {
        sessionId: 'late',
        date,
        kind: 'B',
        answers: [true, true, true],
      }),
    );
    const state = deriveState(PROGRAM, events, date);
    const plan = state.sessions[0]?.blocks ?? [];
    for (const ref of plan.filter((b) => b.group === 'pair1')) {
      for (let i = 1; i <= ref.sets; i++) {
        for (const side of ['L', 'R'] as const) {
          events.push(
            make(
              {
                type: 'set_logged',
                sessionId: 'late',
                blockId: ref.blockId,
                trackId: ref.trackId,
                stepId: ref.stepId,
                setIndex: i,
                side: ref.trackId === 'backpack_row' ? side : undefined,
                reps: ref.target,
                rir: 3,
                asPlanned: true,
              },
              date,
            ),
          );
          if (ref.trackId !== 'backpack_row') break;
        }
      }
    }
    clock = endAt;
    const finished = finishSession(ctx, events, { sessionId: 'late' });
    expect(finished[0]).toMatchObject({
      type: 'session_completed',
      date: '2026-11-15',
      done: true,
    });
    events.push(...finished);
    const after = deriveState(PROGRAM, events, '2026-11-16');
    expect(after.sessions[0]?.date).toBe('2026-11-15');
    expect(after.weeks[0]?.completed).toBe(true);
    expect(after.weeks[1]?.pw).toBe(2);
  });

  test('S-DATE-03: overgangen til sommertid 28/3 2027 tæller datoer uden spring', () => {
    expect(todayIn(Date.parse('2027-03-28T00:30:00Z'))).toBe('2027-03-28');
    expect(todayIn(Date.parse('2027-03-28T21:59:00Z'))).toBe('2027-03-28');
    expect(todayIn(Date.parse('2027-03-28T22:00:00Z'))).toBe('2027-03-29');
    expect(addDays('2027-03-27', 1)).toBe('2027-03-28');
    expect(addDays('2027-03-28', 1)).toBe('2027-03-29');
    expect(addDays('2027-03-29', -2)).toBe('2027-03-27');
    expect(weekday('2027-03-28')).toBe(7);
    expect(weekday('2027-03-29')).toBe(1);
    expect(calendarWeek('2026-11-09', '2027-03-28')).toBe(19);
    expect(calendarWeek('2026-11-09', '2027-03-29')).toBe(20);
    // The other direction: back to winter time on 25 October 2026.
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(todayIn(Date.parse('2026-10-25T22:59:00Z'))).toBe('2026-10-25');
    expect(todayIn(Date.parse('2026-10-25T23:00:00Z'))).toBe('2026-10-26');
  });
});
