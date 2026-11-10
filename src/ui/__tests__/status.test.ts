import { describe, expect, it } from 'vitest';
import { planFor, PROGRAM, statusChange } from '../../engine/index.ts';
import { dayOf, Log, mondays } from '../../engine/__tests__/helpers/log.ts';
import {
  correctionNote,
  endedLine,
  endNote,
  previewNotes,
  resultText,
} from '../life/statusText.ts';
import {
  absenceChanges,
  comingEvents,
  currentStatuses,
  eventLine,
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

describe('Status says what applies (SPEC 3.6, D70)', () => {
  const WED = '2026-11-11';
  const FRI = '2026-11-13';

  it('corrects a trip that is shorter: the new days apply, and the screen says so', () => {
    const log = new Log().onboard();
    log.push(
      { type: 'status_set', status: 'travel', from: '2026-11-09', to: '2026-11-20' },
      '2026-11-09',
    );
    const change = statusChange(log.state(WED), {
      status: 'travel',
      from: WED,
      to: FRI,
      today: WED,
    });
    expect(correctionNote(change, WED)).toBe(
      'Retter Rejse til og med fredag 20. november: nu til og med fredag 13. november.',
    );
    expect(resultText(change.range, WED)).toBe('til og med fredag 13. november');
    expect(previewNotes(log.state(WED), change, WED)).toEqual([]);
  });

  it('says a longer illness continues the one in force, and a new one applies over a trip', () => {
    const log = new Log().onboard();
    log.push({ type: 'status_set', status: 'ill', from: TUE, to: WED }, TUE);
    log.push({ type: 'status_set', status: 'travel', from: WED, to: FRI }, WED);
    const longer = statusChange(log.state(WED), { status: 'ill', from: WED, to: FRI, today: WED });
    expect(correctionNote(longer, WED)).toBe(
      'Retter Syg til og med i dag: nu til og med fredag 13. november.',
    );
    expect(previewNotes(log.state(WED), longer, WED)).toEqual([
      'Gælder i stedet for Rejse fra i dag til og med fredag 13. november.',
    ]);
    const fresh = statusChange(log.state(WED), {
      status: 'holiday',
      from: FRI,
      to: FRI,
      today: WED,
    });
    expect(correctionNote(fresh, WED)).toBeNull();
    expect(resultText(fresh.range, WED)).toBe('fredag 13. november');
  });

  it('says the illness still applies when a trip is made shorter, and where a longer one applies over it (D71)', () => {
    const THU = '2026-11-12';
    const log = new Log().onboard();
    log.push(
      { type: 'status_set', status: 'travel', from: '2026-11-09', to: '2026-11-20' },
      '2026-11-09',
    );
    log.push({ type: 'status_set', status: 'ill', from: THU, to: FRI }, THU);
    const state = log.state(THU);
    const shorter = statusChange(state, { status: 'travel', from: THU, to: FRI, today: THU });
    expect(previewNotes(state, shorter, THU)).toEqual([
      'Syg gælder stadig fra i dag til og med fredag 13. november.',
    ]);
    const longer = statusChange(state, {
      status: 'travel',
      from: THU,
      to: '2026-11-22',
      today: THU,
    });
    expect(previewNotes(state, longer, THU)).toEqual([
      'Gælder i stedet for Syg fra i dag til og med fredag 13. november.',
    ]);
    const later = statusChange(state, {
      status: 'travel',
      from: '2026-11-14',
      to: '2026-11-22',
      today: THU,
    });
    // From Saturday the sick days keep their place under the illness.
    expect(previewNotes(state, later, THU)).toEqual([
      'Syg gælder stadig fra i dag til og med fredag 13. november.',
    ]);
  });

  it('says what applies from today once a status ends', () => {
    const log = new Log().onboard();
    log.push({ type: 'status_set', status: 'travel', from: TUE, to: FRI }, TUE);
    log.push({ type: 'status_set', status: 'ill', from: WED, to: WED }, WED);
    log.push({ type: 'status_set', status: 'club_closed', from: WED, to: '2026-11-14' }, WED);
    log.push({ type: 'status_set', status: 'holiday', from: '2026-11-21', to: '2026-11-22' }, WED);
    const state = log.state(WED);
    const [trip, ill, club, holiday] = state.statuses as [
      (typeof state.statuses)[number],
      (typeof state.statuses)[number],
      (typeof state.statuses)[number],
      (typeof state.statuses)[number],
    ];
    expect(endNote(state, ill, WED)).toBe(
      'Afslut, så gælder Rejse stadig til og med fredag 13. november.',
    );
    expect(endedLine(state, ill, WED)).toBe(
      '✓ Syg er afsluttet. Rejse gælder stadig til og med fredag 13. november.',
    );
    expect(endNote(state, club, WED)).toBe(
      'Afslut, så har Muay Thai-dagene Muay Thai igen fra i dag.',
    );
    expect(endedLine(state, holiday, WED)).toBe(
      '✓ Ferie fra lørdag 21. november til og med søndag 22. november er fjernet.',
    );
    // With the trip and the illness gone, the club is still closed today.
    const left = { ...state, statuses: [club, holiday] };
    expect(endNote({ ...state, statuses: [trip, club, holiday] }, trip, WED)).toBe(
      'Afslut, så gælder den almindelige plan fra i dag, og klubben er stadig lukket.',
    );
    expect(endedLine(left, club, WED)).toBe(
      '✓ Klubben lukket er afsluttet. Muay Thai-dagene har Muay Thai igen.',
    );
  });
});

describe('the day before an event (SPEC 3.1, D70)', () => {
  const WED = '2026-11-11';

  it('says only »I morgen: Kamp.« once the session of the day is logged', () => {
    const log = new Log().onboard();
    log.push({ type: 'calendar_event_added', label: 'Kamp', eventDate: '2026-11-11' }, TUE);
    expect(eventLine(PROGRAM, log.state(TUE), planFor(PROGRAM, log.state(TUE), TUE))).toMatch(
      /^I morgen: Kamp – let udgave i dag. /,
    );
    log.session({ date: TUE, kind: 'A' });
    expect(eventLine(PROGRAM, log.state(TUE), planFor(PROGRAM, log.state(TUE), TUE))).toBe(
      'I morgen: Kamp.',
    );
    expect(eventLine(PROGRAM, log.state(WED), planFor(PROGRAM, log.state(WED), WED))).toBeNull();
  });
});
