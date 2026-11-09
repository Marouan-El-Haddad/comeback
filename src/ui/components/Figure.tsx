// The animated figure (docs/SPEC.md 3.8, 5 and 6; DECISIONS.md D48 and D58). It moves between the
// positions in the step's tempo and shows the phases under it with the running one highlighted. A
// tap on the figure (or on »Slowmotion«) plays it at half speed and back. With prefers-reduced-motion
// it shows the positions as still images side by side with their names. It has a text alternative
// with the positions, the phases, the views and the marks in words.
//
// A figure can have a second view beside it or under it (a squat from the side and from the front
// side by side, a plank from the side and from above over each other: whichever draws the smaller
// larger, D60), on the same clock, and marks at the right moment: an arrow, an angle, a cue or a
// guide line in the figure's red, one at a time, with its text in HTML at the size the session needs
// (SPEC 6), inside its drawing on at most two lines or else on its own line over or under the figure.
// A cue or a guide line at a part of the body follows it through its phase while its text stands
// still. A figure that travels along the floor gets a frame that follows it.
//
// The phone runs without JIT, so the animation is cheap: the SVG is drawn once, and each frame only
// moves the elements of the body (at most 30 times a second), not at all while the figure holds a
// position. It stops when the figure is off the screen or the app is in the background, and goes on
// from where it stood.
//
// In a session the figure can follow the session's clock instead of its own (docs/SPEC.md 3.2,
// src/figure/sync.ts): `clock` gives the time into the movement for each frame. A small still image
// of one position is »Næste« and »Dagens pas« (FigureStill).
import { Fragment } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Fault, FigureItem, OwnMovement, Point } from '../../content/types.ts';
import {
  emptyBox,
  moving,
  svgBody,
  track,
  viewBox,
  type Box,
  type Prim,
} from '../../figure/draw.ts';
import { faultPair } from '../../figure/faults.ts';
import {
  bodyOf,
  followPrims,
  labelCovers,
  markAt,
  markPlans,
  placeLabel,
  stillMarks,
  viewsAndMarksText,
  type MarkDraw,
  type MarkLabel,
  type MarkPlan,
  type MarkShow,
} from '../../figure/marks.ts';
import {
  buildModel,
  frameBox,
  moveAt,
  movingPrims,
  phaseAt,
  poseAt,
  shiftAtTime,
  stillPrims,
  type FigureModel,
  type Move,
} from '../../figure/motion.ts';
import { stackViews, VIEW_GAP, VIEW_NAME, viewAspect, viewModels } from '../../figure/views.ts';
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

/** One view of a figure, ready to draw: its model and its marks with when they are shown. */
interface ViewModel {
  model: FigureModel;
  plans: MarkPlan[];
}

function useViews(figure: FigureItem, movement: OwnMovement, both = true): ViewModel[] {
  return useMemo(
    () =>
      // Both views on one clock with one loop length (L1 in the P1b review).
      viewModels(figure, movement)
        .slice(0, both ? 2 : 1)
        .map((model) => ({ model, plans: markPlans(model) })),
    [figure, movement, both],
  );
}

/**
 * Two views side by side or over each other in the place the figure has (M1 in the P1b review,
 * D60): with the width it has and the height one view gets side by side (the CSS), whichever draws
 * the smaller view larger. Over each other each view gets half that height less the gap, so the
 * figure keeps its height. Returns that height in px, or null side by side (and for one view).
 */
function useStacked(
  root: { current: HTMLElement | null },
  views: readonly ViewModel[],
  still: boolean,
): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || views.length < 2) {
      setHeight(null);
      return;
    }
    const aspects = views.map((v) => viewAspect(v.model, still));
    const decide = () => {
      const svg = el.querySelector<SVGSVGElement>('.figure-svg');
      if (!svg || el.clientWidth <= 0) return;
      // The height the CSS gives one view, without the height set here when stacked.
      const set = svg.style.height;
      svg.style.height = '';
      const side = svg.getBoundingClientRect().height;
      svg.style.height = set;
      setHeight(
        side > 0 && stackViews(aspects, el.clientWidth, side)
          ? Math.floor((side - VIEW_GAP) / 2)
          : null,
      );
    };
    decide();
    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(decide);
    observer.observe(el);
    return () => observer.disconnect();
  }, [views, still]);
  return height;
}

/** The text alternative with the views and the marks in words (docs/SPEC.md 3.8 and 6). */
function fullLabel(label: string, views: readonly ViewModel[]): string {
  return [label, viewsAndMarksText(views)].filter((t) => t !== '').join(' ');
}

export function Figure({ figure, movement, label, clock, compact = false }: FigureProps) {
  addStyle();
  const reduced = useReducedMotion();
  const views = useViews(figure, movement);
  const text = useMemo(() => fullLabel(label, views), [label, views]);
  return reduced ? (
    <Stills views={views} label={text} compact={compact} />
  ) : (
    <Animated views={views} label={text} clock={clock} compact={compact} />
  );
}

/**
 * One position as a still image (»Næste«, »Dagens pas«): the movement's most typical by default. With
 * `full` (a session's figure under reduced motion) both views and the position's marks.
 */
export function FigureStill({
  figure,
  movement,
  label,
  position,
  full = false,
}: {
  figure: FigureItem;
  movement: OwnMovement;
  label: string;
  position: string;
  full?: boolean;
}) {
  addStyle();
  // »Næste« and »Dagens pas« draw many small stills: only the first view, without marks.
  const views = useViews(figure, movement, full);
  const text = useMemo(() => (full ? fullLabel(label, views) : label), [full, label, views]);
  const root = useRef<HTMLDivElement>(null);
  const stacked = useStacked(root, views, true);
  const classes = ['figure-still-only', views.length > 1 ? 'two' : '', stacked ? 'stacked' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div class={classes} role="img" aria-label={text} ref={root}>
      {views.map(({ model }, i) => (
        <StillDrawing
          key={i}
          model={model}
          box={model.stillBox}
          prims={stillPrims(model, position)}
          marks={full ? stillMarks(model, position) : []}
          height={stacked}
        />
      ))}
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
 * height without pushing the cues off the first screen. Measured without its travel along the floor,
 * so a figure that bounds forward stays as tall as standing still (D58).
 */
function isTall(model: FigureModel): boolean {
  const box = model.stillBox;
  return box.y1 - box.y0 > (box.x1 - box.x0) * 0.9;
}

// ---------------------------------------------------------------------------------------------
// The marks' text, placed by its point on the drawing (D58)
// ---------------------------------------------------------------------------------------------

/** Writes a mark's text into its element, or hides it. */
function setMark(el: HTMLElement, label: MarkLabel | null): void {
  el.hidden = !label;
  el.textContent = label ? label.text : '';
}

/**
 * Whether a mark's text fits its drawing as the CSS wraps it there (H1 in the P1b review, D60): no
 * word sticks out, and it takes at most two lines.
 */
function labelFits(el: HTMLElement): boolean {
  if (el.scrollWidth > el.clientWidth + 1) return false;
  const style = getComputedStyle(el);
  const line = parseFloat(style.lineHeight) || 1.3 * parseFloat(style.fontSize);
  return el.clientHeight <= 2 * line + 1;
}

/**
 * Places a mark's text by its point, off the body where it can (placeLabel): the SVG fills its box
 * (`width` × `height` px) and keeps its aspect ratio (»meet«), so every point's place in px follows
 * from the viewBox. The text stays inside its drawing, at most as wide as it and on at most two
 * lines (figure.css), measured after it wraps. When it does not fit (two views side by side beside
 * the clock), it stands on its own line over or under the body across the whole `figure` – both
 * views – while its dot or line stays on the body (H1 in the P1b review, D60).
 */
function placeMark(
  el: HTMLElement,
  draw: MarkDraw | null,
  viewBoxText: string,
  width: number,
  height: number,
  figure: HTMLElement | null = null,
  /** The other views' bodies in px of `figure`, for a text on its own line over both. */
  others: () => ReadonlyArray<readonly [number, number, number]> = () => [],
): void {
  const label = draw?.label;
  if (!draw || !label || el.hidden || width <= 0 || height <= 0) return;
  const { px, scale } = pxOf(viewBoxText, width, height);
  const body = (dx = 0, dy = 0) =>
    draw.body.map(([bx, by, r]) => {
      const [x0, y0] = px([bx, by], dx, dy);
      return [x0, y0, r * scale] as const;
    });
  // First at most as wide as its drawing (figure.css).
  el.style.maxWidth = '';
  const drawing = el.parentElement;
  if (labelFits(el) || !figure || !drawing) {
    const [x, y] = placeLabel({
      width,
      height,
      w: el.offsetWidth,
      h: el.offsetHeight,
      at: label.at ? px(label.at) : null,
      place: label.place,
      ray: label.ray
        ? {
            from: px(label.ray.from),
            dir: [
              Math.cos((label.ray.angle * Math.PI) / 180),
              -Math.sin((label.ray.angle * Math.PI) / 180),
            ],
          }
        : null,
      body: body(),
    });
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    return;
  }
  // Its own line over or under the body, across the whole figure: as wide as the figure, or half as
  // wide on two lines, wherever it covers least of both views.
  const area = figure.getBoundingClientRect();
  const own = drawing.getBoundingClientRect();
  const dx = own.left - area.left;
  const dy = own.top - area.top;
  const bodies = [...body(dx, dy), ...others()];
  let best: { at: Point; covers: number; max: number } | null = null;
  for (const max of [Math.floor(area.width), Math.floor(area.width / 2)]) {
    el.style.maxWidth = `${max}px`;
    if (best && !labelFits(el)) continue;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const at = placeLabel({
      width: area.width,
      height: area.height,
      w,
      h,
      at: label.at ? px(label.at, dx, dy) : null,
      place: label.place,
      line: true,
      body: bodies,
    });
    const covers = labelCovers(at, w, h, bodies);
    if (!best || covers < best.covers) best = { at, covers, max };
  }
  if (!best) return;
  el.style.maxWidth = `${best.max}px`;
  el.style.transform = `translate(${Math.round(best.at[0] - dx)}px, ${Math.round(best.at[1] - dy)}px)`;
}

/** Figure units to px in a drawing of `width` × `height` px showing `viewBoxText` (»meet«). */
function pxOf(
  viewBoxText: string,
  width: number,
  height: number,
): { px: (p: Point, dx?: number, dy?: number) => Point; scale: number } {
  const [vx = 0, vy = 0, vw = 1, vh = 1] = viewBoxText.split(/\s+/).map(Number);
  const scale = Math.min(width / vw, height / vh);
  const ox = (width - vw * scale) / 2;
  const oy = (height - vh * scale) / 2;
  return {
    scale,
    px: (p, dx = 0, dy = 0) => [ox + (p[0] - vx) * scale + dx, oy + (-p[1] - vy) * scale + dy],
  };
}

/**
 * A still image of a view, with the marks it carries (reduced motion, »Nu« under reduced motion);
 * their texts are placed when it is drawn and when it changes size. `height` sets the drawing's
 * height when two views stand over each other (useStacked).
 */
function StillDrawing({
  model,
  box,
  prims,
  marks,
  height = null,
}: {
  model: FigureModel;
  box: Box;
  prims: Prim[];
  marks: MarkDraw[];
  height?: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const markup = svgBody([...prims, ...marks.flatMap((m) => m.prims)]);
  const texts = marks.filter((m) => m.label);
  const vb = viewBox(box);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || texts.length === 0) return;
    // In a session's still the text that does not fit stands over or under both views.
    const figure = root.closest<HTMLElement>('.figure-still-only');
    const place = () => {
      root.querySelectorAll<HTMLElement>('.figure-mark').forEach((el, i) => {
        placeMark(el, texts[i] ?? null, vb, root.clientWidth, root.clientHeight, figure);
      });
    };
    place();
    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(place);
    observer.observe(root);
    return () => observer.disconnect();
  }, [markup, vb, height]);
  return (
    <div class="figure-draw" data-view={model.figure.view} ref={ref}>
      <svg
        class="figure-svg"
        viewBox={vb}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        style={height ? { height: `${height}px` } : undefined}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
      {texts.map((m, i) => (
        <span key={i} class="figure-mark">
          {m.label?.text}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// The animation
// ---------------------------------------------------------------------------------------------

/** One view as the animation draws it: its elements, its mark and what it showed last. */
interface Drawn {
  view: ViewModel;
  box: HTMLElement;
  svg: SVGSVGElement;
  label: HTMLElement;
  marks: Element | null;
  nodes: Map<string, Element>;
  width: number;
  height: number;
  viewBox: string;
  /** The mark shown now, or null, and its plan. */
  shown: MarkShow | null;
  plan: MarkPlan | null;
  /** The shapes of the mark shown now, by key: a mark that follows the body moves them (D60). */
  markNodes: Map<string, Element>;
  /** The hold the body was last drawn in: it needs no drawing until the move changes. */
  held: Move | null;
}

function Animated({
  views,
  label,
  clock,
  compact,
}: {
  views: ViewModel[];
  label: string;
  clock: FigureClock | undefined;
  compact: boolean;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const timeAt = useRef(clock);
  timeAt.current = clock;
  const main = views[0]?.model as FigureModel;
  const [phase, setPhase] = useState<number | null>(() =>
    clock ? phaseOrNull(main, clock(performance.now())) : phaseAt(main, 0),
  );
  const [slow, setSlow] = useState(false);
  const speed = useRef(1);
  speed.current = slow ? 0.5 : 1;
  const markups = useMemo(
    () =>
      views.map(
        ({ model }) =>
          svgBody([...model.still, ...model.ticks, ...movingPrims(model, poseAt(model, 0))], true) +
          '<g class="figure-marks"></g>',
      ),
    [views],
  );

  useEffect(() => {
    const root = stage.current;
    if (!root || main.frozen) return;
    const drawn: Drawn[] = [];
    root.querySelectorAll<HTMLElement>('.figure-draw').forEach((box, i) => {
      const view = views[i];
      const svg = box.querySelector('svg');
      const labelEl = box.querySelector<HTMLElement>('.figure-mark');
      if (!view || !svg || !labelEl) return;
      const nodes = new Map<string, Element>();
      for (const node of svg.querySelectorAll('[data-k]'))
        nodes.set(node.getAttribute('data-k') ?? '', node);
      drawn.push({
        view,
        box,
        svg,
        label: labelEl,
        marks: svg.querySelector('g.figure-marks'),
        nodes,
        width: box.clientWidth,
        height: box.clientHeight,
        viewBox: svg.getAttribute('viewBox') ?? '',
        shown: null,
        plan: null,
        markNodes: new Map(),
        held: null,
      });
    });
    let raf = 0;
    let last = -1;
    let drawnAt = -Infinity;
    /** Seconds into the loop; only runs while the figure is shown. Null = the first position. */
    let t: number | null = timeAt.current ? timeAt.current(performance.now()) : 0;
    let onScreen = true;
    let shown = document.visibilityState !== 'hidden';
    let current = phaseOrNull(main, t);
    /** The other views' bodies now, in px of the stage: a text on its own line keeps off them. */
    const othersOf = (d: Drawn) => () => {
      const area = root.getBoundingClientRect();
      return drawn
        .filter((o) => o !== d && o.width > 0 && o.height > 0)
        .flatMap((o) => {
          const at = o.box.getBoundingClientRect();
          const { px, scale } = pxOf(o.viewBox, o.width, o.height);
          const model = o.view.model;
          return bodyOf(model, poseAt(model, t ?? 0)).map(([bx, by, r]) => {
            const [x, y] = px([bx, by], at.left - area.left, at.top - area.top);
            return [x, y, r * scale] as const;
          });
        });
    };

    const drawView = (d: Drawn) => {
      const { model, plans } = d.view;
      // The body: not while it holds a position it is already drawn in.
      const at = moveAt(model.timeline, t ?? 0);
      const hold = at && at.move.from === at.move.to ? at.move : null;
      const still = hold !== null && hold === d.held;
      const pose = still ? null : poseAt(model, t ?? 0);
      if (pose) {
        for (const p of movingPrims(model, pose)) {
          const node = d.nodes.get(p.key);
          if (node) for (const [name, value] of moving(p)) node.setAttribute(name, value);
        }
      }
      d.held = hold;
      // A figure that travels: the frame follows it (D58).
      let moved = false;
      if (model.travel && !model.fixed && d.width > 0 && d.height > 0) {
        const box = viewBox(frameBox(model, t, d.width / d.height));
        if (box !== d.viewBox) {
          d.svg.setAttribute('viewBox', box);
          d.viewBox = box;
          moved = true;
        }
      }
      // The mark of the moment, drawn once when it comes; its text stands still while it is shown.
      const now = markAt(plans, model.timeline.total, t);
      const show = now?.show ?? null;
      if (show !== d.shown) {
        d.shown = show;
        d.plan = now?.plan ?? null;
        d.markNodes.clear();
        if (d.marks) {
          d.marks.innerHTML = show ? svgBody(show.prims, true) : '';
          for (const node of d.marks.querySelectorAll('[data-k]'))
            d.markNodes.set(node.getAttribute('data-k') ?? '', node);
        }
        setMark(d.label, show?.label ?? null);
        placeMark(d.label, show, d.viewBox, d.width, d.height, root, othersOf(d));
      } else if (moved && show?.label) {
        placeMark(d.label, show, d.viewBox, d.width, d.height, root, othersOf(d));
      }
      // A cue's dot or a guide line at a part of the body follows it through its phase (D60).
      if (show?.follow && d.plan && pose) {
        const dx = shiftAtTime(model, t ?? 0);
        for (const p of followPrims(model, d.plan.mark, d.plan.index, pose, dx)) {
          const node = d.markNodes.get(p.key);
          if (node) for (const [name, value] of moving(p)) node.setAttribute(name, value);
        }
      }
    };
    const draw = () => {
      for (const d of drawn) drawView(d);
      const now = phaseOrNull(main, t);
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
      if (now - drawnAt >= 1000 / FPS - 1) {
        drawnAt = now;
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
    observer?.observe(root);
    // The drawing's size decides the frame of a figure that travels and where a mark's text stands.
    const resize =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            for (const d of drawn) {
              d.width = d.box.clientWidth;
              d.height = d.box.clientHeight;
              d.held = null;
              placeMark(d.label, d.shown, d.viewBox, d.width, d.height, root, othersOf(d));
            }
          })
        : null;
    for (const d of drawn) resize?.observe(d.box);
    run();
    return () => {
      stop();
      observer?.disconnect();
      resize?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [views]);

  // Following the session's clock, or small in a session: no slow motion.
  const steady = compact || clock !== undefined;
  const toggle = steady ? undefined : () => setSlow((s) => !s);
  const two = views.length > 1;
  const stacked = useStacked(stage, views, false);
  const classes = [
    'figure',
    !two && isTall(main) ? 'tall' : '',
    two ? 'two' : '',
    stacked ? 'stacked' : '',
    compact ? 'compact' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <figure class={classes} data-speed={slow ? 'slow' : 'normal'}>
      <div class="figure-stage" role="img" aria-label={label} onClick={toggle} ref={stage}>
        {views.map(({ model }, i) => (
          <div class="figure-view" key={i}>
            {two && !compact && <p class="figure-view-name">{VIEW_NAME[model.figure.view]}</p>}
            <div class="figure-draw" data-view={model.figure.view}>
              <svg
                class="figure-svg"
                viewBox={viewBox(model.box)}
                preserveAspectRatio="xMidYMid meet"
                aria-hidden="true"
                style={stacked ? { height: `${stacked}px` } : undefined}
                dangerouslySetInnerHTML={{ __html: markups[i] ?? '' }}
              />
              <span class="figure-mark" hidden />
            </div>
          </div>
        ))}
      </div>
      <figcaption class="figure-caption">
        {compact ? (
          <CurrentPhase movement={main.movement} current={phase} />
        ) : (
          <Phases movement={main.movement} current={phase} />
        )}
        {!main.frozen && toggle && (
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
        ' '
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

/**
 * Reduced motion: every position as a still image with its name, at most three to a row, and the
 * marks of each position on it (D58). A second view follows under its name. A mark's text that
 * cannot stand on two lines in its still gives the row fewer stills (H1 in the P1b review, D60).
 */
function Stills({
  views,
  label,
  compact,
}: {
  views: ViewModel[];
  label: string;
  compact: boolean;
}) {
  const main = views[0]?.model as FigureModel;
  const two = views.length > 1;
  const root = useRef<HTMLDivElement>(null);
  // Each view at most three to a row, fewer while one of its marks' text does not fit; a new figure
  // starts over.
  const [cap, setCap] = useState<{ views: ViewModel[]; most: number[] }>({ views, most: [] });
  const mostOf = (v: number) => (cap.views === views ? (cap.most[v] ?? 3) : 3);
  useLayoutEffect(() => {
    const grids = [...(root.current?.querySelectorAll<HTMLElement>('.figure-stills') ?? [])];
    const most = grids.map((grid, v) => {
      const marks = [...grid.querySelectorAll<HTMLElement>('.figure-mark')];
      return mostOf(v) > 1 && marks.some((el) => !labelFits(el)) ? mostOf(v) - 1 : mostOf(v);
    });
    if (most.some((n, v) => n !== mostOf(v))) setCap({ views, most });
  }, [views, cap]);
  return (
    <figure class={!two && isTall(main) ? 'figure stills tall' : 'figure stills'}>
      <div
        class="figure-stills-all"
        role={two ? 'img' : undefined}
        aria-label={two ? label : undefined}
        ref={root}
      >
        {views.map(({ model }, v) => {
          // A figure that travels along x (`advance`) shows each position in its own box (H1, P1a).
          const columns = Math.min(
            mostOf(v),
            stillColumns(
              model.movement.positions.length,
              model.stillBox.x1 - model.stillBox.x0,
              model.stillBox.y1 - model.stillBox.y0,
            ),
          );
          return (
            <div class="figure-stills-view" key={v}>
              {two && !compact && <p class="figure-view-name">{VIEW_NAME[model.figure.view]}</p>}
              <div
                class="figure-stills"
                role={two ? undefined : 'img'}
                aria-label={two ? undefined : label}
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              >
                {model.movement.positions.map((p) => (
                  <div class="figure-still" key={p.id}>
                    <StillDrawing
                      model={model}
                      box={model.stillBox}
                      prims={stillPrims(model, p.id)}
                      marks={stillMarks(model, p.id)}
                    />
                    <p class="figure-still-name">{p.name}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <figcaption class="figure-caption">
        <Phases movement={main.movement} current={null} />
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------------------------
// A typical mistake as right and wrong side by side (docs/SPEC.md 3.8, D58)
// ---------------------------------------------------------------------------------------------

/** The dashed ring round the place where the wrong pose differs most. */
function ring(at: Point): Prim {
  return {
    key: 'ring',
    z: 40,
    t: 'circle',
    c: at,
    r: 7,
    f: 'none',
    s: 'hi',
    w: 1.4,
    dash: '2.6 1.8',
  };
}

/**
 * »Rigtigt« and »Forkert« under a typical mistake on the card: the same position twice at the same
 * scale, the wrong one with a ring where it differs most. Words say which is which, not colour.
 */
export function FaultFigure({
  figure,
  movement,
  fault,
  mistake,
}: {
  figure: FigureItem;
  movement: OwnMovement;
  fault: Fault;
  /** The mistake in words, for the text alternative. */
  mistake: string;
}) {
  addStyle();
  const drawing = useMemo(() => {
    const pair = faultPair(figure, movement, fault);
    if (!pair) return null;
    const model = buildModel(pair.figure, movement);
    const right = [...model.still, ...movingPrims(model, pair.right)];
    const wrong = [...model.still, ...movingPrims(model, pair.wrong), ring(pair.differs.at)];
    const box = track(track(emptyBox(), right), wrong);
    return { box, right, wrong };
  }, [figure, movement, fault]);
  if (!drawing) return null;
  const position = movement.positions.find((p) => p.id === fault.at)?.name ?? fault.at;
  const cell = (name: string, prims: Prim[], wrong: boolean) => (
    <div class={wrong ? 'fault-cell wrong' : 'fault-cell'}>
      <p class="fault-label">{name}</p>
      <svg
        class="figure-svg"
        viewBox={viewBox(drawing.box)}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: svgBody(prims) }}
      />
    </div>
  );
  return (
    <div class="fault-pair" role="img" aria-label={`Rigtigt: ${position}. Forkert: ${mistake}`}>
      {cell('Rigtigt', drawing.right, false)}
      {cell('Forkert', drawing.wrong, true)}
    </div>
  );
}
