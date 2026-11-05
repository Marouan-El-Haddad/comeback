// docs/ENGINE.md 8: measurements, levels, catalogue, Hero, boss, Turbo, Open & Strong, onboarding.
import { describe, expect, test } from 'vitest';
import {
  heroStatus,
  impressStatus,
  measureLevel,
  osCue,
  planFor,
  sideBranchStatus,
  turboVisible,
} from '../index.ts';
import { dayOf, Log, mondays, type Steps } from './helpers/log.ts';

const TUE = (k: number) => dayOf(k, 2);
const THU = (k: number) => dayOf(k, 4);
const FRI = (k: number) => dayOf(k, 5);

function from(k: number, steps: Steps = {}) {
  return new Log().onboard({ completedWeeks: mondays(k), steps });
}

describe('Målinger, niveauer og katalog', () => {
  test('S-MEAS-01: uge 4 tirsdag: væg-test før opvarmning, push-ups og bord-rows som første sæt, burpee-test i stedet for EMOM; målesæt tæller ikke', () => {
    const log = from(3);
    const plan = planFor(log.program, log.state(TUE(3)), TUE(3));
    expect(plan.pw).toBe(4);
    const blocks = plan.session?.blocks ?? [];
    expect(blocks[0]).toMatchObject({ role: 'measure', measureId: 'wall_test' });
    expect(blocks[1]).toMatchObject({ role: 'warmup' });
    expect(blocks.find((b) => b.trackId === 'press')).toMatchObject({
      measureId: 'pushups',
      sets: 1,
    });
    expect(blocks.find((b) => b.trackId === 'pull')).toMatchObject({
      measureId: 'table_rows',
      sets: 1,
    });
    expect(blocks.some((b) => b.unit === 'emom')).toBe(false);
    const test3 = blocks.findIndex((b) => b.measureId === 'burpee_3min');
    expect(test3).toBeGreaterThan(blocks.findIndex((b) => b.trackId === 'calf'));

    // Week 1 is not light: the measurement set (rir 0) does not stop a hit on the working set.
    const week1 = new Log().onboard({ steps: { press: { stepId: 'press.1', target: 12 } } });
    week1.session({ date: TUE(0), measures: { pushups: 30 } });
    const measured = week1.events.find((e) => e.type === 'set_logged' && e.measureId === 'pushups');
    expect(measured).toMatchObject({ rir: 0, reps: 30 });
    expect(week1.state(TUE(0)).tracks.press?.hits).toBe(1);
  });

  test('S-MEAS-02: 52 push-ups er Stærk; væg-test 1 cm er Stærk (lavere er bedre)', () => {
    const log = new Log();
    expect(measureLevel(log.program, 'pushups', 52)).toBe('staerk');
    expect(measureLevel(log.program, 'wall_test', 1)).toBe('staerk');
    expect(measureLevel(log.program, 'wall_test', 0)).toBe('imponerende');
    expect(measureLevel(log.program, 'wall_test', 5)).toBeNull();
    expect(measureLevel(log.program, 'pushups', 24)).toBeNull();
  });

  test('S-MEAS-03: runde 1 uge 1: base-check torsdag og målinger tirsdag og fredag; runde 2 uge 5: ingen', () => {
    const log = new Log().onboard();
    const state = log.state(TUE(0));
    expect(planFor(log.program, state, THU(0)).session?.motor?.measureId).toBe('base_check');
    expect(
      planFor(log.program, state, TUE(0))
        .session?.blocks.filter((b) => b.measureId)
        .map((b) => b.measureId),
    ).toEqual(['wall_test', 'pushups', 'table_rows']);
    expect(
      planFor(log.program, state, FRI(0))
        .session?.blocks.filter((b) => b.measureId)
        .map((b) => b.measureId),
    ).toEqual(['pike', 'hollow', 'side_plank', 'wall_sit', 'balance']);
    const round2 = from(12);
    const s2 = round2.state(TUE(12));
    expect(s2.round).toBe(2);
    for (const day of [TUE(12), THU(12), FRI(12)]) {
      const plan = planFor(round2.program, s2, day);
      expect(plan.session?.blocks.some((b) => b.measureId)).toBe(false);
      expect(plan.session?.motor?.measureId).toBeUndefined();
    }
  });

  test('S-IMP-01: press.2 og shoulder.2 låser deficit og wall walks op, diamond kræver 25 push-ups; shoulder.1 låser wall walks', () => {
    const log = new Log().onboard({ steps: { press: 'press.2', shoulder: 'shoulder.2' } });
    const state = log.state(TUE(0));
    const side = Object.fromEntries(
      sideBranchStatus(log.program, state).map((u) => [u.item.id, u.unlocked]),
    );
    const impress = Object.fromEntries(
      impressStatus(log.program, state).map((u) => [u.item.id, u.unlocked]),
    );
    expect(side.deficit).toBe(true);
    expect(side.knuckles).toBe(true);
    expect(side.diamond).toBe(false);
    expect(impress.wall_walks).toBe(true);
    log.push(
      { type: 'measurement_logged', measureId: 'pushups', value: 25, programWeek: 1, round: 1 },
      TUE(0),
    );
    expect(
      Object.fromEntries(
        sideBranchStatus(log.program, log.state(TUE(0))).map((u) => [u.item.id, u.unlocked]),
      ).diamond,
    ).toBe(true);

    const low = new Log().onboard({ steps: { press: 'press.2', shoulder: 'shoulder.1' } });
    const lowImpress = Object.fromEntries(
      impressStatus(low.program, low.state(TUE(0))).map((u) => [u.item.id, u.unlocked]),
    );
    expect(lowImpress.wall_walks).toBe(false);
  });

  test('S-HERO-01: press.6 med 3 reps pr. side giver hint for etarms push-up; afkrydset først, når brugeren gør det', () => {
    const log = from(1, { press: { stepId: 'press.6', target: 3 } });
    const id = log.program.heroes[0]?.id ?? '';
    expect(heroStatus(log.program, log.state(TUE(1))).find((h) => h.item.id === id)?.hint).toBe(
      false,
    );
    log.session({ date: TUE(1), sets: { press: { values: [3, 3, 3], rir: 3 } } });
    const hero = heroStatus(log.program, log.state(TUE(1))).find((h) => h.item.id === id);
    expect(hero).toMatchObject({ hint: true, checked: false });
    log.push({ type: 'hero_checked', heroId: id, checked: true }, TUE(1));
    expect(heroStatus(log.program, log.state(TUE(1))).find((h) => h.item.id === id)?.checked).toBe(
      true,
    );
  });

  test('S-BOSS-01: uge 11, grøn og ingen begivenhed i morgen giver boss; uge 10 nej; boss for 20 dage siden nej', () => {
    const log = from(10);
    expect(planFor(log.program, log.state(TUE(10)), TUE(10)).session?.bossOffered).toBe(true);
    const ten = from(9);
    expect(planFor(ten.program, ten.state(TUE(9)), TUE(9)).session?.bossOffered).toBe(false);
    const recent = from(10);
    recent.push(
      { type: 'boss_logged', bossId: 'x', result: '15 min', level: 'staerk' },
      dayOf(7, 3),
    ); // 20 days before
    expect(planFor(recent.program, recent.state(TUE(10)), TUE(10)).session?.bossOffered).toBe(
      false,
    );
  });

  test('S-TURBO-01: Turbo er skjult i uge 4 og synlig fra uge 5', () => {
    expect(turboVisible(4, 1)).toBe(false);
    expect(turboVisible(5, 1)).toBe(true);
    const log = from(3);
    expect(planFor(log.program, log.state(TUE(3)), TUE(3)).flags).not.toContainEqual({
      type: 'turbo',
    });
    const five = from(4);
    expect(planFor(five.program, five.state(TUE(4)), TUE(4)).flags).toContainEqual({
      type: 'turbo',
    });
  });
});

describe('Open & Strong og indfasning', () => {
  test('S-OS-01: fire uger med mindst 5 × Open & Strong skifter Y-løftets cue til vandflasker', () => {
    const log = new Log().onboard();
    const before = osCue(log.program, log.state(TUE(4)), '3');
    for (let k = 0; k < 4; k++) {
      for (let d = 1; d <= 5; d++) log.push({ type: 'os_done' }, dayOf(k, d));
    }
    expect(log.state(TUE(4)).completedOsWeeks).toBe(4);
    const after = osCue(log.program, log.state(TUE(4)), '3');
    expect(after).not.toBe(before);
    expect(after).toMatch(/vandflasker/);
  });

  test('S-BACKFILL-01: onboarding med press.2 og target 9 giver pres trin 2 med 9 reps i første plan', () => {
    const log = new Log().onboard({ steps: { press: { stepId: 'press.2', target: 9 } } });
    const block = planFor(log.program, log.state(TUE(0)), TUE(0)).session?.blocks.find(
      (b) => b.trackId === 'press',
    );
    expect(block).toMatchObject({ stepId: 'press.2', target: 9 });
  });
});
