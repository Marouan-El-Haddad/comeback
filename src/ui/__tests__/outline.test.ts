// What the guided session shows around the exercise in hand (docs/SPEC.md 3.2, DECISIONS.md D44 and
// D50–D53): the parts of the session for »Del 3 af 7«, where each exercise's intro card stands, what
// »Næste« says, and the clock parts the figure follows.
import { describe, expect, test } from 'vitest';
import { PROGRAM } from '../../engine/program.ts';
import type { BlockPlan } from '../../engine/plan.ts';
import type { LoggedSet } from '../../engine/types.ts';
import {
  clubClock,
  emomClock,
  holdClock,
  introHosts,
  loggedLine,
  neckClock,
  partStartedBy,
  sectionOf,
  sessionSections,
  stepCardId,
  upcomingOf,
} from '../session/outline.ts';
import type { Step } from '../session/steps.ts';

function block(blockId: string, extra: Partial<BlockPlan> = {}): BlockPlan {
  return {
    blockId,
    trackId: 'press',
    role: 'pair',
    group: 'pair1',
    stepId: 'press.1',
    sets: 2,
    target: 6,
    unit: 'reps',
    rirPlan: 2,
    restSec: 60,
    inYellow: true,
    ...extra,
  };
}

const power = block('A.power', {
  trackId: 'power_legs',
  role: 'power',
  stepId: 'power_legs.1',
  target: 3,
  group: undefined,
});
const press = block('A.pair1.press', { measureId: 'pushups', sets: 1 });
const pull = block('A.pair1.pull', { trackId: 'pull', stepId: 'pull.1', per: 'side', target: 8 });
const emom = block('A.finisher', {
  trackId: 'burpee_emom',
  role: 'finisher',
  stepId: 'burpee_emom.E1',
  unit: 'emom',
  group: undefined,
  emom: { stepId: 'burpee_emom.E1', minutes: 4, reps: 3 },
});
const neck = block('A.neck', {
  trackId: 'neck',
  role: 'neck',
  stepId: 'neck.N1',
  unit: 'sec',
  sets: 10,
  target: 10,
  group: undefined,
});

const set = (b: BlockPlan, setIndex: number, group: string, extra: Partial<Step> = {}): Step =>
  ({ type: 'set', block: b, setIndex, measure: false, group, ...extra }) as Step;
const rest = (b: BlockPlan, group: string): Step => ({
  type: 'rest',
  seconds: b.restSec,
  group,
  blockId: b.blockId,
});

// Styrke A in short: power (2 sets), pair 1 (press with its measurement, pull per side), EMOM, neck.
const steps: Step[] = [
  set(power, 1, 'Power'),
  rest(power, 'Power'),
  set(power, 2, 'Power'),
  rest(power, 'Power'),
  { type: 'power-q', block: power, group: 'Power' },
  set(press, 1, 'Par 1', { measure: true }),
  rest(press, 'Par 1'),
  set(pull, 1, 'Par 1', { side: 'L' }),
  set(pull, 1, 'Par 1', { side: 'R' }),
  rest(pull, 'Par 1'),
  set(press, 2, 'Par 1'),
  rest(press, 'Par 1'),
  { type: 'emom', block: emom, group: 'Burpees' },
  { type: 'emom-q', block: emom, group: 'Burpees' },
  { type: 'neck', block: neck, group: 'Nakke' },
  { type: 'neck-q', block: neck, group: 'Nakke' },
  { type: 'finish', group: '' },
];

describe('passets dele (»Del 3 af 7«)', () => {
  test('opvarmningen og væg-testen først, derefter hver gruppe i passet i rækkefølge', () => {
    const parts = sessionSections(steps, { wallTest: true, warmup: true });
    expect(parts.map((p) => p.label)).toEqual([
      'Måling',
      'Opvarmning',
      'Power',
      'Par 1',
      'Burpees',
      'Nakke',
    ]);
    // A pause belongs to the part of the set before it; the question after power too.
    expect(sectionOf(parts, 'run', 3)).toBe(3);
    expect(sectionOf(parts, 'run', 4)).toBe(3);
    expect(sectionOf(parts, 'run', 5)).toBe(4);
    expect(sectionOf(parts, 'run', 14)).toBe(6);
    expect(sectionOf(parts, 'warmup', 0)).toBe(2);
    expect(sectionOf(parts, 'wallTest', 0)).toBe(1);
  });
});

describe('en ny del i passet: det store røde tal (SPEC 5, D59)', () => {
  test('den første øvelse i en del starter delen; resten af delen og pauserne gør ikke', () => {
    const parts = sessionSections(steps, { wallTest: true, warmup: true });
    expect(partStartedBy(parts, steps, 0)).toEqual({ at: 3, of: 6, label: 'Power' });
    expect(partStartedBy(parts, steps, 5)).toEqual({
      at: 4,
      of: 6,
      label: 'Par 1',
      note: 'Et sæt af hver øvelse efter tur, med pause imellem',
    });
    expect(partStartedBy(parts, steps, 12)).toEqual({ at: 5, of: 6, label: 'Burpees' });
    expect(partStartedBy(parts, steps, 14)).toEqual({ at: 6, of: 6, label: 'Nakke' });
    // Power's second set, pull in the middle of the pair, a pause and the summary start none.
    for (const index of [1, 2, 7, 10, 11, 16])
      expect(partStartedBy(parts, steps, index)).toBeNull();
  });
});

describe('det loggede sæt over pausens ur (SPEC 5, Bevægelse; D59)', () => {
  const logged = (b: BlockPlan, setIndex: number, extra: Partial<LoggedSet> = {}): LoggedSet => ({
    blockId: b.blockId,
    trackId: b.trackId,
    stepId: b.stepId,
    setIndex,
    rir: 2,
    asPlanned: true,
    ...extra,
  });

  test('sættet, siden og tallet, der blev logget, og smerte, hvis den blev noteret', () => {
    expect(loggedLine(steps[0], [logged(power, 1, { reps: 3 })])).toBe(
      '✓ Logget: sæt 1 af 2 · 3 reps',
    );
    expect(
      loggedLine(steps[8], [
        logged(pull, 1, { side: 'L', reps: 8 }),
        logged(pull, 1, { side: 'R', reps: 7 }),
      ]),
    ).toBe('✓ Logget: sæt 1 af 2, højre side · 7 reps');
    expect(loggedLine(steps[5], [logged(press, 1, { reps: 20, measureId: 'pushups' })])).toBe(
      '✓ Logget: måling · 20 reps',
    );
    expect(loggedLine(steps[10], [logged(press, 2, { reps: 6, pain: 'light' })])).toBe(
      '✓ Logget: sæt 2 af 2 · 6 reps · let smerte',
    );
  });

  test('intet, når skridtet før pausen ikke er et sæt, eller intet er logget', () => {
    expect(loggedLine(steps[1], [logged(power, 1, { reps: 3 })])).toBeNull();
    expect(loggedLine(steps[2], [logged(power, 1, { reps: 3 })])).toBeNull();
    expect(loggedLine(undefined, [])).toBeNull();
  });
});

describe('introkortet (D44)', () => {
  test('i pausen før en øvelses første sæt, og med sin egen nedtælling, når der ingen pause er', () => {
    const hosts = introHosts(steps);
    // Power is the first exercise after the warm-up: no pause before it.
    expect(hosts.get(0)).toEqual({ cardId: 'power_legs.1', target: 0, own: true });
    // The push-ups measurement comes after the question: its intro is in the pause before it.
    expect(hosts.get(3)).toEqual({ cardId: 'measures.pushups', target: 5, own: false });
    expect(hosts.get(6)).toEqual({ cardId: 'pull.1', target: 7, own: false });
    // The press step's first working set: the pause after pull.
    expect(hosts.get(9)).toEqual({ cardId: 'press.1', target: 10, own: false });
    // The EMOM has its intro on its own screen (»Start EMOM«); the neck has no pause before it.
    expect([...hosts.values()].some((h) => h.cardId === 'burpee_emom.E1')).toBe(false);
    expect(hosts.get(14)).toEqual({ cardId: 'neck.N1', target: 14, own: true });
    // Only the first time: power's second set and pull's right side have none.
    expect(hosts.has(2)).toBe(false);
    expect(hosts.has(8)).toBe(false);
  });
});

describe('»Næste«', () => {
  test('navn, sæt og mål; en måling som måling; EMOM og nakke med deres dosis', () => {
    expect(upcomingOf(steps[7] as never)).toMatchObject({
      cardId: 'pull.1',
      pictoId: 'pull.1',
      title: 'Træk · Rygsæk-row med én arm',
      line: 'Sæt 1 af 2 · Venstre side · 8 reps',
    });
    // The measurement in place of the first set is its own exercise: a max test is an ordinary
    // push-up, not the step's tempo push-up (D45).
    expect(upcomingOf(steps[5] as never)).toMatchObject({
      cardId: 'measures.pushups',
      pictoId: 'press.1',
      title: 'Måling · Push-ups',
      line: 'Første sæt i Pres · max',
    });
    expect(upcomingOf(steps[12] as never)).toMatchObject({
      cardId: 'burpee_emom.E1',
      title: 'Burpees · EMOM 4 × 3',
      line: '4 min · 3 i starten af hvert minut',
    });
    expect(upcomingOf(steps[14] as never).title).toBe('Nakke · Hage-ind liggende');
    expect(stepCardId(steps[5] as never)).toBe('measures.pushups');
  });

  test('et skiftevist sæt: begge sider i ét sæt, målet pr. side (P54)', () => {
    const skater = block('A.power', {
      trackId: 'power_legs',
      role: 'power',
      stepId: 'power_legs.3',
      per: 'side',
      target: 3,
      group: undefined,
    });
    expect(upcomingOf(set(skater, 1, 'Power', { alternate: true }) as never)).toMatchObject({
      title: 'Power ben · Skater-hop',
      line: 'Sæt 1 af 2 · skiftevis · 3 pr. side',
    });
  });
});

describe('urets dele, som figuren følger', () => {
  test('et hold: »Klar« i 5 sek og så holdet', () => {
    expect(holdClock(20)).toEqual([
      { kind: 'ready', seconds: 5 },
      { kind: 'work', seconds: 20 },
    ]);
  });

  test('EMOM: »Klar« og et minut pr. minut med en tone 10 sek før det slutter (SPEC 3.2, D57)', () => {
    const { phases, parts } = emomClock(emom);
    expect(parts.map((p) => p.seconds)).toEqual([5, 60, 60, 60, 60]);
    expect(phases.map((p) => p.warn)).toEqual([undefined, 10, 10, 10, 10]);
  });

  test('klubsekvensen: »Klar« og rundens dele, så mange runder som dosis', () => {
    const club = block('B.finisher', {
      trackId: 'club_sequence',
      role: 'finisher',
      stepId: 'club_sequence.C2',
      unit: 'rounds',
      rounds: 2,
    });
    const { phases, parts } = clubClock(club, PROGRAM);
    expect(parts).toHaveLength(1 + 2 * 5);
    expect(phases).toHaveLength(parts.length);
    expect(parts.slice(1, 6).map((p) => p.seconds)).toEqual([3, 3, 3, 8, 4]);
    expect(phases[1]?.label).toBe('Runde 1: Ned til midten. Hold 3 sek.');
  });

  test('nakken: hold med 10 sek pause imellem, og retningen for hvert hold', () => {
    const n3 = block('A.neck', {
      trackId: 'neck',
      role: 'neck',
      stepId: 'neck.N3',
      unit: 'sec',
      sets: 2,
      target: 10,
      per: 'retning',
    });
    const { phases, parts, direction } = neckClock(n3);
    // Klar, then 2 sets × 4 directions, each but the last followed by a 10-second pause.
    expect(parts).toHaveLength(1 + 8 + 7);
    expect(phases.map((p) => p.seconds)).toEqual(parts.map((p) => p.seconds));
    expect(parts[1]).toEqual({ kind: 'work', seconds: 10 });
    expect(parts[2]).toEqual({ kind: 'rest', seconds: 10 });
    // The label says where the neck is; no counter over it counts the pauses too (D54).
    expect(phases[1]?.label).toBe('Sæt 1 af 2 · retning 1 af 4');
    expect(phases[15]?.label).toBe('Sæt 2 af 2 · retning 4 af 4');
    // The pause before a hold shows that hold's direction.
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => direction(i))).toEqual([
      0, 1, 1, 2, 2, 3, 3, 0, 0,
    ]);
  });
});
