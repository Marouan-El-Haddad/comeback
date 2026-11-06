// Timers measure time with performance.now() and timestamps, never by counting intervals, so
// they stay right after the phone was busy or the app was in the background (docs/SPEC.md 7).
import { useEffect, useState } from 'preact/hooks';

export interface Clock {
  /** performance.now() when the clock started. */
  startedAt: number;
  /** Total milliseconds spent paused. */
  pausedMs: number;
  /** performance.now() when the current pause began, or null while running. */
  pausedAt: number | null;
}

export function startClock(now = performance.now()): Clock {
  return { startedAt: now, pausedMs: 0, pausedAt: null };
}

export function elapsedMs(clock: Clock, now = performance.now()): number {
  const paused = clock.pausedMs + (clock.pausedAt !== null ? now - clock.pausedAt : 0);
  return Math.max(0, now - clock.startedAt - paused);
}

export function pauseClock(clock: Clock, now = performance.now()): Clock {
  return clock.pausedAt !== null ? clock : { ...clock, pausedAt: now };
}

export function resumeClock(clock: Clock, now = performance.now()): Clock {
  if (clock.pausedAt === null) return clock;
  return { ...clock, pausedMs: clock.pausedMs + (now - clock.pausedAt), pausedAt: null };
}

/** Re-renders at most four times a second while `active` (docs/SPEC.md 7). */
export function useTick(active: boolean): number {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!active) return;
    // The time right away when a pause ends: with the tick from before the pause, a clock that has
    // just resumed counts the whole pause against a stale time and shows its full time for a moment.
    setNow(performance.now());
    const id = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/** "1:05" */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
