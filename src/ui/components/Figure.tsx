// The animated figure (docs/SPEC.md 3.8, 5 and 6; DECISIONS.md D48). It moves between the positions
// in the step's tempo and shows the phases under it with the running one highlighted. A tap on the
// figure (or on »Slowmotion«) plays it at half speed and back. With prefers-reduced-motion it shows
// the positions as still images side by side with their names. It has a text alternative with the
// positions and the phases in words.
//
// The phone runs without JIT, so the animation is cheap: the SVG is drawn once, and each frame only
// moves the elements of the body (at most 30 times a second). It stops when the figure is off the
// screen or the app is in the background, and goes on from where it stood.
//
// In a session the figure can follow the session's clock instead of its own (docs/SPEC.md 3.2,
// src/figure/sync.ts): `clock` gives the time into the movement for each frame. A small still image
// of one position is »Næste« and »Dagens pas« (FigureStill).
import { Fragment } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { FigureItem, OwnMovement } from '../../content/types.ts';
import { moving, svgBody, viewBox } from '../../figure/draw.ts';
import {
  buildModel,
  movingPrims,
  phaseAt,
  poseAt,
  stillPrims,
  type FigureModel,
} from '../../figure/motion.ts';
// The figure's CSS comes with the card's code, so no start file lists it (docs/SPEC.md 7).
import css from './figure.css?inline';

let styled = false;

/** Adds the figure's CSS to the page the first time a figure is drawn. */
function addStyle(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
}

/** At most this many drawings a second: a smooth figure, little work without JIT. */
const FPS = 30;

/** Seconds into the movement at `now` (performance.now()); null = the first position, no phase. */
export type FigureClock = (now: number) => number | null;

export interface FigureProps {
  figure: FigureItem;
  movement: OwnMovement;
  /** The text alternative: the positions and the phases in words (docs/SPEC.md 6). */
  label: string;
  /** The session's clock (src/figure/sync.ts); without it the figure runs in its own tempo. */
  clock?: FigureClock;
  /** In a session: no slow motion, so the figure keeps to the clock and leaves room for the set. */
  compact?: boolean;
}

export function Figure({ figure, movement, label, clock, compact = false }: FigureProps) {
  addStyle();
  const reduced = useReducedMotion();
  const model = useMemo(() => buildModel(figure, movement), [figure, movement]);
  return reduced ? (
    <Stills model={model} label={label} />
  ) : (
    <Animated model={model} label={label} clock={clock} compact={compact} />
  );
}

/** One position as a still image (»Næste«, »Dagens pas«): the movement's most typical by default. */
export function FigureStill({
  figure,
  movement,
  label,
  position,
}: {
  figure: FigureItem;
  movement: OwnMovement;
  label: string;
  position: string;
}) {
  addStyle();
  const model = useMemo(() => buildModel(figure, movement), [figure, movement]);
  const markup = useMemo(() => svgBody(stillPrims(model, position)), [model, position]);
  return (
    <div class="figure-still-only" role="img" aria-label={label}>
      <svg
        class="figure-svg"
        viewBox={viewBox(model.stillBox)}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    </div>
  );
}

/** prefers-reduced-motion: reduce, and it follows a change of the setting. */
export function useReducedMotion(): boolean {
  const query = useMemo(
    () =>
      typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null,
    [],
  );
  const [reduced, setReduced] = useState(() => query?.matches ?? false);
  useEffect(() => {
    if (!query) return;
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [query]);
  return reduced;
}

/** The phases as text, the running one highlighted with colour and a line under it. */
function Phases({ movement, current }: { movement: OwnMovement; current: number | null }) {
  return (
    <p class="card-phases figure-phases">
      {movement.phases.map((phase, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span class="figure-sep" aria-hidden="true">
              {' · '}
            </span>
          )}
          <span
            class={i === current ? 'figure-phase now' : 'figure-phase'}
            aria-current={i === current ? 'step' : undefined}
          >
            {phase.label}
          </span>
        </Fragment>
      ))}
    </p>
  );
}

/**
 * A figure taller than it is wide (standing, a wall sit) is drawn beside its phases, so it gets the
 * height without pushing the cues off the first screen.
 */
function isTall(model: FigureModel): boolean {
  return model.box.y1 - model.box.y0 > (model.box.x1 - model.box.x0) * 0.9;
}

function Animated({
  model,
  label,
  clock,
  compact,
}: {
  model: FigureModel;
  label: string;
  clock: FigureClock | undefined;
  compact: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const timeAt = useRef(clock);
  timeAt.current = clock;
  const [phase, setPhase] = useState<number | null>(() =>
    clock ? phaseOrNull(model, clock(performance.now())) : phaseAt(model, 0),
  );
  const [slow, setSlow] = useState(false);
  const speed = useRef(1);
  speed.current = slow ? 0.5 : 1;
  const markup = useMemo(
    () => svgBody([...model.still, ...movingPrims(model, poseAt(model, 0))], true),
    [model],
  );

  useEffect(() => {
    const el = svg.current;
    if (!el || model.frozen) return;
    const nodes = new Map<string, Element>();
    for (const node of el.querySelectorAll('[data-k]'))
      nodes.set(node.getAttribute('data-k') ?? '', node);
    let raf = 0;
    let last = -1;
    let drawn = -Infinity;
    /** Seconds into the loop; only runs while the figure is shown. Null = the first position. */
    let t: number | null = timeAt.current ? timeAt.current(performance.now()) : 0;
    let onScreen = true;
    let shown = document.visibilityState !== 'hidden';
    let current = phaseOrNull(model, t);

    const draw = () => {
      for (const p of movingPrims(model, poseAt(model, t ?? 0))) {
        const node = nodes.get(p.key);
        if (node) for (const [name, value] of moving(p)) node.setAttribute(name, value);
      }
      const now = phaseOrNull(model, t);
      if (now !== current) {
        current = now;
        setPhase(now);
      }
    };
    const tick = (now: number) => {
      raf = 0;
      const follow = timeAt.current;
      if (follow) t = follow(now);
      else if (last >= 0) t = (t ?? 0) + ((now - last) / 1000) * speed.current;
      last = now;
      if (now - drawn >= 1000 / FPS - 1) {
        drawn = now;
        draw();
      }
      run();
    };
    const run = () => {
      if (!raf && onScreen && shown) raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = -1;
    };
    const onVisibility = () => {
      shown = document.visibilityState !== 'hidden';
      if (shown) run();
      else stop();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const observer =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver((entries) => {
            onScreen = entries.some((e) => e.isIntersecting);
            if (onScreen) run();
            else stop();
          })
        : null;
    observer?.observe(el);
    run();
    return () => {
      stop();
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [model]);

  // Following the session's clock, or small in a session: no slow motion.
  const steady = compact || clock !== undefined;
  const toggle = steady ? undefined : () => setSlow((s) => !s);
  const classes = ['figure', isTall(model) ? 'tall' : '', compact ? 'compact' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <figure class={classes} data-speed={slow ? 'slow' : 'normal'}>
      <div class="figure-stage" role="img" aria-label={label} onClick={toggle}>
        <svg
          ref={svg}
          class="figure-svg"
          viewBox={viewBox(model.box)}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: markup }}
        />
      </div>
      <figcaption class="figure-caption">
        {compact ? (
          <CurrentPhase movement={model.movement} current={phase} />
        ) : (
          <Phases movement={model.movement} current={phase} />
        )}
        {!model.frozen && toggle && (
          <button type="button" class="btn figure-speed" onClick={toggle}>
            {slow ? 'Normal fart' : 'Slowmotion'}
          </button>
        )}
      </figcaption>
    </figure>
  );
}

/**
 * In a session (compact): only the phase that runs, on one line of fixed height, so the figure
 * leaves room for the set; the card shows them all.
 */
function CurrentPhase({ movement, current }: { movement: OwnMovement; current: number | null }) {
  const label = current === null ? null : (movement.phases[current]?.label ?? null);
  return (
    <p class="card-phases figure-phases figure-current">
      {label ? (
        <span class="figure-phase now" aria-current="step">
          {label}
        </span>
      ) : (
        ' '
      )}
    </p>
  );
}

/** The phase at `t`, or none when the figure stands in its first position (t = null). */
function phaseOrNull(model: FigureModel, t: number | null): number | null {
  return t === null ? null : phaseAt(model, t);
}

/**
 * How many still images stand on a row: at most three, two when the figure is wide (a plank) or
 * there are four, so each stays large enough to read from the floor (L1 in the P3 review).
 */
export function stillColumns(count: number, width: number, height: number): number {
  if (count <= 1) return 1;
  if (width > height * 1.6 || count === 4) return 2;
  return Math.min(3, count);
}

/** Reduced motion: every position as a still image with its name, at most three to a row. */
function Stills({ model, label }: { model: FigureModel; label: string }) {
  // A figure that travels along x (`advance`) shows each position in its own box (H1, P1a review).
  const box = viewBox(model.stillBox);
  const columns = stillColumns(
    model.movement.positions.length,
    model.stillBox.x1 - model.stillBox.x0,
    model.stillBox.y1 - model.stillBox.y0,
  );
  return (
    <figure class={isTall(model) ? 'figure stills tall' : 'figure stills'}>
      <div
        class="figure-stills"
        role="img"
        aria-label={label}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {model.movement.positions.map((p) => (
          <div class="figure-still" key={p.id}>
            <svg
              class="figure-svg"
              viewBox={box}
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: svgBody(stillPrims(model, p.id)) }}
            />
            <p class="figure-still-name">{p.name}</p>
          </div>
        ))}
      </div>
      <figcaption class="figure-caption">
        <Phases movement={model.movement} current={null} />
      </figcaption>
    </figure>
  );
}
