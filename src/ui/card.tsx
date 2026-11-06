// Opens the exercise card (docs/SPEC.md 3.8) from Stiger, the session and Open & Strong. The card
// and the explanations are fetched on first use, never with the start files (SPEC 7): this module
// only holds the lazy screen, so the screens on the first page can import it.
//
// The card takes the place of the screen it was opened from, which is hidden but stays mounted, so
// »Tilbage« returns to the same place; a session stands still while the card is open (DECISIONS.md
// D43, D47). The card is a step in the browser's history, so Android's back gesture closes it.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { CardContext } from './components/cardItem.ts';
import { lazy } from './lazy.tsx';

export interface CardProps {
  /** A step id ('press.1'), a routine item id ('warmup.2', 'os.3') or 'measures.<id>'. */
  id: string;
  /** The text of the way back: »Tilbage«, »Tilbage til passet«. */
  back: string;
  onClose: () => void;
  /** Opened in a session: its kind and first power step (the warm-up's »Potensér«). */
  context?: CardContext | null;
  /** Next to »Tilbage« in a session: »Passet står stille.« (D47). */
  status?: string;
}

const load = () => import('./components/ExerciseCard.tsx');

export const ExerciseCard = lazy<CardProps>(() => load().then((m) => m.ExerciseCard));

/** Fetches the card's code and the explanation, so the card opens complete, never half drawn. */
export function prepareCard(id: string, context: CardContext | null = null): Promise<void> {
  return load()
    .then((m) => m.prepare(id, context))
    .catch(() => undefined);
}

export interface CardState {
  /** The open card's id, or null. */
  id: string | null;
  /** The session it was opened from, or null. */
  context: CardContext | null;
  open: (id: string, context?: CardContext) => void;
  close: () => void;
}

/** The history entry an open card adds; the back gesture removes it and closes the card. */
const ENTRY = 'comebackCard';

function cardEntry(): boolean {
  const state: unknown = history.state;
  return typeof state === 'object' && state !== null && ENTRY in state;
}

/**
 * The card shown in place of a screen. Closing it restores the scroll position and the focus. It
 * adds a step to the browser's history, so the back gesture closes it, and »Tilbage« goes back over
 * that step, so the history does not grow.
 */
export function useCard(): CardState {
  const [id, setId] = useState<string | null>(null);
  const [context, setContext] = useState<CardContext | null>(null);
  const back = useRef<{ y: number; focus: HTMLElement | null } | null>(null);
  /** A »Tilbage« going back over the card's history step; the next card waits for it. */
  const leaving = useRef<Promise<void> | null>(null);
  const openId = useRef<string | null>(null);
  openId.current = id;

  useLayoutEffect(() => {
    if (id !== null) {
      window.scrollTo(0, 0);
      return;
    }
    const saved = back.current;
    if (!saved) return;
    back.current = null;
    window.scrollTo(0, saved.y);
    if (saved.focus?.isConnected) saved.focus.focus({ preventScroll: true });
  }, [id]);

  // Android's back gesture (or the browser's back): the card's step is gone, so the card closes.
  useEffect(() => {
    if (id === null) return;
    const onPop = () => setId(null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [id]);

  // A screen that goes away with its card open (another tab) takes the card's step with it.
  useEffect(
    () => () => {
      if (openId.current !== null && cardEntry()) history.back();
    },
    [],
  );

  const open = useCallback((cardId: string, from?: CardContext) => {
    const focus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    void Promise.all([prepareCard(cardId, from ?? null), leaving.current]).then(() => {
      back.current ??= { y: window.scrollY, focus };
      if (!cardEntry()) history.pushState({ [ENTRY]: cardId }, '');
      setContext(from ?? null);
      setId(cardId);
    });
  }, []);

  const close = useCallback(() => {
    if (openId.current === null || leaving.current) return;
    setId(null);
    if (!cardEntry()) return;
    leaving.current = new Promise<void>((resolve) => {
      const done = () => {
        window.removeEventListener('popstate', done);
        clearTimeout(timer);
        leaving.current = null;
        resolve();
      };
      // A browser that never answers must not stop the next card from opening.
      const timer = setTimeout(done, 1000);
      window.addEventListener('popstate', done);
      history.back();
    });
  }, []);

  return { id, context, open, close };
}

/** »Sådan gør du«: opens the card of the exercise next to it. */
export function HowButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" class="btn block how" onClick={onClick}>
      Sådan gør du
    </button>
  );
}
