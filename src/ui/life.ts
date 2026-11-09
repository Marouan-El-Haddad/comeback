// The club log and the Sunday check on I dag (docs/SPEC.md 3.1, 4.6 and 4.7, DECISIONS.md D63):
// when they are asked, for which day, and what was saved. Small, as I dag needs it at start; the
// screens themselves are fetched after start with lazy() (src/ui/life/LifeForm.tsx).
import { addDays, calendarWeek, mondayOf, statusOn, TIME_ZONE, weekday } from '../engine/index.ts';
import type {
  ClubContent,
  Freshness,
  Hardness,
  ISODate,
  Program,
  SessionKind,
  State,
} from '../engine/types.ts';

/**
 * What I dag or Uge opens in its place: the club log of a club day, the Sunday check of a Sunday,
 * or »Flyt eller spring over« for the week plan's session on a day (D64).
 */
export type LifeRequest =
  | { kind: 'club'; date: ISODate }
  | { kind: 'sunday'; sunday: ISODate }
  | { kind: 'move'; session: SessionKind; date: ISODate };

export const CONTENT: Record<ClubContent, string> = {
  teknik: 'Teknik',
  power: 'Power',
  fart: 'Fart',
  sparring: 'Sparring',
  mix: 'Mix',
};
export const HARDNESS: Record<Hardness, string> = { easy: 'Let', medium: 'Middel', hard: 'Hård' };
export const FRESHNESS: Record<Freshness, string> = { fresh: 'Frisk', ok: 'OK', flat: 'Flad' };

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Minutes after midnight in Copenhagen at an instant, whatever the device's time zone. */
export function minutesIn(now: number): number {
  const parts = timeFormatter.formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return (value('hour') % 24) * 60 + value('minute');
}

/** The end of a club time like »18–19.30« or »10–11«, in minutes after midnight; null without. */
export function clubEnd(time: string | undefined): number | null {
  const end = time?.split(/[–-]/)[1]?.trim();
  const match = end ? /^(\d{1,2})(?:[.:](\d{2}))?$/.exec(end) : null;
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2] ?? 0);
}

export interface ClubDay {
  date: ISODate;
  /** The club time from the programme (»18–19.30«); missing on an extra club day. */
  time?: string;
}

/**
 * A club day I dag may ask about: a club day in the week plan, in the programme and after the
 * phase-in, without a status (ill, travel, holiday, the club closed).
 */
export function clubDay(program: Program, state: State, date: ISODate): ClubDay | null {
  if (!state.onboarded || calendarWeek(state.startDate, date) < 0) return null;
  if (state.onboardedOn && date < state.onboardedOn) return null;
  const day = weekday(date);
  if (!state.schedule.clubDays.includes(day) || statusOn(state, date) !== null) return null;
  return { date, time: program.club.days.find((d) => d.weekday === day)?.time };
}

/** What was logged for a club day. */
export interface ClubLog {
  attended: boolean;
  content: ClubContent[];
  hardness?: Hardness;
  freshness?: Freshness;
  technique?: number;
}

/**
 * Every log of a club day read together, later values over earlier ones: the club log, and the
 * Saturday grade given in the Sunday check when the club log had none (D63).
 */
export function clubLogOn(state: State, date: ISODate): ClubLog | null {
  const logs = state.club.filter((c) => c.date === date);
  if (logs.length === 0) return null;
  const out: ClubLog = { attended: true, content: [] };
  for (const c of logs) {
    out.attended = c.attended;
    if (c.content && c.content.length > 0) out.content = c.content;
    if (c.hardness) out.hardness = c.hardness;
    if (c.freshness) out.freshness = c.freshness;
    if (c.technique !== undefined) out.technique = c.technique;
  }
  return out;
}

/** »Hård · Flad · Teknik, Sparring · karakter 7«, »du var der ikke« or »mødt«. */
export function clubSummary(log: ClubLog): string {
  if (!log.attended) return 'du var der ikke';
  const parts = [
    log.hardness ? HARDNESS[log.hardness] : '',
    log.freshness ? FRESHNESS[log.freshness] : '',
    log.content.map((c) => CONTENT[c]).join(', '),
    log.technique !== undefined ? `karakter ${log.technique}` : '',
  ].filter((p) => p !== '');
  return parts.length > 0 ? parts.join(' · ') : 'mødt';
}

export interface ClubAsk extends ClubDay {
  /** Yesterday's club session, asked about the day after. */
  yesterday: boolean;
  /** The club time has ended (always true for yesterday and a day without a club time). */
  ended: boolean;
  log: ClubLog | null;
}

/**
 * The club sessions I dag asks »Hvordan var det?« about (docs/SPEC.md 4.6): yesterday's, and
 * today's from the end of its club time (all day when the day has none). `minutes` is the time of
 * day in Copenhagen.
 */
export function clubAsks(
  program: Program,
  state: State,
  today: ISODate,
  minutes: number,
): ClubAsk[] {
  const out: ClubAsk[] = [];
  const before = clubDay(program, state, addDays(today, -1));
  if (before) {
    out.push({ ...before, yesterday: true, ended: true, log: clubLogOn(state, before.date) });
  }
  const day = clubDay(program, state, today);
  if (day) {
    const end = clubEnd(day.time);
    out.push({
      ...day,
      yesterday: false,
      ended: end === null || minutes >= end,
      log: clubLogOn(state, today),
    });
  }
  return out;
}

export interface SundayDue {
  /** The Sunday the check belongs to (its `date`), also when it is taken on the Monday. */
  sunday: ISODate;
  weekStart: ISODate;
  /** Monday: the check was not taken on Sunday (»Glemt i går?«). */
  late: boolean;
  /** The week's saved check (the newest), or null. */
  check: State['sundayChecks'][number] | null;
}

/**
 * The Sunday check I dag shows (docs/SPEC.md 4.7): on Sunday, and on the Monday after for the week
 * that ended, in the programme and after the phase-in.
 */
export function sundayDue(state: State, today: ISODate): SundayDue | null {
  const day = weekday(today);
  if (day !== 7 && day !== 1) return null;
  const sunday = day === 7 ? today : addDays(today, -1);
  if (!state.onboarded || calendarWeek(state.startDate, sunday) < 0) return null;
  if (state.onboardedOn && sunday < state.onboardedOn) return null;
  const weekStart = mondayOf(sunday);
  return {
    sunday,
    weekStart,
    late: day === 1,
    check: state.sundayChecks.find((c) => c.weekStart === weekStart) ?? null,
  };
}

/** »7,5« – hours as the Danish write them. */
export function hoursText(hours: number): string {
  return String(hours).replace('.', ',');
}
