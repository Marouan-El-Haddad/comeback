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
// (SPEC 6), never over the body where there is another place: inside its drawing on at most two
// lines, else on its own line over or under the bodies, else in a band over the drawings (D62).
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
import { faultPair, ringPrims } from '../../figure/faults.ts';
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

/** How a figure's views stand: over each other or not, and the height the CSS gives one view. */
interface ViewLayout {
  stacked: boolean;
  /** The height in px the CSS gives one view side by side; null before it is measured. */
  side: number | null;
}

/**
 * Two views side by side or over each other in the place the figure has (M1 in the P1b review,
 * D60): with the width it has and the height one view gets side by side (the CSS), whichever draws
 * the smaller view larger. Measured again when the figure changes size; one view is only measured
 * where it can give a mark's text a band from its height (`keep`, a session), so the many small
 * stills of »Dagens pas« do no work.
 */
function useViewLayout(
  root: { current: HTMLElement | null },
  views: readonly ViewModel[],
  still: boolean,
  keep: boolean,
): ViewLayout {
  const [layout, setLayout] = useState<ViewLayout>({ stacked: false, side: null });
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || (views.length < 2 && !keep)) return;
    const aspects = views.map((v) => viewAspect(v.model, still));
    const decide = () => {
      const svgs = [...el.querySelectorAll<SVGSVGElement>('.figure-svg')];
      if (!svgs[0] || el.clientWidth <= 0) return;
      // The height the CSS gives one view, without the heights set here.
      const set = svgs.map((svg) => svg.style.height);
      for (const svg of svgs) svg.style.height = '';
      const side = svgs[0].getBoundingClientRect().height;
      svgs.forEach((svg, i) => (svg.style.height = set[i] ?? ''));
      const stacked = views.length > 1 && side > 0 && stackViews(aspects, el.clientWidth, side);
      setLayout((l) => (l.stacked === stacked && l.side === side ? l : { stacked, side }));
    };
    decide();
    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(decide);
    observer.observe(el);
    return () => observer.disconnect();
  }, [views, still, keep]);
  return layout;
}

/**
 * Each drawing's height in px, or null for the CSS's: over each other each view gets half the height
 * less the gap, so the figure keeps its height. `taken` is the band over the drawings for a mark's
 * text (D62) where the figure keeps its place (a session): the drawings give it the room.
 */
function drawHeight(layout: ViewLayout, taken: number): number | null {
  const { stacked, side } = layout;
  if (side === null) return null;
  if (stacked) return Math.max(0, Math.floor((side - VIEW_GAP - taken) / 2));
  return taken > 0 ? Math.max(0, Math.floor(side - taken)) : null;
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
  const layout = useViewLayout(root, views, true, full);
  // The band over the drawings for a mark's text without a free place (D62), taken from their
  // height, so the still keeps its place in the session. It only grows for the same figure.
  const [band, setBand] = useState<{ views: ViewModel[]; px: number }>({ views, px: 0 });
  const bandPx = band.views === views ? band.px : 0;
  const report = (need: number) =>
    setBand((b) => (need > (b.views === views ? b.px : 0) ? { views, px: need } : b));
  /** The other view's body at the position, in px of the figure: a text over both keeps off it. */
  const othersOf =
    (i: number) =>
    (area: DOMRect): Bodies => {
      const svgs = root.current?.querySelectorAll('.figure-draw svg') ?? [];
      return views.flatMap(({ model }, j) => {
        const svg = svgs[j];
        const pose = model.figure.keyframes[position];
        if (j === i || !svg || !pose) return [];
        return bodyInArea(area, svg, viewBox(model.stillBox), bodyOf(model, pose));
      });
    };
  const height = drawHeight(layout, bandPx);
  const classes = [
    'figure-still-only',
    views.length > 1 ? 'two' : '',
    layout.stacked ? 'stacked' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      class={classes}
      role="img"
      aria-label={text}
      ref={root}
      style={bandPx ? { paddingTop: `${bandPx}px` } : undefined}
    >
      {views.map(({ model }, i) => (
        <StillDrawing
          key={i}
          model={model}
          box={model.stillBox}
          prims={stillPrims(model, position)}
          marks={full ? stillMarks(model, position) : []}
          height={height}
          band={bandPx}
          others={othersOf(i)}
          onNeed={report}
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

/**
 * A figure that travels along the floor with a frame that follows it (bounds, the broad jump) gets
 * the card's whole width at a standing figure's height, with its phases under it: in a tall figure's
 * half of the width its frame had to grow to show its way, and the figure became 65 % of a standing
 * one (M8 in the P2 review, D62).
 */
function travels(model: FigureModel): boolean {
  return model.travel !== null && !model.fixed;
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
 * Calls `place` again when a web font has loaded (font-display: swap): a mark's text placed in the
 * fallback font changes size then. Returns the function that stops it.
 */
function onFonts(place: () => void): () => void {
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  if (!fonts) return () => undefined;
  fonts.addEventListener('loadingdone', place);
  return () => fonts.removeEventListener('loadingdone', place);
}

/**
 * A text that wraps keeps the width of its limit in CSS, with room left at the end of its lines:
 * narrow it to its widest line, so it covers no more of the figure than its words (D60).
 */
function tighten(el: HTMLElement): void {
  el.style.width = '';
  const range = document.createRange();
  range.selectNodeContents(el);
  const lines = [...range.getClientRects()];
  if (lines.length < 2) return;
  const widest = Math.max(...lines.map((r) => r.right)) - Math.min(...lines.map((r) => r.left));
  const style = getComputedStyle(el);
  const edges = ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'] as const;
  const extra = edges.reduce((sum, key) => sum + (parseFloat(style[key]) || 0), 0);
  if (widest + extra < el.offsetWidth - 1) el.style.width = `${Math.ceil(widest + extra) + 1}px`;
}

/** The points of a body in px, with the half widths of their strokes. */
type Bodies = ReadonlyArray<readonly [number, number, number]>;

/** The gap between a mark's text in the band over the drawings and the drawings (px). */
const BAND_GAP = 8;

/** A place for a mark's text: its top left in px of a box whose top left is (ox, oy) px of its drawing. */
interface TextPlace {
  covers: number;
  max: string;
  at: Point;
  ox: number;
  oy: number;
}

/**
 * Places a mark's text and returns the height in px of the band over the drawings it needs, or 0
 * when it found a free place in or over them (D58, D60, D62). It stands, in this order:
 * 1. by its point inside its drawing, as wide as it or half as wide and on at most two lines
 *    (figure.css), off the body (placeLabel);
 * 2. on its own line over or under the bodies across the whole figure (`area`: both views, in the
 *    drawings' height), as wide as the figure or half as wide, off all of them;
 * 3. on its own line in the band over the drawings (the top `band` px of `area`), outside them;
 * 4. where it covers least of the body, while the figure has no band yet.
 * Its dot or line stays on the body. The SVG fills its box (`width` × `height` px) and keeps its
 * aspect ratio (»meet«), so every point's place in px follows from the viewBox; the text is measured
 * after it wraps.
 */
function placeMark(
  el: HTMLElement,
  draw: MarkDraw | null,
  viewBoxText: string,
  width: number,
  height: number,
  area: HTMLElement | null,
  /** The other views' bodies in px of the area's top left: a text over all views keeps off them. */
  others: (area: DOMRect) => Bodies = () => [],
  band = 0,
): number {
  const label = draw?.label;
  const host = el.parentElement;
  const svg = host?.querySelector('svg');
  if (!draw || !label || !host || !svg || el.hidden || width <= 0 || height <= 0) return 0;
  const { px, scale } = pxOf(viewBoxText, width, height);
  const hostBox = host.getBoundingClientRect();
  const svgBox = svg.getBoundingClientRect();
  const areaBox = (area ?? host).getBoundingClientRect();
  const bodyAt = (dx: number, dy: number): Bodies =>
    draw.body.map(([bx, by, r]) => {
      const [x, y] = px([bx, by], dx, dy);
      return [x, y, r * scale] as const;
    });
  const put = (p: TextPlace) => {
    el.style.maxWidth = p.max;
    tighten(el);
    el.style.transform = `translate(${Math.round(p.at[0] + p.ox)}px, ${Math.round(p.at[1] + p.oy)}px)`;
  };
  /** Sets the text's width limit; whether it then stands on at most two lines. */
  const limit = (max: string): boolean => {
    el.style.maxWidth = max;
    el.style.width = '';
    return labelFits(el);
  };
  // The place that covers least so far (4).
  const tried: TextPlace[] = [];
  // 1. In its drawing: as wide as it, or half as wide on two lines beside a narrow body.
  const body = bodyAt(0, 0);
  for (const max of ['', `${Math.floor(width / 2)}px`]) {
    if (!limit(max)) continue;
    tighten(el);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const at = placeLabel({
      width,
      height,
      w,
      h,
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
      body,
    });
    const place = {
      covers: labelCovers(at, w, h, body),
      max,
      at,
      ox: svgBox.left - hostBox.left,
      oy: svgBox.top - hostBox.top,
    };
    if (place.covers === 0) {
      put(place);
      return 0;
    }
    tried.push(place);
  }
  // 2. Over or under the bodies across the whole figure: the area's width and its drawings' height
  // (not the views' names over them, nor the band).
  const drawings = [...(area ?? host).querySelectorAll('svg.figure-svg')].map((d) =>
    d.getBoundingClientRect(),
  );
  const top = Math.min(...drawings.map((d) => d.top));
  const fw = areaBox.width;
  const fh = Math.max(...drawings.map((d) => d.bottom)) - top;
  const ax = svgBox.left - areaBox.left;
  const ay = svgBox.top - top;
  const ox = areaBox.left - hostBox.left;
  const oy = areaBox.top - hostBox.top;
  const bodies = [
    ...bodyAt(ax, ay),
    ...others(areaBox).map(([x, y, r]) => [x, y - (top - areaBox.top), r] as const),
  ];
  const point = label.at ? px(label.at, ax, ay) : null;
  for (const max of [`${Math.floor(fw)}px`, `${Math.floor(fw / 2)}px`]) {
    if (!limit(max)) continue;
    tighten(el);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const at = placeLabel({
      width: fw,
      height: fh,
      w,
      h,
      at: point,
      place: label.place,
      line: true,
      body: bodies,
    });
    const place = { covers: labelCovers(at, w, h, bodies), max, at, ox, oy: top - hostBox.top };
    if (place.covers === 0) {
      put(place);
      return 0;
    }
    tried.push(place);
  }
  // 3. In the band over the drawings, at the figure's width, by its point.
  const max = `${Math.floor(fw)}px`;
  limit(max);
  tighten(el);
  const w = el.offsetWidth;
  const need = Math.ceil(el.offsetHeight) + BAND_GAP;
  if (band >= need) {
    const x = Math.max(0, Math.min((point ? point[0] : fw / 2) - w / 2, fw - w));
    put({ covers: 0, max, at: [x, band - need], ox, oy });
    return need;
  }
  // 4. No band yet: where it covers least.
  const least = tried.reduce<TextPlace | null>((a, b) => (a && a.covers <= b.covers ? a : b), null);
  if (least) put(least);
  return need;
}

/** A view's body (figure units) in px of `area`, through its viewBox and its drawing's place. */
function bodyInArea(
  area: DOMRect,
  svg: Element,
  viewBoxText: string,
  body: ReadonlyArray<readonly [number, number, number]>,
): Bodies {
  const box = svg.getBoundingClientRect();
  const { px, scale } = pxOf(viewBoxText, box.width, box.height);
  return body.map(([bx, by, r]) => {
    const [x, y] = px([bx, by], box.left - area.left, box.top - area.top);
    return [x, y, r * scale] as const;
  });
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
 * height (useViewLayout, drawHeight). A text without a free place stands in the band over the
 * drawing: its own (`pad`, a still on the card) or the figure's (a session's still, both views).
 */
function StillDrawing({
  model,
  box,
  prims,
  marks,
  height = null,
  band = 0,
  pad = false,
  across = 1,
  others,
  onNeed,
}: {
  model: FigureModel;
  box: Box;
  prims: Prim[];
  marks: MarkDraw[];
  height?: number | null;
  /** The band over the drawing for a mark's text in px (D62). */
  band?: number;
  /** The band is this drawing's own padding; else the top of the figure around it. */
  pad?: boolean;
  /** Stills to a row: the texts are placed again in the same layout when it changes. */
  across?: number;
  /** The other views' bodies in px of the figure. */
  others?: (area: DOMRect) => Bodies;
  /** Told the band this drawing's texts need (px), each time they are placed. */
  onNeed?: (need: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const markup = svgBody([...prims, ...marks.flatMap((m) => m.prims)]);
  const texts = marks.filter((m) => m.label);
  const vb = viewBox(box);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || texts.length === 0) return;
    // In a session's still a text without a free place stands over both views.
    const area = pad ? root : (root.closest<HTMLElement>('.figure-still-only') ?? root);
    const place = () => {
      const svg = root.querySelector('svg');
      if (!svg) return;
      const { width, height: high } = svg.getBoundingClientRect();
      let need = 0;
      root.querySelectorAll<HTMLElement>('.figure-mark').forEach((el, i) => {
        need = Math.max(need, placeMark(el, texts[i] ?? null, vb, width, high, area, others, band));
      });
      onNeed?.(need);
    };
    place();
    const offFonts = onFonts(place);
    if (typeof ResizeObserver !== 'function') return offFonts;
    const observer = new ResizeObserver(place);
    observer.observe(root);
    return () => {
      offFonts();
      observer.disconnect();
    };
  }, [markup, vb, height, band, across]);
  return (
    <div
      class="figure-draw"
      data-view={model.figure.view}
      ref={ref}
      style={pad && band ? { paddingTop: `${band}px` } : undefined}
    >
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
  // The band over the drawings for a mark's text without a free place in or over them (D62), from
  // all the figure's marks, so the figure does not change size when one comes.
  const [band, setBand] = useState(0);
  const bandNow = useRef(0);
  bandNow.current = band;
  /** Places the marks shown now again (set by the animation): after the band or the layout changed. */
  const replace = useRef<() => void>(() => undefined);
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
    /** The other views' bodies while `show` is shown, in px of the stage: a text over all keeps off them. */
    const othersOf =
      (d: Drawn, show: MarkShow | null) =>
      (area: DOMRect): Bodies => {
        if (!show) return [];
        const times = [0, 0.25, 0.5, 0.75, 1].map((k) => show.start + (show.end - show.start) * k);
        return drawn
          .filter((o) => o !== d && o.width > 0 && o.height > 0)
          .flatMap((o) => {
            const model = o.view.model;
            const body = times.flatMap((at) => {
              const dx = shiftAtTime(model, at);
              return bodyOf(model, poseAt(model, at)).map(([x, y, r]) => [x + dx, y, r] as const);
            });
            return bodyInArea(area, o.svg, o.viewBox, body);
          });
      };
    /** A view's viewBox at `at` seconds: a figure that travels has a frame that follows it. */
    const boxAt = (d: Drawn, at: number) => {
      const model = d.view.model;
      return model.travel && !model.fixed
        ? viewBox(frameBox(model, at, d.width / d.height))
        : d.viewBox;
    };
    const place = (d: Drawn) =>
      placeMark(
        d.label,
        d.shown,
        d.viewBox,
        d.width,
        d.height,
        root,
        othersOf(d, d.shown),
        bandNow.current,
      );
    /** The band all the marks' texts need, each placed at the start of its moment. */
    const measure = (): number => {
      let need = 0;
      for (const d of drawn) {
        if (d.width <= 0 || d.height <= 0) continue;
        for (const plan of d.view.plans) {
          for (const show of plan.shows) {
            if (!show.label) continue;
            setMark(d.label, show.label);
            const vb = boxAt(d, show.start);
            const one = placeMark(
              d.label,
              show,
              vb,
              d.width,
              d.height,
              root,
              othersOf(d, show),
              bandNow.current,
            );
            need = Math.max(need, one);
          }
        }
        setMark(d.label, d.shown?.label ?? null);
      }
      return need;
    };
    /**
     * Decides the band and places the marks shown now. The band only grows while the figure keeps
     * its width, so it does not jump between two sizes; a new width decides it anew.
     */
    let measuredAt = -1;
    const arrange = () => {
      for (const d of drawn) {
        d.width = d.box.clientWidth;
        d.height = d.box.clientHeight;
      }
      const need = measure();
      const width = root.clientWidth;
      const next = width === measuredAt ? Math.max(bandNow.current, need) : need;
      measuredAt = width;
      if (next !== bandNow.current) {
        bandNow.current = next;
        setBand(next);
      }
      for (const d of drawn) place(d);
    };
    replace.current = () => {
      for (const d of drawn) {
        d.width = d.box.clientWidth;
        d.height = d.box.clientHeight;
        place(d);
      }
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
        place(d);
      } else if (moved && show?.label) {
        place(d);
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
    // The drawing's size decides the frame of a figure that travels, the band over the drawings and
    // where a mark's text stands.
    const resize =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            for (const d of drawn) d.held = null;
            arrange();
          })
        : null;
    for (const d of drawn) resize?.observe(d.box);
    const offFonts = onFonts(() => {
      measuredAt = -1;
      arrange();
    });
    arrange();
    run();
    return () => {
      stop();
      offFonts();
      observer?.disconnect();
      resize?.disconnect();
      replace.current = () => undefined;
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [views]);

  // Following the session's clock, or small in a session: no slow motion.
  const steady = compact || clock !== undefined;
  const toggle = steady ? undefined : () => setSlow((s) => !s);
  const two = views.length > 1;
  const layout = useViewLayout(stage, views, false, compact);
  // In a session the figure keeps its place: the band is taken from the drawings' height. On the
  // card it stands over them.
  const height = drawHeight(layout, compact ? band : 0);
  useLayoutEffect(() => replace.current(), [band, height]);
  const classes = [
    'figure',
    !two && travels(main) ? 'travels' : !two && isTall(main) ? 'tall' : '',
    two ? 'two' : '',
    layout.stacked ? 'stacked' : '',
    compact ? 'compact' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <figure class={classes} data-speed={slow ? 'slow' : 'normal'}>
      <div
        class="figure-stage"
        role="img"
        aria-label={label}
        onClick={toggle}
        ref={stage}
        style={band ? { paddingTop: `${band}px` } : undefined}
      >
        {views.map(({ model }, i) => (
          <div class="figure-view" key={i}>
            {two && !compact && <p class="figure-view-name">{VIEW_NAME[model.figure.view]}</p>}
            <div class="figure-draw" data-view={model.figure.view}>
              <svg
                class="figure-svg"
                viewBox={viewBox(model.box)}
                preserveAspectRatio="xMidYMid meet"
                aria-hidden="true"
                style={height !== null ? { height: `${height}px` } : undefined}
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
  // A figure that travels along x (`advance`) shows each position in its own box (H1, P1a).
  const columns = views.map(({ model }, v) =>
    Math.min(
      mostOf(v),
      stillColumns(
        model.movement.positions.length,
        model.stillBox.x1 - model.stillBox.x0,
        model.stillBox.y1 - model.stillBox.y0,
      ),
    ),
  );
  // The band over a row of stills for a mark's text without a free place in its still (D62): as
  // high as the highest such text in the row, so the row's stills stand in line. It only grows for
  // the same figure and rows.
  const rows = columns.join(',');
  const [bands, setBands] = useState<{
    views: ViewModel[];
    rows: string;
    px: Record<string, number>;
  }>({ views, rows, px: {} });
  const same = (b: typeof bands) => b.views === views && b.rows === rows;
  const bandOf = (row: string) => (same(bands) ? (bands.px[row] ?? 0) : 0);
  const report = (row: string) => (need: number) =>
    setBands((b) => {
      const px = same(b) ? b.px : {};
      if (need <= (px[row] ?? 0)) return same(b) ? b : { views, rows, px };
      return { views, rows, px: { ...px, [row]: need } };
    });
  return (
    <figure class={!two && isTall(main) ? 'figure stills tall' : 'figure stills'}>
      <div
        class="figure-stills-all"
        role={two ? 'img' : undefined}
        aria-label={two ? label : undefined}
        ref={root}
      >
        {views.map(({ model }, v) => {
          const across = columns[v] ?? 1;
          return (
            <div class="figure-stills-view" key={v}>
              {two && !compact && <p class="figure-view-name">{VIEW_NAME[model.figure.view]}</p>}
              <div
                class="figure-stills"
                role={two ? undefined : 'img'}
                aria-label={two ? undefined : label}
                style={{ gridTemplateColumns: `repeat(${across}, minmax(0, 1fr))` }}
              >
                {model.movement.positions.map((p, i) => (
                  <div class="figure-still" key={p.id}>
                    <StillDrawing
                      model={model}
                      box={model.stillBox}
                      prims={stillPrims(model, p.id)}
                      marks={stillMarks(model, p.id)}
                      band={bandOf(`${v}:${Math.floor(i / across)}`)}
                      pad
                      across={across}
                      onNeed={report(`${v}:${Math.floor(i / across)}`)}
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
    const wrong = [...model.still, ...movingPrims(model, pair.wrong), ...ringPrims(pair)];
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
