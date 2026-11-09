// Typical mistakes as figures (docs/SPEC.md 3.8 and 9.1, DECISIONS.md D58): the right pose of a
// position beside the wrong one. The figure file says which mistake in the explanation, at which
// position, and how the wrong pose differs (`wrong`: the fields of the pose that change). A limb with
// `to` keeps its point, so a hip that hangs leaves the hands and feet where they stand. The check
// asks that the wrong pose differs visibly from the right one: some drawn point at least
// FAULT_VISIBLE units away. The ring goes round the part the mistake names, or round the joint
// that moves most, with a white edge so it shows on a red part (D62). Pure functions without DOM.
import type { Fault, FigureItem, OwnMovement, Point, Pose, PoseChange } from '../content/types.ts';
import { BODY } from '../content/units.ts';
import { drawnPoints, type Prim } from './draw.ts';
import {
  angleOf,
  distance,
  frameOf,
  solve,
  turn,
  wrap,
  type Frame,
  type Skeleton,
} from './geometry.ts';
import { pointOf } from './marks.ts';
import { faultFigure } from './views.ts';

/** A wrong pose differs from the right one by at least this much somewhere, in figure units. */
export const FAULT_VISIBLE = 3;

/** The right pose with the wrong pose's changes: a limb given replaces the right pose's limb. */
export function wrongPose(right: Pose, change: PoseChange): Pose {
  const { arms, legs, ...rest } = change;
  return {
    ...right,
    ...rest,
    arms: { ...right.arms, ...(arms ?? {}) },
    legs: { ...right.legs, ...(legs ?? {}) },
  };
}

/** How far a wrong pose lies from the right one: the drawn point that moved most, and how far. */
export function deviation(frame: Frame, right: Pose, wrong: Pose): { by: number; at: Point } {
  const a = drawnPoints(solve(frame, right));
  const b = drawnPoints(solve(frame, wrong));
  let best = { by: 0, at: b[0] ?? right.hip };
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = distance(a[i] as Point, b[i] as Point);
    if (d > best.by) best = { by: d, at: b[i] as Point };
  }
  return best;
}

/** The ring round a mistake: its centre in the wrong pose and its radius, in figure units. */
export interface FaultRing {
  at: Point;
  r: number;
}

/** A mistake ready to draw: its view, the right and the wrong pose, and where they differ most. */
export interface FaultPair {
  fault: Fault;
  figure: FigureItem;
  frame: Frame;
  right: Pose;
  wrong: Pose;
  /** The drawn point that moved most, in the wrong pose, and how far. */
  differs: { by: number; at: Point };
  /** Where the ring goes. */
  ring: FaultRing;
}

/** A place on the body a mistake can be at, with the angle that bends there (degrees). */
interface Bend {
  at: Point;
  degrees: number;
}

/** Degrees of bend per unit of `spine`: a back rounded 3 bends about as much as a joint 20°. */
const SPINE_DEGREES = 6;

/**
 * The angles of a pose where a mistake can be: at the hip and the shoulder between the torso and
 * the thigh or upper arm, at the knee and the elbow, at the ankle and the wrist, the head against
 * the torso, and the back's curve – each at its place in the pose.
 */
function bends(s: Skeleton, pose: Pose): Bend[] {
  const torso = angleOf(s.hip, s.shoulder);
  const back: Point = [
    (s.hip[0] + 2 * s.back[0] + s.shoulder[0]) / 4,
    (s.hip[1] + 2 * s.back[1] + s.shoulder[1]) / 4,
  ];
  const out: Bend[] = [
    { at: s.head, degrees: (pose.head ?? 0) + (pose.nod ?? 0) },
    { at: back, degrees: (pose.spine ?? 0) * SPINE_DEGREES },
  ];
  for (const b of s.bones) {
    out.push({ at: b.root, degrees: wrap(angleOf(b.root, b.joint) - torso) });
    out.push({ at: b.joint, degrees: turn(b.root, b.joint, b.end) });
    if (b.tip) out.push({ at: b.end, degrees: turn(b.joint, b.end, b.tip) });
  }
  return out;
}

/** A ring this much wider than the head goes round it, so the head inside it can still be seen. */
const RING = { r: 7, head: BODY.headRadius + 3 } as const;

/** A bend this much different is where the mistake is; less, and the whole body only moved. */
const RING_DEGREES = 5;

/**
 * Where the ring goes (M6 and L6 in the P2 reviews, D62): round the part the mistake names
 * (`ring`); else where the body bends most differently – the hip that sags, the knee that falls in,
 * the heel that lifts at the ankle, the rounded back – not the head or the hand that is only carried
 * along; when nothing bends differently (the whole body tilts), round the drawn point that moves
 * most. Round the head the ring is wider than the head.
 */
function ringOf(frame: Frame, right: Pose, wrong: Pose, fault: Fault, most: Point): FaultRing {
  const sw = solve(frame, wrong);
  let at = fault.ring === undefined ? null : pointOf(frame, sw, fault.ring);
  if (!at) {
    const a = bends(solve(frame, right), right);
    const b = bends(sw, wrong);
    let best = { by: 0, at: most };
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const d = Math.abs(wrap((b[i] as Bend).degrees - (a[i] as Bend).degrees));
      if (d > best.by) best = { by: d, at: (b[i] as Bend).at };
    }
    at = best.by >= RING_DEGREES ? best.at : most;
  }
  return { at, r: distance(at, sw.head) <= BODY.headRadius + 0.5 ? RING.head : RING.r };
}

/** The dashed ring in the figure's red over a wider white edge, so it shows on a red part too. */
export function ringPrims(pair: Pick<FaultPair, 'ring'>): Prim[] {
  const { at, r } = pair.ring;
  return [
    { key: 'ring.halo', z: 39.5, t: 'circle', c: at, r, f: 'none', s: 'paper', w: 3.8 },
    { key: 'ring', z: 40, t: 'circle', c: at, r, f: 'none', s: 'hi', w: 1.4, dash: '2.6 1.8' },
  ];
}

/** The pair of a mistake, or null when its view or position is missing. */
export function faultPair(
  figure: FigureItem,
  movement: OwnMovement,
  fault: Fault,
): FaultPair | null {
  const view = faultFigure(figure, fault);
  const right = view?.keyframes[fault.at];
  if (!view || !right || !movement.positions.some((p) => p.id === fault.at)) return null;
  const frame = frameOf(view);
  const wrong = wrongPose(right, fault.wrong);
  const differs = deviation(frame, right, wrong);
  const ring = ringOf(frame, right, wrong, fault, differs.at);
  return { fault, figure: view, frame, right, wrong, differs, ring };
}
