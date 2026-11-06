// Measurements taken on both sides (docs/SPEC.md 4.8, DECISIONS.md P59, D49): the programme's own
// words say it – »Max tid pr. side« (side plank), »max 60 sek pr. ben« (balance). The left side's
// time is taken first, then the right side's, and the shorter is the measurement's one number, so
// the events and the schema stay as they are.
import type { Measure } from '../../engine/types.ts';

/** The two sides of a timed measurement taken per side or per leg, in order; null otherwise. */
export function measureSides(measure: Measure): [string, string] | null {
  if (measure.unit !== 'sec') return null;
  if (/\bpr\. side\b/.test(measure.how)) return ['Venstre side', 'Højre side'];
  if (/\bpr\. ben\b/.test(measure.how)) return ['Venstre ben', 'Højre ben'];
  return null;
}

/** The shorter time, or null while a side has no time yet. */
export function shortest(times: ReadonlyArray<number | null>): number | null {
  if (times.length === 0 || times.some((t) => t === null)) return null;
  return Math.min(...(times as number[]));
}
