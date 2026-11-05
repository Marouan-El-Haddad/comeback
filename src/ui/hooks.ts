import { useEffect, useState } from 'preact/hooks';
import type { Model } from './model.ts';

/** Re-renders when the model changes. */
export function useModel(model: Model): Model {
  const [, setTick] = useState(0);
  useEffect(() => model.subscribe(() => setTick((n) => n + 1)), [model]);
  return model;
}

const PERSIST_KEY = 'comeback.run';

/** Small per-device notes that survive closing the app (the step a session was on). */
export function readLocal<T>(key = PERSIST_KEY): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeLocal(value: unknown, key = PERSIST_KEY): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or disabled: the session still runs; only the resume point is lost.
  }
}
