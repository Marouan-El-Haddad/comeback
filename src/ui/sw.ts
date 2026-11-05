// The app's service worker (prompt mode): a new version is announced with a banner and installed
// only when the user taps »Opdatér«, never during a session (docs/SPEC.md 2).
import { registerSW } from 'virtual:pwa-register';

type Listener = () => void;

export const swStatus = {
  registration: null as ServiceWorkerRegistration | null,
  needRefresh: false,
  offlineReady: false,
  error: null as string | null,
};

const listeners = new Set<Listener>();
let update: ((reload?: boolean) => Promise<void>) | null = null;

export function onSwChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  for (const l of listeners) l();
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  update = registerSW({
    immediate: true,
    onNeedRefresh() {
      swStatus.needRefresh = true;
      emit();
    },
    onOfflineReady() {
      swStatus.offlineReady = true;
      emit();
    },
    onRegisteredSW(_url, registration) {
      swStatus.registration = registration ?? null;
      emit();
    },
    onRegisterError(error: unknown) {
      swStatus.error = error instanceof Error ? error.message : String(error);
      emit();
    },
  });
}

/** »Opdatér«: activates the new version and reloads. Only from the user's tap. */
export async function applyUpdate(): Promise<void> {
  await update?.(true);
}
