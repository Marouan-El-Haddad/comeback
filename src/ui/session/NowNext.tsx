// »Nu« and »Næste« in the guided session (docs/SPEC.md 3.2, DECISIONS.md D50–D53): the exercise in
// hand with its figure, target and two cues; the next exercise as a strip above the actions, big
// with its animation and »Gør klar« in the pause, and with »Sådan gør du« at the questions; and
// the parts of the session as a bar under the header (»Del 3 af 7«). The figure is the animated
// figure from content/figures when the step is drawn, and the pictogram until then (SPEC 5).
import type { ComponentChildren } from 'preact';
import { useCallback, useMemo } from 'preact/hooks';
import type { ClockPart, SyncMode } from '../../figure/sync.ts';
import { keyPosition, syncFigure } from '../../figure/sync.ts';
import { HowButton } from '../card.tsx';
import type { CardContext } from '../components/cardItem.ts';
import { figureText } from '../components/cardItem.ts';
import { Figure, FigureStill, useReducedMotion } from '../components/Figure.tsx';
import { pictoUrl } from '../components/Picto.tsx';
import { elapsedMs, type Clock } from '../timers/clock.ts';
import { drawnMovement, useExercise } from './exercise.ts';
import type { PartStart, Upcoming } from './outline.ts';
// The session's CSS comes with its code, so the start files do not grow (docs/SPEC.md 7).
import css from './session.css?inline';

let styled = false;

/** Adds the session's CSS to the page the first time a session screen is drawn. */
export function useSessionStyle(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
}

/** The part of the clock that runs and since when: set by the timers, read by the figure. */
export interface PartClock {
  index: number;
  clock: Clock;
}

/** How the figure in »Nu« follows the session's clock (src/figure/sync.ts). */
export interface Follow {
  parts: ClockPart[];
  mode: SyncMode;
  /** The part that runs now, or null before the clock has started. */
  part: () => PartClock | null;
}

export type FigureSize = 'now' | 'next' | 'big' | 'plan';

/**
 * An exercise's figure in a session: animated in its tempo, following the clock (`follow`), or as a
 * still image of its most typical position (`still`); the pictogram until the step is drawn, and
 * nothing when it has neither (the name stands next to it).
 */
export function ExerciseFigure({
  cardId,
  pictoId,
  name,
  context = null,
  size,
  still = false,
  follow,
  movementIndex = 0,
}: {
  cardId: string | null;
  pictoId: string | null;
  name: string;
  context?: CardContext | null;
  size: FigureSize;
  still?: boolean;
  follow?: Follow;
  /** Which of several movements: the neck's direction. */
  movementIndex?: number;
}) {
  const exercise = useExercise(cardId, context);
  const drawn = drawnMovement(exercise, movementIndex);
  const movement = drawn?.movement ?? null;
  // With reduced motion a session's figure is one still image of its most typical position, as in
  // »Næste«: all positions side by side, as on the card, pushed the target off its place (D54).
  // »Nu« and the pause show it in both views with its marks (D58).
  const asStill = useReducedMotion() || still;
  const parts = follow?.parts;
  const mode = follow?.mode;
  // Compared by their contents: a step draws its clock parts anew four times a second.
  const clockKey = follow ? JSON.stringify([follow.parts, follow.mode]) : '';
  const sync = useMemo(
    () => (movement && parts && mode ? syncFigure(movement, parts, mode) : null),
    [movement, clockKey],
  );
  const read = follow?.part;
  const clock = useCallback(
    (now: number): number | null => {
      const running = read?.();
      if (!sync || !running || !parts) return null;
      const part = parts[running.index];
      const elapsed = elapsedMs(running.clock, now) / 1000;
      return sync.at(
        running.index,
        part && part.seconds > 0 ? Math.min(elapsed, part.seconds) : elapsed,
      );
    },
    [sync, read, parts],
  );
  if (drawn && movement) {
    const label = figureText(name, movement);
    return (
      <div class={`session-figure ${size}`}>
        {asStill ? (
          <FigureStill
            figure={drawn.figure}
            movement={movement}
            label={label}
            position={keyPosition(movement)}
            full={size === 'now' || size === 'big'}
          />
        ) : (
          <Figure
            figure={drawn.figure}
            movement={sync?.movement ?? movement}
            label={label}
            clock={sync ? clock : undefined}
            compact
          />
        )}
      </div>
    );
  }
  const url = pictoId ? pictoUrl(pictoId) : null;
  if (!url) return null;
  return (
    <div class={`session-figure ${size}`}>
      <img class="session-picto" src={url} alt="" decoding="async" />
    </div>
  );
}

/** The two cues of »Nu« (docs/SPEC.md 3.2): the explanation's, or the programme's own. */
export function NowCues({ cues }: { cues: readonly string[] }) {
  if (cues.length === 0) return null;
  return (
    <ul class="now-cues">
      {cues.slice(0, 2).map((cue) => (
        <li key={cue}>{cue}</li>
      ))}
    </ul>
  );
}

/** The cues of an exercise, from its explanation when it is there. */
export function useCues(cardId: string | null, context: CardContext | null = null): string[] {
  return useExercise(cardId, context).cues;
}

/**
 * »Næste« as a strip above the actions of a set, a hold or a timer: always in the same place and
 * with the same height, so »Som planlagt« does not move (D33).
 */
export function NextStrip({
  next,
  context = null,
}: {
  next: Upcoming | null;
  context?: CardContext | null;
}) {
  if (!next) return null;
  return (
    <div class="next-strip" data-testid="next-strip">
      <ExerciseFigure
        cardId={next.cardId}
        pictoId={next.pictoId}
        name={next.title}
        context={context}
        size="next"
        still
      />
      <div class="next-text step-enter">
        <p class="next-label">Næste</p>
        <p class="next-name">{next.title}</p>
        {next.line && <p class="next-line">{next.line}</p>}
      </div>
    </div>
  );
}

/**
 * A part of the session with its big red number under a navy line (docs/SPEC.md 5, D59): the parts
 * of »Dagens pas«, and in the session where a part begins, over the intro card.
 */
export function PartHead({
  at,
  label,
  note,
  heading = false,
}: {
  at?: number;
  label: string;
  note?: string;
  /** A heading in »Dagens pas«; over the intro card the exercise is the heading. */
  heading?: boolean;
}) {
  return (
    <div class="day-part-head">
      {at !== undefined && <span class="day-part-number">{at}</span>}
      <div class="day-part-title">
        {heading ? <h2>{label}</h2> : <p class="part-name">{label}</p>}
        {note && <p class="day-part-note">{note}</p>}
      </div>
    </div>
  );
}

/** »Næste«, and when the next exercise starts a new part, the part's number and name beside it. */
function NextLabel({ part }: { part?: PartStart | null }) {
  if (!part) return <p class="next-label">Næste</p>;
  return (
    <p class="next-part">
      <span class="next-label">Næste</span>
      <span class="next-part-name">
        Del {part.at} · {part.label}
      </span>
    </p>
  );
}

/**
 * »Næste« in the pause (docs/SPEC.md 3.2): the next exercise big, with its animation in its tempo,
 * its »Gør klar« from content/explain and »Sådan gør du« for its card.
 */
export function NextBig({
  next,
  context = null,
  part = null,
  onCard,
}: {
  next: Upcoming;
  context?: CardContext | null;
  /** The part the next exercise starts, if it starts one. */
  part?: PartStart | null;
  onCard: (id: string) => void;
}) {
  const exercise = useExercise(next.cardId, context);
  const ready = exercise.explained?.getReady;
  return (
    <section class="next-up next-big" data-testid="next-up" aria-label="Næste øvelse">
      <div class="next-head">
        <div class="next-text">
          <NextLabel part={part} />
          <p class="next-title">{next.title}</p>
          {next.line && <p class="next-line">{next.line}</p>}
        </div>
        {next.cardId && (
          <button type="button" class="btn how now-how" onClick={() => onCard(next.cardId ?? '')}>
            Sådan gør du
          </button>
        )}
      </div>
      {/* »Gør klar« before the figure: what to set up is read first, and if the room runs out it
          is the figure's feet, not the text, that goes under the actions (D51, D59). */}
      {ready && (
        <p class="get-ready">
          <strong>Gør klar:</strong> {ready}
        </p>
      )}
      <ExerciseFigure
        cardId={next.cardId}
        pictoId={next.pictoId}
        name={next.title}
        context={context}
        size="big"
      />
    </section>
  );
}

/** »Næste« at the questions after a block: a still figure, the name and »Sådan gør du« (D47). */
export function NextBox({
  next,
  context = null,
  part = null,
  onCard,
}: {
  next: Upcoming;
  context?: CardContext | null;
  /** The part the next exercise starts, if it starts one. */
  part?: PartStart | null;
  onCard: (id: string) => void;
}) {
  return (
    <section class="next-up next-box" data-testid="next-up" aria-label="Næste øvelse">
      <div class="next-row">
        <ExerciseFigure
          cardId={next.cardId}
          pictoId={next.pictoId}
          name={next.title}
          context={context}
          size="next"
          still
        />
        <div class="next-text">
          <NextLabel part={part} />
          <p class="next-title">{next.title}</p>
          {next.line && <p class="next-line">{next.line}</p>}
        </div>
      </div>
      {next.cardId && <HowButton onClick={() => onCard(next.cardId ?? '')} />}
    </section>
  );
}

/**
 * The parts of the session as a bar under the header: the parts done, the one in hand and the
 * rest, with »Del 3 af 7: Par 1« as its text, so it is not told by colour alone (SPEC 6).
 */
export function SessionProgress({ at, of, label }: { at: number; of: number; label: string }) {
  if (of < 2 || at < 1) return null;
  return (
    <div
      class="session-bar"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={of}
      aria-valuenow={at}
      aria-valuetext={`Del ${at} af ${of}: ${label}`}
    >
      {Array.from({ length: of }, (_, i) => (
        <span key={i} class={i + 1 < at ? 'done' : i + 1 === at ? 'now' : ''} />
      ))}
    </div>
  );
}

/** A name longer than this is set in 22 px instead of 28, so »Nu« keeps its cues over »Næste«. */
const LONG_NAME = 16;

/**
 * »Nu« above the exercise in hand: the label with the track and step on one line, then the name
 * with »Sådan gør du« beside it, so the button stays on the first screen above the actions.
 */
export function NowHead({
  kicker,
  name,
  onCard,
}: {
  kicker: ComponentChildren;
  name: string;
  onCard?: () => void;
}) {
  return (
    <div class="now-head step-enter">
      <p class="step-kicker">
        <span class="now-label">Nu</span> {kicker}
      </p>
      <div class="now-head-row">
        {/* A long name in 22 px stands on at most two lines by »Sådan gør du« (D59). */}
        <h1 class={name.length > LONG_NAME ? 'set-name long' : 'set-name'}>{name}</h1>
        {onCard && (
          <button type="button" class="btn how now-how" onClick={onCard}>
            Sådan gør du
          </button>
        )}
      </div>
    </div>
  );
}
