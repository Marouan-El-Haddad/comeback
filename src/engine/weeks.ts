// Calendar weeks, the programme week marker (R-PW), rounds (R-ROUND2) and the flat rule (R-FLAT).
// docs/ENGINE.md 5.7, 5.11 and 5.13.
import { addDays, calendarWeek, mondayOf } from './dates.ts';
import { getWeek } from './lookup.ts';
import type { ISODate, Program, SessionSummary, State, WeekInfo } from './types.ts';

interface WeekInput {
  startDate: ISODate;
  today: ISODate;
  declaredWeeks: ISODate[];
  sessions: SessionSummary[];
  club: State['club'];
}

const COUNTS: ReadonlySet<string> = new Set(['green', 'yellow', 'travel']);

/** R-WEEK-DONE: an A, B or travel session with status green, yellow or travel and pair 1 done. */
export function weekCompleted(input: WeekInput, monday: ISODate): boolean {
  if (input.declaredWeeks.includes(monday)) return true;
  const sunday = addDays(monday, 6);
  return input.sessions.some(
    (s) =>
      s.completed &&
      (s.kind === 'A' || s.kind === 'B' || s.kind === 'travel') &&
      s.status !== undefined &&
      COUNTS.has(s.status) &&
      s.done === true &&
      s.date >= monday &&
      s.date <= sunday,
  );
}

/** R-FLAT: a club log »Flad« or Saturday's technique ≤ 4 makes the week flat. */
export function weekFlat(input: WeekInput, monday: ISODate): boolean {
  const sunday = addDays(monday, 6);
  return input.club.some(
    (c) =>
      c.date >= monday &&
      c.date <= sunday &&
      (c.freshness === 'flat' || (c.technique !== undefined && c.technique <= 4)),
  );
}

function next(pw: number, round: number): { pw: number; round: number } {
  return pw >= 12 ? { pw: 5, round: round + 1 } : { pw: pw + 1, round };
}

/**
 * Weeks k = 0 … `untilK` (default: this week). Past weeks know whether they were completed;
 * this week and later ones are `completed: null`, and later weeks assume this week is completed.
 */
export function computeWeeks(program: Program, input: WeekInput, untilK?: number): WeekInfo[] {
  const start = mondayOf(input.startDate);
  const todayK = calendarWeek(start, input.today);
  const lastK = Math.max(untilK ?? todayK, todayK);
  const weeks: WeekInfo[] = [];
  let lastDone: { pw: number; round: number } | null = null;
  let flatRun = 0;
  let reductionPending = false;
  for (let k = 0; k <= lastK; k++) {
    const monday = addDays(start, 7 * k);
    const prev = weeks[k - 1];
    let cur = { pw: 1, round: 1 };
    if (prev) {
      const prevDone = prev.completed ?? true; // the running week is assumed completed
      cur = prevDone ? next(prev.pw, prev.round) : (lastDone ?? { pw: 1, round: 1 });
    }
    const past = k < todayK;
    const completed = past ? weekCompleted(input, monday) : null;
    if (completed) lastDone = { pw: cur.pw, round: cur.round };
    const light = getWeek(program, cur.pw).light;

    // R-FLAT: two flat weeks in a row reduce the next week that is not a light week.
    let volumeFactor: 1 | 0.67 = 1;
    if (reductionPending && !light) {
      volumeFactor = 0.67;
      reductionPending = false;
    }
    const flat = k <= todayK && weekFlat(input, monday);
    flatRun = flat ? flatRun + 1 : 0;
    if (flatRun === 2) {
      reductionPending = true;
      flatRun = 0;
    }
    weeks.push({ k, monday, pw: cur.pw, round: cur.round, completed, flat, volumeFactor });
  }
  return weeks;
}

/**
 * R-ABSENCE-3: the run of past weeks without a completed week that ends with last week, counted
 * only from the onboarding week on. Returns the run's first Monday when it is three weeks or more.
 */
export function absenceRun(weeks: WeekInfo[], todayK: number, fromMonday: ISODate): ISODate | null {
  let first: ISODate | null = null;
  let length = 0;
  for (let k = todayK - 1; k >= 0; k--) {
    const week = weeks[k];
    if (!week || week.completed !== false || week.monday < fromMonday) break;
    first = week.monday;
    length++;
  }
  return length >= 3 ? first : null;
}
