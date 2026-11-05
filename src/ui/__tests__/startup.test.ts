import { describe, expect, it } from 'vitest';
import {
  median,
  notClean,
  parseStartupTimes,
  STARTUP_KEEP,
  withStartupTime,
  type LoadFacts,
  type StartupTime,
} from '../startup.ts';

// A clean start from the icon (docs/SPEC.md 7, docs/DECISIONS.md D34).
const CLEAN: LoadFacts = {
  standalone: true,
  navigation: 'navigate',
  first: 'today',
  onboarding: false,
  timeMachine: false,
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
  });
});

describe('kept start-up times', () => {
  const time = (today: number): StartupTime => ({
    at: '2026-11-05T20:40:18.000Z',
    paint: 1,
    today,
  });

  it('keeps the latest five, oldest first', () => {
    let list: StartupTime[] = [];
    for (let i = 1; i <= 7; i++) list = withStartupTime(list, time(i));
    expect(STARTUP_KEEP).toBe(5);
    expect(list.map((t) => t.today)).toEqual([3, 4, 5, 6, 7]);
  });

  it('reads only well-formed entries and treats anything else as none', () => {
    expect(parseStartupTimes(null)).toEqual([]);
    expect(parseStartupTimes('not json')).toEqual([]);
    expect(parseStartupTimes('{"at":"x"}')).toEqual([]);
    const good = { at: '2026-11-05T20:40:18.000Z', paint: null, today: 3833 };
    expect(parseStartupTimes(JSON.stringify([good, { at: 1, today: 2 }, null]))).toEqual([good]);
  });

  it('median: middle value, or the mean of the two middle values', () => {
    expect(median([])).toBeNull();
    expect(median([3833])).toBe(3833);
    expect(median([3902, 3608, 3790])).toBe(3790);
    expect(median([40, 10, 30, 20])).toBe(25);
  });
});
