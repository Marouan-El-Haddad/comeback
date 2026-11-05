// Dates are 'YYYY-MM-DD' strings in Europe/Copenhagen (docs/SPEC.md section 8). Arithmetic works
// on whole days counted from 1970-01-01, so summer time and the device's time zone never matter.
import type { ISODate } from './types.ts';

export const TIME_ZONE = 'Europe/Copenhagen';
const DAY_MS = 86_400_000;

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The date in Copenhagen at an instant (epoch milliseconds), whatever the device's time zone. */
export function todayIn(now: number): ISODate {
  const parts = dayFormatter.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function dayNumber(date: ISODate): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

export function fromDayNumber(day: number): ISODate {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromDayNumber(dayNumber(date) + days);
}

/** Whole days from `a` to `b` (negative when b is before a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return dayNumber(b) - dayNumber(a);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function weekday(date: ISODate): number {
  return ((((dayNumber(date) + 3) % 7) + 7) % 7) + 1;
}

export function mondayOf(date: ISODate): ISODate {
  return addDays(date, 1 - weekday(date));
}

/** Calendar week k counted from the programme's start Monday (k = 0 is week one). */
export function calendarWeek(startMonday: ISODate, date: ISODate): number {
  return Math.floor(daysBetween(startMonday, date) / 7);
}

export function isValidDate(date: unknown): date is ISODate {
  return (
    typeof date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    fromDayNumber(dayNumber(date)) === date
  );
}

const longFormatter = new Intl.DateTimeFormat('da-DK', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const shortFormatter = new Intl.DateTimeFormat('da-DK', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'long',
});

function utc(date: ISODate): Date {
  return new Date(dayNumber(date) * DAY_MS);
}

function part(
  formatter: Intl.DateTimeFormat,
  date: ISODate,
  type: Intl.DateTimeFormatPartTypes,
): string {
  return formatter.formatToParts(utc(date)).find((p) => p.type === type)?.value ?? '';
}

/** "tirsdag 10. november" – built from parts, so every browser's ICU gives the same text. */
export function formatLong(date: ISODate): string {
  return `${part(longFormatter, date, 'weekday')} ${formatDay(date)}`;
}

/** "10. november" */
export function formatDay(date: ISODate): string {
  return `${part(shortFormatter, date, 'day')}. ${part(shortFormatter, date, 'month')}`;
}

const WEEKDAYS = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];

/** Danish weekday name for an ISO weekday (1 = mandag). */
export function weekdayName(day: number): string {
  return WEEKDAYS[(day - 1 + 7) % 7] ?? '';
}
