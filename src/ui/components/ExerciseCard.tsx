// The exercise card (docs/SPEC.md 3.8): the name and the dose from the programme, the figure, and
// the explanation from content/explain (9.1). Until the figure system (milestone 6) draws the step,
// the figure is its pictogram from program/pictos.json with the phases as text under it. Without an
// explanation the card shows the programme's execution and cues without sources (DECISIONS.md D43).
// The order lets it be skimmed in a pause: figure, cues, »Sådan gør du« with the start position
// first, then »Træner« (D47). Loaded with lazy() from src/ui/card.tsx: it fetches content, so never
// in the start files (SPEC 7).
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { loadExplain } from '../../content/load.ts';
import type { ExplainItem, Movement } from '../../content/types.ts';
import { PROGRAM } from '../../engine/program.ts';
import type { CardProps } from '../card.tsx';
import { useExplain } from '../content.ts';
import {
  cardItem,
  cardMovements,
  equipmentText,
  explanationOf,
  likeSubject,
  movementsText,
  phasesText,
  type CardContext,
  type CardItem,
} from './cardItem.ts';
import { pictoUrl } from './Picto.tsx';

/** The session's first power step as the warm-up's »Potensér« shows it, or null. */
function powerOf(context: CardContext | null): CardItem | null {
  return context?.power ? cardItem(PROGRAM, context.power) : null;
}

/**
 * Fetches the explanation before the card opens (src/ui/card.tsx), so it opens complete: also the
 * file a »like« points into and, in a session's warm-up, the first power step's file.
 */
export async function prepare(id: string, context: CardContext | null = null): Promise<void> {
  const item = cardItem(PROGRAM, id);
  if (!item) return;
  const file = await loadExplain(item.subject);
  const other = likeSubject(file, id);
  const power = powerOf(context);
  await Promise.all([
    other ? loadExplain(other) : null,
    power && power.subject !== item.subject ? loadExplain(power.subject) : null,
  ]);
}

export function ExerciseCard({ id, back, onClose, context = null, status }: CardProps) {
  const item = cardItem(PROGRAM, id);
  const file = useExplain(item?.subject ?? '');
  const other = useExplain(likeSubject(file, id) ?? '');
  const power = powerOf(context);
  const powerFile = useExplain(power?.subject ?? '');
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, [id]);

  const backButton = (
    <button type="button" class="btn" onClick={onClose}>
      {back}
    </button>
  );
  // In a session: the way back and what the session does meanwhile (D47).
  const top = (
    <div class="card-top">
      {backButton}
      {status && (
        <p class="card-status" role="status">
          {status}
        </p>
      )}
    </div>
  );
  if (!item) {
    return (
      <article class="screen exercise-card" data-card={id}>
        {top}
        <h1 class="card-title" ref={title} tabIndex={-1}>
          Øvelsen findes ikke i programmet
        </h1>
      </article>
    );
  }
  const explained = explanationOf(file, id, other);
  // The warm-up's »Potensér« shows the session's first power step (docs/SPEC.md 9.1).
  const movements = cardMovements(
    explained?.movements ?? [],
    context,
    power && context?.power
      ? { name: power.name, explained: explanationOf(powerFile, context.power) }
      : null,
  );
  // The track's »Hvorfor« from content/explain replaces the programme's own text (SPEC 3.2).
  const why = file ? file.why : item.why;

  return (
    <article class="screen exercise-card" data-card={id} aria-labelledby="card-title">
      {top}
      <header class="card-head">
        <p class="step-kicker">{item.kicker}</p>
        <h1 id="card-title" class="card-title" ref={title} tabIndex={-1}>
          {item.name}
        </h1>
        <p class="card-dose">
          {/* Big numbers for a short dose; a dose in words would wrap at that size (D47). */}
          <span class={item.dose.length > 18 ? 'card-dose-value long' : 'card-dose-value'}>
            {item.dose}
          </span>
          {item.doseLegend && <span class="card-dose-legend">{item.doseLegend}</span>}
        </p>
      </header>
      {file !== undefined && (
        <>
          <Figure id={id} name={item.name} movements={movements} />
          {context?.lighter && explained && (
            <section class="card-lighter" aria-label="Lettere variant i dag">
              <p>
                <strong>Lettere variant i dag:</strong> {explained.easier}
              </p>
            </section>
          )}
          {explained ? (
            <Explained x={explained} movements={movements} />
          ) : (
            <ProgrammeOnly item={item} />
          )}
          <Folds x={explained} why={why} />
        </>
      )}
      <button type="button" class="btn block card-back" onClick={onClose}>
        {back}
      </button>
    </article>
  );
}

/** Several movements, or one with a name (»Potensér«): listed after »Sådan gør du« (D47). */
function named(movements: Movement[]): boolean {
  return movements.length > 1 || (movements.length === 1 && !!movements[0]?.name);
}

/**
 * The step's pictogram with the phases of one repetition under it (the figure from P3 on). Several
 * movements have their phases in »Bevægelserne« instead, so the cues and the steps still start on
 * the first screen (D47).
 */
function Figure({ id, name, movements }: { id: string; name: string; movements: Movement[] }) {
  const url = pictoUrl(id);
  // A step without its own pictogram uses the ladder's nearest one (SPEC 5): say so.
  const similar = url !== null && PROGRAM.pictos[id]?.fallback === true;
  const [only] = movements;
  const phases = only && !named(movements) ? <p class="card-phases">{phasesText(only)}</p> : null;
  if (!url) return phases ? <div class="card-figure">{phases}</div> : null;
  return (
    <figure class="card-figure">
      <img
        class="card-picto"
        src={url}
        alt={movements.length > 0 ? movementsText(movements) : name}
        width={382}
        height={140}
        decoding="async"
      />
      {(phases || similar) && (
        <figcaption class="card-caption">
          {phases}
          {similar && <p class="card-similar">Tegningen viser en lignende øvelse.</p>}
        </figcaption>
      )}
    </figure>
  );
}

function Section({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <section class="card-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/**
 * Visible without unfolding, in the order that lets the card be skimmed in a pause (D47): the cues,
 * »Sådan gør du« with the start position first and the numbered steps, the movements when there are
 * several (each name and its phases on one line: the warm-up's »Mobilisér«, the session's power step
 * in »Potensér«, docs/SPEC.md 9.1), then »Træner«.
 */
function Explained({ x, movements }: { x: ExplainItem; movements: Movement[] }) {
  return (
    <>
      <Section title="Cues">
        <Cues cues={x.cues} />
      </Section>
      <Section title="Sådan gør du">
        <p class="card-start">
          <strong>Udgangsstilling:</strong> {x.start}
        </p>
        <ol class="card-steps">
          {x.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Section>
      {named(movements) && (
        <Section title="Bevægelserne">
          <ul class="card-phases">
            {movements.map((m) => {
              const text = phasesText(m);
              return (
                <li key={m.id ?? m.name}>
                  <strong class="card-move-name">{m.name}</strong>
                  {text ? `: ${text}` : ''}
                </li>
              );
            })}
          </ul>
        </Section>
      )}
      <Section title="Træner">
        <p>{x.trains}</p>
      </Section>
    </>
  );
}

/** No explanation yet: the programme's cues, its own execution and the parts of a round. */
function ProgrammeOnly({ item }: { item: CardItem }) {
  return (
    <>
      {item.cues.length > 0 && (
        <Section title="Cues">
          <Cues cues={item.cues} />
        </Section>
      )}
      {(item.execution || item.round.length > 0) && (
        <Section title="Sådan gør du">
          {item.execution && <p>{item.execution}</p>}
          {item.round.length > 0 && (
            <>
              <p class="card-round">En runde:</p>
              <ol class="card-steps">
                {item.round.map((part, i) => (
                  <li key={i}>{part}</li>
                ))}
              </ol>
            </>
          )}
        </Section>
      )}
    </>
  );
}

function Cues({ cues }: { cues: string[] }) {
  return (
    <ul class="card-cues">
      {cues.map((cue) => (
        <li key={cue}>{cue}</li>
      ))}
    </ul>
  );
}

/** Folded, one tap each: tempo and breathing, mistakes, easier and harder, equipment, »Hvorfor«. */
function Folds({ x, why }: { x: ExplainItem | null; why: string[] }) {
  if (!x && why.length === 0) return null;
  return (
    <div class="card-folds">
      {x && (
        <>
          <Fold title="Tempo og vejrtrækning">
            <dl class="card-facts">
              <dt>Tempo</dt>
              <dd>{x.tempo}</dd>
              <dt>Vejrtrækning</dt>
              <dd>{x.breathing}</dd>
            </dl>
          </Fold>
          <Fold title="Typiske fejl">
            <ul class="card-mistakes">
              {x.mistakes.map((m) => (
                <li key={m.mistake}>
                  <p class="card-mistake">{m.mistake}</p>
                  <p>
                    <strong>Ret det:</strong> {m.fix}
                  </p>
                </li>
              ))}
            </ul>
          </Fold>
          <Fold title="Lettere og sværere">
            <dl class="card-facts">
              <dt>Lettere</dt>
              <dd>{x.easier}</dd>
              <dt>Sværere</dt>
              <dd>{x.harder}</dd>
            </dl>
          </Fold>
          <Fold title={`Udstyr: ${equipmentText(x.equipment)}`}>
            <p>
              <strong>Gør klar:</strong> {x.getReady}
            </p>
          </Fold>
        </>
      )}
      {why.length > 0 && (
        <Fold title="Hvorfor">
          {why.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </Fold>
      )}
    </div>
  );
}

function Fold({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <details class="card-fold">
      <summary>{title}</summary>
      <div class="card-fold-body">{children}</div>
    </details>
  );
}
