// Keeps the screen on during a session: Screen Wake Lock, with the silent looping video from the
// probe as fallback when the API is refused or released (docs/DECISIONS.md D16, D24).
const VIDEO_URL = `${import.meta.env.BASE_URL}keep-awake.webm`;

let sentinel: WakeLockSentinel | null = null;
let video: HTMLVideoElement | null = null;
let wanted = false;

export type WakeState = 'off' | 'lock' | 'video' | 'failed';
let state: WakeState = 'off';
const listeners = new Set<(s: WakeState) => void>();

function set(next: WakeState): void {
  state = next;
  for (const l of listeners) l(next);
}

export function wakeState(): WakeState {
  return state;
}

export function onWakeState(listener: (s: WakeState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function wakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

async function startVideo(): Promise<void> {
  if (!video) {
    video = document.createElement('video');
    video.src = VIDEO_URL;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('aria-hidden', 'true');
    // Small but visible, as in the probe (D16): Firefox keeps the screen on for a playing video.
    Object.assign(video.style, {
      position: 'fixed',
      right: '8px',
      bottom: '8px',
      width: '64px',
      height: '36px',
      borderRadius: '8px',
      pointerEvents: 'none',
      zIndex: '50',
    });
    document.body.append(video);
  }
  try {
    await video.play();
    set('video');
  } catch {
    set('failed');
  }
}

async function request(): Promise<void> {
  if (!wanted) return;
  if (wakeLockSupported()) {
    try {
      const lock = await navigator.wakeLock.request('screen');
      sentinel = lock;
      set('lock');
      lock.addEventListener('release', () => {
        if (sentinel === lock) sentinel = null;
        // Released by the browser (e.g. tab hidden): the visibility handler asks again.
      });
      return;
    } catch {
      // fall through to the video
    }
  }
  await startVideo();
}

function onVisibility(): void {
  if (wanted && document.visibilityState === 'visible' && !sentinel) void request();
}

/** Call from a tap when a session starts. */
export async function keepAwake(): Promise<void> {
  if (wanted) return;
  wanted = true;
  document.addEventListener('visibilitychange', onVisibility);
  await request();
}

export function releaseAwake(): void {
  wanted = false;
  document.removeEventListener('visibilitychange', onVisibility);
  const lock = sentinel;
  sentinel = null;
  if (lock && !lock.released) lock.release().catch(() => undefined);
  if (video) {
    video.pause();
    video.remove();
    video = null;
  }
  set('off');
}
