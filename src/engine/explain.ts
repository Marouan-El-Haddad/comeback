// The one-sentence explanations of the engine's decisions (SK5), in Danish.
import { formatDay } from './dates.ts';
import { getStep, getTrack, trackIdOf, workRange } from './lookup.ts';
import type { EventTrim } from './plan.ts';
import type { ISODate, Per, Program } from './types.ts';

const PER: Record<Per, string> = { side: ' pr. side', ben: ' pr. ben', retning: ' pr. retning' };

function label(program: Program, stepId: string): string {
  return `${getTrack(program, trackIdOf(stepId)).short}`;
}

function key(program: Program, stepId: string): string {
  return getStep(program, stepId).key;
}

/** "3 × 12 sek pr. side" for the top of a step. */
export function atMax(program: Program, stepId: string, sets: number): string {
  const dose = getStep(program, stepId).dose;
  const range = workRange(dose);
  if (!range) return `${sets} sæt`;
  const per = 'per' in dose && dose.per ? PER[dose.per] : '';
  return `${sets} × ${range.max}${range.unit === 'sec' ? ' sek' : ''}${per}`;
}

export function explainStepUp(
  program: Program,
  from: string,
  to: string,
  how: 'double' | 'power' | 'rounds' | 'w3' | 'neck',
  sets: number,
): string {
  const head = `${label(program, from)}: trin ${key(program, to)} næste gang.`;
  switch (how) {
    case 'double':
      return `${head} Du ramte ${atMax(program, from, sets)} med 2 i reserve to pas i træk.`;
    case 'power':
      return `${head} Alle reps var lige høje og hurtige med ${atMax(program, from, sets)} to pas i træk.`;
    case 'rounds':
      return `${head} To rene pas i træk.`;
    case 'w3':
      return `${head} To rene pas i træk med 3 runder.`;
    case 'neck':
      return `${head} Trinnet føltes let to pas i træk.`;
  }
}

export function explainEmomUp(program: Program, to: string): string {
  return `${label(program, to)}: ${key(program, to)} i dag. Alle minutter var rene med mindst 20 sek pause i det sidste minut.`;
}

export function explainLoad(program: Program, stepId: string, sets: number, to: number): string {
  const range = workRange(getStep(program, stepId).dose);
  return `${label(program, stepId)}: læg 2 kg mere i rygsækken (nu ${to} kg), og start igen på ${range?.min ?? ''}. Du ramte ${atMax(program, stepId, sets)} med 2 i reserve to pas i træk.`;
}

export function explainPain(
  program: Program,
  from: string,
  to: string,
  until: ISODate,
  source: 'session' | 'sunday',
): string {
  const why = source === 'sunday' ? 'noget gør ondt og går ikke væk' : 'skarp smerte';
  const cue = getTrack(program, trackIdOf(from)).painCue;
  const tail = cue ? ` ${cue}` : '';
  if (from === to) {
    return `${label(program, from)}: bliv på trin ${key(program, to)} med en lettere variant til ${formatDay(until)}, fordi ${why}.${tail}`;
  }
  return `${label(program, from)}: trin ${key(program, to)} til ${formatDay(until)}, fordi ${why}. Et trin ned i en uge.${tail}`;
}

export function explainPainAgain(program: Program, stepId: string, until: ISODate): string {
  return `${label(program, stepId)}: ny skarp smerte, så trin ${key(program, stepId)} en uge mere (til ${formatDay(until)}). Bliver den værre fra gang til gang, så få den undersøgt.`;
}

export function explainRestore(program: Program, from: string, to: string): string {
  if (from === to) {
    return `${label(program, to)}: almindelig udgave af trin ${key(program, to)} igen. Ingen ny smerte i en uge.`;
  }
  return `${label(program, to)}: tilbage på trin ${key(program, to)}. Ingen ny smerte i en uge.`;
}

/** R-ABSENCE-3's reason, at the end of every absence explanation (I dag shows it once). */
export const ABSENCE_REASON = 'Tre uger uden styrkepas: alle stiger ét trin ned.';

export function explainAbsence(program: Program, from: string, to: string): string {
  if (from === to) {
    return `${label(program, to)}: bliver på trin ${key(program, to)} og starter forfra. ${ABSENCE_REASON}`;
  }
  return `${label(program, to)}: trin ${key(program, to)}. ${ABSENCE_REASON}`;
}

export function explainAbsenceLoad(program: Program, stepId: string, to: number): string {
  return `${label(program, stepId)}: ${to} kg i rygsækken og forfra på arbejdstallet. ${ABSENCE_REASON}`;
}

/** »A, B og C« */
function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} og ${items[items.length - 1] ?? ''}`;
}

const EVENT_MOTOR: Record<NonNullable<EventTrim['motor']>, string> = {
  intervals: 'Motoren er en rolig base i stedet for intervaller',
  cooper: 'Motoren er en rolig base uden Cooper-testen',
  strides: 'Motoren er en rolig base uden stigningsløb',
};

/**
 * R-EVENT on I dag the day before an event (ENGINE 5.1 step 5, S-EVENT-03): what the rule took out
 * of the day's session, and why.
 */
export function explainEventTomorrow(program: Program, trim: EventTrim): string {
  const head = `I morgen: ${trim.label}`;
  if (trim.kind === null) return `${head}.`;
  const parts: string[] = [];
  if (trim.tracks.length > 0) {
    const names = trim.tracks.map((id) => getTrack(program, id).short);
    parts.push(`${list(names)} er taget ud af dagens pas`);
  }
  if (trim.motor) parts.push(EVENT_MOTOR[trim.motor]);
  if (trim.boss) parts.push('der er ingen boss-udfordring i dag');
  if (parts.length === 0) {
    return `${head}. Dagens pas har hverken tunge ben, Nordic eller intervaller og er uændret.`;
  }
  const what = parts.join(', og ');
  return `${head} – let udgave i dag. Dagen før en begivenhed er der aldrig tunge ben, Nordic eller intervaller: ${what.charAt(0).toUpperCase()}${what.slice(1)}.`;
}

export function explainUserChoice(program: Program, to: string): string {
  return `${label(program, to)}: trin ${key(program, to)} – dit eget valg.`;
}

/** R-PAIN-SUNDAY: »For tungt?« in the Sunday check, accepted when the check is saved. */
export function explainTooHeavy(program: Program, from: string, to: string): string {
  return `${label(program, to)}: trin ${key(program, to)} – dit eget valg i søndagstjekket, fordi trin ${key(program, from)} var for tungt.`;
}
