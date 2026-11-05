// Export, import and merge of the event log (docs/ENGINE.md 7.4, docs/SPEC.md 9).
import { isValidDate } from './dates.ts';
import type { AppEvent } from './types.ts';

export const SCHEMA_VERSION = 1;
export const APP_ID = 'comeback';

export interface ExportFile {
  app: typeof APP_ID;
  schemaVersion: number;
  programVersion: string;
  exportedAt: string;
  events: AppEvent[];
}

export function exportFile(
  events: readonly AppEvent[],
  programVersion: string,
  exportedAt: string,
): ExportFile {
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    programVersion,
    exportedAt,
    events: [...events],
  };
}

/** The file's text: stable key order, so the same log always gives the same bytes. */
export function serializeExport(file: ExportFile): string {
  return `${JSON.stringify(file, null, 1)}\n`;
}

export interface ImportPreview {
  count: number;
  from: string | null;
  to: string | null;
  programVersion: string;
  schemaVersion: number;
}

export type ImportResult =
  | { ok: true; file: ExportFile; preview: ImportPreview }
  | { ok: false; reason: string; newer?: boolean };

function isEvent(value: unknown): value is AppEvent {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    e.id.length > 0 &&
    typeof e.type === 'string' &&
    typeof e.at === 'string' &&
    isValidDate(e.date) &&
    e.v === 1
  );
}

/** Validates a backup file and returns a preview before anything is changed. */
export function parseImport(text: string, currentSchema = SCHEMA_VERSION): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'Filen er ikke gyldig JSON.' };
  }
  if (typeof data !== 'object' || data === null) return { ok: false, reason: 'Filen er tom.' };
  const file = data as Record<string, unknown>;
  if (file.app !== APP_ID) return { ok: false, reason: 'Filen er ikke en Comeback-backup.' };
  if (typeof file.schemaVersion !== 'number')
    return { ok: false, reason: 'Skemaversionen mangler.' };
  if (file.schemaVersion > currentSchema) {
    return {
      ok: false,
      reason: 'Filen er fra en nyere version. Opdatér appen først.',
      newer: true,
    };
  }
  if (!Array.isArray(file.events)) return { ok: false, reason: 'Filen har ingen hændelser.' };
  const bad = file.events.findIndex((e) => !isEvent(e));
  if (bad >= 0) return { ok: false, reason: `Hændelse nr. ${bad + 1} er ugyldig.` };
  const events = file.events as AppEvent[];
  const dates = events.map((e) => e.date).sort();
  return {
    ok: true,
    file: {
      app: APP_ID,
      schemaVersion: file.schemaVersion,
      programVersion: typeof file.programVersion === 'string' ? file.programVersion : '?',
      exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : '',
      events,
    },
    preview: {
      count: events.length,
      from: dates[0] ?? null,
      to: dates[dates.length - 1] ?? null,
      programVersion: typeof file.programVersion === 'string' ? file.programVersion : '?',
      schemaVersion: file.schemaVersion,
    },
  };
}

/**
 * »Flet«: the union of both logs. Events with an id already present are ignored; the result is
 * ordered by `at` (stable, so events with the same time keep their order).
 */
export function mergeEvents(
  current: readonly AppEvent[],
  incoming: readonly AppEvent[],
): AppEvent[] {
  const seen = new Set(current.map((e) => e.id));
  const merged = [...current];
  for (const e of incoming) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    merged.push(e);
  }
  return merged
    .map((e, index) => ({ e, index }))
    .sort((a, b) => (a.e.at < b.e.at ? -1 : a.e.at > b.e.at ? 1 : a.index - b.index))
    .map(({ e }) => e);
}
