import { describe, expect, it } from 'vitest';
import { PROGRAM } from '../../engine/index.ts';
import { dayOf, Log, mondays } from '../../engine/__tests__/helpers/log.ts';
import {
  absenceChanges,
  comingEvents,
  currentStatuses,
  rangeText,
  repeatedWeek,
  untilText,
} from '../status.ts';

// Status and events on I dag, Uge and Mere (docs/SPEC.md 3.1 and 3.6, DECISIONS.md D67).
const TUE = '2026-11-10';

describe('the statuses and events still to come (SPEC 3.6)', () => {
  it('lists the statuses that apply today or later by their first day', () => {
    const log = new Log().onboard();
    log.push({ type: 'status_set', status: 'holiday', from: '2026-11-21', to: '2026-11-22' }, TUE);
    log.push({ type: 'status_set', status: 'ill', from: '2026-11-09', to: '2026-11-09' }, TUE);
    log.push({ type: 'status_set', status: 'ill', from: TUE, to: '2026-11-11' }, TUE);
    expect(currentStatuses(log.state(TUE), TUE)).toEqual([
      { status: 'ill', from: TUE, to: '2026-11-11' },
      { status: 'holiday', from: '2026-11-21', to: '2026-11-22' },
    ]);
  });

  it('lists the events from today on by date', () => {
    const log = new Log().onboard();
    log.push({ type: 'calendar_event_added', label: 'Kamp', eventDate: '2026-11-28' }, TUE);
    log.push({ type: 'calendar_event_added', label: 'Gammel', eventDate: '2026-11-09' }, TUE);
    log.push({ type: 'calendar_event_added', label: 'Graduering', eventDate: '2026-11-14' }, TUE);
    expect(comingEvents(log.state(TUE), TUE).map((e) => e.label)).toEqual(['Graduering', 'Kamp']);
  });

  it('writes the days out in Danish', () => {
    expect(rangeText(TUE, TUE, TUE)).toBe('i dag');
    expect(rangeText(TUE, '2026-11-11', TUE)).toBe('fra i dag til og med onsdag 11. november');
    expect(rangeText('2026-11-14', '2026-11-15', TUE)).toBe(
      'fra lørdag 14. november til og med søndag 15. november',
    );
    expect(untilText({ status: 'ill', from: TUE, to: TUE }, TUE)).toBe('Kun i dag.');
    expect(untilText({ status: 'ill', from: TUE, to: '2026-11-11' }, TUE)).toBe(
      'Til og med onsdag 11. november.',
    );
  });
});

describe('I dag explains a changed day (SPEC 3.1)', () => {
  it('says the week repeats the last completed one after a week that was not completed (R-PW)', () => {
    const log = new Log().onboard({ completedWeeks: mondays(2) });
    expect(repeatedWeek(PROGRAM, log.state(dayOf(2, 2)), dayOf(2, 2))).toBeNull();
    expect(repeatedWeek(PROGRAM, log.state(dayOf(3, 2)), dayOf(3, 2))).toBe(
      'Sidste uge blev ikke gennemført: du gentager uge 2.',
    );
    expect(repeatedWeek(PROGRAM, log.state(dayOf(4, 2)), dayOf(4, 2))).toBe(
      'Sidste uge blev ikke gennemført: du gentager uge 2.',
    );
    expect(repeatedWeek(PROGRAM, log.state(dayOf(0, 2)), dayOf(0, 2))).toBeNull();
  });

  it('shows the ladders three weeks without a strength session took down, in their own words, that week only (R-ABSENCE-3)', () => {
    const log = new Log().onboard({
      steps: { legs: 'legs.3', backpack_row: { stepId: 'backpack_row.1', load: 4 } },
    });
    expect(absenceChanges(log.events, dayOf(3, 1))).toBeNull();
    log.catchUp(dayOf(3, 2));
    const changes = absenceChanges(log.events, dayOf(3, 4));
    const lines = changes?.lines ?? [];
    expect(lines).toContain('Ben: trin 2.');
    expect(lines).toContain('Rygsæk-row: 2 kg i rygsækken og forfra på arbejdstallet.');
    // Ladders on their first step stay there, and a load at 0 kg goes nowhere.
    expect(changes?.stayed).toBe(true);
    expect(lines.some((l) => l.startsWith('Pres'))).toBe(false);
    expect(lines.some((l) => l.startsWith('Læg'))).toBe(false);
    expect(absenceChanges(log.events, dayOf(4, 1))).toBeNull();
  });

  it('shows the card with no lines when every ladder was on its first step', () => {
    const log = new Log().onboard();
    log.catchUp(dayOf(3, 1));
    expect(absenceChanges(log.events, dayOf(3, 1))).toEqual({ lines: [], stayed: true });
  });
});
