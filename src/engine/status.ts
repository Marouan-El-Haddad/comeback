// Setting, correcting and ending a status (docs/ENGINE.md 3.1, S-WEEK-13, S-WEEK-14): the
// `status_set` events Status writes. The days that are over always stand as before.
import { addDays } from './dates.ts';
import type { EventBody, ISODate, State, StatusKind, StatusRange } from './types.ts';

export interface StatusChange {
  /** The status as it stands after the change: from the first day it corrects to the new last day. */
  range: StatusRange;
  /** The statuses of the same kind, in force today or later, that it corrects. */
  replaced: StatusRange[];
  /** The events to write, in order: each corrected status ends yesterday or goes, then the new one. */
  bodies: EventBody[];
}

/** The status `range` ends yesterday (»Afslut«), or goes when it starts today or later (»Fjern«). */
export function statusEnd(range: StatusRange, today: ISODate): EventBody {
  return {
    type: 'status_set',
    status: range.status,
    from: range.from,
    to: addDays(range.from > today ? range.from : today, -1),
  };
}

/**
 * A new status from `from` (today or later) to `to`. One of the same kind in force today or later
 * that it overlaps or adjoins is corrected instead of lying under it: it ends yesterday or goes,
 * and the corrected period – from its first day to the new last day – is written from today (or its
 * first day, when that is later) as the newest, so it applies over another status (S-WEEK-14).
 */
export function statusChange(
  state: State,
  input: { status: StatusKind; from: ISODate; to: ISODate; today: ISODate },
): StatusChange {
  const { status, from, to, today } = input;
  const replaced = state.statuses.filter(
    (r) =>
      r.status === status && r.to >= today && r.from <= addDays(to, 1) && from <= addDays(r.to, 1),
  );
  const start = replaced.reduce((first, r) => (r.from < first ? r.from : first), from);
  const bodies = replaced.map((r) => statusEnd(r, today));
  bodies.push({ type: 'status_set', status, from: start > today ? start : today, to });
  return { range: { status, from: start, to }, replaced, bodies };
}
