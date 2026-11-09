// An exercise as the session shows it (docs/SPEC.md 3.2 and 3.8): its explanation and its movements
// from content/explain, and the figure of a movement from content/figures – the same data the
// exercise card shows. The files are fetched when the screen needs them and drawn when they come;
// until then, and for a step that is not drawn yet, the screens show the pictogram (SPEC 5).
// Imports src/content/load.ts, so only code loaded with lazy() may import this (SPEC 7).
import { useEffect, useMemo, useState } from 'preact/hooks';
import { loadExplain, loadFigures, loadedExplain } from '../../content/load.ts';
import {
  isBorrowed,
  isLike,
  type ExplainItem,
  type FigureFile,
  type FigureItem,
  type OwnMovement,
} from '../../content/types.ts';
import { getStep } from '../../engine/lookup.ts';
import { PROGRAM } from '../../engine/program.ts';
import {
  cardItem,
  cardMovements,
  explanationOf,
  figureIn,
  likeSubject,
  type CardContext,
  type CardMovement,
} from '../components/cardItem.ts';
import { useExplain, useFigures } from '../content.ts';

/** 'press' for 'press.1', 'measures' for 'measures.hollow'. */
export function subjectOf(id: string): string {
  return id.slice(0, Math.max(0, id.indexOf('.')));
}

export interface Exercise {
  /** The explanation; undefined while it loads, null when there is none. */
  explained: ExplainItem | null | undefined;
  /** The movements the card shows, in a session without those of other sessions (SPEC 9.1). */
  movements: CardMovement[];
  /** A movement's drawn figure, or null. */
  figureOf: (movement: CardMovement) => FigureItem | null;
  /** The cues: the explanation's, or the programme's own until it is written (SPEC 3.8). */
  cues: string[];
}

/** The figure files a card's movements can be in: its own, a »like«'s and the power step's. */
function finder(files: ReadonlyArray<FigureFile | null | undefined>) {
  return (movement: CardMovement): FigureItem | null => {
    const source = movement.source;
    if (!source) return null;
    const file = files.find((f) => f?.subject === subjectOf(source.item));
    return figureIn(file, source.item, source.movement);
  };
}

/** The exercise behind a card id ('press.1', 'warmup.4', 'measures.hollow') in a session. */
export function useExercise(id: string | null, context: CardContext | null = null): Exercise {
  const subject = id ? subjectOf(id) : '';
  const file = useExplain(subject);
  const otherSubject = id ? (likeSubject(file, id) ?? '') : '';
  const other = useExplain(otherSubject);
  // The warm-up's »Potensér« is the session's first power step (docs/SPEC.md 9.1).
  const powerId = subject === 'warmup' ? (context?.power ?? null) : null;
  const powerSubject = powerId ? subjectOf(powerId) : '';
  const powerFile = useExplain(powerSubject);
  const figures = useFigures(subject);
  const otherFigures = useFigures(otherSubject);
  const powerFigures = useFigures(powerSubject);
  const session = context?.session;

  return useMemo(() => {
    const explained = id && file !== undefined ? explanationOf(file, id, other) : undefined;
    const power =
      powerId && context
        ? {
            name: getStep(PROGRAM, powerId).name,
            explained: explanationOf(powerFile, powerId),
          }
        : null;
    const movements = explained
      ? cardMovements(explained.movements, context, power, explained.id)
      : [];
    const programme = id ? cardItem(PROGRAM, id) : null;
    return {
      explained,
      movements,
      figureOf: finder([figures, otherFigures, powerFigures]),
      cues: explained ? explained.cues : (programme?.cues ?? []),
    };
    // The context is compared by its fields: a new object with the same session is the same.
  }, [id, file, other, powerFile, figures, otherFigures, powerFigures, session, powerId]);
}

/** The movement with its figure that a small figure shows: the first one drawn. */
export function drawnMovement(
  exercise: Exercise,
  index = 0,
): { movement: CardMovement & OwnMovement; figure: FigureItem } | null {
  const own = exercise.movements.filter((m): m is CardMovement & OwnMovement => !isBorrowed(m));
  const preferred = own[Math.min(index, own.length - 1)];
  const ordered = preferred ? [preferred, ...own.filter((m) => m !== preferred)] : own;
  for (const movement of ordered) {
    if (movement.positions.length === 0) continue;
    const figure = exercise.figureOf(movement);
    if (figure) return { movement, figure };
  }
  return null;
}

/**
 * Fetches the explanations and figures of these subjects, and of the files their »like«s point
 * into, so the screens of a session draw them without waiting (»Dagens pas« starts it). Returns a
 * number that changes when they have come, for a screen that reads several files at once.
 */
export function useSubjects(subjects: readonly string[]): number {
  const key = [...new Set(subjects.filter(Boolean))].sort().join(',');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    const load = (subject: string) =>
      Promise.all([loadExplain(subject), loadFigures(subject)]).then(([file]) => {
        const others = new Set<string>();
        for (const entry of file?.items ?? []) {
          if (!isLike(entry)) continue;
          const s = subjectOf(entry.like);
          if (s && s !== subject) others.add(s);
        }
        return Promise.all([...others].map((s) => Promise.all([loadExplain(s), loadFigures(s)])));
      });
    void Promise.all(key.split(',').filter(Boolean).map(load)).then(() => {
      if (live) setVersion((v) => v + 1);
    });
    return () => {
      live = false;
    };
  }, [key]);
  return version;
}

/** The explanation of an id among the files already fetched (a screen that lists many). */
export function loadedExplanation(id: string): ExplainItem | null {
  const file = loadedExplain(subjectOf(id));
  const other = likeSubject(file, id);
  return explanationOf(file, id, other ? loadedExplain(other) : null);
}
