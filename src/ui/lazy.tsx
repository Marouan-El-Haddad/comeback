// A screen the first screen does not need: its code is fetched on first use, or earlier with
// preload(), so the phone parses less while it starts (docs/SPEC.md 7, docs/DECISIONS.md D35).
// The service worker precaches every file, so this works offline.
import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';

export interface LazyScreen<P> {
  (props: P): preact.JSX.Element | null;
  /** Fetches the code once; a failed fetch is tried again next time. */
  preload(): Promise<unknown>;
}

export function lazy<P extends { onClose: () => void }>(
  load: () => Promise<ComponentType<P>>,
): LazyScreen<P> {
  let loaded: ComponentType<P> | null = null;
  let pending: Promise<unknown> | null = null;
  const preload = () =>
    (pending ??= load().then(
      (screen) => {
        loaded = screen;
      },
      (error: unknown) => {
        pending = null;
        throw error;
      },
    ));

  function Lazy(props: P) {
    const [failed, setFailed] = useState(false);
    const [, setReady] = useState(false);
    useEffect(() => {
      if (loaded) return;
      let live = true;
      preload().then(
        () => live && setReady(true),
        () => live && setFailed(true),
      );
      return () => {
        live = false;
      };
    }, []);
    const Screen = loaded;
    if (Screen) return <Screen {...props} />;
    if (!failed) return null;
    return (
      <div class="screen" role="alert">
        <h1>Skærmen kunne ikke åbnes</h1>
        <p>Dine data er ikke slettet. Luk appen helt, og åbn den igen.</p>
        <button type="button" class="btn block" onClick={props.onClose}>
          Tilbage
        </button>
      </div>
    );
  }
  Lazy.preload = preload;
  return Lazy;
}
