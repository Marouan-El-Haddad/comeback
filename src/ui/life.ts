// The club log and the Sunday check on I dag (docs/SPEC.md 3.1, 4.6 and 4.7, DECISIONS.md D63):
// when they are asked, for which day, and what was saved. Small, as I dag needs it at start; the
// screens themselves are fetched after start with lazy() (src/ui/life/LifeForm.tsx).
import {
  addDays,
  calendarWeek,
  clubClosedOn,
  getStep,
  getTrack,
  mondayOf,
  PROGRAM,
  statusOn,
  stepIndex,
  TIME_ZONE,
  todayIn,
  weekday,
} from '../engine/index.ts';
import type {
  ClubContent,
  Freshness,
  Hardness,
  ISODate,
  Program,
  SessionKind,
  State,
} from '../engine/types.ts';
import { distanceText } from './screens/Ladders.tsx';

/**
 * What I dag, Uge or Mere opens in its place: the club log of a club day, the Sunday check of a
 * Sunday, »Flyt eller spring over« for the week plan's session on a day (D64), Status or
 * Begivenheder (D67).
 */
export type LifeRequest =
  | { kind: 'club'; date: ISODate }
  | { kind: 'sunday'; sunday: ISODate }
  | { kind: 'move'; session: SessionKind; date: ISODate }
  | { kind: 'status' }
  | { kind: 'event' };

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
 * phase-in, not sick or on holiday and with the club open. On a travel day the club stands, as the
 * engine says, so it is asked as on any club day (D67, D70).
 */
export function clubDay(program: Program, state: State, date: ISODate): ClubDay | null {
  if (!state.onboarded || calendarWeek(state.startDate, date) < 0) return null;
  if (state.onboardedOn && date < state.onboardedOn) return null;
  const day = weekday(date);
  const status = statusOn(state, date);
  if (!state.schedule.clubDays.includes(day) || status === 'ill' || status === 'holiday') {
    return null;
  }
  if (clubClosedOn(state, date)) return null;
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

/** Only Saturday's grade: no content, hardness or freshness. */
export function gradeOnly(log: ClubLog): boolean {
  return (
    log.attended &&
    log.technique !== undefined &&
    log.content.length === 0 &&
    log.hardness === undefined &&
    log.freshness === undefined
  );
}

/**
 * A log that answers »Hvordan var det?« the day after: anything but the grade the Sunday check
 * gives when the club log is missing (D63, D65, D68, D69). The check writes it alone with an empty
 * content list – the club log's own screen leaves content out when none is chosen – and after its
 * club day; a grade the club log saves alone, on the day or the day after, answers.
 */
function answers(entry: State['club'][number]): boolean {
  const fromCheck =
    entry.content !== undefined &&
    gradeOnly({ ...entry, content: entry.content }) &&
    todayIn(Date.parse(entry.at)) > entry.date;
  return !fromCheck;
}

export interface ClubAsk extends ClubDay {
  /** Yesterday's club session, asked about the day after. */
  yesterday: boolean;
  /** The club time has ended (always true for yesterday and a day without a club time). */
  ended: boolean;
  log: ClubLog | null;
  /**
   * »Hvordan var det?« is answered: a log on the club day itself, and the day after a log that is
   * more than the grade from the Sunday check.
   */
  answered: boolean;
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
    const log = clubLogOn(state, before.date);
    out.push({
      ...before,
      yesterday: true,
      ended: true,
      log,
      answered: state.club.some((c) => c.date === before.date && answers(c)),
    });
  }
  const day = clubDay(program, state, today);
  if (day) {
    const end = clubEnd(day.time);
    const log = clubLogOn(state, today);
    out.push({
      ...day,
      yesterday: false,
      ended: end === null || minutes >= end,
      log,
      answered: log !== null,
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

export interface StandingChange {
  trackId: string;
  /** Taken down for pain (»Ondt«) or one step down as your own choice (»For tungt«). */
  kind: 'pain' | 'heavy';
  /** »lettere variant til 22. november (smerte)«, »nu trin 2«. */
  now: string;
}

/**
 * What the week's Sunday checks changed that still stands (D65): a track one of them named and
 * took down on the check's Sunday – for pain, while the pain period lasts, or as your own choice.
 * Also a track a correction no longer names: it stays where it is. `distance` is Stiger's text for
 * a track in a pain period.
 */
export function standingChanges(
  program: Program,
  state: State,
  due: SundayDue,
  distance: (trackId: string) => string,
): StandingChange[] {
  if (!due.check) return [];
  const out: StandingChange[] = [];
  for (const id of due.check.taken) {
    const t = state.tracks[id];
    // Only the track's newest step change counts, and only when it is the check's: dated its
    // Sunday, and not a step up (a step chosen back under Stiger is not the check's, D68).
    const last = [...state.decisions].reverse().find((d) => d.trackId === id);
    if (!t || !last || last.date !== due.sunday) continue;
    if (t.tempDown && last.reason === 'pain') {
      const text = distance(id);
      out.push({ trackId: id, kind: 'pain', now: text.charAt(0).toLowerCase() + text.slice(1) });
    } else if (
      last.reason === 'user_choice' &&
      stepIndex(program, last.to) <= stepIndex(program, last.from)
    ) {
      out.push({ trackId: id, kind: 'heavy', now: `nu trin ${getStep(program, t.stepId).key}` });
    }
  }
  return out;
}

/** Stiger's text for a track (»Lettere variant til 22. november (smerte)« in a pain period). */
export function trackDistance(state: State, trackId: string): string {
  const t = state.tracks[trackId];
  return t ? distanceText(getTrack(PROGRAM, trackId), t, state.emom.pendingUp) : '';
}

/** »Lyske – lettere variant til 22. november (smerte)« for a standing change. */
export function standingText(program: Program, change: StandingChange): string {
  return `${getTrack(program, change.trackId).short} – ${change.now}`;
}
