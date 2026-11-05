// R-MOVE and R-REST: where a session may be moved within its calendar week (docs/ENGINE.md 5.9).
import { addDays, calendarWeek, mondayOf, weekday } from './dates.ts';
import { getStep, getWeek, hasTag } from './lookup.ts';
import { eventTomorrow, scheduleForWeek, weekInfoAt } from './plan.ts';
import type { AppEvent, EventFactory, ISODate, Program, SessionKind, State } from './types.ts';

export interface MoveOption {
  date: ISODate;
  /** 'short' = the 30-minute version with pair 1 and 2, in the morning of a club day. */
  mode: 'full' | 'short';
  /** A or B takes the motor's day; the motor is dropped this week. */
  motorDropped: boolean;
  /** »B skal efterlade dig frisk« when A and B land on two days in a row. */
  warning?: string;
}

const STRENGTH: ReadonlySet<SessionKind> = new Set(['A', 'B', 'travel']);

function isClubDay(state: State, date: ISODate): boolean {
  return state.schedule.clubDays.includes(weekday(date));
}

function intervalsWeek(program: Program, state: State, date: ISODate): boolean {
  const info = weekInfoAt(program, state, calendarWeek(state.startDate, date));
  const type = info ? getWeek(program, info.pw).motor.type : 'base';
  return type === 'intervals_30_15' || type === 'fight_rounds';
}

/** Valid days to move `kind` from `fromDate` to, from `today` until Sunday. */
export function validMoveDays(
  program: Program,
  state: State,
  kind: SessionKind,
  fromDate: ISODate,
  today: ISODate,
): MoveOption[] {
  const monday = mondayOf(fromDate);
  const sunday = addDays(monday, 6);
  const plan = scheduleForWeek(program, state, monday);
  const others = plan.filter((a) => !(a.kind === kind && a.date === fromDate));
  const options: MoveOption[] = [];
  const first = today > monday ? today : monday;

  for (let date = first; date <= sunday; date = addDays(date, 1)) {
    if (date === fromDate) continue;
    const club = isClubDay(state, date);
    if (club && kind === 'motor') continue; // the motor only moves to a free day
    const there = others.filter((a) => a.date === date);
    const doneThere = state.sessions.filter((s) => s.date === date && s.kind !== 'os');
    // Rule 1 and 5: never two sessions on a day; A and B may take the motor's day.
    if (there.some((a) => STRENGTH.has(a.kind)) || doneThere.some((s) => STRENGTH.has(s.kind)))
      continue;
    const motorThere =
      there.some((a) => a.kind === 'motor') || doneThere.some((s) => s.kind === 'motor');
    if (motorThere && (kind === 'motor' || doneThere.some((s) => s.kind === 'motor'))) continue;
    // Rule 3: not the day before an event for A, motor intervals or a session with Nordic.
    if (eventTomorrow(state, date)) {
      const nordic =
        kind === 'A' &&
        hasTag(getStep(program, state.tracks.posterior?.stepId ?? 'posterior.1'), 'nordic');
      if (kind === 'A' || nordic || (kind === 'motor' && intervalsWeek(program, state, date)))
        continue;
    }
    // Rule 4 (R-REST): at least one whole rest day must remain in the week.
    let restDay = false;
    for (let d = monday; d <= sunday; d = addDays(d, 1)) {
      if (isClubDay(state, d) || d === date) continue;
      const past = d < today;
      const busy = past
        ? state.sessions.some((s) => s.date === d && s.kind !== 'os')
        : others.some((a) => a.date === d);
      if (!busy) {
        restDay = true;
        break;
      }
    }
    if (!restDay) continue;
    const partner = kind === 'A' ? 'B' : kind === 'B' ? 'A' : null;
    const nextTo =
      partner !== null &&
      others.some(
        (a) => a.kind === partner && (a.date === addDays(date, 1) || a.date === addDays(date, -1)),
      );
    options.push({
      date,
      mode: club ? 'short' : 'full',
      motorDropped: motorThere && kind !== 'motor',
      warning: nextTo ? 'B skal efterlade dig frisk' : undefined,
    });
  }
  return options;
}

/** session_moved, or null when the day is not valid (S-MOVE-04: the moved session loses). */
export function moveSession(
  program: Program,
  state: State,
  make: EventFactory,
  input: { kind: SessionKind; fromDate: ISODate; toDate: ISODate; today: ISODate; short?: boolean },
): AppEvent | null {
  const option = validMoveDays(program, state, input.kind, input.fromDate, input.today).find(
    (o) => o.date === input.toDate,
  );
  if (!option) return null;
  if (option.mode === 'short' && input.short === false) return null;
  return make(
    {
      type: 'session_moved',
      kind: input.kind,
      fromDate: input.fromDate,
      toDate: input.toDate,
      short: option.mode === 'short',
    },
    input.today,
  );
}
