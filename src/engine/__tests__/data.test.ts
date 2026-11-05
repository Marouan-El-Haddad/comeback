// docs/ENGINE.md 8: determinism, export/import, merge, migrations, programme versions, time machine.
import { describe, expect, test } from 'vitest';
import {
  deriveState,
  exportFile,
  mergeEvents,
  migrate,
  parseImport,
  planFor,
  PROGRAM,
  serializeExport,
  simulate,
  type Migration,
} from '../index.ts';
import type { AppEvent, Program } from '../types.ts';
import { dayOf, Log, mondays } from './helpers/log.ts';

const TUE = (k: number) => dayOf(k, 2);
const THU = (k: number) => dayOf(k, 4);
const FRI = (k: number) => dayOf(k, 5);

/** About five weeks of training: well over 300 events. */
function busyLog(): Log {
  const log = new Log().onboard({
    steps: { press: { stepId: 'press.1', target: 10 }, legs: 'legs.2' },
  });
  for (let k = 0; k < 5; k++) {
    log.session({ date: TUE(k), results: { burpee_emom: { clean: true, rest20: true } } });
    log.session({ date: THU(k), kind: 'motor' });
    log.session({
      date: FRI(k),
      kind: 'B',
      results: { club_sequence: { clean: true }, neck: { feel: 'easy' } },
    });
    log.push(
      { type: 'club_logged', attended: true, hardness: 'medium', freshness: 'ok' },
      dayOf(k, 3),
    );
    for (let d = 1; d <= 7; d++) log.push({ type: 'os_done' }, dayOf(k, d));
  }
  return log;
}

describe('Data', () => {
  test('S-DATA-01: deriveState over 300 hændelser giver samme resultat to gange', () => {
    const log = busyLog();
    expect(log.events.length).toBeGreaterThanOrEqual(300);
    const a = JSON.stringify(deriveState(PROGRAM, log.events, TUE(5)));
    const b = JSON.stringify(deriveState(PROGRAM, log.events, TUE(5)));
    expect(a).toBe(b);
  });

  test('S-DATA-02: eksport og import (erstat) giver identiske hændelser og samme tilstand, byte for byte', () => {
    const log = busyLog();
    const text = serializeExport(
      exportFile(log.events, PROGRAM.programVersion, '2026-12-14T10:00:00.000Z'),
    );
    const parsed = parseImport(text);
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(parsed.file.events).toEqual(log.events);
    expect(parsed.preview).toMatchObject({
      count: log.events.length,
      programVersion: '1',
      schemaVersion: 1,
    });
    expect(JSON.stringify(deriveState(PROGRAM, parsed.file.events, TUE(5)))).toBe(
      JSON.stringify(deriveState(PROGRAM, log.events, TUE(5))),
    );
    expect(serializeExport(parsed.file)).toBe(text);
    expect(parseImport('{"app":"other"}')).toMatchObject({ ok: false });
    expect(parseImport('not json')).toMatchObject({ ok: false });
    expect(parseImport(JSON.stringify({ ...parsed.file, schemaVersion: 2 }))).toMatchObject({
      ok: false,
      newer: true,
    });
  });

  test('S-DATA-03: flet med overlappende id: dubletter ignoreres, rækkefølgen er efter tidspunkt', () => {
    const log = busyLog();
    const mine = log.events.slice(0, 200);
    const theirs = [...log.events.slice(150, 260)].reverse();
    const merged = mergeEvents(mine, theirs);
    expect(merged).toHaveLength(260);
    expect(new Set(merged.map((e) => e.id)).size).toBe(260);
    for (let i = 1; i < merged.length; i++) {
      expect((merged[i - 1] as AppEvent).at <= (merged[i] as AppEvent).at).toBe(true);
    }
    expect(merged).toEqual(log.events.slice(0, 260));
  });

  test('S-DATA-04: migration fra skema 1 til 2 gemmer først en kopi, og alle hændelser bevares', () => {
    const log = busyLog();
    const stored = { schemaVersion: 1, events: structuredClone(log.events) as unknown[] };
    const v1ToV2: Migration = {
      from: 1,
      to: 2,
      migrate: (events) => events.map((e) => ({ ...(e as object), migrated: true })),
    };
    const result = migrate(stored, [v1ToV2], 2);
    expect(result.backup).toEqual({ schemaVersion: 1, events: log.events });
    expect(result.log.schemaVersion).toBe(2);
    expect(result.log.events).toHaveLength(log.events.length);
    expect(result.log.events.map((e) => (e as AppEvent).id)).toEqual(log.events.map((e) => e.id));
    expect(stored.events).toEqual(log.events);
    expect(migrate(stored).backup).toBeNull();
  });

  test('S-DATA-05: programversion 2 med omdøbt press.3 og fjernet press.5: trinnene virker videre', () => {
    const tracks = PROGRAM.tracks.map((t) =>
      t.id !== 'press'
        ? t
        : {
            ...t,
            steps: t.steps
              .filter((s) => s.id !== 'press.5')
              .map((s) => (s.id === 'press.3' ? { ...s, name: 'Skæv push-up (ny tekst)' } : s)),
          },
    );
    const v2: Program = {
      ...PROGRAM,
      programVersion: '2',
      tracks,
      migrations: { 'press.5': 'press.4' },
    };
    const renamed = new Log().onboard({ steps: { press: 'press.3' } });
    expect(deriveState(v2, renamed.events, TUE(0)).tracks.press?.stepId).toBe('press.3');
    const removed = new Log().onboard({ steps: { press: { stepId: 'press.5', target: 5 } } });
    const state = deriveState(v2, removed.events, TUE(0));
    expect(state.tracks.press?.stepId).toBe('press.4');
    expect(
      planFor(v2, state, TUE(0)).session?.blocks.find((b) => b.trackId === 'press')?.stepId,
    ).toBe('press.4');
  });
});

describe('Tidsmaskinen', () => {
  test('S-TIME-01: simulering fra 24/12 med en uge logget giver jule- og nytårsforslagene', () => {
    const real = new Log().onboard({ completedWeeks: mondays(6) });
    const sim = simulate(PROGRAM, real.events, '2026-12-24');
    const xmas = planFor(PROGRAM, sim.state(), sim.today);
    expect(xmas.overlays.map((o) => o.overlayId)).toEqual(['xmas_2026_motor', 'xmas_2026_B']);
    expect(planFor(PROGRAM, sim.state(), '2026-12-26').kind).toBe('B');
    // Log the week inside the simulation: B on Saturday 26/12 completes programme week 7.
    const helper = new Log(PROGRAM, 'sim');
    helper.events = [...sim.events];
    sim.setToday('2026-12-26');
    const before = helper.events.length;
    helper.session({ date: '2026-12-26', kind: 'B' });
    sim.append(helper.events.slice(before));
    sim.advance(2);
    expect(sim.today).toBe('2026-12-28');
    const newYear = planFor(PROGRAM, sim.state(), sim.today);
    expect(newYear.pw).toBe(8);
    expect(newYear.overlays.map((o) => o.overlayId)).toEqual(['newyear_2026_measure']);
  });

  test('S-TIME-02: simuleringen skriver aldrig til lageret', () => {
    const real = new Log().onboard();
    real.session({ date: TUE(0) });
    const stored = Object.freeze([...real.events]);
    const store = {
      readOnly: true,
      writes: 0,
      append(events: AppEvent[]) {
        if (this.readOnly) throw new Error('read-only');
        this.writes += events.length;
      },
    };
    const sim = simulate(PROGRAM, stored, TUE(1));
    const helper = new Log(PROGRAM, 'sim');
    helper.events = [...sim.events];
    const before = helper.events.length;
    for (const [day, kind] of [
      [TUE(1), 'A'],
      [THU(1), 'motor'],
      [FRI(1), 'B'],
    ] as const) {
      sim.setToday(day);
      helper.session({ date: day, kind });
    }
    sim.append(helper.events.slice(before));
    expect(sim.events.length).toBeGreaterThan(stored.length);
    expect(stored).toHaveLength(real.events.length);
    expect(store.writes).toBe(0);
    expect(() => store.append(helper.events.slice(before))).toThrow('read-only');
    expect(store.writes).toBe(0);
  });

  test('S-TIME-03: efter simuleringen viser I dag den rigtige dato og tilstand', () => {
    const real = new Log().onboard({ steps: { press: 'press.2' } });
    real.session({ date: TUE(0) });
    const today = dayOf(0, 3);
    const before = JSON.stringify(planFor(PROGRAM, real.state(today), today));
    const sim = simulate(PROGRAM, real.events, '2027-01-19');
    const helper = new Log(PROGRAM, 'sim');
    helper.events = [...sim.events];
    helper.onboard({ steps: { press: 'press.6' } });
    sim.append(helper.events.slice(real.events.length));
    expect(sim.state().tracks.press?.stepId).toBe('press.6');
    // Finishing the simulation drops the copy; the real log and date are untouched.
    const after = JSON.stringify(planFor(PROGRAM, real.state(today), today));
    expect(after).toBe(before);
    expect(real.state(today).tracks.press?.stepId).toBe('press.2');
  });
});
