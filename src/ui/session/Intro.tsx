// The intro card (docs/SPEC.md 3.2, DECISIONS.md D44): the first time an exercise comes in a strength
// session it shows its animation and its steps – in the pause before its first set, where it closes
// with a tap or by itself when the pause ends, or, with no pause before it, with its own »Gør klar«
// countdown of 10 sek. The warm-up has one card for its four items, 10 sek before its first timer.
// It never stops the session: hold, club sequence and neck still start without a touch (SK3).
import type { ComponentChildren } from 'preact';
import type { CardContext } from '../components/cardItem.ts';
import { PROGRAM } from '../../engine/program.ts';
import { cardItem } from '../components/cardItem.ts';
import { useExercise } from './exercise.ts';
import { ExerciseFigure } from './NowNext.tsx';
import type { PartStart, Upcoming } from './outline.ts';
import { CountdownView, useCountdown } from './timers.tsx';

/** »Gør klar« before an exercise without a pause before it, and before the warm-up's first timer. */
export const INTRO_SECONDS = 10;

/**
 * The card's content: the name, the target, the figure in its tempo, »Gør klar« (the card stands in
 * the pause, so the pause's own »Gør klar« must be here too) and the numbered steps.
 */
export function IntroBody({
  next,
  context,
  label = 'Ny øvelse',
}: {
  next: Upcoming;
  context: CardContext | null;
  label?: string;
}) {
  const exercise = useExercise(next.cardId, context);
  const explained = exercise.explained;
  const programme = next.cardId ? cardItem(PROGRAM, next.cardId) : null;
  return (
    <>
      <p class="intro-label">{label}</p>
      <h1>{next.title}</h1>
      {next.line && <p class="intro-line">{next.line}</p>}
      <ExerciseFigure
        cardId={next.cardId}
        pictoId={next.pictoId}
        name={next.title}
        context={context}
        size="big"
      />
      {explained?.getReady && (
        <p class="get-ready">
          <strong>Gør klar:</strong> {explained.getReady}
        </p>
      )}
      {explained ? (
        <ol class="intro-steps">
          {explained.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : (
        programme?.execution && <p>{programme.execution}</p>
      )}
    </>
  );
}

/**
 * The intro card with the clock it stands under: the pause's, or its own »Gør klar«. Where the
 * exercise begins a part of the session, the clock's line carries the part's big red number (D59).
 */
export function IntroCard({
  next,
  context = null,
  clock,
  onClose,
}: {
  next: Upcoming;
  context?: CardContext | null;
  clock: ComponentChildren;
  onClose: () => void;
}) {
  return (
    <div class="intro" data-testid="intro">
      {clock}
      {/* A tap anywhere on the card closes it, as »Luk« does (D44). */}
      <section class="intro-card" aria-label="Introkort" onClick={onClose}>
        <IntroBody next={next} context={context} />
      </section>
      <div class="fixed-actions">
        <button type="button" class="btn block" onClick={onClose} data-testid="intro-close">
          Luk
        </button>
      </div>
    </div>
  );
}

/**
 * The intro card of an exercise with no pause before it: »Gør klar« counts down 10 sek, and then
 * (or at the tap) the exercise starts. The countdown stands still with the session.
 */
export function IntroStep({
  next,
  context = null,
  part = null,
  paused,
  onDone,
}: {
  next: Upcoming;
  context?: CardContext | null;
  part?: PartStart | null;
  paused: boolean;
  onDone: () => void;
}) {
  const timer = useCountdown(INTRO_SECONDS, paused, { onDone, end: 'go' });
  return (
    <IntroCard
      next={next}
      context={context}
      clock={<CountdownView state={timer} label="Gør klar" size="line" part={part} />}
      onClose={onDone}
    />
  );
}

/** One warm-up item on the warm-up's card: its name, dose and figure (or pictogram). */
function WarmupItem({ id, context }: { id: string; context: CardContext | null }) {
  const item = cardItem(PROGRAM, id);
  const exercise = useExercise(id, context);
  if (!item) return null;
  const names = exercise.movements.map((m) => m.name).filter((n): n is string => !!n);
  return (
    <li>
      <ExerciseFigure
        cardId={id}
        pictoId={id}
        name={item.name}
        context={context}
        size="next"
        still
      />
      <span>
        <strong>{item.name}</strong> · {item.dose}
        {names.length > 0 && (
          <>
            <br />
            {names.join(' · ')}
          </>
        )}
      </span>
    </li>
  );
}

/**
 * The warm-up's one card (D44): its four items with name and figure, 10 sek after »Start
 * opvarmningen«; it closes by itself before the first timer starts, or at a tap.
 */
export function WarmupIntro({
  ids,
  context,
  part = null,
  paused,
  onDone,
}: {
  ids: string[];
  context: CardContext | null;
  /** The warm-up's part of the session: »2 Opvarmning«. */
  part?: PartStart | null;
  paused: boolean;
  onDone: () => void;
}) {
  const timer = useCountdown(INTRO_SECONDS, paused, { onDone, end: 'go' });
  return (
    <div class="intro" data-testid="intro">
      <CountdownView state={timer} label="Gør klar" size="line" part={part} />
      <section class="intro-card" aria-label="Introkort" onClick={onDone}>
        <p class="intro-label">Opvarmning · 8 min</p>
        <h1>Fire punkter efter tur</h1>
        <p class="intro-line">Uret skifter selv til næste punkt.</p>
        <ul class="intro-moves">
          {ids.map((id) => (
            <WarmupItem key={id} id={id} context={context} />
          ))}
        </ul>
      </section>
      <div class="fixed-actions">
        <button type="button" class="btn block" onClick={onDone} data-testid="intro-close">
          Luk
        </button>
      </div>
    </div>
  );
}
