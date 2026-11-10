import { describe, expect, it } from 'vitest';
import { chooseStep, PROGRAM, submitSundayCheck } from '../../engine/index.ts';
import { dayOf, Log, mondays } from '../../engine/__tests__/helpers/log.ts';
import {
  clubAsks,
  clubEnd,
  clubLogOn,
  clubSummary,
  gradeOnly,
  minutesIn,
  standingChanges,
  standingText,
  sundayDue,
  trackDistance,
  type ClubAsk,
} from '../life.ts';
import {
  checkEffects,
  filmWeek,
  heavyChoices,
  heavyLabel,
  heavyStep,
  lightPains,
  painChoices,
  parseSleep,
  readyLadders,
} from '../life/choices.ts';

// The club log and the Sunday check on I dag (docs/SPEC.md 4.6, 4.7, DECISIONS.md D63).
const MON = '2026-11-09';
const WED = '2026-11-11';
const THU = '2026-11-12';
const SAT = '2026-11-14';
const SUN = '2026-11-15';

function onboarded(date = '2026-11-08') {
  return new Log().onboard({ date });
}

const summary = (asks: ClubAsk[]) =>
  asks.map((a) => ({ date: a.date, yesterday: a.yesterday, ended: a.ended, logged: !!a.log }));

describe('the time of day in Copenhagen', () => {
  it('reads the clock in Copenhagen whatever the device says, also in summer time', () => {
    expect(minutesIn(Date.parse('2026-11-11T18:45:00Z'))).toBe(19 * 60 + 45);
    expect(minutesIn(Date.parse('2026-11-11T23:30:00Z'))).toBe(30);
    expect(minutesIn(Date.parse('2027-06-01T17:45:00Z'))).toBe(19 * 60 + 45);
  });

  it('finds the end of the club time in the programme', () => {
    expect(clubEnd('18–19.30')).toBe(19 * 60 + 30);
    expect(clubEnd('10–11')).toBe(11 * 60);
    expect(clubEnd('17-18:15')).toBe(18 * 60 + 15);
    expect(clubEnd(undefined)).toBeNull();
    expect(clubEnd('aften')).toBeNull();
    expect(PROGRAM.club.days.every((d) => clubEnd(d.time) !== null)).toBe(true);
  });
});

describe('the club log on I dag (SPEC 4.6)', () => {
  it('asks after the end of the club time, and the next day', () => {
    const log = onboarded();
    const state = log.state(WED);
    expect(summary(clubAsks(PROGRAM, state, WED, 19 * 60 + 29))).toEqual([
      { date: WED, yesterday: false, ended: false, logged: false },
    ]);
    expect(summary(clubAsks(PROGRAM, state, WED, 19 * 60 + 30))).toEqual([
      { date: WED, yesterday: false, ended: true, logged: false },
    ]);
    expect(summary(clubAsks(PROGRAM, log.state(THU), THU, 8 * 60))).toEqual([
      { date: WED, yesterday: true, ended: true, logged: false },
    ]);
    // Saturday's club time is 10–11; nothing is asked on a day without club, or two days later.
    expect(clubAsks(PROGRAM, log.state(SAT), SAT, 11 * 60)[0]?.ended).toBe(true);
    expect(clubAsks(PROGRAM, log.state('2026-11-10'), '2026-11-10', 20 * 60)).toEqual([
      expect.objectContaining({ date: MON, yesterday: true }),
    ]);
    expect(clubAsks(PROGRAM, log.state('2026-11-13'), '2026-11-13', 20 * 60)).toEqual([]);
  });

  it('asks all day on a club day without a club time', () => {
    const log = onboarded();
    log.push({ type: 'schedule_changed', clubDays: [1, 3, 5, 6], clinch: false }, '2026-11-08');
    const friday = '2026-11-13';
    expect(summary(clubAsks(PROGRAM, log.state(friday), friday, 7 * 60))).toEqual([
      { date: friday, yesterday: false, ended: true, logged: false },
    ]);
  });

  it('does not ask on a day with a status, before the start or before the phase-in', () => {
    const ill = onboarded();
    ill.push({ type: 'status_set', status: 'ill', from: WED, to: WED }, WED);
    expect(clubAsks(PROGRAM, ill.state(WED), WED, 20 * 60)).toEqual([]);
    expect(clubAsks(PROGRAM, ill.state(THU), THU, 8 * 60)).toEqual([]);
    const closed = onboarded();
    closed.push({ type: 'status_set', status: 'club_closed', from: WED, to: WED }, WED);
    expect(clubAsks(PROGRAM, closed.state(WED), WED, 20 * 60)).toEqual([]);
    // Monday 2 November is before the programme starts; a phase-in on Tuesday 17/11 does not ask
    // about Monday 16/11.
    const early = onboarded('2026-10-30');
    expect(clubAsks(PROGRAM, early.state('2026-11-02'), '2026-11-02', 20 * 60)).toEqual([]);
    const late = onboarded('2026-11-17');
    expect(clubAsks(PROGRAM, late.state('2026-11-17'), '2026-11-17', 8 * 60)).toEqual([]);
    expect(clubAsks(PROGRAM, new Log().state(WED), WED, 20 * 60)).toEqual([]);
  });

  it('reads what was logged, later values over earlier ones, and says it in words', () => {
    const log = onboarded();
    log.push(
      {
        type: 'club_logged',
        attended: true,
        content: ['teknik', 'sparring'],
        hardness: 'hard',
        freshness: 'flat',
      },
      SAT,
    );
    log.push({ type: 'club_logged', attended: true, technique: 7 }, SAT);
    const logged = clubLogOn(log.state(SUN), SAT);
    expect(logged).toEqual({
      attended: true,
      content: ['teknik', 'sparring'],
      hardness: 'hard',
      freshness: 'flat',
      technique: 7,
    });
    expect(logged && clubSummary(logged)).toBe('Hård · Flad · Teknik, Sparring · karakter 7');
    expect(clubSummary({ attended: false, content: [] })).toBe('du var der ikke');
    expect(clubSummary({ attended: true, content: [] })).toBe('mødt');
    expect(clubAsks(PROGRAM, log.state(SUN), SUN, 8 * 60)[0]?.log?.technique).toBe(7);
    expect(clubLogOn(log.state(SUN), WED)).toBeNull();
  });
});

describe('the Sunday check on I dag (SPEC 4.7)', () => {
  it('is due on Sunday and on the Monday after, for the week that ends on the Sunday', () => {
    const log = onboarded();
    expect(sundayDue(log.state(SUN), SUN)).toEqual({
      sunday: SUN,
      weekStart: MON,
      late: false,
      check: null,
    });
    expect(sundayDue(log.state('2026-11-16'), '2026-11-16')).toMatchObject({
      sunday: SUN,
      weekStart: MON,
      late: true,
    });
    expect(sundayDue(log.state('2026-11-17'), '2026-11-17')).toBeNull();
    expect(sundayDue(log.state(SAT), SAT)).toBeNull();
    // Monday 9/11: the Sunday before is before the programme starts.
    expect(sundayDue(log.state(MON), MON)).toBeNull();
  });

  it('is not due for a week before the phase-in, and shows the saved check', () => {
    expect(sundayDue(onboarded('2026-11-16').state('2026-11-16'), '2026-11-16')).toBeNull();
    const log = onboarded();
    log.push(
      { type: 'sunday_check', weekStart: MON, sleepAvg: 7.5, painTracks: [], tooHeavy: [] },
      SUN,
    );
    expect(sundayDue(log.state('2026-11-16'), '2026-11-16')?.check).toMatchObject({
      sleepAvg: 7.5,
    });
  });
});

describe('the Sunday check’s fields', () => {
  it('reads the hours of sleep as a number with a comma or a point', () => {
    expect(parseSleep('')).toBeNull();
    expect(parseSleep(' 7 ')).toBe(7);
    expect(parseSleep('6,5')).toBe(6.5);
    expect(parseSleep('7.25')).toBe(7.3);
    expect(parseSleep('0')).toBe('invalid');
    expect(parseSleep('25')).toBe('invalid');
    expect(parseSleep('syv')).toBe('invalid');
  });

  it('offers the exercises of Styrke A and B once each under pain', () => {
    const groups = painChoices(PROGRAM);
    expect(groups.map((g) => g.title)).toEqual(['Styrke A', 'Styrke B']);
    const ids = groups.flatMap((g) => g.trackIds);
    expect(new Set(ids).size).toBe(ids.length);
    expect(groups[0]?.trackIds).toEqual(expect.arrayContaining(['press', 'legs', 'groin', 'neck']));
    expect(groups[1]?.trackIds).toEqual(
      expect.arrayContaining(['shoulder', 'core_side', 'wallsit']),
    );
    expect(ids).not.toContain('burpee_skill');
  });

  it('offers »For tungt?« for the ladders and power tracks with a step below', () => {
    const log = new Log().onboard({
      completedWeeks: mondays(1),
      steps: { legs: 'legs.3', burpee_emom: 'burpee_emom.E2', calf: 'calf.1' },
    });
    const state = log.state(SUN);
    expect(heavyChoices(PROGRAM, state, [])).toEqual(['legs', 'burpee_emom']);
    expect(heavyChoices(PROGRAM, state, ['press'])).toEqual(['press', 'legs', 'burpee_emom']);
  });

  it('lists the ladders ready for the next step: moved up this week or one session short', () => {
    const log = new Log().onboard({
      completedWeeks: mondays(1),
      steps: {
        press: { stepId: 'press.1', target: 12 },
        pull: { stepId: 'pull.2', target: 12 },
      },
    });
    const week = dayOf(1, 1);
    // Tuesday: a hit on press and pull at the top of the range, and clean EMOM minutes.
    log.session({ date: dayOf(1, 2), sets: { press: [12, 12, 12], pull: [12, 12, 12] } });
    const ready = readyLadders(PROGRAM, log.state(dayOf(1, 7)), week);
    expect(ready.map((r) => r.trackId)).toEqual(['press', 'pull', 'burpee_emom']);
    expect(ready[0]?.text).toBe('1 pas mere med alle sæt på 12 og 2 i reserve');
    expect(ready[2]?.text).toBe('rykker et trin op ved næste EMOM-pas');
    // Friday: the second hit on press moves it up, and the A session takes the EMOM's step-up;
    // pull is not logged.
    log.session({ date: dayOf(1, 5), kind: 'A', only: ['press'], sets: { press: [12, 12, 12] } });
    const after = readyLadders(PROGRAM, log.state(dayOf(1, 7)), week);
    expect(after.find((r) => r.trackId === 'press')?.text).toBe('nu trin 2, rykket op fredag');
    expect(after.find((r) => r.trackId === 'pull')?.text).toMatch(/^1 pas mere/);
    expect(after.find((r) => r.trackId === 'burpee_emom')?.text).toBe(
      'nu trin E2, rykket op fredag',
    );
    // The week after: only what is still one session short.
    const next = readyLadders(PROGRAM, log.state(dayOf(2, 7)), dayOf(2, 1));
    expect(next.map((r) => r.trackId)).toEqual(['pull']);
  });

  it('shows the week’s light pain, and »Film dig selv« every other week', () => {
    const log = new Log().onboard({ completedWeeks: mondays(1) });
    log.session({
      date: dayOf(1, 2),
      sets: { press: { values: [6, 6, 6], rir: 3, pain: 'light' } },
    });
    expect(lightPains(log.state(dayOf(1, 7)), dayOf(1, 1))).toEqual([
      { trackId: 'press', date: dayOf(1, 2) },
    ]);
    expect(lightPains(log.state(dayOf(2, 7)), dayOf(2, 1))).toEqual([]);
    const state = log.state(SUN);
    expect(filmWeek(state, SUN)).toBe(true);
    expect(filmWeek(state, '2026-11-22')).toBe(false);
    expect(filmWeek(state, '2026-11-29')).toBe(true);
  });
});

// The review of P5a (docs/reviews/nat3-p5a-livet.md, DECISIONS.md D65).
describe('after the review of P5a', () => {
  it('M3: the grade from the Sunday check alone does not answer yesterday’s club card', () => {
    const log = onboarded();
    // Written on Sunday, as the Sunday check writes it (the helper's clock only goes forward).
    log.push({ type: 'os_done' }, SUN);
    log.push({ type: 'club_logged', attended: true, technique: 4, content: [] }, SAT);
    const [sunday] = clubAsks(PROGRAM, log.state(SUN), SUN, 9 * 60);
    expect(sunday).toMatchObject({ date: SAT, yesterday: true, answered: false });
    expect(sunday?.log && gradeOnly(sunday.log)).toBe(true);
    // The rest of the club log answers it; a log on the club day itself always does.
    log.push({ type: 'club_logged', attended: true, hardness: 'medium' }, SAT);
    expect(clubAsks(PROGRAM, log.state(SUN), SUN, 9 * 60)[0]?.answered).toBe(true);
    const sameDay = onboarded();
    sameDay.push({ type: 'club_logged', attended: true, technique: 7 }, SAT);
    expect(clubAsks(PROGRAM, sameDay.state(SAT), SAT, 20 * 60)[0]?.answered).toBe(true);
  });

  it('M1: »For tungt?« in a pain period is about the step before the pain, which the period would bring back', () => {
    const log = new Log().onboard({
      completedWeeks: mondays(1),
      steps: { legs: { stepId: 'legs.3', target: 8 } },
    });
    log.session({
      date: dayOf(1, 2),
      sets: { legs: { values: [8, 8, 8], rir: 2, pain: 'sharp' } },
    });
    const state = log.state(dayOf(1, 7));
    expect(state.tracks.legs?.stepId).toBe('legs.2');
    expect(heavyStep(state, 'legs')).toBe('legs.3');
    expect(heavyLabel(PROGRAM, state, 'legs')).toBe('Ben · trin 3');
    expect(heavyChoices(PROGRAM, state, [])).toContain('legs');
    const input = { date: dayOf(1, 7), painTracks: [], tooHeavy: ['legs'] };
    expect(checkEffects(PROGRAM, log.events, state, input).get('legs')).toBe(
      'Ben bliver på trin 2 og kommer ikke tilbage til trin 3 – dit eget valg.',
    );
  });

  it('M2: the screen says what saving does, and nothing a correction would not do', () => {
    const log = new Log().onboard({
      completedWeeks: mondays(1),
      steps: { legs: { stepId: 'legs.3', target: 8 }, groin: 'groin.1', press: 'press.2' },
    });
    const sunday = dayOf(1, 7);
    const first = { date: sunday, painTracks: ['groin', 'press'], tooHeavy: ['legs'] };
    let effects = checkEffects(PROGRAM, log.events, log.state(sunday), first);
    expect(effects.get('groin')).toBe('Lyske får en lettere variant til 29. november.');
    expect(effects.get('press')).toBe('Pres går fra trin 2 til trin 1 til 29. november.');
    expect(effects.get('legs')).toBe('Ben går fra trin 3 til trin 2 – dit eget valg.');
    log.add(submitSundayCheck(log.ctx, log.events, first));
    // The same answers again: nothing more happens, and the screen says so.
    effects = checkEffects(PROGRAM, log.events, log.state(sunday), first);
    expect(effects.get('groin')).toBe('Lyske står allerede nede fra søndagstjekket.');
    expect(effects.get('legs')).toBe('Ben står allerede nede fra søndagstjekket.');
    // A correction without them: the changes still stand, also on the card.
    log.add(submitSundayCheck(log.ctx, log.events, { date: sunday, painTracks: [], tooHeavy: [] }));
    const state = log.state(sunday);
    const due = sundayDue(state, sunday);
    if (!due) throw new Error('no check');
    const standing = standingChanges(PROGRAM, state, due, (id) => trackDistance(state, id));
    expect(standing.map((c) => standingText(PROGRAM, c))).toEqual([
      'Lyske – lettere variant til 29. november (smerte)',
      'Pres – midlertidigt trin til 29. november (smerte)',
      'Ben – nu trin 2',
    ]);
    expect(standing.map((c) => c.kind)).toEqual(['pain', 'pain', 'heavy']);
  });
});

// The follow-up on the review of P5a (docs/reviews/nat3-p5a-livet.md, »Opfølgning«, D68).
describe('after the follow-up on the review of P5a', () => {
  it('N4: a grade alone from the club log, logged the day after, answers; the Sunday check’s does not', () => {
    const log = onboarded();
    log.push({ type: 'os_done' }, SUN);
    log.push({ type: 'club_logged', attended: true, technique: 7 }, SAT);
    expect(clubAsks(PROGRAM, log.state(SUN), SUN, 9 * 60)[0]?.answered).toBe(true);
    const check = onboarded();
    check.push({ type: 'os_done' }, SUN);
    check.push({ type: 'club_logged', attended: true, technique: 7, content: [] }, SAT);
    expect(clubAsks(PROGRAM, check.state(SUN), SUN, 9 * 60)[0]?.answered).toBe(false);
  });

  it('N2: a grade logged alone on Saturday itself answers the club card the day after', () => {
    const log = onboarded();
    log.push({ type: 'club_logged', attended: true, technique: 7 }, SAT);
    expect(clubAsks(PROGRAM, log.state(SUN), SUN, 9 * 60)[0]).toMatchObject({
      date: SAT,
      answered: true,
    });
  });

  it('N1: the card leaves out a step chosen back under Stiger on the same Sunday', () => {
    const log = new Log().onboard({
      completedWeeks: mondays(1),
      steps: { legs: { stepId: 'legs.3', target: 8 } },
    });
    const sunday = dayOf(1, 7);
    log.add(
      submitSundayCheck(log.ctx, log.events, { date: sunday, painTracks: [], tooHeavy: ['legs'] }),
    );
    log.add(submitSundayCheck(log.ctx, log.events, { date: sunday, painTracks: [], tooHeavy: [] }));
    const standing = () => {
      const state = log.state(sunday);
      const due = sundayDue(state, sunday);
      if (!due) throw new Error('no check');
      return standingChanges(PROGRAM, state, due, (id) => trackDistance(state, id));
    };
    expect(standing().map((c) => c.trackId)).toEqual(['legs']);
    // Back to trin 3 under Stiger the same Sunday: nothing of the check stands.
    log.add(
      chooseStep(log.ctx, log.events, { trackId: 'legs', stepId: 'legs.3', date: sunday }).events,
    );
    expect(standing()).toEqual([]);
  });
});
