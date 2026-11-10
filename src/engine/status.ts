// Setting, correcting and ending a status (docs/ENGINE.md 3.1, S-WEEK-13..16): the `status_set`
// events Status writes, and how one is read into the list of statuses. The days that are over
// always stand as before.
import { addDays } from './dates.ts';
import type { EventBody, ISODate, State, StatusKind, StatusRange } from './types.ts';

/**
 * One `status_set` read into the list (ENGINE 3.1, S-WEEK-13): one with the same status and first
 * day as an earlier one replaces it in its place, and a `to` before `from` removes it; otherwise
 * it is the newest. Returns a new list.
 */
export function applyStatusSet(
  statuses: readonly StatusRange[],
  set: { status: StatusKind; from: ISODate; to: ISODate },
): StatusRange[] {
  const range = { status: set.status, from: set.from, to: set.to };
  const index = statuses.findIndex((s) => s.status === set.status && s.from === set.from);
  if (index < 0) return set.to >= set.from ? [...statuses, range] : [...statuses];
  if (set.to < set.from) return statuses.filter((_, i) => i !== index);
  return statuses.map((s, i) => (i === index ? range : s));
}

export interface StatusChange {
  /** The status as it stands after the change: from the earliest first day to the last day. */
  range: StatusRange;
  /** The statuses of the same kind, in force today or later, that it corrects (they overlap). */
  replaced: StatusRange[];
  /** The events to write, in order. */
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
 * A new status from `from` (today or later) to `to` (ENGINE 3.1). A status of the same kind in force
 * today or later that it overlaps is corrected; one it only adjoins stands next to it (S-WEEK-15).
 * The corrected period runs from the earliest first day to the new last day – a corrected status
 * that begins after the new first day keeps a later last day, so none of its days go. A correction
 * that only moves the last day earlier keeps its place, so a newer status still applies on its days
 * (S-WEEK-16). One that adds days leaves each corrected status its days before the new first day,
 * in its place, and writes the period from the new first day as the newest (S-WEEK-14).
 */
export function statusChange(
  state: State,
  input: { status: StatusKind; from: ISODate; to: ISODate; today: ISODate },
): StatusChange {
  const { status, from, to, today } = input;
  const replaced = state.statuses.filter(
    (r) => r.status === status && r.to >= today && r.from <= to && from <= r.to,
  );
  if (replaced.length === 0) {
    return {
      range: { status, from, to },
      replaced,
      bodies: [{ type: 'status_set', status, from, to }],
    };
  }
  const start = replaced.reduce((first, r) => (r.from < first ? r.from : first), from);
  const end = replaced.reduce((last, r) => (r.from > from && r.to > last ? r.to : last), to);
  const range = { status, from: start, to: end };
  const only = replaced.length === 1 ? replaced[0] : undefined;
  if (only && only.from === start && end <= only.to) {
    // Only the last day moves earlier: the status keeps its place (S-WEEK-13, S-WEEK-16).
    return { range, replaced, bodies: [{ type: 'status_set', status, from: only.from, to: end }] };
  }
  const first = from > today ? from : today;
  const bodies: EventBody[] = replaced.map((r) => ({
    type: 'status_set',
    status,
    from: r.from,
    to: addDays(r.from < first ? first : r.from, -1),
  }));
  bodies.push({ type: 'status_set', status, from: first, to: end });
  return { range, replaced, bodies };
}
