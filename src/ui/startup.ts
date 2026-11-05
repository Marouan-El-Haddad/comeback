// Start-up times for Diagnose (docs/SPEC.md 7, docs/DECISIONS.md D34). Only a clean start from the
// icon counts: the installed app (display-mode standalone) opened as a new page load (navigation
// type »navigate«), I dag as the first screen, neither the onboarding nor the time machine in use,
// and the app in the foreground until I dag is on screen (D42). The last clean starts of the
// running version are kept on the device in localStorage, outside the event log and the backup:
// no schema change, no migration.
import { APP_VERSION } from './version.ts';

/** performance.mark: I dag is on screen with its fonts (SK1; read by e2e/perf.spec.ts). */
export const TODAY_MARK = 'cb-today';
export const STARTUP_KEY = 'comeback.startup';
/** Clean starts kept; Diagnose shows the latest and their median. */
export const STARTUP_KEEP = 5;

export interface StartupTime {
  /** When it was measured (ISO). */
  at: string;
  /** First contentful paint, ms after the navigation started; null when the browser gave none. */
  paint: number | null;
  /** I dag on screen with its fonts, ms after the navigation started. */
  today: number;
  /** The app version that started (APP_VERSION); missing in times kept before D42. */
  version?: string;
}

/** What a page load looked like when I dag was first on screen. */
export interface LoadFacts {
  standalone: boolean;
  /** PerformanceNavigationTiming.type ('navigate', 'reload', 'back_forward', …) or 'unknown'. */
  navigation: string;
  /** The first screen the app showed ('today', 'onboarding', 'session', …), null if none yet. */
  first: string | null;
  onboarding: boolean;
  timeMachine: boolean;
  /** The app was in the background at some point before I dag was on screen. */
  hidden: boolean;
}

/** Why a load is not a clean start from the icon (Danish, for Diagnose); null when it is one. */
export function notClean(facts: LoadFacts): string | null {
  if (!facts.standalone) return 'ikke åbnet som installeret app';
  if (facts.navigation === 'reload') return 'genindlæsning';
  if (facts.navigation === 'back_forward') return 'åbnet med tilbage';
  if (facts.navigation === 'unknown') return 'navigationstypen er ukendt';
  if (facts.navigation !== 'navigate') return `navigationstype ${facts.navigation}`;
  if (facts.onboarding) return 'indfasningen var i brug';
  if (facts.timeMachine) return 'tidsmaskinen var i brug';
  if (facts.first !== 'today') return 'I dag var ikke første skærm';
  // requestAnimationFrame waits while the app is hidden, so the time would include the break.
  if (facts.hidden) return 'appen var i baggrunden';
  return null;
}

/** The median; for an even count the mean of the two middle values. */
export function median(values: readonly number[]): number | null {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid];
  if (upper === undefined) return null;
  return sorted.length % 2 === 1 ? upper : ((sorted[mid - 1] ?? upper) + upper) / 2;
}

function isStartupTime(value: unknown): value is StartupTime {
  if (typeof value !== 'object' || value === null) return false;
  const time = value as Record<string, unknown>;
  return (
    typeof time.at === 'string' &&
    typeof time.today === 'number' &&
    (time.paint === null || typeof time.paint === 'number') &&
    (time.version === undefined || typeof time.version === 'string')
  );
}

/** The kept times, oldest first; anything unreadable counts as none. */
export function parseStartupTimes(raw: string | null): StartupTime[] {
  try {
    const value: unknown = raw === null ? [] : JSON.parse(raw);
    return Array.isArray(value) ? value.filter(isStartupTime) : [];
  } catch {
    return [];
  }
}

/** Keeps the new time and the latest ones of the same version; another version's are dropped. */
export function withStartupTime(list: readonly StartupTime[], time: StartupTime): StartupTime[] {
  return [...startupTimesFor(list, time.version), time].slice(-STARTUP_KEEP);
}

/** The times of one version: Diagnose shows only the running version's (D42). */
export function startupTimesFor(
  list: readonly StartupTime[],
  version: string | undefined,
): StartupTime[] {
  return list.filter((time) => time.version === version);
}

export function readStartupTimes(): StartupTime[] {
  try {
    return parseStartupTimes(localStorage.getItem(STARTUP_KEY));
  } catch {
    return [];
  }
}

// This page load: the first screen, what was used before I dag was on screen, and the verdict.
const load = {
  first: null as string | null,
  onboarding: false,
  timeMachine: false,
  hidden: typeof document !== 'undefined' && document.visibilityState === 'hidden',
  marked: false,
  /** undefined until I dag has been on screen; then null (counted) or why not. */
  verdict: undefined as string | null | undefined,
};

/** The app reports every screen it shows; the first one decides »I dag er første skærm«. */
export function noteScreen(screen: string): void {
  load.first ??= screen;
  if (screen === 'onboarding') load.onboarding = true;
}

export function noteTimeMachine(): void {
  load.timeMachine = true;
}

// From the moment this file runs until I dag is measured, a switch to the background is noted.
function onVisibility(): void {
  if (document.visibilityState === 'hidden') load.hidden = true;
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);

/** This load: undefined before I dag has been on screen, null if it counted, else why not. */
export function thisStart(): string | null | undefined {
  return load.verdict;
}

function standalone(): boolean {
  try {
    return matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

const LEGACY_TYPES = ['navigate', 'reload', 'back_forward'];

function navigationType(): string {
  try {
    const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (entry?.type) return entry.type;
    // The older interface: 0 navigate, 1 reload, 2 back/forward.
    const legacy = (performance as { navigation?: { type?: unknown } }).navigation?.type;
    return (typeof legacy === 'number' && LEGACY_TYPES[legacy]) || 'unknown';
  } catch {
    return 'unknown';
  }
}

function firstPaint(): number | null {
  const entry = performance
    .getEntriesByType('paint')
    .find((p) => p.name === 'first-contentful-paint');
  return entry ? Math.round(entry.startTime) : null;
}

/** The paint entry can arrive a moment after the frame it describes; wait at most a second. */
function waitForFirstPaint(): Promise<number | null> {
  const now = firstPaint();
  if (now !== null || typeof PerformanceObserver === 'undefined') return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      observer.disconnect();
      clearTimeout(timer);
      resolve(firstPaint());
    };
    const observer = new PerformanceObserver(done);
    const timer = setTimeout(done, 1000);
    try {
      observer.observe({ type: 'paint' });
    } catch {
      done();
    }
  });
}

/**
 * I dag calls this once it is drawn: marks TODAY_MARK once per load (after the next frame, with
 * the fonts loaded) and keeps the time if the load is a clean start from the icon.
 */
export function markTodayVisible(): void {
  if (load.marked) return;
  load.marked = true;
  requestAnimationFrame(() => {
    void document.fonts.ready.then(async () => {
      performance.mark(TODAY_MARK);
      document.removeEventListener('visibilitychange', onVisibility);
      const today = performance.getEntriesByName(TODAY_MARK)[0]?.startTime;
      const verdict = notClean({ standalone: standalone(), navigation: navigationType(), ...load });
      load.verdict = verdict ?? (today === undefined ? 'tiden kunne ikke måles' : null);
      if (load.verdict !== null || today === undefined) return;
      const at = new Date().toISOString();
      const paint = await waitForFirstPaint();
      try {
        const time = { at, paint, today: Math.round(today), version: APP_VERSION };
        const list = withStartupTime(readStartupTimes(), time);
        localStorage.setItem(STARTUP_KEY, JSON.stringify(list));
      } catch {
        // Storage full or disabled: Diagnose simply has no time to show.
      }
    });
  });
}
