// Display helpers: always da-DK and Europe/Copenhagen, whatever the browser reports.
export const CPH = 'Europe/Copenhagen';

const dateTimeFormat = new Intl.DateTimeFormat('da-DK', {
  timeZone: CPH,
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const numberFormat = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 3 });
const msFormat = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 });

export const nowIso = (): string => new Date().toISOString();
export const formatDateTime = (iso: string): string => dateTimeFormat.format(new Date(iso));
export const formatNumber = (n: number): string => numberFormat.format(n);
export const formatMs = (ms: number): string => `${msFormat.format(ms)} ms`;

export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${msFormat.format(bytes / 1e9)} GB`;
  if (bytes >= 1e6) return `${msFormat.format(bytes / 1e6)} MB`;
  return `${msFormat.format(bytes / 1e3)} kB`;
}

/** Seconds as m:ss. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message ? `${error.name}: ${error.message}` : error.name;
  return String(error);
}

/** YYYY-MM-DD in Copenhagen, built from parts so it does not depend on a locale's date pattern. */
export function copenhagenDate(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: CPH,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
