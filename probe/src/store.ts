// Persistence for the probe. Point 2 writes the same number to IndexedDB and localStorage; the
// results of the tests that need your action are kept so they still show after a restart.
import { errorText } from './format';

const DB_NAME = 'comeback-probe';
const STORE = 'kv';
const PREFIX = 'comeback-probe.';

export type Marker = { number: number; createdAt: string };
export type VersionSeen = { version: number; firstSeenAt: string };
export type Outcome = { ok: boolean; text: string; at: string };

export type Results = {
  persist?: Outcome;
  offline?: Outcome;
  updateFound?: { at: string; how: 'automatisk' | 'manuelt'; version: number };
  updateApplied?: { at: string; fromVersion: number };
  wakeLock?: Outcome;
  video?: Outcome;
  sound?: Outcome;
  vibration?: Outcome;
  vibrationLater?: Outcome;
  exported?: Outcome;
  imported?: Outcome;
  shared?: Outcome;
};

export type StoreSide = { marker?: Marker; error?: string };

export type StorageReport = {
  idb: StoreSide;
  ls: StoreSide;
  /** The number was created during this page load. */
  createdNow: boolean;
  visits: number;
  versions: VersionSeen[];
};

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB kunne ikke åbnes'));
    request.onblocked = () => reject(new Error('IndexedDB er blokeret'));
  });
  return dbPromise;
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error ?? new Error('Læsning fejlede'));
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Skrivning fejlede'));
    tx.onabort = () => reject(tx.error ?? new Error('Skrivning afbrudt'));
  });
}

function lsGet<T>(key: string): T | undefined {
  const raw = localStorage.getItem(PREFIX + key);
  return raw === null ? undefined : (JSON.parse(raw) as T);
}

function lsSet(key: string, value: unknown): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

async function attempt<T>(fn: () => T | Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

/** Reads the number from both stores, creates it on the first visit, counts visits and versions. */
export async function bootStorage(version: number, now: Date): Promise<StorageReport> {
  const idb: StoreSide = {};
  const ls: StoreSide = {};
  try {
    idb.marker = await idbGet<Marker>('marker');
  } catch (e) {
    idb.error = errorText(e);
  }
  try {
    ls.marker = lsGet<Marker>('marker');
  } catch (e) {
    ls.error = errorText(e);
  }

  let createdNow = false;
  if (!idb.marker && !ls.marker) {
    const marker: Marker = {
      number: 1000 + Math.floor(Math.random() * 9000),
      createdAt: now.toISOString(),
    };
    createdNow = true;
    if (!idb.error) {
      try {
        await idbSet('marker', marker);
        idb.marker = marker;
      } catch (e) {
        idb.error = errorText(e);
      }
    }
    if (!ls.error) {
      try {
        lsSet('marker', marker);
        ls.marker = marker;
      } catch (e) {
        ls.error = errorText(e);
      }
    }
  }

  const visits =
    Math.max(
      (await attempt(() => idbGet<number>('visits'))) ?? 0,
      (await attempt(() => lsGet<number>('visits'))) ?? 0,
    ) + 1;
  await attempt(() => idbSet('visits', visits));
  await attempt(() => lsSet('visits', visits));

  const seen = new Map<number, string>();
  const lists = [
    await attempt(() => idbGet<VersionSeen[]>('versions')),
    await attempt(() => lsGet<VersionSeen[]>('versions')),
  ];
  for (const entry of lists.flatMap((list) => list ?? [])) {
    const earlier = seen.get(entry.version);
    if (!earlier || entry.firstSeenAt < earlier) seen.set(entry.version, entry.firstSeenAt);
  }
  if (!seen.has(version)) seen.set(version, now.toISOString());
  const versions = [...seen]
    .map(([v, firstSeenAt]) => ({ version: v, firstSeenAt }))
    .sort((a, b) => a.version - b.version);
  await attempt(() => idbSet('versions', versions));
  await attempt(() => lsSet('versions', versions));

  return { idb, ls, createdNow, visits, versions };
}

export function loadResults(): Results {
  try {
    return lsGet<Results>('results') ?? {};
  } catch {
    return {};
  }
}

export function saveResults(results: Results): void {
  try {
    lsSet('results', results);
  } catch {
    // Point 2 shows whether localStorage works; the results stay visible in memory meanwhile.
  }
}
