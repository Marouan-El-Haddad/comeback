// The surfaces a figure touches (docs/SPEC.md 9.1, DECISIONS.md D48): the floor and the props as
// solids with a signed distance (positive outside), and how close a point of the body is when it
// touches one, as the pictograms draw it. Shared by the checks (check.ts) and the frames between
// the keyframes (tween.ts), which need to know what a hand or foot stands on.
import { BODY } from '../content/units.ts';
import type { FigureItem, Point, Prop, Surface } from '../content/types.ts';
import { distance, type Skeleton } from './geometry.ts';

export interface Solid {
  on: Surface;
  /** The prop's index in the figure's props, or -1 for the floor. */
  prop: number;
  sdf: (p: Point) => number;
}

/** The height of the opening under a sofa's front edge (picto.py couch(side_low)). */
export const SOFA_LOW = 7.5;

export function boxSdf(p: Point, x: number, y: number, w: number, h: number): number {
  const qx = Math.abs(p[0] - (x + w / 2)) - w / 2;
  const qy = Math.abs(p[1] - (y + h / 2)) - h / 2;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
}

function anchorEnd(s: Skeleton, attach: string): Point | null {
  if (attach === 'back') return null;
  const [side, part] = attach.split('.');
  const kind = part === 'hand' ? 'arm' : 'leg';
  return s.bones.find((b) => b.side === side && b.kind === kind)?.end ?? null;
}

/**
 * The surfaces a body can touch in a frame: the floor (not seen from above) and the props. A towel
 * under a hand or foot follows it, so it needs the frame's skeleton; without one it is left out.
 */
export function solids(figure: Pick<FigureItem, 'view' | 'props'>, s: Skeleton | null): Solid[] {
  const list: Solid[] = [];
  if (figure.view !== 'top') list.push({ on: 'floor', prop: -1, sdf: (p) => p[1] });
  figure.props.forEach((prop: Prop, i) => {
    switch (prop.type) {
      case 'wall': {
        const side = prop.side;
        list.push({ on: 'wall', prop: i, sdf: (p) => (prop.x - p[0]) * side });
        break;
      }
      case 'chair':
        list.push({
          on: 'chair',
          prop: i,
          sdf: (p) => boxSdf(p, prop.x, prop.height - 4, prop.width, 4),
        });
        break;
      case 'table':
        list.push({
          on: 'table',
          prop: i,
          sdf: (p) => boxSdf(p, prop.x, prop.height - 3.2, prop.width, 3.2),
        });
        break;
      case 'step':
      case 'bed':
        list.push({
          on: prop.type,
          prop: i,
          sdf: (p) => boxSdf(p, prop.x, 0, prop.width, prop.height),
        });
        break;
      case 'sofa': {
        const backX = prop.backSide === 'right' ? prop.x + prop.width - 7 : prop.x;
        const back = prop.back;
        list.push({
          on: 'sofa',
          prop: i,
          sdf: (p) =>
            Math.min(
              boxSdf(p, prop.x, SOFA_LOW, prop.width, prop.height - SOFA_LOW),
              back !== undefined && back > prop.height
                ? boxSdf(p, backX, prop.height, 7, back - prop.height)
                : Infinity,
            ),
        });
        break;
      }
      case 'books': {
        const count = prop.count ?? 3;
        list.push({
          on: 'books',
          prop: i,
          sdf: (p) => boxSdf(p, prop.at[0], prop.at[1], (prop.width ?? 9) + 0.8, count * 2.4 - 0.4),
        });
        break;
      }
      case 'pillow':
        list.push({
          on: 'pillow',
          prop: i,
          sdf: (p) => boxSdf(p, prop.at[0], prop.at[1], prop.width, 3.4),
        });
        break;
      case 'towel': {
        if ('attach' in prop) {
          const end = s ? anchorEnd(s, prop.attach) : null;
          if (end) {
            const x = end[0] - prop.width / 2;
            list.push({ on: 'towel', prop: i, sdf: (p) => boxSdf(p, x, 0, prop.width, 2) });
          }
        } else if (prop.rolled) {
          const r = prop.width / 2;
          const c: Point = [prop.at[0] + r, prop.at[1] + r];
          list.push({ on: 'towel', prop: i, sdf: (p) => distance(p, c) - r });
        } else {
          list.push({
            on: 'towel',
            prop: i,
            sdf: (p) => boxSdf(p, prop.at[0], prop.at[1], prop.width, 2),
          });
        }
        break;
      }
      // Backpacks and bottles are carried or stand on the floor; nothing rests on them.
      default:
        break;
    }
  });
  return list;
}

/** The distance from `p` to the nearest of the solids (Infinity without any). */
export function nearest(list: readonly Solid[], p: Point): number {
  let d = Infinity;
  for (const x of list) d = Math.min(d, x.sdf(p));
  return d;
}

/** The direction out of a solid at `p`: the gradient of its distance, by central differences. */
export function normalAt(solid: Solid, p: Point): Point {
  const h = 0.05;
  const gx = solid.sdf([p[0] + h, p[1]]) - solid.sdf([p[0] - h, p[1]]);
  const gy = solid.sdf([p[0], p[1] + h]) - solid.sdf([p[0], p[1] - h]);
  const length = Math.hypot(gx, gy);
  return length > 1e-9 ? [gx / length, gy / length] : [0, 1];
}

/** A point of the body as the pictograms place it on a surface. */
export type PointKind = 'hand' | 'elbow' | 'knee' | 'ankle' | 'toe' | 'hip' | 'shoulder' | 'head';

/**
 * The distance from a surface at which a point touches it, as the pictograms draw it: a wrist on the
 * floor at 0, an ankle at 3.6 with the toes at 0.3, the hip of a seated figure at 5, the head's
 * centre one radius away. Lower = how far into the surface still counts.
 */
export const TOUCH: Record<PointKind, readonly [number, number]> = {
  hand: [-1.5, 3.5],
  elbow: [-1.5, 5],
  knee: [-1.5, 5],
  ankle: [-1.5, 5],
  toe: [-1.5, 2.5],
  hip: [-1.5, 7.5],
  shoulder: [-1.5, 8],
  head: [BODY.headRadius - 1.5, BODY.headRadius + 2.5],
};

/** Where a point rests when it touches, as the pictograms draw it: the height a message counts from. */
export const REST: Record<PointKind, number> = {
  hand: 0,
  elbow: 2.5,
  knee: 2.5,
  ankle: 3.6,
  toe: 0.3,
  hip: 5,
  shoulder: 5,
  head: BODY.headRadius,
};

export const inRange = (d: number, kind: PointKind): boolean =>
  d >= TOUCH[kind][0] && d <= TOUCH[kind][1];
