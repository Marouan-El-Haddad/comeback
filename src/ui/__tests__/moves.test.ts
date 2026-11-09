import { describe, expect, it } from 'vitest';
import { moveSession, PROGRAM } from '../../engine/index.ts';
import { Log } from '../../engine/__tests__/helpers/log.ts';
import {
  canAct,
  dayRef,
  forgotten,
  motorGone,
  movable,
  movedFrom,
  optionName,
  optionNotes,
} from '../moves.ts';

// Moving and skipping a session on I dag and in Uge (docs/SPEC.md 3.1, 3.4, ENGINE.md 5.9,
// DECISIONS.md D64): which sessions can be moved or skipped, the days, and their names.
const MON = '2026-11-09';
const TUE = '2026-11-10';
const WED = '2026-11-11';
const THU = '2026-11-12';
const FRI = '2026-11-13';
const SAT = '2026-11-14';
const SUN = '2026-11-15';
const NEXT_MON = '2026-11-16';

function onboarded() {
  return new Log().onboard({ date: '2026-11-08' });
}

const days = (item: ReturnType<typeof movable>, today: string) =>
  (item?.options ?? []).map((o) => ({
    name: optionName(o, today),
    mode: o.mode,
    notes: optionNotes(o),
  }));

describe('a forgotten session (SPEC 3.1)', () => {
  it('PLAN M3 checklist 7: on Wednesday Tuesday’s Styrke A goes to Thursday (the motor drops) or Sunday, and to Wednesday or Saturday as the short version', () => {
    const log = onboarded();
    log.catchUp(WED);
    const state = log.state(WED);
    const list = forgotten(PROGRAM, state, WED);
    expect(list.map((m) => ({ kind: m.kind, shown: m.shown, date: m.date }))).toEqual([
      { kind: 'A', shown: 'A', date: TUE },
    ]);
    const item = list[0] ?? null;
    expect(item && canAct(item)).toBe(true);
    expect(days(item, WED)).toEqual([
      { name: 'Kort version i dag', mode: 'short', notes: [] },
      {
        name: 'Torsdag 12. november',
        mode: 'full',
        notes: ['Motoren udgår denne uge.', 'B skal efterlade dig frisk.'],
      },
      // Saturday is the day after B on Friday.
      {
        name: 'Kort version lørdag 14. november',
        mode: 'short',
        notes: ['B skal efterlade dig frisk.'],
      },
      { name: 'Søndag 15. november', mode: 'full', notes: [] },
    ]);
    expect(dayRef(TUE, WED)).toBe('i går');
  });

  it('stands later in the week while the week has a day for it, and not after »Spring over« or a move', () => {
    const log = onboarded();
    log.catchUp(FRI);
    // Friday: Tuesday's A (Saturday short, Sunday) and Thursday's motor (Sunday).
    const friday = forgotten(PROGRAM, log.state(FRI), FRI);
    expect(friday.map((m) => [m.kind, m.date])).toEqual([
      ['A', TUE],
      ['motor', THU],
    ]);
    expect(dayRef(TUE, FRI)).toBe('tirsdag');
    expect(days(friday[0] ?? null, FRI).map((d) => d.name)).toEqual([
      'Kort version lørdag 14. november',
      'Søndag 15. november',
    ]);

    log.push({ type: 'session_skipped', kind: 'A', forDate: TUE, reason: 'user' }, FRI);
    const motor = movable(PROGRAM, log.state(FRI), THU, FRI);
    const move = motor?.options.find((o) => o.date === SUN);
    expect(move).toMatchObject({ mode: 'full' });
    const event = moveSession(PROGRAM, log.state(FRI), log.make, {
      kind: 'motor',
      fromDate: THU,
      toDate: SUN,
      today: FRI,
    });
    if (event) log.add([event]);
    expect(forgotten(PROGRAM, log.state(FRI), FRI)).toEqual([]);
  });

  it('shows yesterday’s session on a Monday without days, but an older one only with a day', () => {
    const log = onboarded();
    // B moved to Sunday and not taken: on Monday it stands, with only »Spring over«.
    const event = moveSession(PROGRAM, log.state(FRI), log.make, {
      kind: 'B',
      fromDate: FRI,
      toDate: SUN,
      today: FRI,
    });
    expect(event).not.toBeNull();
    if (event) log.add([event]);
    // Sunday has B: Tuesday's A and Thursday's motor have no day left and do not stand.
    log.catchUp(SUN);
    expect(forgotten(PROGRAM, log.state(SUN), SUN)).toEqual([]);
    expect(movable(PROGRAM, log.state(SUN), TUE, SUN)?.options).toEqual([]);
    expect(movable(PROGRAM, log.state(SUN), THU, SUN)?.options).toEqual([]);
    log.catchUp(NEXT_MON);
    const monday = forgotten(PROGRAM, log.state(NEXT_MON), NEXT_MON);
    expect(monday.map((m) => [m.kind, m.date, m.options.length])).toEqual([['B', SUN, 0]]);
    expect(dayRef(SUN, NEXT_MON)).toBe('i går');
  });

  it('a travel day’s session is the week plan’s A, shown as the travel session', () => {
    const log = onboarded();
    log.push({ type: 'status_set', status: 'travel', from: TUE, to: TUE }, MON);
    log.catchUp(WED);
    const [item] = forgotten(PROGRAM, log.state(WED), WED);
    expect(item).toMatchObject({ kind: 'A', shown: 'travel', date: TUE });
    log.push({ type: 'session_skipped', kind: 'A', forDate: TUE, reason: 'user' }, WED);
    expect(forgotten(PROGRAM, log.state(WED), WED)).toEqual([]);
  });

  it('nothing before the phase-in, on a sick day or for a session that was started', () => {
    const late = new Log().onboard({ date: WED });
    expect(forgotten(PROGRAM, late.state(THU), THU)).toEqual([]);
    const ill = onboarded();
    ill.push({ type: 'status_set', status: 'ill', from: TUE, to: TUE }, MON);
    expect(forgotten(PROGRAM, ill.state(WED), WED)).toEqual([]);
    const done = onboarded();
    done.session({ date: TUE, kind: 'A', only: ['press'], aborted: true });
    expect(movable(PROGRAM, done.state(WED), TUE, WED)).toBeNull();
  });
});

describe('today’s and the week’s sessions (SPEC 3.1, 3.4)', () => {
  it('today’s session can be moved or skipped; skipped, it can still be moved', () => {
    const log = onboarded();
    const item = movable(PROGRAM, log.state(TUE), TUE, TUE);
    expect(item).toMatchObject({ kind: 'A', date: TUE, missed: false, skipped: false });
    expect(days(item, TUE).map((d) => d.name)).toEqual([
      'Kort version onsdag 11. november',
      'Torsdag 12. november',
      'Kort version lørdag 14. november',
      'Søndag 15. november',
    ]);
    log.push({ type: 'session_skipped', kind: 'A', forDate: TUE, reason: 'user' }, TUE);
    const skipped = movable(PROGRAM, log.state(TUE), TUE, TUE);
    expect(skipped).toMatchObject({ skipped: true });
    expect(skipped && canAct(skipped)).toBe(true);
    expect(movable(PROGRAM, log.state(TUE), WED, TUE)).toBeNull();
  });

  it('a whole day today is »I dag« with the date', () => {
    const log = onboarded();
    log.catchUp(THU);
    const item = movable(PROGRAM, log.state(THU), TUE, THU);
    expect(days(item, THU)[0]).toEqual({
      name: 'I dag, torsdag 12. november',
      mode: 'full',
      notes: ['Motoren udgår denne uge.', 'B skal efterlade dig frisk.'],
    });
  });

  it('a moved session says where it came from, and that the motor drops when it took its day', () => {
    const log = onboarded();
    const event = moveSession(PROGRAM, log.state(WED), log.make, {
      kind: 'A',
      fromDate: TUE,
      toDate: THU,
      today: WED,
    });
    if (event) log.add([event]);
    const state = log.state(WED);
    expect(movedFrom(PROGRAM, state, 'A', THU)).toBe(TUE);
    expect(movedFrom(PROGRAM, state, 'B', FRI)).toBeNull();
    expect(motorGone(PROGRAM, state, THU)).toBe(true);
    expect(movable(PROGRAM, state, THU, WED)).toMatchObject({ kind: 'A', date: THU });
    expect(movable(PROGRAM, state, TUE, WED)).toBeNull();

    const other = onboarded();
    expect(motorGone(PROGRAM, other.state(WED), THU)).toBe(false);
  });

  it('a skipped session without a day left has nothing to offer', () => {
    const log = onboarded();
    log.push({ type: 'session_skipped', kind: 'A', forDate: TUE, reason: 'user' }, WED);
    // The motor only moves to a free day: on Saturday that is Sunday.
    const motor = movable(PROGRAM, log.state(SAT), THU, SAT);
    expect(motor?.options.map((o) => [o.date, o.mode])).toEqual([[SUN, 'full']]);
    const event = moveSession(PROGRAM, log.state(SAT), log.make, {
      kind: 'B',
      fromDate: FRI,
      toDate: SUN,
      today: SAT,
    });
    expect(event).not.toBeNull();
    if (event) log.add([event]);
    const skipped = movable(PROGRAM, log.state(SAT), TUE, SAT);
    expect(skipped).toMatchObject({ skipped: true });
    expect(skipped?.options.map((o) => [o.date, o.mode])).toEqual([[SAT, 'short']]);
    const sunday = movable(PROGRAM, log.state(SUN), TUE, SUN);
    expect(sunday).toMatchObject({ skipped: true, options: [] });
    expect(sunday && canAct(sunday)).toBe(false);
  });
});
