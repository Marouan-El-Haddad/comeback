// Measurements taken on both sides (docs/SPEC.md 4.8, DECISIONS.md P59, D49): the programme's own
// words say it – »Max tid pr. side« (side plank), »max 60 sek pr. ben« (balance). The left side's
// time is taken first, then the right side's, and the shorter is the measurement's one number, so
// the events and the schema stay as they are. Exercises done alternately left and right in one set
// are read from the programme's words in the same way (P54, D54).
import type { Measure, Step } from '../../engine/types.ts';

/**
 * A step done per side or per leg, but alternately in one set (DECISIONS.md P54): skater-hop
 * springs »fra ét ben til det andet«, split jumps are a »Skifte-udfald«. The session shows such a
 * set as one, and one »Som planlagt« logs both sides (D54). Read from the programme's own words, so
 * the code knows no exercise by name; a test holds the result up against the programme.
 */
export function alternates(step: Step): boolean {
  const per = 'per' in step.dose ? step.dose.per : undefined;
  if (per !== 'side' && per !== 'ben') return false;
  return /fra ét ben til det andet|\bskifte-|\bskiftevis\b/i.test(step.execution);
}

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
