import { describe, expect, it } from 'vitest';
import {
  median,
  notClean,
  parseStartupTimes,
  STARTUP_KEEP,
  startupTimesFor,
  withStartupTime,
  type LoadFacts,
  type StartupTime,
} from '../startup.ts';

// A clean start from the icon (docs/SPEC.md 7, docs/DECISIONS.md D34 and D42).
const CLEAN: LoadFacts = {
  standalone: true,
  navigation: 'navigate',
  first: 'today',
  onboarding: false,
  timeMachine: false,
  hidden: false,
};

describe('clean start from the icon', () => {
  it('counts the installed app opened as a new load with I dag first', () => {
    expect(notClean(CLEAN)).toBeNull();
  });

  it('names why a load does not count', () => {
    expect(notClean({ ...CLEAN, standalone: false })).toBe('ikke åbnet som installeret app');
    expect(notClean({ ...CLEAN, navigation: 'reload' })).toBe('genindlæsning');
    expect(notClean({ ...CLEAN, navigation: 'back_forward' })).toBe('åbnet med tilbage');
    expect(notClean({ ...CLEAN, navigation: 'unknown' })).toBe('navigationstypen er ukendt');
    expect(notClean({ ...CLEAN, navigation: 'prerender' })).toBe('navigationstype prerender');
    expect(notClean({ ...CLEAN, first: 'onboarding', onboarding: true })).toBe(
      'indfasningen var i brug',
    );
    expect(notClean({ ...CLEAN, timeMachine: true })).toBe('tidsmaskinen var i brug');
    expect(notClean({ ...CLEAN, first: 'session' })).toBe('I dag var ikke første skærm');
    expect(notClean({ ...CLEAN, first: null })).toBe('I dag var ikke første skærm');
    expect(notClean({ ...CLEAN, hidden: true })).toBe('appen var i baggrunden');
  });
});

describe('kept start-up times', () => {
  const time = (today: number, version = 'A'): StartupTime => ({
    at: '2026-11-05T20:40:18.000Z',
    paint: 1,
    today,
    version,
  });

  it('keeps the latest five, oldest first', () => {
    let list: StartupTime[] = [];
    for (let i = 1; i <= 7; i++) list = withStartupTime(list, time(i));
    expect(STARTUP_KEEP).toBe(5);
    expect(list.map((t) => t.today)).toEqual([3, 4, 5, 6, 7]);
  });

  it('keeps only the running version: a new version starts a new list (D42)', () => {
    const old = [time(1), time(2), { at: 'x', paint: null, today: 3 }];
    expect(withStartupTime(old, time(9, 'B'))).toEqual([time(9, 'B')]);
    expect(startupTimesFor([...old, time(9, 'B')], 'A')).toEqual([time(1), time(2)]);
    expect(startupTimesFor(old, 'B')).toEqual([]);
  });

  it('reads only well-formed entries and treats anything else as none', () => {
    expect(parseStartupTimes(null)).toEqual([]);
    expect(parseStartupTimes('not json')).toEqual([]);
    expect(parseStartupTimes('{"at":"x"}')).toEqual([]);
    const good = { at: '2026-11-05T20:40:18.000Z', paint: null, today: 3833 };
    expect(parseStartupTimes(JSON.stringify([good, { at: 1, today: 2 }, null]))).toEqual([good]);
    const versioned = { ...good, version: '2026-11-06 · e3dceb0' };
    expect(parseStartupTimes(JSON.stringify([versioned, { ...good, version: 7 }]))).toEqual([
      versioned,
    ]);
  });

  it('median: middle value, or the mean of the two middle values', () => {
    expect(median([])).toBeNull();
    expect(median([3833])).toBe(3833);
    expect(median([3902, 3608, 3790])).toBe(3790);
    expect(median([40, 10, 30, 20])).toBe(25);
  });
});
