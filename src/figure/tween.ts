// The frames between two keyframes (docs/SPEC.md 9.1, DECISIONS.md D48 and D56). The body moves as
// joint angles with forward kinematics from the point that stands still in both keyframes – the hip,
// the shoulders, a knee, a foot, the toes, an elbow or a hand – instead of the hip moving in a
// straight line. So the segments keep their length, a straight joint stays straight, no joint bends
// more than in the keyframes on either side, and a heel that lifts turns the foot about the toes.
//
// - The anchor: the first of hip, shoulders, knee, ankle, toes, elbow and hand that stands still
//   (near side first); when nothing stands still, a hand or foot that slides along a surface. The
//   hip turns about it: a rigid segment keeps its length (the thigh about a knee, the torso about the
//   shoulders), a two-bone limb interpolates the distance and the angle from the hand or foot to its
//   root, so a straight leg stays straight and a wall sit slides down.
// - The torso turns the shorter way; an elbow that stands still (a forearm plank) turns it to keep
//   the upper arm's length, and so does an arm that stands or slides straight in both keyframes.
// - Hands and feet that stand still are solved with two-bone IK to their point; a foot whose toes
//   stand still turns about them; a hand or foot that slides along a surface follows it, and a
//   straight limb that slides along the floor or a wall stays straight. The rest swing with their
//   joint angles (also a hand or foot that leaves a surface, lands on one, or that a transition lifts),
//   the shoulder and hip within their anatomical range (an arm swings forward over the head, not back
//   through the body).
// - A swinging limb never goes into a surface. One that would sweep through it folds early and
//   opens late (its bend stays between the keyframes'). A lifted one then turns as a whole about
//   its root just enough to keep the knee or elbow and the hand or foot clear, in an arc over its
//   surface if it can; turning keeps every length and bend. Otherwise, and for a free limb, the
//   hand or foot is pushed out the way the keyframes leave the surface, so it never flips side,
//   and the joint bends at most 6° more than in the keyframes. Then the toes turn about the ankle.
// Pure functions without DOM; motion.ts calls tween() for every frame.
import type { FigureItem, LiftLimb, LimbSide, Point, Pose } from '../content/types.ts';
import { BODY } from '../content/units.ts';
import {
  anatomicalBend,
  angleOf,
  distance,
  ik,
  lerp,
  lerpAngle,
  lerpPoint,
  polar,
  rootsOf,
  turn,
  wrap,
  type Frame,
  type Kind,
  type Skeleton,
} from './geometry.ts';
import { inRange, normalAt, solids, type Solid } from './surfaces.ts';

export type LimbId = `${LimbSide}.${Kind}`;
export const LIMB_IDS: readonly LimbId[] = ['far.leg', 'far.arm', 'near.leg', 'near.arm'];

export const limbOfLift = (lift: LiftLimb): LimbId =>
  lift.endsWith('hand')
    ? (`${lift.split('.')[0]}.arm` as LimbId)
    : (`${lift.split('.')[0]}.leg` as LimbId);

/** A limb of a keyframe as points and angles. */
export interface LimbRig {
  side: LimbSide;
  kind: Kind;
  root: Point;
  joint: Point;
  end: Point;
  tip: Point | null;
  l1: number;
  l2: number;
  /** Ankle to toes, or wrist to fingers (0 without a tip). */
  l3: number;
  /** The upper segment's direction in degrees. */
  a1: number;
  /** The turn at the elbow or knee in degrees (+ = counterclockwise), −180–180. */
  bend: number;
  /** The turn at the wrist or ankle, from the lower segment to the hand or foot. */
  tipTurn: number;
  flip: boolean;
}

/** A keyframe as the tween needs it: its solved points and its angles. */
export interface Rig {
  hip: Point;
  shoulder: Point;
  torso: number;
  head: number;
  spine: number;
  width: { shoulders: number; hips: number } | undefined;
  limbs: Partial<Record<LimbId, LimbRig>>;
  /** The keyframe's skeleton, for what the hands and feet touch. */
  skeleton: Skeleton;
}

export function rigOf(pose: Pose, s: Skeleton): Rig {
  const limbs: Rig['limbs'] = {};
  for (const b of s.bones) {
    const a1 = angleOf(b.root, b.joint);
    const a2 = angleOf(b.joint, b.end);
    limbs[`${b.side}.${b.kind}`] = {
      side: b.side,
      kind: b.kind,
      root: b.root,
      joint: b.joint,
      end: b.end,
      tip: b.tip,
      l1: distance(b.root, b.joint),
      l2: distance(b.joint, b.end),
      l3: b.tip ? distance(b.end, b.tip) : 0,
      a1,
      bend: turn(b.root, b.joint, b.end),
      tipTurn: b.tip ? wrap(angleOf(b.end, b.tip) - a2) : 0,
      flip: b.flip === true,
    };
  }
  return {
    hip: s.hip,
    shoulder: s.shoulder,
    torso: pose.torso,
    head: pose.head ?? 0,
    spine: s.spine,
    width: pose.width,
    limbs,
    skeleton: s,
  };
}

const shift = (p: Point, dx: number): Point => [p[0] + dx, p[1]];

/** A rig moved `dx` along x: a transition's `advance`. */
export function shiftRig(rig: Rig, dx: number): Rig {
  if (dx === 0) return rig;
  const limbs: Rig['limbs'] = {};
  for (const id of LIMB_IDS) {
    const l = rig.limbs[id];
    if (!l) continue;
    limbs[id] = {
      ...l,
      root: shift(l.root, dx),
      joint: shift(l.joint, dx),
      end: shift(l.end, dx),
      tip: l.tip ? shift(l.tip, dx) : null,
    };
  }
  const s = rig.skeleton;
  return {
    ...rig,
    hip: shift(rig.hip, dx),
    shoulder: shift(rig.shoulder, dx),
    limbs,
    skeleton: {
      ...s,
      hip: shift(s.hip, dx),
      shoulder: shift(s.shoulder, dx),
      head: shift(s.head, dx),
      back: shift(s.back, dx),
      bones: s.bones.map((b) => ({
        ...b,
        root: shift(b.root, dx),
        joint: shift(b.joint, dx),
        end: shift(b.end, dx),
        tip: b.tip ? shift(b.tip, dx) : null,
      })),
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The plan of a move: what stands still, what slides, what is lifted and what swings
// ---------------------------------------------------------------------------------------------

/** Closer than this in both keyframes = the same point (the slide check's tolerance). */
export const STILL = 1;
/** A limb straight in both keyframes stays straight while its point is this close to full reach. */
const STRAIGHT_SLACK = 0.6;
/** Below this turn (degrees) a joint counts as straight. */
const STRAIGHT_TURN = 1.5;
/** How far a knee or an elbow, a wrist or an ankle and the toes stay out of a surface in a swing. */
const CLEARANCE = { joint: 2.5, end: { arm: 0, leg: 1.5 }, tip: 0 } as const;
/** Points along a move at which a swinging limb's turn out of the surfaces is worked out. */
const PROFILE = 32;

export type Mode = 'anchor' | 'planted' | 'toe' | 'slide' | 'lift' | 'free';

export interface LimbPlan {
  mode: Mode;
  /** picto.py's bend for the IK of a limb solved to a point: the side the keyframes bend to. */
  ikBend: 1 | -1;
  /** Straight in both keyframes. */
  straight: boolean;
  /** The hand or foot stands still too (not only the wrist or ankle). */
  tipStill: boolean;
  /** The hand or foot slides along a surface with the wrist or ankle. */
  tipSlides: boolean;
  /** A straight limb sliding along the floor (y) or a wall (x): where its hand or foot runs. */
  line?: { axis: 0 | 1; a: number; b: number };
  /** A swinging limb: its angle at the shoulder or hip (jointAngle) at the start and how far it turns. */
  swing?: { from: number; delta: number; sign: 1 | -1 };
  /**
   * A swinging limb: how far its knee or elbow (`joint`), its hand or foot (`end`) and its toes or
   * fingers (`tip`) are from each surface that stands still in the two keyframes – it is kept clear
   * of them, but never further out than the keyframes have it – the way it turns about its root to
   * get clear (the way it swings), and for a lifted one the arc over the surface it leaves.
   */
  clear?: {
    joint: Array<[number, number]>;
    end: Array<[number, number]>;
    tip: Array<[number, number]>;
    turn: 1 | -1;
    arc?: { height: number; surface: number };
    /**
     * How far the limb turns about its root at PROFILE evenly spaced points of the (eased) way, so
     * the frames between them turn smoothly and never flip side.
     */
    profile?: number[];
    /**
     * The knee or elbow folds early and opens late (its bend still between the keyframes'), for a
     * limb that would otherwise sweep through a surface: a leg tucks before it swings under the hip.
     */
    fold?: boolean;
    /**
     * No smooth turn keeps the limb clear (a leg that must pass under the hip): its hand or foot is
     * pushed out of the surface instead, along the way out the keyframes give, and the joint follows.
     */
    push?: { end: Point[]; tip: Point[] };
  };
}

export type AnchorKind =
  'hip' | 'shoulder' | 'knee' | 'ankle' | 'toe' | 'elbow' | 'hand' | 'slide' | 'free';

export interface Plan {
  anchor: AnchorKind;
  /** The limb the anchor belongs to (knee, ankle, toe, elbow, hand, slide). */
  limb: LimbId | null;
  limbs: Partial<Record<LimbId, LimbPlan>>;
  /**
   * An arm the torso turns to keep (side view): its elbow stands still on a surface (a forearm
   * plank), or it stands or slides straight in both keyframes (a rollout). `side` = which of the
   * two shoulder points the keyframes have.
   */
  keep: { limb: LimbId; what: 'elbow' | 'reach'; side: 1 | -1 } | null;
  /** The surfaces that stand still, which a swinging limb keeps clear of. */
  surfaces: Solid[];
}

const still = (a: Point | null | undefined, b: Point | null | undefined): boolean =>
  !!a && !!b && distance(a, b) <= STILL;

/** Whether a knee or an elbow rests on a surface. */
function jointTouches(list: readonly Solid[], p: Point): boolean {
  return list.some((x) => inRange(x.sdf(p), 'knee'));
}

/**
 * The arcs a limb's swing does not pass through, in jointAngle's degrees (start and span,
 * counterclockwise): an arm not back from over the head down behind the body, a leg not up behind it.
 */
const FORBIDDEN: Record<Kind, readonly [number, number]> = { arm: [200, 100], leg: [165, 135] };

const inArc = (x: number, [start, span]: readonly [number, number]) =>
  (((x - start) % 360) + 360) % 360 < span;

/** The swing from one joint angle to another: the shorter way, unless it passes a forbidden arc. */
export function swingDelta(from: number, to: number, kind: Kind): number {
  const arc = FORBIDDEN[kind];
  const short = wrap(to - from);
  if (inArc(from, arc) || inArc(to, arc)) return short;
  for (let i = 1; i < 12; i++) {
    if (inArc(from + (short * i) / 12, arc)) return short > 0 ? short - 360 : short + 360;
  }
  return short;
}

/** The solid a hand (wrist) or ankle touches in a keyframe, or null. */
function touched(list: readonly Solid[], l: LimbRig): Solid | null {
  let best: Solid | null = null;
  let bestD = Infinity;
  const kind = l.kind === 'arm' ? 'hand' : 'ankle';
  for (const x of list) {
    const d = x.sdf(l.end);
    if (inRange(d, kind) && d < bestD) {
      best = x;
      bestD = d;
    }
  }
  return best;
}

function tipTouched(list: readonly Solid[], l: LimbRig): Solid | null {
  if (!l.tip) return null;
  const kind = l.kind === 'arm' ? 'hand' : 'toe';
  for (const x of list) if (inRange(x.sdf(l.tip), kind)) return x;
  return null;
}

/** picto.py's bend that puts the joint on the side the keyframes bend to. */
function ikBendOf(frame: Frame, a: LimbRig, b: LimbRig): 1 | -1 {
  // A turn clockwise at the joint (negative) is picto.py's bend 1.
  if (Math.abs(a.bend) >= 2) return a.bend < 0 ? 1 : -1;
  if (Math.abs(b.bend) >= 2) return b.bend < 0 ? 1 : -1;
  if (frame.view === 'side' && frame.facing !== null) {
    const anatomical = anatomicalBend(a.kind, frame.facing);
    return a.flip || b.flip ? (anatomical === 1 ? -1 : 1) : anatomical;
  }
  return 1;
}

/** How high a lifted hand or foot goes: more for a long step, not at all when it stays in place. */
export function liftHeight(distanceMoved: number): number {
  if (distanceMoved < STILL) return 0;
  return Math.min(8, Math.max(3, 0.1 * distanceMoved));
}

/**
 * The anatomical angle of a limb's upper segment at the shoulder or hip: 0 = along the body toward
 * the feet, + = forward (toward the chest) and up. Arms run from −90 to 270, so an arm swings
 * forward over the head and never back through the body; legs from −180 to 180.
 */
function jointAngle(l: LimbRig, torso: number, sign: 1 | -1): number {
  return wrap((l.a1 - torso - 180) * sign, l.kind === 'arm' ? -90 : -180);
}

function signOf(frame: Frame, id: LimbId): 1 | -1 {
  if (frame.view === 'side' && frame.facing !== null) return frame.facing;
  return id.startsWith('near') ? 1 : -1;
}

/**
 * What each limb does between keyframes `a` and `b` (already moved by any `advance`), and which
 * point the hip turns about. `lift` = the hands and feet the transition lifts; `arcs` = whether they
 * go in an arc (not on the way to or from a transition's `via`, which already gives the shape).
 */
export function planMove(
  figure: Pick<FigureItem, 'view' | 'props'>,
  frame: Frame,
  a: Rig,
  b: Rig,
  lift: readonly LiftLimb[] = [],
  arcs = true,
): Plan {
  const lifted = new Set(lift.map(limbOfLift));
  const solidsA = solids(figure, a.skeleton);
  const solidsB = solids(figure, b.skeleton);
  // Seen from above the body lies on the floor and its props: nothing to keep clear of.
  const surfaces = figure.view === 'top' ? [] : solids(figure, null);
  const pairs = LIMB_IDS.flatMap((id) => {
    const la = a.limbs[id];
    const lb = b.limbs[id];
    return la && lb ? [{ id, la, lb }] : [];
  });
  const find = (kind: Kind, test: (la: LimbRig, lb: LimbRig) => boolean): LimbId | null => {
    for (const side of ['near', 'far'] as const) {
      const p = pairs.find((x) => x.id === `${side}.${kind}`);
      if (p && !lifted.has(p.id) && test(p.la, p.lb)) return p.id;
    }
    return null;
  };
  const slides = (la: LimbRig, lb: LimbRig) => {
    const sa = touched(solidsA, la);
    const sb = touched(solidsB, lb);
    return !!sa && !!sb && sa.on === sb.on && sa.prop === sb.prop;
  };

  let anchor: AnchorKind = 'free';
  let limb: LimbId | null = null;
  if (still(a.hip, b.hip)) anchor = 'hip';
  else if (still(a.shoulder, b.shoulder)) anchor = 'shoulder';
  else {
    // A knee or an elbow anchors only when it rests on something in both keyframes.
    const rests = (la: LimbRig, lb: LimbRig) =>
      still(la.joint, lb.joint) &&
      jointTouches(solidsA, la.joint) &&
      jointTouches(solidsB, lb.joint);
    const order: Array<[AnchorKind, Kind, (la: LimbRig, lb: LimbRig) => boolean]> = [
      ['knee', 'leg', rests],
      ['ankle', 'leg', (la, lb) => still(la.end, lb.end)],
      ['toe', 'leg', (la, lb) => still(la.tip, lb.tip)],
      ['elbow', 'arm', rests],
      ['hand', 'arm', (la, lb) => still(la.end, lb.end)],
      // Nothing stands still: a foot or hand sliding along a surface (feet up a wall) holds the hip.
      ['slide', 'leg', slides],
      ['slide', 'arm', slides],
    ];
    for (const [kind, limbKind, test] of order) {
      const found = find(limbKind, test);
      if (found) {
        anchor = kind;
        limb = found;
        break;
      }
    }
  }

  const limbs: Plan['limbs'] = {};
  for (const { id, la, lb } of pairs) {
    const straight = Math.abs(la.bend) < STRAIGHT_TURN && Math.abs(lb.bend) < STRAIGHT_TURN;
    const base = {
      ikBend: ikBendOf(frame, la, lb),
      straight,
      tipStill: still(la.tip, lb.tip),
      tipSlides: false,
    };
    let mode: Mode;
    if (id === limb) mode = 'anchor';
    else if (lifted.has(id)) mode = 'lift';
    else if (still(la.end, lb.end)) mode = 'planted';
    else if (la.kind === 'leg' && still(la.tip, lb.tip)) mode = 'toe';
    else mode = slides(la, lb) ? 'slide' : 'free';
    const plan: LimbPlan = { mode, ...base };
    if (mode === 'slide' || (mode === 'anchor' && anchor === 'slide')) {
      const on = touched(solidsA, la);
      const ta = tipTouched(solidsA, la);
      const tb = tipTouched(solidsB, lb);
      plan.tipSlides = !!ta && !!tb && ta.on === tb.on && ta.prop === tb.prop;
      // A straight limb along the floor or a wall stays straight: its end runs along the surface.
      if (straight && on && (on.on === 'floor' || on.on === 'wall')) {
        const axis = on.on === 'floor' ? 1 : 0;
        plan.line = { axis, a: la.end[axis], b: lb.end[axis] };
      }
    }
    if (mode === 'free' || mode === 'lift') {
      const sign = signOf(frame, id);
      const from = jointAngle(la, a.torso, sign);
      const delta = swingDelta(from, jointAngle(lb, b.torso, sign), la.kind);
      plan.swing = { from, delta, sign };
      const lifts = mode === 'lift' && arcs ? (touched(solidsA, la) ?? touched(solidsB, lb)) : null;
      const index = lifts
        ? surfaces.findIndex((x) => x.on === lifts.on && x.prop === lifts.prop)
        : -1;
      plan.clear = {
        joint: surfaces.map((x) => [x.sdf(la.joint), x.sdf(lb.joint)]),
        end: surfaces.map((x) => [x.sdf(la.end), x.sdf(lb.end)]),
        tip: surfaces.map((x) => [la.tip ? x.sdf(la.tip) : 0, lb.tip ? x.sdf(lb.tip) : 0]),
        // Out of the way in the direction the limb swings (its absolute angle turns this way).
        turn: delta * sign + wrap(b.torso - a.torso) >= 0 ? 1 : -1,
      };
      if (index >= 0) {
        plan.clear.arc = { height: liftHeight(distance(la.end, lb.end)), surface: index };
      }
    }
    limbs[id] = plan;
  }

  // An arm the torso keeps, where the anchor is elsewhere (side view): an elbow resting still on a
  // surface (a forearm plank turning about the feet) keeps the upper arm's length; an arm standing
  // or sliding straight in both keyframes (a rollout, a plank lifting a hand) stays straight.
  let keep: Plan['keep'] = null;
  if (frame.view === 'side' && anchor !== 'shoulder' && anchor !== 'elbow' && anchor !== 'hand') {
    const side = (hip: Point, shoulder: Point, p: Point): 1 | -1 =>
      (p[0] - hip[0]) * (shoulder[1] - hip[1]) - (p[1] - hip[1]) * (shoulder[0] - hip[0]) >= 0
        ? 1
        : -1;
    for (const what of ['elbow', 'reach'] as const) {
      for (const s of ['near', 'far'] as const) {
        const id: LimbId = `${s}.arm`;
        const p = limbs[id];
        const la = a.limbs[id];
        const lb = b.limbs[id];
        if (!p || !la || !lb || keep || id === limb) continue;
        if (
          what === 'elbow' &&
          p.mode === 'planted' &&
          still(la.joint, lb.joint) &&
          jointTouches(solidsA, la.joint) &&
          jointTouches(solidsB, lb.joint)
        ) {
          keep = { limb: id, what, side: side(a.hip, a.shoulder, la.joint) };
        } else if (what === 'reach' && (p.mode === 'planted' || p.mode === 'slide') && p.straight) {
          keep = { limb: id, what, side: side(a.hip, a.shoulder, la.end) };
        }
      }
    }
  }
  return { anchor, limb, limbs, keep, surfaces };
}

// ---------------------------------------------------------------------------------------------
// The frame at u
// ---------------------------------------------------------------------------------------------

type Width = { shoulders: number; hips: number };

/** What separates a limb's root from the hip: the shoulder, and in front view half the width. */
function rootOffset(
  frame: Frame,
  id: LimbId,
  hip: Point,
  torso: number,
  width: Width | undefined,
): Point {
  const root = rootsOf(frame, hip, torso, width).roots[id.endsWith('arm') ? 'arm' : 'leg'][
    id.startsWith('near') ? 'near' : 'far'
  ];
  return [root[0] - hip[0], root[1] - hip[1]];
}

/** A limb from its root to a point by two-bone IK; straight when it was straight in both keyframes. */
function reach(
  root: Point,
  target: Point,
  l1: number,
  l2: number,
  plan: LimbPlan,
): { joint: Point; end: Point } {
  const d = distance(root, target);
  if (plan.straight && d >= l1 + l2 - STRAIGHT_SLACK) {
    const a = angleOf(root, target);
    return { joint: polar(root, l1, a), end: polar(root, l1 + l2, a) };
  }
  const solved = ik(root, target, l1, l2, plan.ikBend);
  return { joint: solved.joint, end: solved.end };
}

/**
 * Where a straight limb of length `length` from `root` meets the line its hand or foot slides along
 * (x = value for a wall, y = value for the floor), nearest `near`; null when it cannot reach it.
 */
function onLine(
  root: Point,
  length: number,
  axis: 0 | 1,
  value: number,
  near: Point,
): Point | null {
  const across = value - root[axis];
  if (Math.abs(across) > length) return null;
  const along = Math.sqrt(length * length - across * across);
  const other = axis === 0 ? 1 : 0;
  const options = [root[other] + along, root[other] - along].map((v): Point =>
    axis === 0 ? [value, v] : [v, value],
  );
  const [p, q] = options as [Point, Point];
  return distance(p, near) <= distance(q, near) ? p : q;
}

/** The tip of a limb: still, sliding with the end, or turning with the lower segment. */
function tipAt(
  la: LimbRig,
  lb: LimbRig,
  plan: LimbPlan,
  joint: Point,
  end: Point,
  u: number,
): Point | null {
  if (!la.tip || !lb.tip) return null;
  if (plan.tipStill || (plan.tipSlides && (plan.mode === 'slide' || plan.mode === 'anchor')))
    return lerpPoint(la.tip, lb.tip, u);
  const a2 = angleOf(joint, end);
  return polar(end, lerp(la.l3, lb.l3, u), a2 + lerp(la.tipTurn, lb.tipTurn, u));
}

/** The point a two-bone limb reaches from its root, rotated and stretched like its keyframes. */
function chord(origin: Point, la: LimbRig, lb: LimbRig, u: number, from: 'end' | 'joint'): Point {
  const pa = from === 'end' ? la.end : la.joint;
  const pb = from === 'end' ? lb.end : lb.joint;
  const d = lerp(distance(pa, la.root), distance(pb, lb.root), u);
  return polar(origin, d, lerpAngle(angleOf(pa, la.root), angleOf(pb, lb.root), u));
}

/**
 * The torso angle that puts the shoulder `radius` from `center` (a still elbow, or the hand of a
 * straight arm), on the same side of the line from the hip to `center` as in the keyframes.
 */
function keepAt(hip: Point, torso: number, center: Point, radius: number, side: 1 | -1): number {
  const r = BODY.torso;
  const d = distance(hip, center);
  if (d > r + radius || d < Math.abs(r - radius) || d < 1e-9) return torso;
  // The shoulder lies on both circles: around the hip (r) and around the centre (radius).
  const base = angleOf(hip, center);
  const cos = (r * r + d * d - radius * radius) / (2 * r * d);
  const off = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  // side 1: the centre lies clockwise of the hip-to-shoulder line, so the torso turns counterclockwise.
  return side === 1 ? base + off : base - off;
}

const turnAbout = (pivot: Point, p: Point, degrees: number): Point =>
  polar(pivot, distance(pivot, p), angleOf(pivot, p) + degrees);

/** The points of a swinging limb that keep clear of the surfaces, with their levels at `u`. */
function clearPoints(
  c: NonNullable<LimbPlan['clear']>,
  kind: Kind,
  joint: Point,
  end: Point,
  tip: Point | null,
  u: number,
  margin = 0,
  withArc = true,
): Array<{ p: Point; level: (i: number) => number }> {
  const level = (pairs: Array<[number, number]>, cap: number) => (i: number) => {
    const [da, db] = pairs[i] ?? [Infinity, Infinity];
    return Math.min(cap + margin, da + (db - da) * u);
  };
  // A soft arc: it leaves and lands slowly (sin²), as a foot that rolls off and onto the floor.
  const arc = c.arc && withArc ? c.arc.height * Math.sin(Math.PI * u) ** 2 : 0;
  const endLevel = level(c.end, CLEARANCE.end[kind]);
  // A lifted hand or foot rises over its resting height above the surface it leaves.
  const rest = (i: number) => {
    const [da, db] = c.end[i] ?? [0, 0];
    return da + (db - da) * u;
  };
  return [
    { p: joint, level: level(c.joint, CLEARANCE.joint) },
    {
      p: end,
      level: (i: number) =>
        c.arc?.surface === i ? Math.max(endLevel(i), rest(i) + arc) : endLevel(i),
    },
    ...(tip ? [{ p: tip, level: level(c.tip, CLEARANCE.tip) }] : []),
  ];
}

/**
 * Works out, once per move, how far each swinging limb turns about its root to keep clear of the
 * surfaces (a lifted one also in an arc): the needed turn at PROFILE points along the way, all the
 * same way round – the way that needs the least, and that helps everywhere – so the limb moves
 * smoothly and never jumps from one side of the floor to the other.
 */
export function clearanceProfile(frame: Frame, a: Rig, b: Rig, plan: Plan): void {
  const swinging = LIMB_IDS.filter((id) => plan.limbs[id]?.clear);
  if (swinging.length === 0 || plan.surfaces.length === 0) return;
  const sample = () =>
    Array.from({ length: PROFILE + 1 }, (_, k) => {
      const u = k / PROFILE;
      return { u, pose: tween(frame, a, b, plan, u, true) };
    });
  const clearAt = (id: LimbId, u: number, pose: Pose, margin: number, withArc = true) => {
    const c = plan.limbs[id]?.clear;
    const side = id.startsWith('near') ? 'near' : 'far';
    const kind: Kind = id.endsWith('arm') ? 'arm' : 'leg';
    const limb = kind === 'arm' ? pose.arms[side] : pose.legs[side];
    if (!c || !limb || !('joint' in limb)) return null;
    const root = rootsOf(frame, pose.hip, pose.torso, pose.width).roots[kind][side];
    const points = clearPoints(c, kind, limb.joint, limb.end, limb.tip ?? null, u, margin, withArc);
    return (degrees: number) =>
      points.every(({ p, level }) => {
        const q = degrees === 0 ? p : turnAbout(root, p, degrees);
        return plan.surfaces.every((x, i) => x.sdf(q) >= level(i) - 1e-6);
      });
  };
  // A limb that sweeps through a surface folds first, and is then turned clear where it must be.
  let raw = sample();
  for (const id of swinging) {
    const c = plan.limbs[id]?.clear;
    if (c && raw.some(({ u, pose }) => clearAt(id, u, pose, 0)?.(0) === false)) c.fold = true;
  }
  if (swinging.some((id) => plan.limbs[id]?.clear?.fold)) raw = sample();
  for (const id of swinging) {
    const c = plan.limbs[id]?.clear;
    if (!c) continue;
    // At each point: whether each candidate turn keeps the limb clear (a little more than the
    // check asks, so the frames between the points are clear too).
    const samples = raw.map(({ u, pose }) => clearAt(id, u, pose, 0.5));
    if (samples.every((clear) => !clear || clear(0))) continue;
    // A lifted hand or foot (a step) turns clear with the whole limb, in its arc if it can, else
    // just clear; a free swing (a take-off, a landing) pushes its hand or foot out, so a leg does
    // not drag along the floor.
    const lifted = plan.limbs[id]?.mode === 'lift';
    const path = lifted
      ? (turnPath(samples, c.turn) ??
        turnPath(
          raw.map(({ u, pose }) => clearAt(id, u, pose, 0.5, false)),
          c.turn,
        ))
      : null;
    if (path) {
      c.profile = path;
      continue;
    }
    // No smooth turn helps: push the hand or foot out, along the way out of each surface at the
    // keyframe that is furthest from it, so it never flips side.
    const out = (x: Solid, pa: Point | null, pb: Point | null): Point => {
      const da = pa ? x.sdf(pa) : -Infinity;
      const db = pb ? x.sdf(pb) : -Infinity;
      const at = da >= db ? pa : pb;
      return at ? normalAt(x, at) : [0, 1];
    };
    const la = a.limbs[id];
    const lb = b.limbs[id];
    if (!la || !lb) continue;
    c.push = {
      end: plan.surfaces.map((x) => out(x, la.end, lb.end)),
      tip: plan.surfaces.map((x) => out(x, la.tip, lb.tip)),
    };
  }
}

/**
 * A point pushed out of the surfaces it dips into: to `level(i)` out of each, along `outs[i]`, but
 * never further than the keyframes on either side have it.
 */
function pushOut(
  list: readonly Solid[],
  p: Point,
  level: (i: number) => number,
  outs: readonly Point[],
): Point | null {
  let moved: Point | null = null;
  for (const [i, x] of list.entries()) {
    const q: Point = moved ?? p;
    const d = x.sdf(q);
    const want = level(i);
    if (d < want) {
      const n = outs[i] ?? [0, 1];
      moved = [q[0] + (want - d) * n[0], q[1] + (want - d) * n[1]];
    }
  }
  return moved;
}

/** Candidate turns for a swinging limb, in degrees: 3° apart from −150 to 150. */
const TURNS = Array.from({ length: 101 }, (_, j) => -150 + 3 * j);

/**
 * The smoothest way to turn a limb through the points of a move, starting and ending at 0 and clear
 * of the surfaces at every point: the least turning in all (a shortest path over the candidate turns,
 * at most 6° from one point to the next, so it never jumps), then the least turn. Null when no such
 * path is clear everywhere.
 */
function turnPath(
  samples: ReadonlyArray<((degrees: number) => boolean) | null>,
  prefer: 1 | -1,
): number[] | null {
  const n = TURNS.length;
  const zero = TURNS.indexOf(0);
  const blocked = 1e4;
  let cost = TURNS.map((_, j) => (j === zero ? 0 : Infinity));
  const from: number[][] = [];
  for (let k = 1; k < samples.length; k++) {
    const clear = samples[k];
    const next = new Array<number>(n).fill(Infinity);
    const back = new Array<number>(n).fill(zero);
    for (let j = 0; j < n; j++) {
      const turn = TURNS[j] as number;
      const here = (clear ? (clear(turn) ? 0 : blocked) : 0) + 0.02 * Math.abs(turn);
      // A small nudge toward the way the limb swings, so two equal ways do not flicker.
      const way = turn * prefer < 0 ? 0.001 * Math.abs(turn) : 0;
      for (let i = Math.max(0, j - 2); i <= Math.min(n - 1, j + 2); i++) {
        const c = (cost[i] as number) + Math.abs(turn - (TURNS[i] as number)) + here + way;
        if (c < (next[j] as number)) {
          next[j] = c;
          back[j] = i;
        }
      }
    }
    cost = next;
    from.push(back);
  }
  // The last point is the keyframe: no turn. A path through a surface is no path.
  if ((cost[zero] as number) >= blocked) return null;
  const path = new Array<number>(samples.length).fill(0);
  let j = zero;
  for (let k = samples.length - 1; k >= 1; k--) {
    path[k] = TURNS[j] as number;
    j = from[k - 1]?.[j] ?? zero;
  }
  path[0] = 0;
  return path;
}

/** The turn a swinging limb makes at `u`, between the profile's points. */
function profileAt(profile: readonly number[], u: number): number {
  const x = Math.max(0, Math.min(1, u)) * PROFILE;
  const k = Math.min(PROFILE - 1, Math.floor(x));
  const a = profile[k] ?? 0;
  const b = profile[k + 1] ?? a;
  return a + (b - a) * (x - k);
}

/**
 * The pose `u` (0–1, already eased) of the way from `a` to `b` under `plan`, as a pose of joints.
 * `raw` leaves out the swinging limbs' turns out of the surfaces (clearanceProfile works them out).
 */
export function tween(frame: Frame, a: Rig, b: Rig, plan: Plan, u: number, raw = false): Pose {
  let torso = lerpAngle(a.torso, b.torso, u);
  const width: Width | undefined =
    a.width || b.width
      ? {
          shoulders: lerp(a.width?.shoulders ?? 22, b.width?.shoulders ?? 22, u),
          hips: lerp(a.width?.hips ?? 12, b.width?.hips ?? 12, u),
        }
      : undefined;
  const la = plan.limb ? a.limbs[plan.limb] : undefined;
  const lb = plan.limb ? b.limbs[plan.limb] : undefined;
  const id = plan.limb as LimbId;
  /** Points of the anchor limb that the anchor fixes (the rest is solved below). */
  const fixed: { joint?: Point; end?: Point; tip?: Point } = {};

  let hip: Point;
  switch (plan.anchor) {
    case 'hip':
      hip = lerpPoint(a.hip, b.hip, u);
      break;
    case 'shoulder':
      hip = polar(lerpPoint(a.shoulder, b.shoulder, u), BODY.torso, torso + 180);
      break;
    case 'knee':
    case 'elbow': {
      if (!la || !lb) {
        hip = lerpPoint(a.hip, b.hip, u);
        break;
      }
      // A rigid upper segment turns about the joint that stands still.
      const joint = lerpPoint(la.joint, lb.joint, u);
      fixed.joint = joint;
      const root = chord(joint, la, lb, u, 'joint');
      const offset = rootOffset(frame, id, [0, 0], torso, width);
      hip = [root[0] - offset[0], root[1] - offset[1]];
      break;
    }
    case 'ankle':
    case 'hand':
    case 'toe':
    case 'slide': {
      if (!la || !lb) {
        hip = lerpPoint(a.hip, b.hip, u);
        break;
      }
      let end: Point;
      if (plan.anchor === 'toe' && la.tip && lb.tip) {
        // The heel lifts: the foot turns about the toes.
        const tip = lerpPoint(la.tip, lb.tip, u);
        fixed.tip = tip;
        end = polar(
          tip,
          lerp(la.l3, lb.l3, u),
          lerpAngle(angleOf(la.tip, la.end), angleOf(lb.tip, lb.end), u),
        );
      } else end = lerpPoint(la.end, lb.end, u);
      fixed.end = end;
      const root = chord(end, la, lb, u, 'end');
      const offset = rootOffset(frame, id, [0, 0], torso, width);
      hip = [root[0] - offset[0], root[1] - offset[1]];
      break;
    }
    default:
      hip = lerpPoint(a.hip, b.hip, u);
  }

  if (plan.keep) {
    const ka = a.limbs[plan.keep.limb];
    const kb = b.limbs[plan.keep.limb];
    if (ka && kb) {
      torso =
        plan.keep.what === 'elbow'
          ? keepAt(
              hip,
              torso,
              lerpPoint(ka.joint, kb.joint, u),
              lerp(ka.l1, kb.l1, u),
              plan.keep.side,
            )
          : keepAt(
              hip,
              torso,
              lerpPoint(ka.end, kb.end, u),
              lerp(ka.l1 + ka.l2, kb.l1 + kb.l2, u),
              plan.keep.side,
            );
    }
  }

  const { roots } = rootsOf(frame, hip, torso, width);
  const limb = (lid: LimbId) => {
    const pa = a.limbs[lid];
    const pb = b.limbs[lid];
    const p = plan.limbs[lid];
    if (!pa || !pb || !p) return null;
    const root = roots[pa.kind][pa.side];
    const l1 = lerp(pa.l1, pb.l1, u);
    const l2 = lerp(pa.l2, pb.l2, u);
    let joint: Point;
    let end: Point;
    let tip: Point | null;
    if (p.mode === 'anchor' && fixed.joint) {
      joint = fixed.joint;
      end = still(pa.end, pb.end)
        ? lerpPoint(pa.end, pb.end, u)
        : polar(joint, l2, angleOf(root, joint) + lerp(pa.bend, pb.bend, u));
      tip = tipAt(pa, pb, p, joint, end, u);
    } else if (p.mode === 'anchor' && fixed.end) {
      ({ joint, end } = reach(root, fixed.end, l1, l2, p));
      tip = fixed.tip ?? tipAt(pa, pb, p, joint, end, u);
    } else if ((p.mode === 'free' || p.mode === 'lift') && p.swing) {
      const a1 = torso + 180 + (p.swing.from + p.swing.delta * u) * p.swing.sign;
      joint = polar(root, l1, a1);
      // Folding first: toward the more bent keyframe early, away from it late.
      const folds = Math.abs(pb.bend) > Math.abs(pa.bend);
      const b = p.clear?.fold ? (folds ? 1 - (1 - u) * (1 - u) : u * u) : u;
      end = polar(joint, l2, a1 + lerp(pa.bend, pb.bend, b));
      tip = tipAt(pa, pb, p, joint, end, u);
    } else {
      let target: Point;
      let toeTip: Point | null = null;
      if (p.mode === 'toe' && pa.tip && pb.tip) {
        toeTip = lerpPoint(pa.tip, pb.tip, u);
        target = polar(
          toeTip,
          lerp(pa.l3, pb.l3, u),
          lerpAngle(angleOf(pa.tip, pa.end), angleOf(pb.tip, pb.end), u),
        );
      } else target = lerpPoint(pa.end, pb.end, u);
      // A straight limb sliding along the floor or a wall stays straight and on it.
      const along = p.line
        ? onLine(root, l1 + l2, p.line.axis, lerp(p.line.a, p.line.b, u), target)
        : null;
      if (along) {
        const angle = angleOf(root, along);
        joint = polar(root, l1, angle);
        end = along;
      } else ({ joint, end } = reach(root, target, l1, l2, p));
      tip = toeTip ?? tipAt(pa, pb, p, joint, end, u);
    }
    // A swinging limb keeps clear of the surfaces: the whole limb turns about its root – toes and
    // fingers too, so no length or bend changes – as far as its profile says at this point.
    const c = p.clear;
    if (!raw && c?.profile && (p.mode === 'free' || p.mode === 'lift')) {
      const degrees = profileAt(c.profile, u);
      if (degrees !== 0) {
        joint = turnAbout(root, joint, degrees);
        end = turnAbout(root, end, degrees);
        if (tip) tip = turnAbout(root, tip, degrees);
      }
    } else if (!raw && c?.push && (p.mode === 'free' || p.mode === 'lift')) {
      const points = clearPoints(c, pa.kind, joint, end, tip, u, 0, false);
      const endLevel = points[1]?.level ?? (() => 0);
      const moved = pushOut(plan.surfaces, end, endLevel, c.push.end);
      if (moved) {
        ({ joint, end } = reach(root, moved, l1, l2, { ...p, straight: false }));
        // The joint folds no more than a little past the more bent keyframe.
        const most = Math.max(Math.abs(pa.bend), Math.abs(pb.bend)) + 6;
        const bend = turn(root, joint, end);
        if (Math.abs(bend) > most) {
          end = polar(joint, l2, angleOf(root, joint) + Math.sign(bend) * most);
        }
        tip = tipAt(pa, pb, p, joint, end, u);
      }
      const tipLevel = points[2]?.level;
      if (tip && tipLevel) tip = pushOut(plan.surfaces, tip, tipLevel, c.push.tip) ?? tip;
    }
    return tip ? { joint, end, tip } : { joint, end };
  };

  const pose: Pose = {
    hip,
    torso,
    head: lerp(a.head, b.head, u),
    arms: { near: limb('near.arm'), far: limb('far.arm') },
    legs: { near: limb('near.leg'), far: limb('far.leg') },
  };
  if (width) pose.width = width;
  const spine = lerp(a.spine, b.spine, u);
  if (spine !== 0) pose.spine = spine;
  return pose;
}
