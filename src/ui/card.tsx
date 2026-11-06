// Opens the exercise card (docs/SPEC.md 3.8) from Stiger, the session and Open & Strong. The card
// and the explanations are fetched on first use, never with the start files (SPEC 7): this module
// only holds the lazy screen, so the screens on the first page can import it.
//
// The card takes the place of the screen it was opened from, which is hidden but stays mounted:
// a session's timers keep running, and »Tilbage« returns to the same place (DECISIONS.md D43).
import { useCallback, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { lazy } from './lazy.tsx';

export interface CardProps {
  /** A step id ('press.1') or a routine item id ('warmup.2', 'os.3'). */
  id: string;
  /** The text of the way back: »Tilbage«, »Tilbage til passet«. */
  back: string;
  onClose: () => void;
}

const load = () => import('./components/ExerciseCard.tsx');

export const ExerciseCard = lazy<CardProps>(() => load().then((m) => m.ExerciseCard));

/** Fetches the card's code and the explanation, so the card opens complete, never half drawn. */
export function prepareCard(id: string): Promise<void> {
  return load()
    .then((m) => m.prepare(id))
    .catch(() => undefined);
}

export interface CardState {
  /** The open card's id, or null. */
  id: string | null;
  open: (id: string) => void;
  close: () => void;
}

/** The card shown in place of a screen; closing it restores the scroll position and the focus. */
export function useCard(): CardState {
  const [id, setId] = useState<string | null>(null);
  const back = useRef<{ y: number; focus: HTMLElement | null } | null>(null);
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
  const open = useCallback((cardId: string) => {
    const focus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    void prepareCard(cardId).then(() => {
      back.current ??= { y: window.scrollY, focus };
      setId(cardId);
    });
  }, []);
  const close = useCallback(() => setId(null), []);
  return { id, open, close };
}

/** »Sådan gør du«: opens the card of the exercise next to it. */
export function HowButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" class="btn block how" onClick={onClick}>
      Sådan gør du
    </button>
  );
}
