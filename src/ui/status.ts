// Status and events on I dag, Uge and Mere (docs/SPEC.md 3.1, 3.4 and 3.6, DECISIONS.md D67): the
// names, a status's line, the statuses and events still to come, and I dag's explanations of a
// changed day in the engine's own words. Small, as I dag needs it at start; the screens are fetched
// after start with lazy() (src/ui/life/StatusForm.tsx and EventForm.tsx).
import {
  ABSENCE_REASON,
  addDays,
  calendarWeek,
  eventExplanation,
  formatLong,
  mondayOf,
  weekInfoAt,
  type DayPlan,
} from '../engine/index.ts';
import type {
  AppEvent,
  CalendarEvent,
  ISODate,
  Program,
  State,
  StatusKind,
  StatusRange,
} from '../engine/types.ts';

export const STATUS_NAME: Record<StatusKind, string> = {
  ill: 'Syg',
  travel: 'Rejse',
  holiday: 'Ferie',
  club_closed: 'Klubben lukket',
};

/** What a status does to the days it covers, in one line (ENGINE 5.1 step 3). */
export const STATUS_LINE: Record<StatusKind, string> = {
  ill: 'Feber eller ondt i kroppen: hvil. Kun forkølet over halsen: Open & Strong og en gåtur.',
  travel: 'Rejsepasset på Styrke-dagene.',
  holiday: 'Hvile. Open & Strong er valgfri.',
  club_closed: '4–5 kamp-runder hjemme på Muay Thai-dagene.',
};

/**
 * The day before an event (ENGINE 5.1 step 5, S-EVENT-03): the engine's explanation of what the
 * rule took out of today's session – or only »I morgen: Kamp.« once that session is logged or under
 * way, as it ran with what it had (D70). Null without an event tomorrow.
 */
export function eventLine(program: Program, state: State, plan: DayPlan): string | null {
  const flag = plan.flags.find((f) => f.type === 'event_tomorrow');
  if (!flag || flag.type !== 'event_tomorrow') return null;
  if (plan.done || plan.open) return `I morgen: ${flag.label}.`;
  return eventExplanation(program, state, plan.date) ?? `I morgen: ${flag.label}.`;
}

/** »i dag« or »onsdag 11. november«. */
export function dayText(date: ISODate, today: ISODate): string {
  return date === today ? 'i dag' : formatLong(date);
}

/** »i dag«, »fra i dag til og med onsdag 11. november«. */
export function rangeText(from: ISODate, to: ISODate, today: ISODate): string {
  if (from === to) return dayText(from, today);
  return `fra ${dayText(from, today)} til og med ${formatLong(to)}`;
}

/** The last day of a status that applies today: »Kun i dag.« or »Til og med onsdag 11. november.« */
export function untilText(range: StatusRange, today: ISODate): string {
  return range.to === today ? 'Kun i dag.' : `Til og med ${formatLong(range.to)}.`;
}

/** The statuses that apply today or later, by their first day (Status, SPEC 3.6). */
export function currentStatuses(state: State, today: ISODate): StatusRange[] {
  return state.statuses
    .filter((s) => s.to >= today)
    .sort((a, b) => (a.from === b.from ? 0 : a.from < b.from ? -1 : 1));
}

/** The events from today on, by date (Begivenheder, SPEC 3.6). */
export function comingEvents(state: State, today: ISODate): CalendarEvent[] {
  return state.events
    .filter((e) => e.eventDate >= today)
    .sort((a, b) => (a.eventDate === b.eventDate ? 0 : a.eventDate < b.eventDate ? -1 : 1));
}

/**
 * The week after a week that was not completed repeats the last completed one (R-PW): »Sidste uge
 * blev ikke gennemført: du gentager uge 2.«, or null.
 */
export function repeatedWeek(program: Program, state: State, today: ISODate): string | null {
  const k = calendarWeek(state.startDate, today);
  if (k < 1) return null;
  const last = weekInfoAt(program, state, k - 1);
  const now = weekInfoAt(program, state, k);
  if (!last || !now || last.completed !== false) return null;
  return `Sidste uge blev ikke gennemført: du gentager uge ${now.pw}.`;
}

/** An explanation without R-ABSENCE-3's shared reason at its end: »Ben: trin 2.« */
function withoutReason(explanation: string): string {
  return explanation.endsWith(ABSENCE_REASON)
    ? explanation.slice(0, -ABSENCE_REASON.length).trim()
    : explanation;
}

export interface AbsenceChanges {
  /** The engine's own explanation of each ladder that went down a step or 2 kg: »Ben: trin 2.« */
  lines: string[];
  /** Some ladders were on their first step: they stay there and start over. */
  stayed: boolean;
}

/**
 * The week three weeks without a strength session took the ladders down (R-ABSENCE-3), from the
 * week's events. Null in a week without it.
 */
export function absenceChanges(events: readonly AppEvent[], today: ISODate): AbsenceChanges | null {
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  let found = false;
  let stayed = false;
  const lines: string[] = [];
  for (const e of events) {
    if (e.date < monday || e.date > sunday) continue;
    if (e.type === 'step_changed' && e.reason === 'absence') {
      found = true;
      if (e.from !== e.to) lines.push(withoutReason(e.explanation));
      else stayed = true;
    } else if (
      e.type === 'load_changed' &&
      e.by === 'engine' &&
      e.explanation.endsWith(ABSENCE_REASON) &&
      e.to < e.from
    ) {
      lines.push(withoutReason(e.explanation));
    }
  }
  return found ? { lines, stayed } : null;
}
