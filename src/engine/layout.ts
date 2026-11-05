// R-EXTRA-MT: where A, B and the motor go in a week with other club days (docs/ENGINE.md 5.10).
import type { Program } from './types.ts';

export interface Layout {
  A: number | null;
  B: number | null;
  motor: number | null;
  rest: number | null;
  /** A and B run as the 30-minute short version in the morning of a club day. */
  short: boolean;
  /** The motor is dropped; I dag offers an optional calm walk on the rest day instead. */
  motorDropped: boolean;
}

const REST_ORDER = [7, 6, 1, 2, 3, 4, 5];
const CANDIDATE_ORDER = [2, 4, 5, 1, 3, 6];

/** Circular distance between two weekdays (the week repeats). */
function distance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 7 - d);
}

/**
 * The layout for the given club days. The standard week (A tirsdag, motor torsdag, B fredag) is
 * kept whenever those days are free and a rest day remains (Præcisering P27); otherwise the
 * algorithm of ENGINE 5.10 places the sessions.
 */
export function layoutFor(program: Program, clubDays: number[]): Layout {
  const club = new Set(clubDays);
  const free = [1, 2, 3, 4, 5, 6, 7].filter((d) => !club.has(d));
  const rest = REST_ORDER.find((d) => !club.has(d)) ?? null;
  const defaults = Object.fromEntries(
    program.sessions.filter((s) => s.defaultWeekday > 0).map((s) => [s.id, s.defaultWeekday]),
  );
  const [a, b, m] = [defaults.A, defaults.B, defaults.motor];
  if (a && b && m && rest !== null && [a, b, m].every((d) => !club.has(d) && d !== rest)) {
    return { A: a, B: b, motor: m, rest, short: false, motorDropped: false };
  }
  const candidates = CANDIDATE_ORDER.filter((d) => free.includes(d) && d !== rest);
  if (candidates.length >= 2) {
    const A = candidates[0] ?? null;
    const others = candidates.slice(1);
    const B = others.find((d) => A !== null && distance(A, d) >= 2) ?? others[0] ?? null;
    const motor = candidates.find((d) => d !== A && d !== B) ?? null;
    return { A, B, motor, rest, short: false, motorDropped: motor === null };
  }
  // Fewer than two free days: A and B as the short version on the club days furthest apart.
  const days = CANDIDATE_ORDER.filter((d) => club.has(d));
  let best: [number, number] | null = null;
  for (const x of days) {
    for (const y of days) {
      if (x === y) continue;
      if (!best || distance(x, y) > distance(best[0], best[1])) best = [x, y];
    }
  }
  return {
    A: best?.[0] ?? null,
    B: best?.[1] ?? null,
    motor: null,
    rest,
    short: true,
    motorDropped: true,
  };
}
