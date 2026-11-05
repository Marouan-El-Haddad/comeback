// Persistent storage (docs/SPEC.md 9, DECISIONS D23): `persist()` is asked for after the first
// logged session, and the answer is shown under Mere → Backup and in Diagnose.

function storageManager(): StorageManager | null {
  if (typeof navigator === 'undefined') return null;
  // Missing in older browsers and outside secure contexts, whatever the DOM types say.
  const manager: StorageManager | undefined = navigator.storage;
  return manager ?? null;
}

/**
 * Asks the browser to keep the data (IronFox shows a prompt). True when granted, false when not
 * (or when the request fails), null when the browser has no such API.
 */
export async function requestPersist(): Promise<boolean | null> {
  const manager = storageManager();
  if (typeof manager?.persist !== 'function') return null;
  try {
    return await manager.persist();
  } catch {
    return false;
  }
}

/** Whether the data is kept persistently; null when unknown. */
export async function isPersisted(): Promise<boolean | null> {
  const manager = storageManager();
  if (typeof manager?.persisted !== 'function') return null;
  try {
    return await manager.persisted();
  } catch {
    return null;
  }
}

/** Bytes used and available for this app; null when unknown. */
export async function estimate(): Promise<{ usage: number; quota: number } | null> {
  const manager = storageManager();
  if (typeof manager?.estimate !== 'function') return null;
  try {
    const { usage, quota } = await manager.estimate();
    return { usage: usage ?? 0, quota: quota ?? 0 };
  } catch {
    return null;
  }
}
