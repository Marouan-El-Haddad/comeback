// Moving and skipping a session (docs/SPEC.md 3.1 and 3.4, ENGINE.md 5.9, DECISIONS.md D64): which
// session of a day can still be moved or skipped, where it can go from today on, and the names of
// the days. Small, as I dag needs it at start; the screen itself is fetched after start with
// lazy() (src/ui/life/MoveForm.tsx).
import {
  addDays,
  calendarWeek,
  calmTourDay,
  formatLong,
  mondayOf,
  scheduleForWeek,
  statusOn,
  validMoveDays,
  type MoveOption,
} from '../engine/index.ts';
import type { ISODate, Program, SessionKind, State } from '../engine/types.ts';
import { capitalize } from './format.ts';

/** A session in the week plan that is not started: it can be moved or skipped. */
export interface Movable {
  /** The week plan's session: A, B or motor (a travel day's session is its A or B). */
  kind: SessionKind;
  /** What the day shows: the travel session for A or B on a travel day. */
  shown: SessionKind;
  /** The day it stands on now. */
  date: ISODate;
  /** The day is over: the session was not logged. */
  missed: boolean;
  /** »Spring over« was tapped for it. */
  skipped: boolean;
  /** Where it can go from today until Sunday (R-MOVE, R-REST). */
  options: MoveOption[];
}

/**
 * The session on `date` that can still be moved or skipped: in the week plan (after moves),
 * after the phase-in, not on a sick or holiday day, and not started.
 */
export function movable(
  program: Program,
  state: State,
  date: ISODate,
  today: ISODate,
): Movable | null {
  if (!state.onboarded || calendarWeek(state.startDate, date) < 0) return null;
  if (state.onboardedOn && date < state.onboardedOn) return null;
  const status = statusOn(state, date);
  if (status === 'ill' || status === 'holiday') return null;
  const assignment = scheduleForWeek(program, state, mondayOf(date)).find((a) => a.date === date);
  if (!assignment) return null;
  if (state.sessions.some((s) => s.date === date && s.kind !== 'os')) return null;
  const kind = assignment.kind;
  return {
    kind,
    shown: status === 'travel' && kind !== 'motor' ? 'travel' : kind,
    date,
    missed: date < today,
    skipped: state.skipped.some(
      (s) => s.forDate === date && s.kind === kind && s.reason === 'user',
    ),
    options: validMoveDays(program, state, kind, date, today),
  };
}

/** There is something to offer: a day to move to, or »Spring over«. */
export function canAct(item: Movable): boolean {
  return !item.skipped || item.options.length > 0;
}

/**
 * The forgotten sessions I dag offers (SPEC 3.1): yesterday's always (also last week's Sunday on a
 * Monday), an older one of this week while the week has a day for it; not one that was skipped
 * with »Spring over« or moved away.
 */
export function forgotten(program: Program, state: State, today: ISODate): Movable[] {
  const yesterday = addDays(today, -1);
  const monday = mondayOf(today);
  const out: Movable[] = [];
  for (let d = yesterday < monday ? yesterday : monday; d < today; d = addDays(d, 1)) {
    const item = movable(program, state, d, today);
    if (!item || item.skipped) continue;
    if (d !== yesterday && item.options.length === 0) continue;
    out.push(item);
  }
  return out;
}

/** The weekday of a date in Danish (»tirsdag«). */
export function weekdayWord(date: ISODate): string {
  return formatLong(date).split(' ')[0] ?? '';
}

/** »i dag«, »i går«, »i morgen« or the weekday (»tirsdag«). */
export function dayRef(date: ISODate, today: ISODate): string {
  if (date === today) return 'i dag';
  if (date === addDays(today, -1)) return 'i går';
  if (date === addDays(today, 1)) return 'i morgen';
  return weekdayWord(date);
}

/** »Torsdag 12. november«, »I dag, torsdag 12. november«, »Kort version lørdag 14. november«. */
export function optionName(option: MoveOption, today: ISODate): string {
  const day = formatLong(option.date);
  if (option.mode === 'short') return `Kort version ${option.date === today ? 'i dag' : day}`;
  return option.date === today ? `I dag, ${day}` : capitalize(day);
}

/** »Motoren udgår denne uge – tag en valgfri rolig tur søndag.«, or without a day (ENGINE 5.9). */
export function motorNote(calm: ISODate | null, today: ISODate): string {
  return calm
    ? `Motoren udgår denne uge – tag en valgfri rolig tur ${dayRef(calm, today)}.`
    : 'Motoren udgår denne uge.';
}

/**
 * What the move costs, on its button (S-MOVE-01): the motor drops – with the day of the optional
 * calm run after the move (5.9 rule 1, S-MOVE-06) – and B close to A.
 */
export function optionNotes(
  program: Program,
  state: State,
  item: Movable,
  option: MoveOption,
  today: ISODate,
): string[] {
  const notes: string[] = [];
  if (option.motorDropped) {
    const move = {
      kind: item.kind,
      fromDate: item.date,
      toDate: option.date,
      short: option.mode === 'short',
      on: today,
    };
    const after = { ...state, moves: [...state.moves, move] };
    notes.push(motorNote(calmTourDay(program, after, option.date, today), today));
  }
  if (option.warning) notes.push(`${option.warning}.`);
  return notes;
}

/** The week plan without the user's moves (the layout and the holidays' overlays). */
function plannedWeek(program: Program, state: State, date: ISODate) {
  return scheduleForWeek(program, { ...state, moves: [] }, mondayOf(date));
}

/** The day a moved session stood on in the week plan, or null when it is on its own day. */
export function movedFrom(
  program: Program,
  state: State,
  kind: SessionKind,
  date: ISODate,
): ISODate | null {
  const planned = plannedWeek(program, state, date).find((a) => a.kind === kind)?.date;
  return planned && planned !== date ? planned : null;
}

/** The week of `date` had a motor, and the moves took its day: »Motoren udgår denne uge«. */
export function motorGone(program: Program, state: State, date: ISODate): boolean {
  const planned = plannedWeek(program, state, date).some((a) => a.kind === 'motor');
  const now = scheduleForWeek(program, state, mondayOf(date)).some((a) => a.kind === 'motor');
  return planned && !now;
}
