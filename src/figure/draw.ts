// Drawing a solved figure as SVG in the pictograms' style (tools/pictos/picto.py Canvas): navy near
// limbs, pale far limbs, Thai red on the working segments, light props on a floor line, and in side
// view a small mark on the head for the way the face looks (DECISIONS.md D56). A frame is a
// list of primitives with stable keys, so the app can draw the first frame once and then move the
// same elements (src/ui/components/Figure.tsx), and the contact sheet can print them as a string.
// Colours are the design tokens as CSS variables (docs/SPEC.md 5): the app injects them, and the
// contact sheet defines them from src/ui/design-tokens.json.
import type { FigureItem, Point, Prop, Segment } from '../content/types.ts';
import { BODY } from '../content/units.ts';
import { angleOf, polar, type Bone, type Skeleton } from './geometry.ts';
import { SOFA_LOW } from './surfaces.ts';

export { SOFA_LOW } from './surfaces.ts';

/** The colour roles of a figure; PAINT maps them to the design tokens. */
export type Paint =
  'near' | 'far' | 'hi' | 'ghost' | 'prop' | 'fill' | 'fill2' | 'towel' | 'pack' | 'paper' | 'none';

export const PAINT: Record<Paint, string> = {
  none: 'none',
  /** The page's white: the edge round a mark, so it stands out on the body (D58). */
  paper: 'var(--c-paper)',
  near: 'var(--c-picto-near)',
  far: 'var(--c-picto-far)',
  hi: 'var(--c-picto-highlight)',
  ghost: 'var(--c-picto-ghost)',
  prop: 'var(--c-picto-far)',
  fill: 'var(--c-line)',
  fill2: 'var(--c-panel)',
  towel: 'var(--c-redTint)',
  pack: 'var(--c-picto-ghost)',
};

/** Stroke widths as picto.py: limbs, torso, hands and feet. */
export const WIDTH = { limb: 6.6, torso: 8.6, tip: 6.6 * 0.8 } as const;

interface Base {
  /** Stable across the frames of a figure: the app moves the element with this key. */
  key: string;
  /** Drawing order; equal z keeps the order the primitives were made in. */
  z: number;
}
export type Prim = Base &
  (
    | { t: 'line'; a: Point; b: Point; w: number; s: Paint; butt?: boolean; dash?: string }
    /** An open line through points: an arrow's way, an angle's arc (DECISIONS.md D58). */
    | { t: 'path'; pts: Point[]; w: number; s: Paint; dash?: string }
    | { t: 'circle'; c: Point; r: number; f: Paint; s?: Paint; w?: number; dash?: string }
    | {
        t: 'rect';
        x: number;
        y: number;
        width: number;
        height: number;
        rx: number;
        f: Paint;
        s: Paint;
        w: number;
      }
    | { t: 'poly'; pts: Point[]; s: Paint; f: Paint; w: number }
    /** A quadratic curve from a to b through the control point c: a round back. */
    | { t: 'curve'; a: Point; c: Point; b: Point; w: number; s: Paint }
  );

export type Mode = 'solid' | 'ghost';

const SEGMENT_INDEX = { upperArm: 1, forearm: 2, thigh: 1, shin: 2 } as const;

function highlighted(highlight: readonly Segment[], b: Bone, segment: 1 | 2): boolean {
  return highlight.some((h) => {
    const [side, name] = h.split('.') as [string, keyof typeof SEGMENT_INDEX | undefined];
    if (side !== b.side || !name) return false;
    const kind = name === 'upperArm' || name === 'forearm' ? 'arm' : 'leg';
    return kind === b.kind && SEGMENT_INDEX[name] === segment;
  });
}

/** Whether a figure draws its back as a curve: a keyframe bends it (`spine`). */
export function curvedBack(figure: { keyframes?: FigureItem['keyframes'] }): boolean {
  return Object.values(figure.keyframes ?? {}).some((pose) => (pose.spine ?? 0) !== 0);
}

/** The face mark: a small round nose on the head, the way the face looks (side view). */
const FACE = { r: 1.9, at: BODY.headRadius - 0.4 } as const;

/** Where the face mark sits, or null without one (front and top view). */
export function facePoint(s: Skeleton): Point | null {
  return s.face === null ? null : polar(s.head, FACE.at, s.face);
}

/**
 * The points of the body as drawn, always the same ones in the same order: hip, shoulder line, head,
 * the face mark, the middle of the back, and each limb's joint, end and hand or foot (a missing one
 * counts its end again). How far the figure moves, and how far a wrong pose lies from the right one,
 * is measured on them (DECISIONS.md D58).
 */
export function drawnPoints(s: Skeleton): Point[] {
  const back: Point = [
    (s.hip[0] + 2 * s.back[0] + s.shoulder[0]) / 4,
    (s.hip[1] + 2 * s.back[1] + s.shoulder[1]) / 4,
  ];
  return [
    s.hip,
    s.shoulder,
    s.head,
    facePoint(s) ?? s.head,
    back,
    ...s.bones.flatMap((b) => [b.joint, b.end, b.tip ?? b.end]),
  ];
}

/**
 * The body of one frame: limbs, torso, neck (when it is red), head and, in side view, the face mark,
 * in picto.py's z order. A figure with a round back somewhere draws its back as a curve in every frame.
 */
export function bodyPrims(
  figure: Pick<FigureItem, 'view' | 'highlight'> & { keyframes?: FigureItem['keyframes'] },
  s: Skeleton,
  mode: Mode = 'solid',
  prefix = '',
): Prim[] {
  const ghost = mode === 'ghost';
  const zBase = ghost ? 2 : 10;
  const colour = (b: Bone, segment: 1 | 2): Paint => {
    if (ghost) return 'ghost';
    if (highlighted(figure.highlight, b, segment)) return 'hi';
    return b.side === 'near' ? 'near' : 'far';
  };
  const prims: Prim[] = [];
  for (const b of s.bones) {
    const z = zBase + (b.side === 'near' ? 3 : 0) + (b.kind === 'arm' ? 0.5 : 0);
    const id = `${prefix}${b.side}.${b.kind}`;
    prims.push({
      key: `${id}.1`,
      z,
      t: 'line',
      a: b.root,
      b: b.joint,
      w: WIDTH.limb,
      s: colour(b, 1),
    });
    prims.push({
      key: `${id}.2`,
      z: z + 0.1,
      t: 'line',
      a: b.joint,
      b: b.end,
      w: WIDTH.limb,
      s: colour(b, 2),
    });
    if (b.tip) {
      prims.push({
        key: `${id}.tip`,
        z: z + 0.1,
        t: 'line',
        a: b.end,
        b: b.tip,
        w: WIDTH.tip,
        s: colour(b, 2),
      });
    }
  }
  const torsoRed = !ghost && figure.highlight.includes('torso');
  const torso: Paint = ghost ? 'ghost' : torsoRed ? 'hi' : 'near';
  if (figure.view === 'front' && s.pelvis && s.shoulders) {
    // Front view: the torso as a trapezoid between the pelvis and the shoulder line (skater); with
    // `spine` somewhere in the figure its long sides bend sideways in every frame (D58).
    prims.push({
      key: `${prefix}torso`,
      z: zBase + 1,
      t: 'poly',
      pts: curvedBack(figure)
        ? frontTorso(s, s.pelvis, s.shoulders)
        : [s.pelvis[0], s.pelvis[1], s.shoulders[1], s.shoulders[0]],
      s: torso,
      f: torso,
      w: WIDTH.limb,
    });
  } else if (curvedBack(figure)) {
    prims.push({
      key: `${prefix}torso`,
      z: zBase + 1,
      t: 'curve',
      a: s.hip,
      c: s.back,
      b: s.shoulder,
      w: WIDTH.torso,
      s: torso,
    });
  } else {
    prims.push({
      key: `${prefix}torso`,
      z: zBase + 1,
      t: 'line',
      a: s.hip,
      b: s.shoulder,
      w: WIDTH.torso,
      s: torso,
    });
  }
  if (!ghost && figure.highlight.includes('neck')) {
    prims.push({
      key: `${prefix}neck`,
      z: zBase + 1.1,
      t: 'line',
      a: s.shoulder,
      b: s.head,
      w: WIDTH.limb,
      s: 'hi',
    });
  }
  prims.push({
    key: `${prefix}head`,
    z: zBase + 1.2,
    t: 'circle',
    c: s.head,
    r: BODY.headRadius,
    f: ghost ? 'ghost' : 'near',
  });
  if (s.face !== null) {
    prims.push({
      key: `${prefix}face`,
      z: zBase + 1.3,
      t: 'circle',
      c: polar(s.head, FACE.at, s.face),
      r: FACE.r,
      f: ghost ? 'ghost' : 'near',
    });
  }
  return prims;
}

/** Points along a quadratic curve from a through the control point c to b. */
export function quadratic(a: Point, c: Point, b: Point, n = 6): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    points.push([
      u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
      u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
    ]);
  }
  return points;
}

/**
 * The long sides of the front view's torso, as points: what touches the floor when the figure lies
 * on its side seen from the front (a side plank), following the back's curve (DECISIONS.md D58).
 */
export function torsoSides(s: Skeleton): Point[] {
  return s.pelvis && s.shoulders ? frontTorso(s, s.pelvis, s.shoulders) : [];
}

/**
 * The front view's torso when the back bends sideways: both long sides follow the back's curve, the
 * far side from the pelvis up to the shoulder line and the near side back down (14 points always).
 */
function frontTorso(s: Skeleton, pelvis: [Point, Point], shoulders: [Point, Point]): Point[] {
  const mid: Point = [(s.hip[0] + s.shoulder[0]) / 2, (s.hip[1] + s.shoulder[1]) / 2];
  const off: Point = [s.back[0] - mid[0], s.back[1] - mid[1]];
  const edge = (a: Point, b: Point) =>
    quadratic(a, [(a[0] + b[0]) / 2 + off[0], (a[1] + b[1]) / 2 + off[1]], b);
  return [...edge(pelvis[0], shoulders[0]), ...edge(shoulders[1], pelvis[1])];
}

/** Where a carried prop sits in this frame: the hand's or foot's end, or the middle of the back. */
function anchorPoint(s: Skeleton, attach: string): { at: Point; back: number } | null {
  if (attach === 'back') {
    // The middle of the back as drawn: on the curve when the back is round.
    const mid: Point = [
      (s.hip[0] + 2 * s.back[0] + s.shoulder[0]) / 4,
      (s.hip[1] + 2 * s.back[1] + s.shoulder[1]) / 4,
    ];
    return { at: mid, back: angleOf(s.hip, s.shoulder) };
  }
  const [side, part] = attach.split('.');
  const kind = part === 'hand' ? 'arm' : 'leg';
  const b = s.bones.find((x) => x.side === side && x.kind === kind);
  return b ? { at: b.end, back: 0 } : null;
}

/** The extent the floor and the walls are drawn to, from the bounds of every frame. */
export interface Extent {
  x0: number;
  x1: number;
  top: number;
}

/** Whether a prop moves with the figure (attached to a hand, a foot or the back). */
export function carried(prop: Prop): boolean {
  return 'attach' in prop;
}

/**
 * The props of one frame. Static props (furniture, walls, things on the floor) are the same in every
 * frame; carried ones follow their hand, foot or back. `facing` puts a backpack on the back side.
 */
export function propPrims(
  props: readonly Prop[],
  s: Skeleton | null,
  extent: Extent,
  facing: 1 | -1 | null,
  mode: Mode = 'solid',
  include: (prop: Prop) => boolean = () => true,
): Prim[] {
  const prims: Prim[] = [];
  const ghost = mode === 'ghost';
  const fill = (p: Paint): Paint => (ghost ? 'ghost' : p);
  props.forEach((prop, i) => {
    if (!include(prop)) return;
    let part = 0;
    const next = () => `prop${i}.${part++}`;
    const box = (x: number, y: number, width: number, height: number, rx: number, f: Paint) =>
      prims.push({
        key: next(),
        z: 1,
        t: 'rect',
        x,
        y,
        width,
        height,
        rx,
        f: fill(f),
        s: 'prop',
        w: 1.2,
      });
    const leg = (x: number, y1: number, y2: number, w = 2.2) =>
      prims.push({
        key: next(),
        z: 0,
        t: 'line',
        a: [x, y1],
        b: [x, y2],
        w,
        s: 'prop',
        butt: true,
      });
    switch (prop.type) {
      case 'wall': {
        const top = Math.ceil(extent.top + 4);
        leg(prop.x, 0, top, 1.6);
        // Hatching on the wall's back side, every 6 units (picto.py wall()).
        for (let y = 3; y + 4 <= top; y += 6) {
          prims.push({
            key: next(),
            z: 0,
            t: 'line',
            a: [prop.x, y],
            b: [prop.x + prop.side * 4, y + 4],
            w: 1,
            s: 'prop',
            butt: true,
          });
        }
        break;
      }
      case 'chair':
        box(prop.x, prop.height - 4, prop.width, 4, 1.5, 'fill');
        leg(prop.x + 2.5, 0, prop.height - 4);
        leg(prop.x + prop.width - 2.5, 0, prop.height - 4);
        break;
      case 'table':
        box(prop.x, prop.height - 3.2, prop.width, 3.2, 1.2, 'fill');
        leg(prop.x + 3, 0, prop.height - 3.2, 2.4);
        leg(prop.x + prop.width - 3, 0, prop.height - 3.2, 2.4);
        break;
      case 'step':
        box(prop.x, 0, prop.width, prop.height, 1.2, 'fill');
        break;
      case 'bed':
        box(prop.x, 0, prop.width, prop.height, 2, 'fill');
        break;
      case 'sofa': {
        // A base with an opening under the front edge for anchoring the feet (picto.py couch()).
        const low = SOFA_LOW;
        box(prop.x, low, prop.width, prop.height - low, 2.5, 'fill');
        if (prop.back !== undefined && prop.back > prop.height) {
          const x = prop.backSide === 'right' ? prop.x + prop.width - 7 : prop.x;
          box(x, prop.height, 7, prop.back - prop.height, 2.5, 'fill');
        }
        leg(prop.x + 3, 0, low);
        leg(prop.x + prop.width - 3, 0, low);
        break;
      }
      case 'books': {
        const width = prop.width ?? 9;
        const count = prop.count ?? 3;
        for (let n = 0; n < count; n++) {
          box(
            prop.at[0] + (n % 2) * 0.8,
            prop.at[1] + n * 2.4,
            width,
            2,
            0.6,
            n % 2 ? 'fill2' : 'fill',
          );
        }
        break;
      }
      case 'pillow':
        box(prop.at[0], prop.at[1], prop.width, 3.4, 1.7, 'fill');
        break;
      case 'towel': {
        if ('attach' in prop) {
          const a = s ? anchorPoint(s, prop.attach) : null;
          if (!a) break;
          box(a.at[0] - prop.width / 2, 0, prop.width, 2, 1, 'towel');
        } else if (prop.rolled) {
          const r = prop.width / 2;
          prims.push({
            key: next(),
            z: 3,
            t: 'circle',
            c: [prop.at[0] + r, prop.at[1] + r],
            r,
            f: fill('towel'),
            s: 'prop',
            w: 1,
          });
        } else box(prop.at[0], prop.at[1], prop.width, 2, 1, 'towel');
        break;
      }
      case 'backpack': {
        if (!('attach' in prop)) {
          box(prop.at[0], prop.at[1], 9, 11, 2.6, 'pack');
          break;
        }
        const a = s ? anchorPoint(s, prop.attach) : null;
        if (!a) break;
        if (prop.attach === 'back') {
          // On the back: a 9 × 11 bag along the torso, on the side away from the chest.
          prims.push({
            key: next(),
            z: 13,
            t: 'poly',
            pts: onBack(a, facing, 11, 9),
            s: 'prop',
            f: fill('pack'),
            w: 1,
          });
        } else {
          // Hanging from the hand or foot, as poses.py's backpack row.
          prims.push({
            key: next(),
            z: 13,
            t: 'rect',
            x: a.at[0] - 4,
            y: a.at[1] - 11,
            width: 9,
            height: 11,
            rx: 2.6,
            f: fill('pack'),
            s: 'prop',
            w: 1,
          });
        }
        break;
      }
      case 'bottles': {
        const a = s ? anchorPoint(s, prop.attach) : null;
        if (!a) break;
        if (prop.attach === 'back') {
          // On the back: a bottle lying along the torso, on the side away from the chest; seen from
          // above it lies on the middle of the back (DECISIONS.md D56).
          prims.push({
            key: next(),
            z: 13,
            t: 'poly',
            pts: onBack(a, facing, 10, 3.6),
            s: 'prop',
            f: fill('fill2'),
            w: 1,
          });
          break;
        }
        prims.push({
          key: next(),
          z: 13,
          t: 'rect',
          x: a.at[0] - 1.8,
          y: a.at[1] - 8,
          width: 3.6,
          height: 10,
          rx: 1.4,
          f: fill('fill2'),
          s: 'prop',
          w: 1,
        });
        break;
      }
    }
  });
  return prims;
}

/**
 * The corners of a thing lying on the back: `length` along the torso and `thickness` out from it, on
 * the side away from the chest (side view), or on the middle of the back seen from above (`facing`
 * null). The torso is drawn 8.6 wide, so it starts 4.3 off the line.
 */
function onBack(
  a: { at: Point; back: number },
  facing: 1 | -1 | null,
  length: number,
  thickness: number,
): Point[] {
  const away = a.back + 90 * (facing ?? 1);
  const c = facing === null ? a.at : polar(a.at, WIDTH.torso / 2 + thickness / 2 - 0.2, away);
  return [
    [-length / 2, -thickness / 2],
    [length / 2, -thickness / 2],
    [length / 2, thickness / 2],
    [-length / 2, thickness / 2],
  ].map(([u, v]) => polar(polar(c, u ?? 0, a.back), v ?? 0, a.back + 90));
}

/** The outline of a prop's primitive, for the checks: corners of a box, points of a polygon. */
export function outline(p: Prim): Point[] {
  switch (p.t) {
    case 'rect':
      return [
        [p.x, p.y],
        [p.x + p.width, p.y],
        [p.x + p.width, p.y + p.height],
        [p.x, p.y + p.height],
      ];
    case 'poly':
    case 'path':
      return p.pts;
    case 'circle':
      return [0, 90, 180, 270].map((d) => polar(p.c, p.r, d));
    case 'line':
      return [p.a, p.b];
    case 'curve':
      return [p.a, p.c, p.b];
  }
}

export function floorPrim(extent: Extent): Prim {
  return {
    key: 'floor',
    z: 0,
    t: 'line',
    a: [extent.x0, -1.2],
    b: [extent.x1, -1.2],
    w: 1.4,
    s: 'prop',
    butt: true,
  };
}

// ---------------------------------------------------------------------------------------------
// Bounds and SVG
// ---------------------------------------------------------------------------------------------

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function emptyBox(): Box {
  return { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
}

function grow(box: Box, p: Point, pad: number): void {
  box.x0 = Math.min(box.x0, p[0] - pad);
  box.x1 = Math.max(box.x1, p[0] + pad);
  box.y0 = Math.min(box.y0, p[1] - pad);
  box.y1 = Math.max(box.y1, p[1] + pad);
}

/** Grows `box` to hold the primitives with their stroke widths (picto.py's _track). */
export function track(box: Box, prims: readonly Prim[]): Box {
  for (const p of prims) {
    switch (p.t) {
      case 'line':
        grow(box, p.a, p.w / 2);
        grow(box, p.b, p.w / 2);
        break;
      case 'circle':
        grow(box, p.c, p.r + (p.w ?? 0));
        break;
      case 'rect':
        grow(box, [p.x, p.y], p.w);
        grow(box, [p.x + p.width, p.y + p.height], p.w);
        break;
      case 'poly':
      case 'path':
        for (const q of p.pts) grow(box, q, p.w / 2);
        break;
      case 'curve':
        grow(box, p.a, p.w / 2);
        grow(box, p.b, p.w / 2);
        // The curve stays inside its control polygon; its middle is halfway to the control point.
        grow(
          box,
          [(p.a[0] + 2 * p.c[0] + p.b[0]) / 4, (p.a[1] + 2 * p.c[1] + p.b[1]) / 4],
          p.w / 2,
        );
        break;
    }
  }
  return box;
}

/** Sorted by z, ties in the order they were made (picto.py sorts stably). */
export function ordered(prims: readonly Prim[]): Prim[] {
  return prims
    .map((p, i) => [p, i] as const)
    .sort((a, b) => a[0].z - b[0].z || a[1] - b[1])
    .map(([p]) => p);
}

const n = (v: number) => (Math.round(v * 100) / 100).toString();
/** y is flipped: SVG y grows downward. */
const pt = (p: Point) => `${n(p[0])},${n(-p[1])}`;

/** The attributes that move between frames, for the app to set on the element. */
export function moving(p: Prim): Array<[string, string]> {
  switch (p.t) {
    case 'line':
      return [
        ['x1', n(p.a[0])],
        ['y1', n(-p.a[1])],
        ['x2', n(p.b[0])],
        ['y2', n(-p.b[1])],
      ];
    case 'circle':
      return [
        ['cx', n(p.c[0])],
        ['cy', n(-p.c[1])],
      ];
    case 'rect':
      return [
        ['x', n(p.x)],
        ['y', n(-(p.y + p.height))],
      ];
    case 'poly':
    case 'path':
      return [['points', p.pts.map(pt).join(' ')]];
    case 'curve':
      return [['d', `M${pt(p.a)} Q${pt(p.c)} ${pt(p.b)}`]];
  }
}

const dash = (d: string | undefined) => (d ? ` stroke-dasharray="${d}"` : '');

/** One primitive as an SVG element; `data-k` carries its key for the app. */
export function primSvg(p: Prim, withKey = false): string {
  const k = withKey ? ` data-k="${p.key}"` : '';
  const attrs = moving(p)
    .map(([a, v]) => `${a}="${v}"`)
    .join(' ');
  switch (p.t) {
    case 'line':
      return `<line${k} ${attrs} stroke="${PAINT[p.s]}" stroke-width="${n(p.w)}" stroke-linecap="${p.butt ? 'butt' : 'round'}"${dash(p.dash)}/>`;
    case 'path':
      return `<polyline${k} ${attrs} fill="none" stroke="${PAINT[p.s]}" stroke-width="${n(p.w)}" stroke-linecap="round" stroke-linejoin="round"${dash(p.dash)}/>`;
    case 'circle': {
      const stroke = p.s
        ? ` stroke="${PAINT[p.s]}" stroke-width="${n(p.w ?? 1)}"${dash(p.dash)}`
        : '';
      return `<circle${k} ${attrs} r="${n(p.r)}" fill="${PAINT[p.f]}"${stroke}/>`;
    }
    case 'rect':
      return `<rect${k} ${attrs} width="${n(p.width)}" height="${n(p.height)}" rx="${n(p.rx)}" fill="${PAINT[p.f]}" stroke="${PAINT[p.s]}" stroke-width="${n(p.w)}"/>`;
    case 'poly':
      return `<polygon${k} ${attrs} fill="${PAINT[p.f]}" stroke="${PAINT[p.s]}" stroke-width="${n(p.w)}" stroke-linejoin="round"/>`;
    case 'curve':
      return `<path${k} ${attrs} fill="none" stroke="${PAINT[p.s]}" stroke-width="${n(p.w)}" stroke-linecap="round"/>`;
  }
}

/** The viewBox of a box with picto.py's padding of 3 units; y flipped for SVG. */
export function viewBox(box: Box, pad = 3): string {
  const x0 = box.x0 - pad;
  const top = box.y1 + pad;
  return `${n(x0)} ${n(-top)} ${n(box.x1 - box.x0 + 2 * pad)} ${n(box.y1 - box.y0 + 2 * pad)}`;
}

/** The elements of a frame in drawing order, as SVG markup. */
export function svgBody(prims: readonly Prim[], withKeys = false): string {
  return ordered(prims)
    .map((p) => primSvg(p, withKeys))
    .join('');
}
