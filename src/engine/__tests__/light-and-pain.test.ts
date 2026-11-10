// docs/ENGINE.md 8: traffic light and pain.
import { describe, expect, test } from 'vitest';
import {
  applyTrafficLight,
  defaultAnswers,
  planFor,
  sessionPlan,
  startSession,
  submitSundayCheck,
} from '../index.ts';
import { dayOf, explanationOf, Log, mondays, type Steps } from './helpers/log.ts';

const TUE = (k: number) => dayOf(k, 2);
const WED = (k: number) => dayOf(k, 3);
const THU = (k: number) => dayOf(k, 4);
const FRI = (k: number) => dayOf(k, 5);

function from(k: number, steps: Steps = {}) {
  return new Log().onboard({ completedWeeks: mondays(k), steps });
}

describe('Trafiklys', () => {
  test('S-TL-01: tre gange ja giver den fulde plan og session_started.light = green', () => {
    const log = from(1);
    const state = log.state(TUE(1));
    const full = sessionPlan(log.program, state, 'A', TUE(1));
    const started = startSession(log.ctx, log.events, {
      sessionId: 's1',
      date: TUE(1),
      kind: 'A',
      answers: [true, true, true],
    });
    const begun = started.find((e) => e.type === 'session_started');
    expect(begun).toMatchObject({ light: 'green' });
    if (begun?.type !== 'session_started') throw new Error('not started');
    const planned = full.blocks.filter((b) => b.role !== 'warmup' && b.role !== 'measure');
    expect(begun.blocks.map((b) => b.blockId)).toEqual(planned.map((b) => b.blockId));
    expect(applyTrafficLight(full, 'green')).toEqual({ ...full, light: 'green' });
  });

  test('S-TL-02: ét nej giver gul: kun inYellow-blokke, 2 sæt, 3 i reserve, ingen power, finisher eller nakke', () => {
    const log = from(5);
    const state = log.state(TUE(5));
    const yellow = applyTrafficLight(sessionPlan(log.program, state, 'A', TUE(5)), 'yellow');
    const work = yellow.blocks.filter((b) => b.role !== 'warmup');
    expect(work.map((b) => b.trackId)).toEqual(['press', 'pull', 'legs', 'posterior']);
    for (const b of work) expect(b).toMatchObject({ sets: 2, rirPlan: 3 });
    expect(
      yellow.blocks.some((b) => b.role === 'power' || b.role === 'finisher' || b.role === 'neck'),
    ).toBe(false);
    const started = startSession(log.ctx, log.events, {
      sessionId: 's1',
      date: TUE(5),
      kind: 'A',
      answers: [false, true, true],
    });
    expect(started.find((e) => e.type === 'session_started')).toMatchObject({ light: 'yellow' });
  });

  test('S-TL-03: rød giver kun Open & Strong og gåtur; done = false; ugen er ikke gennemført af passet', () => {
    const log = from(1);
    const { plan, finished } = log.session({ date: TUE(1), light: 'red' });
    expect(plan.blocks).toHaveLength(0);
    expect(finished[0]).toMatchObject({ type: 'session_completed', status: 'red', done: false });
    const state = log.state(TUE(2));
    expect(state.weeks[1]?.completed).toBe(false);
    expect(state.weeks[2]?.pw).toBe(1);
  });

  test('S-TL-04: skarp smerte i går giver »nej« som standard på spørgsmål 2', () => {
    const log = from(1, { press: 'press.2' });
    log.session({ date: TUE(1), sets: { press: { values: [6, 6, 6], rir: 3, pain: 'sharp' } } });
    const defaults = defaultAnswers(log.state(WED(1)), WED(1));
    expect(defaults.answers).toEqual([true, false, true]);
    expect(defaults.painReason).toBe('recent_sharp');
  });

  test('S-TL-05: hård klubtræning i går viser hinten, men svarene er uændrede', () => {
    const log = from(1);
    log.push({ type: 'club_logged', attended: true, hardness: 'hard' }, dayOf(1, 1));
    const defaults = defaultAnswers(log.state(TUE(1)), TUE(1));
    expect(defaults.hardYesterday).toBe(true);
    expect(defaults.answers).toEqual([true, true, true]);
  });

  test('S-TL-06: gul motor-dag giver rolig base 30 min uanset fase', () => {
    for (const k of [0, 5, 9]) {
      const log = from(k);
      const plan = sessionPlan(log.program, log.state(THU(k)), 'motor', THU(k));
      const yellow = applyTrafficLight(plan, 'yellow');
      expect(yellow.motor).toMatchObject({ variant: 'base', minutes: 30 });
      expect(yellow.motor?.phases).toEqual([
        { kind: 'base', label: 'Rolig base i tale-tempo', seconds: 1800 },
      ]);
    }
  });

  test('S-TL-07: uge 5, hård klubtræning onsdag: rolig base med valget »Kør intervallerne alligevel«; »Middel« giver intervaller', () => {
    const log = from(4);
    log.push({ type: 'club_logged', attended: true, hardness: 'hard' }, WED(4));
    const hard = planFor(log.program, log.state(THU(4)), THU(4));
    expect(hard.kind).toBe('motor');
    expect(hard.session?.motor?.variant).toBe('base');
    expect(hard.session?.calmBase).toBe(true);
    expect(hard.session?.intervalsOption?.variant).toBe('intervals');
    const anyway = log.session({ date: THU(4), kind: 'motor', intervalsAnyway: true, open: true });
    expect(anyway.plan.motor?.variant).toBe('intervals');

    const medium = from(4);
    medium.push({ type: 'club_logged', attended: true, hardness: 'medium' }, WED(4));
    const normal = planFor(medium.program, medium.state(THU(4)), THU(4));
    expect(normal.session?.motor?.variant).toBe('intervals');
    expect(normal.session?.intervalsOption).toBeUndefined();
  });
});

describe('Smerte', () => {
  test('S-PAIN-01: skarp smerte på legs.3 giver legs.3 → legs.2 i 7 dage, hits 0 og target min', () => {
    const log = from(1, { legs: { stepId: 'legs.3', target: 8 } });
    const { finished } = log.session({
      date: TUE(1),
      sets: { legs: { values: [8, 8, 8], rir: 2, pain: 'sharp' } },
    });
    expect(finished.find((e) => e.type === 'step_changed' && e.trackId === 'legs')).toMatchObject({
      from: 'legs.3',
      to: 'legs.2',
      reason: 'pain',
      until: dayOf(2, 2),
    });
    expect(explanationOf(finished, 'legs')).toMatch(/\S/);
    expect(log.state(TUE(1)).tracks.legs).toMatchObject({ stepId: 'legs.2', hits: 0, target: 6 });
  });

  test('S-PAIN-02: dag 8 med et grønt pas uden smerte gendanner legs.2 → legs.3 med target min', () => {
    const log = from(1, { legs: { stepId: 'legs.3', target: 8 } });
    log.session({ date: TUE(1), sets: { legs: { values: [8, 8, 8], rir: 2, pain: 'sharp' } } });
    const { finished } = log.session({ date: TUE(2) });
    expect(finished.find((e) => e.type === 'step_changed' && e.trackId === 'legs')).toMatchObject({
      from: 'legs.2',
      to: 'legs.3',
      reason: 'restore',
    });
    expect(log.state(TUE(2)).tracks.legs).toMatchObject({
      stepId: 'legs.3',
      target: 6,
      tempDown: undefined,
    });
  });

  test('S-PAIN-03: ny skarp smerte på dag 4 forlænger til 7 dage fra dag 4 og viser Fysio-rådet', () => {
    const log = from(1, { legs: { stepId: 'legs.3', target: 8 } });
    log.session({ date: TUE(1), sets: { legs: { values: [8, 8, 8], rir: 2, pain: 'sharp' } } });
    const { finished } = log.session({
      date: FRI(1),
      kind: 'A',
      sets: { legs: { values: [6, 6, 6], rir: 2, pain: 'sharp' } },
    });
    expect(finished.find((e) => e.type === 'step_changed' && e.trackId === 'legs')).toMatchObject({
      from: 'legs.2',
      to: 'legs.2',
      reason: 'pain',
      until: dayOf(2, 5),
    });
    const state = log.state(FRI(1));
    expect(state.tracks.legs?.tempDown).toMatchObject({
      until: dayOf(2, 5),
      originalStepId: 'legs.3',
      physio: true,
    });
    expect(planFor(log.program, state, dayOf(1, 6)).flags).toContainEqual({
      type: 'physio',
      trackId: 'legs',
    });
    expect(explanationOf(finished, 'legs')).toMatch(/undersøgt/);
  });

  test('S-PAIN-04: skarp smerte på press.1 holder trinnet med flaget »lettere variant«', () => {
    const log = from(1, { press: { stepId: 'press.1', target: 8 } });
    const { finished } = log.session({
      date: TUE(1),
      sets: { press: { values: [8, 8, 8], rir: 2, pain: 'sharp' } },
    });
    expect(finished.find((e) => e.type === 'step_changed' && e.trackId === 'press')).toMatchObject({
      from: 'press.1',
      to: 'press.1',
      reason: 'pain',
    });
    const state = log.state(TUE(1));
    expect(state.tracks.press?.tempDown).toMatchObject({
      lighter: true,
      originalStepId: 'press.1',
    });
    const block = planFor(log.program, state, TUE(2)).session?.blocks.find(
      (b) => b.trackId === 'press',
    );
    expect(block?.tempDown?.lighter).toBe(true);
    expect(explanationOf(finished, 'press')).toMatch(/lettere variant/);
  });

  test('S-PAIN-05: søndagstjekket med smerte i lysken behandles som skarp smerte', () => {
    const log = from(1, { groin: 'groin.2' });
    const sunday = dayOf(1, 7);
    const events = log.add(
      submitSundayCheck(log.ctx, log.events, { date: sunday, painTracks: ['groin'], tooHeavy: [] }),
    );
    expect(events.find((e) => e.type === 'step_changed')).toMatchObject({
      trackId: 'groin',
      from: 'groin.2',
      to: 'groin.1',
      reason: 'pain',
      until: dayOf(2, 7),
    });
    expect(defaultAnswers(log.state(TUE(2)), TUE(2)).answers[1]).toBe(false);
  });

  test('S-PAIN-07: »for tungt« i søndagstjekket går ét trin ned som dit valg, ikke på første trin og ikke ved smerte', () => {
    const log = from(1, {
      legs: { stepId: 'legs.3', target: 9 },
      press: 'press.1',
      groin: 'groin.2',
    });
    const sunday = dayOf(1, 7);
    const events = log.add(
      submitSundayCheck(log.ctx, log.events, {
        date: sunday,
        painTracks: ['groin'],
        tooHeavy: ['legs', 'press', 'groin'],
      }),
    );
    const changes = events.filter((e) => e.type === 'step_changed');
    expect(changes.filter((e) => e.trackId === 'legs')).toEqual([
      expect.objectContaining({ from: 'legs.3', to: 'legs.2', by: 'user', reason: 'user_choice' }),
    ]);
    expect(changes.some((e) => e.trackId === 'press')).toBe(false);
    expect(changes.filter((e) => e.trackId === 'groin')).toEqual([
      expect.objectContaining({ from: 'groin.2', to: 'groin.1', by: 'engine', reason: 'pain' }),
    ]);
    expect(explanationOf(events, 'legs')).toMatch(/for tungt/);
    const state = log.state(dayOf(2, 2));
    expect(state.tracks.legs).toMatchObject({ stepId: 'legs.2', hits: 0, target: 6 });
    expect(state.tracks.legs?.tempDown).toBeUndefined();
    expect(state.tracks.press?.stepId).toBe('press.1');
    expect(state.sundayChecks).toEqual([
      expect.objectContaining({ weekStart: dayOf(1, 1), tooHeavy: ['legs', 'press', 'groin'] }),
    ]);
  });

  test('S-PAIN-08: et nyt søndagstjek for samme uge afløser det forrige uden at tage et spor ned igen', () => {
    const log = from(1, { groin: 'groin.2', legs: { stepId: 'legs.3', target: 9 } });
    const sunday = dayOf(1, 7);
    const first = { date: sunday, painTracks: ['groin'], tooHeavy: ['legs'] };
    log.add(submitSundayCheck(log.ctx, log.events, first));
    // The same week again, as on Monday with »Ret søndagstjekket«: still dated Sunday.
    const again = log.add(submitSundayCheck(log.ctx, log.events, { ...first, sleepAvg: 7 }));
    expect(again.filter((e) => e.type === 'step_changed')).toEqual([]);
    expect(again.filter((e) => e.type === 'sunday_check')).toHaveLength(1);
    const tuesday = dayOf(2, 2);
    let state = log.state(tuesday);
    expect(state.sundayChecks).toEqual([
      expect.objectContaining({ weekStart: dayOf(1, 1), sleepAvg: 7, painTracks: ['groin'] }),
    ]);
    expect(state.tracks.groin?.tempDown).toMatchObject({ until: dayOf(2, 7), physio: false });
    expect(state.tracks.legs?.stepId).toBe('legs.2');
    expect(planFor(log.program, state, tuesday).flags).not.toContainEqual({
      type: 'physio',
      trackId: 'groin',
    });
    expect(defaultAnswers(state, tuesday).answers[1]).toBe(false);

    // A newer check without pain replaces it: question 2 is »ja« again, the step stays down.
    log.add(submitSundayCheck(log.ctx, log.events, { date: sunday, painTracks: [], tooHeavy: [] }));
    state = log.state(tuesday);
    expect(defaultAnswers(state, tuesday).answers[1]).toBe(true);
    expect(state.tracks.groin?.stepId).toBe('groin.1');
    expect(state.tracks.legs?.stepId).toBe('legs.2');
    expect(state.sundayChecks).toHaveLength(1);
  });

  test('S-PAIN-09: »for tungt« på en stige i en smerteperiode gør det sænkede trin til dit trin uden at gå længere ned', () => {
    // Sharp pain on Tuesday takes legs.3 down to legs.2 for a week.
    const log = from(1, { legs: { stepId: 'legs.3', target: 8 } });
    log.session({ date: TUE(1), sets: { legs: { values: [8, 8, 8], rir: 2, pain: 'sharp' } } });
    const sunday = dayOf(1, 7);
    const events = log.add(
      submitSundayCheck(log.ctx, log.events, { date: sunday, painTracks: [], tooHeavy: ['legs'] }),
    );
    expect(events.filter((e) => e.type === 'step_changed')).toEqual([
      expect.objectContaining({
        trackId: 'legs',
        from: 'legs.2',
        to: 'legs.2',
        by: 'user',
        reason: 'user_choice',
      }),
    ]);
    expect(explanationOf(events, 'legs')).toMatch(/trin 3 var for tungt/);
    expect(log.state(sunday).tracks.legs).toMatchObject({ stepId: 'legs.2', tempDown: undefined });
    // Two weeks later, after green sessions past the period: no restore to legs.3.
    log.session({ date: TUE(2) });
    log.session({ date: TUE(3) });
    expect(log.state(TUE(3)).tracks.legs?.stepId).toBe('legs.2');

    // The same from a check corrected from pain to »for tungt«; a third check writes nothing.
    const corrected = from(1, { legs: { stepId: 'legs.3', target: 8 } });
    const check = (painTracks: string[], tooHeavy: string[]) =>
      corrected.add(
        submitSundayCheck(corrected.ctx, corrected.events, { date: sunday, painTracks, tooHeavy }),
      );
    expect(check(['legs'], []).filter((e) => e.type === 'step_changed')).toEqual([
      expect.objectContaining({ from: 'legs.3', to: 'legs.2', reason: 'pain' }),
    ]);
    expect(check([], ['legs']).filter((e) => e.type === 'step_changed')).toEqual([
      expect.objectContaining({ from: 'legs.2', to: 'legs.2', reason: 'user_choice' }),
    ]);
    expect(check([], ['legs']).filter((e) => e.type === 'step_changed')).toEqual([]);
    const state = corrected.state(dayOf(2, 2));
    expect(state.tracks.legs).toMatchObject({ stepId: 'legs.2', tempDown: undefined });
  });

  test('S-PAIN-10: et tredje søndagstjek for ugen tager ikke et spor ned igen, som et tidligere tjek har taget ned', () => {
    const log = from(1, { groin: 'groin.2' });
    const sunday = dayOf(1, 7);
    const check = (painTracks: string[]) =>
      log
        .add(submitSundayCheck(log.ctx, log.events, { date: sunday, painTracks, tooHeavy: [] }))
        .filter((e) => e.type === 'step_changed');
    expect(check(['groin'])).toHaveLength(1);
    expect(check([])).toEqual([]);
    expect(check(['groin'])).toEqual([]);
    const state = log.state(TUE(2));
    expect(state.tracks.groin?.tempDown).toMatchObject({ until: dayOf(2, 7), physio: false });
    expect(planFor(log.program, state, TUE(2)).flags).not.toContainEqual({
      type: 'physio',
      trackId: 'groin',
    });
    expect(defaultAnswers(state, TUE(2)).answers[1]).toBe(false);
  });

  test('S-PAIN-11: et søndagstjek gemt igen efter et pas med skarp smerte gør ikke smertens trin permanent', () => {
    const log = from(1, { legs: { stepId: 'legs.3', target: 8 } });
    const sunday = dayOf(1, 7);
    const answers = { date: sunday, painTracks: [], tooHeavy: ['legs'] };
    log.add(submitSundayCheck(log.ctx, log.events, answers));
    expect(log.state(sunday).tracks.legs?.stepId).toBe('legs.2');
    // A Styrke A moved to the same Sunday, with sharp pain in legs: legs.1 for a week.
    log.session({
      date: sunday,
      kind: 'A',
      sets: { legs: { values: [6, 6, 6], rir: 2, pain: 'sharp' } },
    });
    expect(log.state(sunday).tracks.legs).toMatchObject({
      stepId: 'legs.1',
      tempDown: { originalStepId: 'legs.2' },
    });
    // The same answers again, as with »Ret søndagstjekket« on Monday: nothing happens.
    const again = log.add(submitSundayCheck(log.ctx, log.events, { ...answers, sleepAvg: 7 }));
    expect(again.filter((e) => e.type === 'step_changed')).toEqual([]);
    expect(log.state(dayOf(2, 1)).tracks.legs?.tempDown).toMatchObject({
      originalStepId: 'legs.2',
    });
    // The first green session after the period gives legs.2 back.
    const { finished } = log.session({ date: TUE(3) });
    expect(finished.find((e) => e.type === 'step_changed' && e.trackId === 'legs')).toMatchObject({
      from: 'legs.1',
      to: 'legs.2',
      reason: 'restore',
    });
  });

  test('S-PAIN-06: let smerte ændrer intet trin, men står i historikken', () => {
    const log = from(1, { press: { stepId: 'press.2', target: 8 } });
    const { finished } = log.session({
      date: TUE(1),
      sets: { press: { values: [8, 8, 8], rir: 3, pain: 'light' } },
    });
    expect(finished.some((e) => e.type === 'step_changed')).toBe(false);
    const session = log.state(TUE(1)).sessions[0];
    expect(session?.sets.some((s) => s.trackId === 'press' && s.pain === 'light')).toBe(true);
    expect(log.state(TUE(1)).tracks.press?.stepId).toBe('press.2');
  });
});
