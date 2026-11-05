// The mirror: the whole log as export JSON in localStorage['comeback.mirror'] (docs/SPEC.md 9).
// When IndexedDB has no events but the mirror has, the store restores them from here. The mirror
// is a second copy: a failing localStorage (full, disabled) never stops a save, it only shows in
// the status.
import { exportFile, parseImport, serializeExport, type ExportFile } from '../engine/data.ts';
import type { AppEvent } from '../engine/types.ts';

export const MIRROR_KEY = 'comeback.mirror';
/** Where a mirror that cannot be read is kept before a new log may overwrite it. */
export const UNREADABLE_MIRROR_KEY = 'comeback.mirror.unreadable';
/** Saves within this time are mirrored in one write. */
export const MIRROR_DELAY_MS = 1500;

/** The part of `Storage` the mirror uses: localStorage, or a stand-in in tests. */
export type MirrorStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface MirrorStatus {
  /** False when the last write failed, or when there is no localStorage. */
  ok: boolean;
  /** Saved events are not mirrored yet. */
  pending: boolean;
  /** When the mirror was last written (ISO), and with how many events. */
  savedAt: string | null;
  events: number;
  /** The last failure, in Danish. */
  error: string | null;
}

export type MirrorRead =
  { ok: true; file: ExportFile } | { ok: false; reason: string; newer: boolean; text: string };

/** localStorage, or null when the browser has none or refuses access to it. */
export function defaultMirrorStorage(): MirrorStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : String(error);
}

export class Mirror {
  private readonly storage: MirrorStorage | null;
  private readonly programVersion: string;
  private readonly source: () => readonly AppEvent[];
  private readonly canWrite: () => boolean;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private dirty = false;
  private blocked = false;
  private last: Omit<MirrorStatus, 'pending'>;

  /**
   * `source` gives the whole log at the moment of writing. While `canWrite` is false (the time
   * machine runs), nothing is written; the pending write waits for the next flush.
   */
  constructor(
    storage: MirrorStorage | null,
    programVersion: string,
    source: () => readonly AppEvent[],
    canWrite: () => boolean = () => true,
  ) {
    this.storage = storage;
    this.programVersion = programVersion;
    this.source = source;
    this.canWrite = canWrite;
    this.last = {
      ok: storage !== null,
      savedAt: null,
      events: 0,
      error: storage ? null : 'localStorage er ikke tilgængeligt.',
    };
  }

  get status(): MirrorStatus {
    return { ...this.last, pending: this.dirty };
  }

  /** Reads and validates the mirror; null when there is none. */
  read(): MirrorRead | null {
    let text: string | null;
    try {
      text = this.storage?.getItem(MIRROR_KEY) ?? null;
    } catch {
      return null;
    }
    if (text === null) return null;
    const parsed = parseImport(text);
    if (parsed.ok) return { ok: true, file: parsed.file };
    return { ok: false, reason: parsed.reason, newer: parsed.newer === true, text };
  }

  /**
   * Keeps a mirror that cannot be read under UNREADABLE_MIRROR_KEY before the log may overwrite
   * it. If even that fails, the mirror is not written again in this session.
   */
  keepUnreadable(text: string): void {
    try {
      this.storage?.setItem(UNREADABLE_MIRROR_KEY, text);
    } catch (error) {
      this.blocked = true;
      this.last = {
        ...this.last,
        ok: false,
        error: `Spejlet kunne ikke læses og overskrives ikke (${errorName(error)}).`,
      };
    }
  }

  /** The log has changed: write the mirror within MIRROR_DELAY_MS (one write for a burst). */
  schedule(): void {
    this.dirty = true;
    this.timer ??= setTimeout(() => {
      this.timer = undefined;
      this.flush();
    }, MIRROR_DELAY_MS);
  }

  /** Writes the mirror now if it is behind the log. Never throws. */
  flush(): MirrorStatus {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (!this.dirty || !this.storage || this.blocked || !this.canWrite()) return this.status;
    const events = this.source();
    const at = new Date().toISOString();
    try {
      this.storage.setItem(
        MIRROR_KEY,
        serializeExport(exportFile(events, this.programVersion, at)),
      );
      this.dirty = false;
      this.last = { ok: true, savedAt: at, events: events.length, error: null };
    } catch (error) {
      // Stays pending: the next flush (the next save, or the app going to the background) retries.
      this.last = {
        ...this.last,
        ok: false,
        error: `Spejlet kunne ikke gemmes (${errorName(error)}).`,
      };
    }
    return this.status;
  }
}
