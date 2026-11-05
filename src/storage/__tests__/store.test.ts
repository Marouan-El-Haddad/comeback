// The storage layer (docs/SPEC.md 2, 3.7 and 9; ENGINE.md 5.14 and 7.4) against fake-indexeddb, with
// an in-memory stand-in for localStorage. Every test has its own database.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { parseImport, SCHEMA_VERSION } from '../../engine/data.ts';
import { MIGRATIONS, type Migration } from '../../engine/migrations/index.ts';
import type { AppEvent } from '../../engine/types.ts';
import { MIRROR_DELAY_MS, MIRROR_KEY } from '../mirror.ts';
import {
  BACKUP_BEFORE_IMPORT,
  BACKUP_BEFORE_MIGRATION,
  MemoryStore,
  NewerSchemaError,
  openStore,
  ReadOnlyError,
  type EventStore,
  type StoreOptions,
  type StoredBackup,
} from '../store.ts';

class FakeStorage {
  readonly data = new Map<string, string>();
  writes = 0;
  /** Name of the DOMException every write throws, e.g. 'QuotaExceededError'. */
  failWith: string | null = null;

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.writes++;
    if (this.failWith) throw new DOMException('Skrivning nægtet', this.failWith);
    this.data.set(key, value);
  }
}

/** Distinct events of several kinds, nested values and Danish text; `sample(n)` starts the same. */
function sample(count: number, prefix = 'e'): AppEvent[] {
  const events: AppEvent[] = [];
  for (let n = 0; n < count; n++) {
    const base = {
      id: `${prefix}${String(n).padStart(4, '0')}`,
      at: new Date(Date.UTC(2026, 10, 9, 7, 0, n)).toISOString(),
      date: '2026-11-09',
      v: 1 as const,
    };
    if (n % 3 === 0) {
      events.push({ ...base, type: 'os_done' });
    } else if (n % 3 === 1) {
      events.push({
        ...base,
        type: 'set_logged',
        sessionId: 's1',
        blockId: 'A.pair1.press',
        trackId: 'press',
        stepId: 'press.3',
        setIndex: n,
        side: 'L',
        reps: 8 + (n % 5),
        rir: 2,
        asPlanned: n % 2 === 0,
      });
    } else {
      events.push({
        ...base,
        type: 'step_changed',
        trackId: 'press',
        from: 'press.3',
        to: 'press.4',
        by: 'engine',
        reason: 'progression',
        explanation: `Ét trin op – »${n} × 12« i to grønne pas i træk.`,
        week: { round: 1, pw: 2 },
      });
    }
  }
  return events;
}

function mirroredEvents(storage: FakeStorage): AppEvent[] | null {
  const text = storage.getItem(MIRROR_KEY);
  if (text === null) return null;
  const parsed = parseImport(text);
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.file.events;
}

let databases = 0;
const opened: EventStore[] = [];

function freshName(): string {
  databases++;
  return `comeback-test-${databases}`;
}

async function open(options: StoreOptions = {}): Promise<EventStore> {
  const store = await openStore({
    dbName: options.dbName ?? freshName(),
    storage: options.storage ?? new FakeStorage(),
    migrations: options.migrations,
  });
  opened.push(store);
  return store;
}

afterEach(() => {
  for (const store of opened.splice(0)) store.close();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Lager', () => {
  test('append og load: rækkefølge og indhold bevares nøjagtigt', async () => {
    const store = await open();
    expect(await store.load()).toEqual({
      events: [],
      schemaVersion: SCHEMA_VERSION,
      restoredFromMirror: false,
      migrated: [],
    });
    expect(await store.getMeta('schemaVersion')).toBe(SCHEMA_VERSION);

    const events = sample(25);
    await store.append(events.slice(0, 1));
    await store.append(events.slice(1, 10));
    await store.append(events.slice(10));
    const loaded = await store.load();
    expect(loaded.events).toEqual(events);
    expect(JSON.stringify(loaded.events)).toBe(JSON.stringify(events));
    expect(await store.count()).toBe(25);
  });

  test('en hændelse med et id, der allerede findes, gemmes ikke igen', async () => {
    const dbName = freshName();
    const store = await open({ dbName });
    await store.load();
    const [a, b, c, d, e, f] = sample(6) as [
      AppEvent,
      AppEvent,
      AppEvent,
      AppEvent,
      AppEvent,
      AppEvent,
    ];
    await store.append([a, b]);
    await store.append([b, c]);
    await store.append([c, c, d]);
    await Promise.all([store.append([e]), store.append([e])]);
    expect(await store.count()).toBe(5);
    expect((await store.load()).events).toEqual([a, b, c, d, e]);

    // A new connection knows the stored ids, also when it appends before an explicit load.
    const again = await open({ dbName });
    await again.append([a, f]);
    expect(await again.count()).toBe(6);
    expect((await again.load()).events).toEqual([a, b, c, d, e, f]);
  });

  test('en ny forbindelse til databasen finder alt igen', async () => {
    const dbName = freshName();
    const events = sample(12);
    const first = await open({ dbName });
    await first.load();
    await first.append(events);
    await first.setMeta('persistRequested', true);
    first.close();

    const second = await open({ dbName });
    const loaded = await second.load();
    expect(loaded.events).toEqual(events);
    expect(loaded.restoredFromMirror).toBe(false);
    expect(loaded.migrated).toEqual([]);
    expect(await second.getMeta('persistRequested')).toBe(true);
    expect(await second.getMeta('schemaVersion')).toBe(SCHEMA_VERSION);
  });

  test('tom IndexedDB og et spejl: hændelserne gendannes fra spejlet', async () => {
    const storage = new FakeStorage();
    const events = sample(8);
    const before = await open({ storage });
    await before.load();
    await before.append(events);
    expect(before.flushMirror()).toMatchObject({ ok: true, pending: false, events: 8 });
    expect(mirroredEvents(storage)).toEqual(events);
    before.close();

    // IndexedDB is lost; localStorage still has the mirror.
    const dbName = freshName();
    const after = await open({ dbName, storage });
    const restored = await after.load();
    expect(restored.restoredFromMirror).toBe(true);
    expect(restored.events).toEqual(events);
    expect(await after.count()).toBe(8);
    after.close();

    const reopened = await open({ dbName, storage });
    const loaded = await reopened.load();
    expect(loaded.restoredFromMirror).toBe(false);
    expect(loaded.events).toEqual(events);
  });

  test('S-TIME-02: lagerets antal hændelser er uændret, mens tidsmaskinen kører', async () => {
    const storage = new FakeStorage();
    const real = await open({ storage });
    await real.load();
    const events = sample(6);
    await real.append(events);
    real.flushMirror();
    const mirrorBefore = storage.getItem(MIRROR_KEY);
    const writesBefore = storage.writes;
    const countBefore = await real.count();

    // The time machine: the real store read-only, the simulation on a copy in memory.
    real.readOnly = true;
    const sim = new MemoryStore((await real.load()).events);
    const simulated = sample(10).slice(6);
    await sim.append(simulated);
    expect(await sim.count()).toBe(10);

    await expect(real.append(simulated)).rejects.toBeInstanceOf(ReadOnlyError);
    await expect(real.replaceAll(simulated)).rejects.toBeInstanceOf(ReadOnlyError);
    await expect(real.setMeta('persistRequested', true)).rejects.toBeInstanceOf(ReadOnlyError);
    expect(await real.count()).toBe(countBefore);
    expect(await real.getMeta('persistRequested')).toBeUndefined();
    real.flushMirror();
    expect(storage.writes).toBe(writesBefore);
    expect(storage.getItem(MIRROR_KEY)).toBe(mirrorBefore);

    // »Afslut«: the copy is dropped, and the real log is exactly as before.
    real.readOnly = false;
    expect((await real.load()).events).toEqual(events);
    expect(await real.count()).toBe(countBefore);
    real.flushMirror();
    expect(mirroredEvents(storage)).toEqual(events);
  });

  test('replaceAll gemmer først den hidtidige log som backup_before_import', async () => {
    const store = await open();
    await store.load();
    const current = sample(5);
    const imported = sample(9, 'i');
    await store.append(current);

    await store.replaceAll(imported);
    expect((await store.load()).events).toEqual(imported);
    const backup = await store.getMeta<StoredBackup>(BACKUP_BEFORE_IMPORT);
    expect(backup?.events).toEqual(current);
    expect(backup?.schemaVersion).toBe(SCHEMA_VERSION);

    // The same file once more (a second tap) changes nothing and keeps the backup.
    await store.replaceAll(imported);
    expect((await store.getMeta<StoredBackup>(BACKUP_BEFORE_IMPORT))?.events).toEqual(current);
    // The imported ids are now the known ones.
    await store.append(imported.slice(0, 2));
    expect(await store.count()).toBe(imported.length);
  });

  test('S-DATA-04: kopi før migration i lageret', async () => {
    const dbName = freshName();
    const original = sample(7);
    const old = await open({ dbName });
    await old.load();
    await old.append(original);
    await old.setMeta('schemaVersion', 0); // a log stored by a version with schema 0
    old.close();

    const v0ToV1: Migration = {
      from: 0,
      to: 1,
      migrate: (events) => events.map((event) => ({ ...(event as object), migrated: true })),
    };
    const migrations = [v0ToV1, ...MIGRATIONS];
    const store = await open({ dbName, migrations });
    const loaded = await store.load();
    expect(loaded.migrated).toEqual(migrations.map((m) => m.to));
    expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);
    expect(loaded.events.map((event) => event.id)).toEqual(original.map((event) => event.id));
    expect(loaded.events.every((event) => 'migrated' in event && event.migrated === true)).toBe(
      true,
    );
    const backup = await store.getMeta<StoredBackup>(BACKUP_BEFORE_MIGRATION);
    expect(backup?.schemaVersion).toBe(0);
    expect(backup?.events).toEqual(original);
    expect(await store.getMeta('schemaVersion')).toBe(SCHEMA_VERSION);
    store.close();

    // Stored: the next start reads the migrated log and does not migrate again.
    const reopened = await open({ dbName, migrations });
    const again = await reopened.load();
    expect(again.migrated).toEqual([]);
    expect(again.events).toEqual(loaded.events);
  });

  test('en migration, der ikke kan gemmes, efterlader lageret uændret', async () => {
    const dbName = freshName();
    const original = sample(7);
    const old = await open({ dbName });
    await old.load();
    await old.append(original);
    await old.setMeta('schemaVersion', 0);
    old.close();

    const broken: Migration = {
      from: 0,
      to: 1,
      // A function cannot be stored: the rewrite fails half-way through.
      migrate: (events) =>
        events.map((event, i) => (i < 3 ? event : { ...(event as object), f: () => i })),
    };
    const store = await open({ dbName, migrations: [broken, ...MIGRATIONS] });
    await expect(store.load()).rejects.toMatchObject({ name: 'DataCloneError' });
    await expect(store.append(sample(8).slice(7))).rejects.toMatchObject({
      name: 'DataCloneError',
    });
    expect(await store.getMeta('schemaVersion')).toBe(0);
    expect(await store.getMeta(BACKUP_BEFORE_MIGRATION)).toBeUndefined();
    expect(await store.count()).toBe(7);
  });

  test('nyere skemaversion i lageret: load afviser med en klar fejl, og intet skrives', async () => {
    const dbName = freshName();
    const first = await open({ dbName });
    await first.load();
    await first.append(sample(3));
    await first.setMeta('schemaVersion', SCHEMA_VERSION + 1);
    first.close();

    const store = await open({ dbName });
    const error: unknown = await store.load().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NewerSchemaError);
    expect((error as Error).message).toContain('Opdatér appen');
    await expect(store.append(sample(4).slice(3))).rejects.toBeInstanceOf(NewerSchemaError);
    expect(await store.count()).toBe(3);
  });

  test('en skrivning, der fejler, afvises, og hændelserne kan gemmes ved næste forsøg', async () => {
    const store = await open();
    await store.load();
    const [a, b] = sample(2) as [AppEvent, AppEvent];
    const unstorable = { ...b, f: () => 1 } as unknown as AppEvent;

    await expect(store.append([a, unstorable])).rejects.toMatchObject({ name: 'DataCloneError' });
    expect(await store.count()).toBe(0);
    await store.append([a, b]);
    expect((await store.load()).events).toEqual([a, b]);

    // A closed connection: the write is rejected, not swallowed.
    store.close();
    await expect(store.append(sample(3).slice(2))).rejects.toMatchObject({
      name: 'InvalidStateError',
    });
  });

  test('spejlet skrives samlet efter 1,5 s og straks ved flushMirror', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const storage = new FakeStorage();
    const store = await open({ storage });
    await store.load();
    const events = sample(3);

    await store.append(events.slice(0, 1));
    await store.append(events.slice(1, 2));
    expect(store.mirrorStatus.pending).toBe(true);
    vi.advanceTimersByTime(MIRROR_DELAY_MS - 1);
    expect(storage.writes).toBe(0);
    vi.advanceTimersByTime(1);
    expect(storage.writes).toBe(1);
    expect(mirroredEvents(storage)).toEqual(events.slice(0, 2));

    await store.append(events.slice(2));
    expect(store.flushMirror()).toMatchObject({ ok: true, pending: false, events: 3 });
    expect(storage.writes).toBe(2);
    expect(mirroredEvents(storage)).toEqual(events);
    vi.advanceTimersByTime(10 * MIRROR_DELAY_MS);
    expect(storage.writes).toBe(2);
  });

  test('et localStorage, der fejler, stopper aldrig en tilføjelse; fejlen ses i status', async () => {
    const storage = new FakeStorage();
    storage.failWith = 'QuotaExceededError';
    const store = await open({ storage });
    await store.load();
    await store.append(sample(3));
    expect(await store.count()).toBe(3);

    const status = store.flushMirror();
    expect(status).toMatchObject({ ok: false, pending: true });
    expect(status.error).toContain('QuotaExceededError');

    storage.failWith = null;
    expect(store.flushMirror()).toMatchObject({ ok: true, pending: false, events: 3, error: null });
    expect(mirroredEvents(storage)).toEqual(sample(3));
  });

  test('MemoryStore rører hverken IndexedDB eller localStorage', async () => {
    const touched: string[] = [];
    const trap = (label: string) =>
      new Proxy(
        {},
        {
          get(_target, property) {
            touched.push(`${label}.${String(property)}`);
            return undefined;
          },
        },
      );
    vi.stubGlobal('indexedDB', trap('indexedDB'));
    vi.stubGlobal('localStorage', trap('localStorage'));

    const real = sample(4);
    const input = structuredClone(real);
    const store = new MemoryStore(input);
    expect(store.kind).toBe('memory');
    expect((await store.load()).events).toEqual(real);

    await store.append(sample(6).slice(4));
    await store.append(real.slice(0, 1));
    expect(await store.count()).toBe(6);
    await store.setMeta('persistRequested', true);
    expect(await store.getMeta('persistRequested')).toBe(true);
    await store.replaceAll(real.slice(0, 2));
    expect((await store.getMeta<StoredBackup>(BACKUP_BEFORE_IMPORT))?.events).toEqual(sample(6));
    expect((await store.load()).events).toEqual(real.slice(0, 2));
    store.flushMirror();
    store.close();

    store.readOnly = true;
    await expect(store.append(sample(7).slice(6))).rejects.toBeInstanceOf(ReadOnlyError);
    expect(await store.count()).toBe(2);
    expect(input).toEqual(real);
    expect(touched).toEqual([]);
  });
});
