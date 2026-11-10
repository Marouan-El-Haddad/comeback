// What Status says before and after a tap (docs/SPEC.md 3.6, DECISIONS.md D67, D70): what a status
// does, the status a new one corrects, and what applies from today once one ends – read from the
// engine's own statusChange and statusRangeOn, so the screen and its »✓« line say what applies.
import { formatLong, statusRangeOn, type StatusChange } from '../../engine/index.ts';
import type { ISODate, State, StatusKind, StatusRange } from '../../engine/types.ts';
import { rangeText, STATUS_NAME } from '../status.ts';

/** Sick and holiday days do not complete the week (ENGINE 4, »Gennemført uge«). */
const WEEK =
  'Syge- og feriedage gennemfører ikke ugen: den tæller kun med Styrke A, B eller rejsepasset på en anden dag.';

/** What a status does (ENGINE 5.1 step 3, R-ILL, R-TRAVEL, R-HOLIDAY and 5.8), a line each. */
export const EFFECTS: Record<StatusKind, string[]> = {
  ill: [
    // The programme's own words: »Kun forkølet over halsen« is your call (R-ILL).
    'Feber eller ondt i kroppen: hvil. Kun forkølet over halsen: Open & Strong og en gåtur.',
    'Ingen styrkepas og ingen motor de dage.',
    WEEK,
  ],
  travel: [
    'Styrke-dagene får rejsepasset: 25 min med push-ups, rygsæk-row, split squats og 6 min EMOM.',
    'Rejsepasset gennemfører ugen, men flytter ingen stiger.',
  ],
  holiday: [
    'Hvile: ingen pas, og Open & Strong er valgfri.',
    WEEK,
    'Vil du træne i ferien, så sæt ikke ferie.',
  ],
  club_closed: ['Muay Thai-dagene bliver 4–5 kamp-runder hjemme.'],
};

/** »til og med fredag 13. november« for a status in force today, the days for a later one. */
export function spanText(range: StatusRange, today: ISODate): string {
  if (range.from > today) return rangeText(range.from, range.to, today);
  return range.to === today ? 'i dag' : `til og med ${formatLong(range.to)}`;
}

/** The days of a status as a correction speaks of them: »til og med i dag« rather than »i dag«. */
function untilText(range: StatusRange, today: ISODate): string {
  if (range.from > today) return rangeText(range.from, range.to, today);
  return `til og med ${range.to === today ? 'i dag' : formatLong(range.to)}`;
}

/** The days a new or corrected status applies: »til og med fredag 13. november« when it began. */
export function resultText(range: StatusRange, today: ISODate): string {
  return range.from < today ? untilText(range, today) : rangeText(range.from, range.to, today);
}

/** »Retter Rejse til og med fredag 20. november: nu til og med fredag 13. november.«, or null. */
export function correctionNote(change: StatusChange, today: ISODate): string | null {
  if (change.replaced.length === 0) return null;
  const name = STATUS_NAME[change.range.status];
  const old = change.replaced.map((r) => `${name} ${untilText(r, today)}`).join(' og ');
  return `Retter ${old}: nu ${resultText(change.range, today)}.`;
}

/**
 * Of ill, travel and holiday the newest applies where they overlap (ENGINE 5.1 step 3): the new
 * status, written as the newest, applies over the others on its days from today on.
 */
export function overlapNote(state: State, change: StatusChange, today: ISODate): string | null {
  const own = (k: StatusKind) => k !== 'club_closed';
  const { status, from, to } = change.range;
  if (!own(status)) return null;
  const first = from > today ? from : today;
  const over = state.statuses.filter(
    (r) => own(r.status) && r.status !== status && r.from <= to && first <= r.to,
  );
  const names = [...new Set(over.map((r) => STATUS_NAME[r.status]))];
  return names.length > 0
    ? `Gælder i stedet for ${names.join(' og ')} de dage, de overlapper.`
    : null;
}

/** What applies today once `range` no longer does: another status, or null for the plan. */
function leftToday(state: State, range: StatusRange, today: ISODate): StatusRange | null {
  return statusRangeOn({ ...state, statuses: state.statuses.filter((r) => r !== range) }, today);
}

/** Over »Afslut« or »Fjern«: what applies from today once it is tapped. */
export function endNote(state: State, range: StatusRange, today: ISODate): string {
  if (range.from > today) return 'Fjern, så gælder statussen ikke.';
  if (range.status === 'club_closed')
    return 'Afslut, så har Muay Thai-dagene Muay Thai igen fra i dag.';
  const left = leftToday(state, range, today);
  if (left && left.status !== 'club_closed') {
    return `Afslut, så gælder ${STATUS_NAME[left.status]} stadig ${untilText(left, today)}.`;
  }
  return left
    ? 'Afslut, så gælder den almindelige plan fra i dag, og klubben er stadig lukket.'
    : 'Afslut, så gælder den almindelige plan fra i dag.';
}

/** The »✓« line once »Afslut« or »Fjern« is written. */
export function endedLine(state: State, range: StatusRange, today: ISODate): string {
  const name = STATUS_NAME[range.status];
  if (range.from > today) return `✓ ${name} ${rangeText(range.from, range.to, today)} er fjernet.`;
  if (range.status === 'club_closed')
    return `✓ ${name} er afsluttet. Muay Thai-dagene har Muay Thai igen.`;
  const left = leftToday(state, range, today);
  if (left && left.status !== 'club_closed') {
    return `✓ ${name} er afsluttet. ${STATUS_NAME[left.status]} gælder stadig ${untilText(left, today)}.`;
  }
  return left
    ? `✓ ${name} er afsluttet. Fra i dag gælder den almindelige plan, og klubben er stadig lukket.`
    : `✓ ${name} er afsluttet. Fra i dag gælder den almindelige plan.`;
}
