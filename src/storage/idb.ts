// Minimal promise wrappers for IndexedDB, without a library (docs/SPEC.md 9). A write counts as
// saved only when its transaction has committed; a failure rejects and is never swallowed.

/** Opens the database; `upgrade` creates the object stores the first time. */
export function openDatabase(
  factory: IDBFactory,
  name: string,
  version: number,
  upgrade: (db: IDBDatabase) => void,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, version);
    request.onupgradeneeded = () => upgrade(request.result);
    request.onsuccess = () => {
      const db = request.result;
      // A newer version of the app must be able to upgrade the database. This connection then
      // closes, and later writes through it fail visibly instead of blocking the upgrade.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('Lageret kunne ikke åbnes.'));
  });
}

/** The result of a single request. */
export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Lageret svarede ikke.'));
  });
}

/** Wraps a request callback, so a throw inside it aborts the transaction instead of escaping. */
export type Guard = (callback: () => void) => () => void;

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Runs `work` in one transaction and resolves with the value of the function it returns once the
 * transaction has committed. A throw in `work` or in a guarded callback aborts the transaction, so
 * none of its writes are kept, and the promise rejects with that error. Writes ask for strict
 * durability: committed means on disk.
 */
export function inTransaction<T>(
  db: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction, guard: Guard) => () => T,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx =
      mode === 'readwrite'
        ? db.transaction(stores, mode, { durability: 'strict' })
        : db.transaction(stores, mode);
    let failure: Error | undefined;
    const abort = (error: unknown) => {
      failure ??= toError(error);
      try {
        tx.abort();
      } catch {
        // The transaction has already finished.
      }
    };
    const guard: Guard = (callback) => () => {
      try {
        callback();
      } catch (error) {
        abort(error);
      }
    };
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('Skrivningen blev afbrudt.'));
    try {
      const result = work(tx, guard);
      tx.oncomplete = () => {
        try {
          resolve(result());
        } catch (error) {
          reject(toError(error));
        }
      };
    } catch (error) {
      abort(error);
    }
  });
}
