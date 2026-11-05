// The event store (docs/SPEC.md 2 and 9, ENGINE.md 5.14 and 7.4): the IndexedDB database 'comeback'
// keeps the append-only log in 'events' (auto-increment key, read back in key order) and key-value
// data in 'meta', and the log is mirrored to localStorage. Events are never edited or deleted; only
// »Erstat alt« and a schema migration rewrite the log, each after a copy in 'meta'. The time
// machine works on a MemoryStore while the real store is read-only.
import { SCHEMA_VERSION } from '../engine/data.ts';
import { migrate, MIGRATIONS, type Migration, type StoredLog } from '../engine/migrations/index.ts';
import { PROGRAM } from '../engine/program.ts';
import type { AppEvent } from '../engine/types.ts';
import { inTransaction, openDatabase, requestResult } from './idb.ts';
import { defaultMirrorStorage, Mirror, type MirrorStatus, type MirrorStorage } from './mirror.ts';

export type { MirrorStatus, MirrorStorage } from './mirror.ts';

export const DB_NAME = 'comeback';
const DB_VERSION = 1;
const EVENTS = 'events';
const META = 'meta';

/** Meta keys the store itself writes. */
export const SCHEMA_KEY = 'schemaVersion';
export const BACKUP_BEFORE_MIGRATION = 'backup_before_migration';
export const BACKUP_BEFORE_IMPORT = 'backup_before_import';

export interface LoadResult {
  /** All events in append order. */
  events: AppEvent[];
  schemaVersion: number;
  /** IndexedDB was empty and the events came from the mirror (»Data gendannet fra spejl«). */
  restoredFromMirror: boolean;
  /** Schema versions migrated to during this load. */
  migrated: number[];
}

/** The log as it was before a migration or an import replaced it. */
export interface StoredBackup extends StoredLog {
  savedAt: string;
}

export interface EventStore {
  readonly kind: 'idb' | 'memory';
  /** True while the time machine runs; every write then rejects with ReadOnlyError. */
  readOnly: boolean;
  /** Reads the log (migrating or restoring it from the mirror first, if needed). */
  load(): Promise<LoadResult>;
  /** Saves events in one transaction; resolves once committed. Known ids are ignored. */
  append(events: AppEvent[]): Promise<void>;
  /** »Erstat alt«: keeps the current log under 'backup_before_import' first. */
  replaceAll(events: AppEvent[]): Promise<void>;
  count(): Promise<number>;
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: unknown): Promise<void>;
  /** Writes the localStorage mirror now instead of after the delay. */
  flushMirror(): MirrorStatus;
  readonly mirrorStatus: MirrorStatus;
  /** Flushes the mirror and closes the database connection. */
  close(): void;
}

export class ReadOnlyError extends Error {
  override name = 'ReadOnlyError';
  constructor(message = 'Lageret er skrivebeskyttet, mens tidsmaskinen kører.') {
    super(message);
  }
}

/** The stored data (or the mirror) has a newer schema than this version of the app knows. */
export class NewerSchemaError extends Error {
  override name = 'NewerSchemaError';
  readonly found: number | null;
  constructor(found: number | null) {
    super('Dataene er fra en nyere version af appen. Opdatér appen først.');
    this.found = found;
  }
}

export interface StoreOptions {
  /** IndexedDB database name (default 'comeback'). */
  dbName?: string;
  /** Where the mirror lives (default localStorage). */
  storage?: MirrorStorage;
  /** Tests only: the migrations to run instead of MIGRATIONS. */
  migrations?: readonly Migration[];
}

interface Loaded {
  events: AppEvent[];
  restored: boolean;
  applied: number[];
}

const MIRROR_UNUSED: MirrorStatus = {
  ok: true,
  pending: false,
  savedAt: null,
  events: 0,
  error: null,
};

function uniqueById(events: readonly AppEvent[]): AppEvent[] {
  const seen = new Set<string>();
  const unique: AppEvent[] = [];
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    unique.push(event);
  }
  return unique;
}

function sameIds(a: readonly AppEvent[], b: readonly AppEvent[]): boolean {
  return a.length === b.length && a.every((event, i) => event.id === b[i]?.id);
}

function createStores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(EVENTS)) db.createObjectStore(EVENTS, { autoIncrement: true });
  if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
}

function indexedDBFactory(): IDBFactory | null {
  try {
    return typeof indexedDB === 'undefined' ? null : indexedDB;
  } catch {
    return null;
  }
}

/** Opens the IndexedDB store. Call `load()` before showing anything. */
export async function openStore(options: StoreOptions = {}): Promise<EventStore> {
  const factory = indexedDBFactory();
  if (!factory) throw new Error('Browseren giver ikke adgang til lageret (IndexedDB).');
  const db = await openDatabase(factory, options.dbName ?? DB_NAME, DB_VERSION, createStores);
  return new IdbStore(db, options.storage ?? defaultMirrorStorage(), options.migrations);
}

class IdbStore implements EventStore {
  readonly kind = 'idb';
  readOnly = false;
  private readonly db: IDBDatabase;
  private readonly migrations: readonly Migration[];
  private readonly mirror: Mirror;
  /** The committed log and its ids; the mirror is written from here. */
  private events: AppEvent[] = [];
  private ids = new Set<string>();
  private loaded: Promise<LoadResult> | undefined;

  constructor(
    db: IDBDatabase,
    storage: MirrorStorage | null,
    migrations: readonly Migration[] = MIGRATIONS,
  ) {
    this.db = db;
    this.migrations = migrations;
    this.mirror = new Mirror(
      storage,
      PROGRAM.programVersion,
      () => this.events,
      () => !this.readOnly,
    );
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.mirror.flush();
  };

  get mirrorStatus(): MirrorStatus {
    return this.mirror.status;
  }

  flushMirror(): MirrorStatus {
    return this.mirror.flush();
  }

  load(): Promise<LoadResult> {
    const loading = this.read();
    this.loaded = loading;
    return loading;
  }

  async append(events: AppEvent[]): Promise<void> {
    await this.writable();
    const fresh: AppEvent[] = [];
    for (const event of events) {
      if (this.ids.has(event.id)) continue;
      this.ids.add(event.id);
      fresh.push(event);
    }
    if (fresh.length === 0) return;
    try {
      await inTransaction(this.db, [EVENTS], 'readwrite', (tx) => {
        const store = tx.objectStore(EVENTS);
        for (const event of fresh) store.add(event);
        return () => undefined;
      });
    } catch (error) {
      // Not saved: the same events must be accepted when they are tried again.
      for (const event of fresh) this.ids.delete(event.id);
      throw error;
    }
    this.events.push(...fresh);
    this.mirror.schedule();
  }

  async replaceAll(events: AppEvent[]): Promise<void> {
    await this.writable();
    const next = uniqueById(events);
    const savedAt = new Date().toISOString();
    await inTransaction(this.db, [EVENTS, META], 'readwrite', (tx, guard) => {
      const store = tx.objectStore(EVENTS);
      const current = store.getAll();
      current.onsuccess = guard(() => {
        const before = current.result as AppEvent[];
        // The same log again (a second tap on »Erstat alt«) must not overwrite the backup.
        if (sameIds(before, next)) return;
        if (before.length > 0) {
          const backup: StoredBackup = { schemaVersion: SCHEMA_VERSION, savedAt, events: before };
          tx.objectStore(META).put(backup, BACKUP_BEFORE_IMPORT);
        }
        store.clear();
        for (const event of next) store.add(event);
      });
      return () => undefined;
    });
    this.events = next;
    this.ids = new Set(next.map((event) => event.id));
    this.mirror.schedule();
    this.mirror.flush();
  }

  async count(): Promise<number> {
    return await requestResult(this.db.transaction(EVENTS, 'readonly').objectStore(EVENTS).count());
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    const value: unknown = await requestResult(
      this.db.transaction(META, 'readonly').objectStore(META).get(key),
    );
    return value as T | undefined;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.writable();
    await inTransaction(this.db, [META], 'readwrite', (tx) => {
      tx.objectStore(META).put(value, key);
      return () => undefined;
    });
  }

  close(): void {
    this.mirror.flush();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.db.close();
  }

  /** Rejects while read-only, and loads the log first, so the known ids are complete. */
  private async writable(): Promise<void> {
    if (this.readOnly) throw new ReadOnlyError();
    await (this.loaded ?? this.load());
    if (this.readOnly) throw new ReadOnlyError();
  }

  private async read(): Promise<LoadResult> {
    const readOnly = this.readOnly;
    const mode = readOnly ? 'readonly' : 'readwrite';
    const loaded = await inTransaction(this.db, [EVENTS, META], mode, (tx, guard) => {
      let outcome: Loaded | undefined;
      const version = tx.objectStore(META).get(SCHEMA_KEY);
      const stored = tx.objectStore(EVENTS).getAll();
      stored.onsuccess = guard(() => {
        outcome = this.settle(tx, version.result, stored.result, readOnly);
      });
      return () => {
        if (!outcome) throw new Error('Lageret kunne ikke læses.');
        return outcome;
      };
    });
    this.events = loaded.events;
    this.ids = new Set(loaded.events.map((event) => event.id));
    // Brings the mirror up to date, should the app have closed before the last mirror write.
    if (loaded.events.length > 0) this.mirror.schedule();
    return {
      events: [...loaded.events],
      schemaVersion: SCHEMA_VERSION,
      restoredFromMirror: loaded.restored,
      migrated: loaded.applied,
    };
  }

  /**
   * Inside the load transaction: restores from the mirror when IndexedDB has no events, migrates
   * an older schema and writes the result. The copy before a migration is written first and in
   * the same transaction as the rewrite, so either both are saved or nothing is.
   */
  private settle(
    tx: IDBTransaction,
    storedVersion: unknown,
    stored: unknown[],
    readOnly: boolean,
  ): Loaded {
    const version = typeof storedVersion === 'number' ? storedVersion : null;
    if (version !== null && version > SCHEMA_VERSION) throw new NewerSchemaError(version);
    let log: StoredLog = { schemaVersion: version ?? SCHEMA_VERSION, events: stored };
    let restored = false;
    if (stored.length === 0) {
      const mirror = this.mirror.read();
      if (mirror?.ok && mirror.file.events.length > 0) {
        log = { schemaVersion: mirror.file.schemaVersion, events: mirror.file.events };
        restored = true;
      } else if (mirror && !mirror.ok) {
        if (mirror.newer) throw new NewerSchemaError(null);
        if (!readOnly) this.mirror.keepUnreadable(mirror.text);
      }
    }
    const migration = migrate(log, this.migrations, SCHEMA_VERSION);
    const rewrite = restored || migration.applied.length > 0;
    const writeVersion = rewrite || version === null;
    if (writeVersion && readOnly) throw new ReadOnlyError();
    const meta = tx.objectStore(META);
    if (migration.backup) {
      const backup: StoredBackup = { ...migration.backup, savedAt: new Date().toISOString() };
      meta.put(backup, BACKUP_BEFORE_MIGRATION);
    }
    let events = migration.log.events as AppEvent[];
    if (rewrite) {
      events = uniqueById(events);
      const store = tx.objectStore(EVENTS);
      store.clear();
      for (const event of events) store.add(event);
    }
    if (writeVersion) meta.put(SCHEMA_VERSION, SCHEMA_KEY);
    return { events, restored, applied: migration.applied };
  }
}

function settled<T>(work: () => T): Promise<T> {
  return new Promise((resolve) => resolve(work()));
}

/**
 * The time machine's store: a copy of the log in memory. Nothing it does reaches IndexedDB or
 * localStorage; »Afslut« simply drops it (docs/SPEC.md 3.7, ENGINE.md 5.14).
 */
export class MemoryStore implements EventStore {
  readonly kind = 'memory';
  readOnly = false;
  private events: AppEvent[];
  private ids: Set<string>;
  private readonly meta = new Map<string, unknown>();

  constructor(events: readonly AppEvent[]) {
    this.events = uniqueById(structuredClone(events));
    this.ids = new Set(this.events.map((event) => event.id));
  }

  get mirrorStatus(): MirrorStatus {
    return { ...MIRROR_UNUSED };
  }

  flushMirror(): MirrorStatus {
    return { ...MIRROR_UNUSED };
  }

  load(): Promise<LoadResult> {
    return settled(() => ({
      events: [...this.events],
      schemaVersion: SCHEMA_VERSION,
      restoredFromMirror: false,
      migrated: [],
    }));
  }

  append(events: AppEvent[]): Promise<void> {
    return settled(() => {
      this.assertWritable();
      for (const event of structuredClone(events)) {
        if (this.ids.has(event.id)) continue;
        this.ids.add(event.id);
        this.events.push(event);
      }
    });
  }

  replaceAll(events: AppEvent[]): Promise<void> {
    return settled(() => {
      this.assertWritable();
      const next = uniqueById(structuredClone(events));
      if (sameIds(this.events, next)) return;
      if (this.events.length > 0) {
        const backup: StoredBackup = {
          schemaVersion: SCHEMA_VERSION,
          savedAt: new Date().toISOString(),
          events: this.events,
        };
        this.meta.set(BACKUP_BEFORE_IMPORT, backup);
      }
      this.events = next;
      this.ids = new Set(next.map((event) => event.id));
    });
  }

  count(): Promise<number> {
    return settled(() => this.events.length);
  }

  getMeta<T>(key: string): Promise<T | undefined> {
    return settled(() => structuredClone(this.meta.get(key)) as T | undefined);
  }

  setMeta(key: string, value: unknown): Promise<void> {
    return settled(() => {
      this.assertWritable();
      this.meta.set(key, structuredClone(value));
    });
  }

  close(): void {
    // Nothing to release: the copy lives in memory only.
  }

  private assertWritable(): void {
    if (this.readOnly) throw new ReadOnlyError();
  }
}
