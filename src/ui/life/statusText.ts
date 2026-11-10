// What Status says before and after a tap (docs/SPEC.md 3.6, DECISIONS.md D67, D70): what a status
// does, the status a new one corrects, and what applies from today once one ends – read from the
// engine's own statusChange and statusRangeOn, so the screen and its »✓« line say what applies.
import {
  addDays,
  applyStatusSet,
  formatLong,
  statusOn,
  statusRangeOn,
  type StatusChange,
} from '../../engine/index.ts';
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

/** Days in runs: »fra i dag til og med fredag 13. november og søndag 15. november«. */
function runsText(days: ISODate[], today: ISODate): string {
  const runs: Array<[ISODate, ISODate]> = [];
  for (const day of days) {
    const last = runs[runs.length - 1];
    if (last && addDays(last[1], 1) === day) last[1] = day;
    else runs.push([day, day]);
  }
  return runs.map(([from, to]) => rangeText(from, to, today)).join(' og ');
}

/**
 * Where the new status applies over another one, and where another one still applies, from today
 * on – read from the engine's own statuses after the change (ENGINE 3.1, 5.1 step 3): of ill,
 * travel and holiday the newest applies, and a correction that only moves the last day keeps its
 * place (D71). The club closed applies next to them, so it has no such lines.
 */
export function previewNotes(state: State, change: StatusChange, today: ISODate): string[] {
  const kind = change.range.status;
  if (kind === 'club_closed') return [];
  let statuses = state.statuses;
  for (const body of change.bodies) {
    if (body.type === 'status_set') statuses = applyStatusSet(statuses, body);
  }
  const after = { ...state, statuses };
  const own = (s: StatusKind | null) => (s === 'club_closed' ? null : s);
  const instead = new Map<StatusKind, ISODate[]>();
  const still = new Map<StatusKind, ISODate[]>();
  const add = (map: Map<StatusKind, ISODate[]>, key: StatusKind, day: ISODate) =>
    map.set(key, [...(map.get(key) ?? []), day]);
  const first = change.range.from > today ? change.range.from : today;
  for (let day = first, n = 0; day <= change.range.to && n < 400; day = addDays(day, 1), n++) {
    const now = own(statusOn(after, day));
    const was = own(statusOn(state, day));
    if (now === kind) {
      if (was && was !== kind) add(instead, was, day);
    } else if (now) {
      add(still, now, day);
    }
  }
  return [
    ...[...instead].map(
      ([k, days]) => `Gælder i stedet for ${STATUS_NAME[k]} ${runsText(days, today)}.`,
    ),
    ...[...still].map(([k, days]) => `${STATUS_NAME[k]} gælder stadig ${runsText(days, today)}.`),
  ];
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
