import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Model } from './model.ts';

/** Re-renders when the model changes. */
export function useModel(model: Model): Model {
  const [, setTick] = useState(0);
  useEffect(() => model.subscribe(() => setTick((n) => n + 1)), [model]);
  return model;
}

/**
 * The world a screen was opened in – the real log or the time machine's copy (SPEC 3.7): false once
 * the time machine has started or ended since, so what was opened in the time machine never writes
 * in the real log, and the other way round.
 */
export function useSameWorld(model: Model): () => boolean {
  const simulated = useRef(model.sim !== null);
  return () => (model.sim !== null) === simulated.current;
}

/** The history entry a screen shown in place of a tab adds (the club log, the Sunday check, »Flyt«). */
const SCREEN_ENTRY = 'comebackScreen';

function screenEntry(): boolean {
  const state: unknown = history.state;
  return typeof state === 'object' && state !== null && SCREEN_ENTRY in state;
}

/** A screen's own step back in the history on its way: the next screen opens after it. */
let leaving: Promise<void> | null = null;

/** Resolves once no screen is going back over its history step (opens wait for it). */
export function screenSettled(): Promise<void> {
  return leaving ?? Promise.resolve();
}

/**
 * A screen shown in place of a tab is a step in the browser's history, as the exercise card is
 * (D47): Android's back gesture closes the screen, not the app (D65). Closed any other way –
 * »Tilbage«, a save, the time machine starting or ending, another tab – it goes back over its
 * step, so the history does not grow.
 */
export function useScreenEntry(open: boolean, onBack: () => void): void {
  const back = useRef(onBack);
  back.current = onBack;
  useEffect(() => {
    if (!open) return;
    if (!screenEntry()) history.pushState({ [SCREEN_ENTRY]: true }, '');
    let popped = false;
    const onPop = () => {
      popped = true;
      back.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (popped || !screenEntry()) return;
      leaving = new Promise<void>((resolve) => {
        const done = () => {
          window.removeEventListener('popstate', done);
          clearTimeout(timer);
          leaving = null;
          resolve();
        };
        // A browser that never answers must not stop the next screen from opening.
        const timer = setTimeout(done, 1000);
        window.addEventListener('popstate', done);
        history.back();
      });
    };
  }, [open]);
}

/**
 * A button that writes: the first tap writes, the taps after it do nothing until the screen or
 * card is gone (D61). A failed write lets the next tap try again.
 */
export function useWriteOnce(): {
  busy: boolean;
  run: (action: () => Promise<void>) => () => void;
} {
  const writing = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = (action: () => Promise<void>) => () => {
    if (writing.current) return;
    writing.current = true;
    setBusy(true);
    action().catch(() => {
      writing.current = false;
      setBusy(false);
    });
  };
  return { busy, run };
}

/**
 * Half a second without taps after the screen changed (D57): a screen opened or closed in place of
 * the tab, or a card went away, so a second tap of a double tap lands on nothing new.
 */
export function useSettle(changes: readonly unknown[]): boolean {
  const first = useRef(true);
  const [settling, setSettling] = useState(false);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSettling(true);
    const id = setTimeout(() => setSettling(false), 500);
    return () => clearTimeout(id);
  }, changes);
  return settling;
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
