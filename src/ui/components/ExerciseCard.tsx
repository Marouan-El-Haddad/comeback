// The exercise card (docs/SPEC.md 3.8): the name and the dose from the programme, the figure, and
// the explanation from content/explain (9.1). The figure is the animated figure from
// content/figures when the step is drawn (src/ui/components/Figure.tsx, DECISIONS.md D48), and
// until then its pictogram from program/pictos.json with the phases as text under it. Without an
// explanation the card shows the programme's execution and cues without sources (DECISIONS.md D43).
// The order lets it be skimmed in a pause: figure, cues, »Sådan gør du« with the start position
// first, then »Træner« (D47) and »Mærk« (D55). Loaded with lazy() from src/ui/card.tsx: it fetches
// content and holds the figure system, so never in the start files (SPEC 7).
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { loadExplain, loadFigures } from '../../content/load.ts';
import type { ExplainItem, Fault, FigureFile, FigureItem, Movement } from '../../content/types.ts';
import { PROGRAM } from '../../engine/program.ts';
import type { CardProps } from '../card.tsx';
import { useExplain, useFigures } from '../content.ts';
import {
  cardItem,
  cardMovements,
  equipmentText,
  explanationOf,
  figureIn,
  figureText,
  likeSubject,
  movementsText,
  phasesText,
  type CardContext,
  type CardItem,
  type CardMovement,
} from './cardItem.ts';
import { Figure as AnimatedFigure, FaultFigure } from './Figure.tsx';
import { pictoUrl } from './Picto.tsx';

/** The session's first power step as the warm-up's »Potensér« shows it, or null. */
function powerOf(context: CardContext | null): CardItem | null {
  return context?.power ? cardItem(PROGRAM, context.power) : null;
}

/**
 * Fetches the explanation and the figures before the card opens (src/ui/card.tsx), so it opens
 * complete: also the files a »like« points into and, in a session's warm-up, the first power step's.
 */
export async function prepare(id: string, context: CardContext | null = null): Promise<void> {
  const item = cardItem(PROGRAM, id);
  if (!item) return;
  const [file] = await Promise.all([loadExplain(item.subject), loadFigures(item.subject)]);
  const other = likeSubject(file, id);
  const power = powerOf(context);
  const powerOther = power && power.subject !== item.subject ? power.subject : null;
  await Promise.all([
    other ? loadExplain(other) : null,
    other ? loadFigures(other) : null,
    powerOther ? loadExplain(powerOther) : null,
    powerOther ? loadFigures(powerOther) : null,
  ]);
}

/** Finds a card movement's figure among the loaded figure files, or null when it is not drawn. */
type FigureOf = (movement: CardMovement) => FigureItem | null;

/** A typical mistake drawn as right and wrong in a movement's figure (D58). */
interface DrawnFault {
  figure: FigureItem;
  movement: CardMovement;
  fault: Fault;
}

/**
 * The typical mistakes the card's figures draw, by their number in the explanation (from 1): only
 * the movements of the card's own explanation, whose mistakes the card lists – not the power step the
 * warm-up's »Potensér« borrows.
 */
function drawnFaults(
  movements: readonly CardMovement[],
  figureOf: FigureOf,
  ownId: string | undefined,
): Map<number, DrawnFault> {
  const found = new Map<number, DrawnFault>();
  for (const movement of movements) {
    if (movement.positions.length === 0 || movement.source?.item !== ownId) continue;
    const figure = figureOf(movement);
    for (const fault of figure?.faults ?? []) {
      if (figure && !found.has(fault.mistake))
        found.set(fault.mistake, { figure, movement, fault });
    }
  }
  return found;
}

function figureFinder(files: ReadonlyArray<FigureFile | null | undefined>): FigureOf {
  return (movement) => {
    const source = movement.source;
    if (!source) return null;
    const subject = source.item.slice(0, Math.max(0, source.item.indexOf('.')));
    const file = files.find((f) => f?.subject === subject);
    return figureIn(file, source.item, source.movement);
  };
}

export function ExerciseCard({ id, back, onClose, context = null, status }: CardProps) {
  const item = cardItem(PROGRAM, id);
  const file = useExplain(item?.subject ?? '');
  const otherSubject = likeSubject(file, id) ?? '';
  const other = useExplain(otherSubject);
  const power = powerOf(context);
  const powerFile = useExplain(power?.subject ?? '');
  const figures = useFigures(item?.subject ?? '');
  const otherFigures = useFigures(otherSubject);
  const powerFigures = useFigures(power?.subject ?? '');
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, [id]);

  const explained = explanationOf(file, id, other);
  const powerExplained = context?.power ? explanationOf(powerFile, context.power) : null;
  // The warm-up's »Potensér« shows the session's first power step (docs/SPEC.md 9.1). The same
  // movement objects from render to render, so a running figure is not started again.
  const movements = useMemo(
    () =>
      cardMovements(
        explained?.movements ?? [],
        context,
        power && context?.power ? { name: power.name, explained: powerExplained } : null,
        explained?.id,
      ),
    [explained, context, power?.name, powerExplained],
  );
  const figureOf = figureFinder([figures, otherFigures, powerFigures]);
  const faults = useMemo(
    () =>
      drawnFaults(movements, figureFinder([figures, otherFigures, powerFigures]), explained?.id),
    [movements, figures, otherFigures, powerFigures, explained?.id],
  );

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
          <Figure id={id} name={item.name} movements={movements} figureOf={figureOf} />
          {context?.lighter && explained && (
            <section class="card-lighter" aria-label="Lettere variant i dag">
              <p>
                <strong>Lettere variant i dag:</strong> {explained.easier}
              </p>
            </section>
          )}
          {explained ? (
            <Explained x={explained} name={item.name} movements={movements} figureOf={figureOf} />
          ) : (
            <ProgrammeOnly item={item} />
          )}
          <Folds x={explained} why={why} faults={faults} />
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
 * The step's figure: the animated figure with the phases under it when the step is drawn, and until
 * then its pictogram with the phases as text. Several movements have their figures and phases in
 * »Bevægelserne« instead, so the cues and the steps still start on the first screen (D47).
 */
function Figure({
  id,
  name,
  movements,
  figureOf,
}: {
  id: string;
  name: string;
  movements: CardMovement[];
  figureOf: FigureOf;
}) {
  const [only] = movements;
  const single = only && !named(movements) ? only : null;
  const figure = single ? figureOf(single) : null;
  if (single && figure) {
    return (
      <div class="card-figure">
        <AnimatedFigure figure={figure} movement={single} label={figureText(name, single)} />
      </div>
    );
  }
  const url = pictoUrl(id);
  // A step without its own pictogram uses the ladder's nearest one (SPEC 5): say so.
  const similar = url !== null && PROGRAM.pictos[id]?.fallback === true;
  const phases = single ? <p class="card-phases">{phasesText(single)}</p> : null;
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
 * several (the warm-up's »Mobilisér«, the session's power step in »Potensér«, docs/SPEC.md 9.1:
 * each with its figure under its name when it is drawn, otherwise its name and phases on one line),
 * then »Træner« and »Mærk«: where the step should be felt, when the explanation has it (D55).
 */
function Explained({
  x,
  name,
  movements,
  figureOf,
}: {
  x: ExplainItem;
  name: string;
  movements: CardMovement[];
  figureOf: FigureOf;
}) {
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
              const figure = figureOf(m);
              if (figure) {
                return (
                  <li key={m.id ?? m.name} class="card-move">
                    <h3 class="card-move-title">{m.name}</h3>
                    <AnimatedFigure
                      figure={figure}
                      movement={m}
                      label={figureText(m.name ?? name, m)}
                    />
                  </li>
                );
              }
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
      {x.feel && (
        <Section title="Mærk">
          <p>{x.feel}</p>
        </Section>
      )}
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

/**
 * Folded, one tap each: tempo and breathing, mistakes, easier and harder, equipment, »Hvorfor«. A
 * mistake the figure draws stands as »Rigtigt« and »Forkert« under it, drawn when the fold opens.
 */
function Folds({
  x,
  why,
  faults,
}: {
  x: ExplainItem | null;
  why: string[];
  faults: ReadonlyMap<number, DrawnFault>;
}) {
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
          <Fold title="Typiske fejl" lazy={faults.size > 0}>
            <ul class="card-mistakes">
              {x.mistakes.map((m, i) => {
                const drawn = faults.get(i + 1);
                return (
                  <li key={m.mistake}>
                    <p class="card-mistake">{m.mistake}</p>
                    {drawn && (
                      <FaultFigure
                        figure={drawn.figure}
                        movement={drawn.movement}
                        fault={drawn.fault}
                        mistake={m.mistake}
                      />
                    )}
                    <p>
                      <strong>Ret det:</strong> {m.fix}
                    </p>
                  </li>
                );
              })}
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

/** A fold; a `lazy` one draws its contents the first time it opens (the mistakes' figures). */
function Fold({
  title,
  children,
  lazy = false,
}: {
  title: string;
  children: ComponentChildren;
  lazy?: boolean;
}) {
  const [opened, setOpened] = useState(!lazy);
  return (
    <details
      class="card-fold"
      onToggle={(e) => {
        if (e.currentTarget.open) setOpened(true);
      }}
    >
      <summary>{title}</summary>
      <div class="card-fold-body">{opened ? children : null}</div>
    </details>
  );
}
