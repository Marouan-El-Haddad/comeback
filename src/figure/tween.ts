// The frames between two keyframes (docs/SPEC.md 9.1, DECISIONS.md D48 and D56). The body moves as
// joint angles with forward kinematics from the point that stands still in both keyframes – the hip,
// the shoulders, a knee, a foot, the toes, an elbow or a hand – instead of the hip moving in a
// straight line. So the segments keep their length, a straight joint stays straight, no joint bends
// more than in the keyframes on either side, and a heel that lifts turns the foot about the toes.
//
// - The anchor: the first of hip, shoulders, knee, ankle, toes, elbow and hand that stands still
//   (near side first). The hip turns about it: a rigid segment keeps its length (the thigh about a
//   knee, the torso about the shoulders), a two-bone limb interpolates the distance and the angle
//   from the hand or foot to its root, so a straight leg stays straight and a wall sit slides down.
// - The torso turns the shorter way; an elbow that stands still (a forearm plank) turns it to keep
//   the upper arm's length.
// - Hands and feet that stand still are solved with two-bone IK to their point; a foot whose toes
//   stand still turns about them; a hand or foot that slides along a surface follows it; one that a
//   transition lifts (`lift`) goes in an arc over its surface; the rest swing with their angles (also a
//   hand or foot that leaves or lands on a surface), the shoulder and hip within their anatomical
//   range (an arm swings forward over the head, not back through the body). A planted arm that is
//   straight in both keyframes stays straight: the torso turns to keep it.
// - A hand or foot that would still dip into a surface is pushed out of it.
// Pure functions without DOM; motion.ts calls tween() for every frame.
import type { FigureItem, LiftLimb, LimbSide, Point, Pose } from '../content/types.ts';
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
import { BODY } from '../content/units.ts';
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
  const rig: Rig = {
    hip: s.hip,
    shoulder: s.shoulder,
    torso: pose.torso,
    head: pose.head ?? 0,
    spine: s.spine,
    width: pose.width,
    limbs,
    skeleton: s,
  };
  return rig;
}

const shift = (p: Point, dx: number): Point => [p[0] + dx, p[1]];

/** A rig moved `dx` along x: a phase's `advance`. */
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
  /** A lifted hand or foot: how high the arc goes and which way is away from the surface. */
  lift?: { height: number; normal: Point };
  /** A swinging limb: its angle at the shoulder or hip (jointAngle) at the start and how far it turns. */
  swing?: { from: number; delta: number; sign: 1 | -1 };
  /**
   * A swinging or lifted limb: how far its hand or foot (`end`) and its tip are from each surface
   * that stands still, in the two keyframes. It is never pushed further out than they are.
   */
  clear?: { end: Array<[number, number]>; tip: Array<[number, number]> };
}

export type AnchorKind = 'hip' | 'shoulder' | 'knee' | 'ankle' | 'toe' | 'elbow' | 'hand' | 'free';

export interface Plan {
  anchor: AnchorKind;
  /** The limb the anchor belongs to (knee, ankle, toe, elbow, hand). */
  limb: LimbId | null;
  limbs: Partial<Record<LimbId, LimbPlan>>;
  /**
   * An arm the torso turns to keep (side view): its elbow stands still on a surface (a forearm
   * plank), or it stands or slides straight in both keyframes (a rollout). `side` = which of the
   * two shoulder points the keyframes have.
   */
  keep: { limb: LimbId; what: 'elbow' | 'reach'; side: 1 | -1 } | null;
  /** The surfaces that stand still, for pushing a hand or foot out of them. */
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
  return Math.min(6, Math.max(3, 2 + 0.15 * distanceMoved));
}

/**
 * What each limb does between keyframes `a` and `b` (already moved by any `advance`), and which
 * point the hip turns about. `lift` = the hands and feet the transition lifts.
 */
export function planMove(
  figure: Pick<FigureItem, 'view' | 'props'>,
  frame: Frame,
  a: Rig,
  b: Rig,
  lift: readonly LiftLimb[] = [],
): Plan {
  const lifted = new Set(lift.map(limbOfLift));
  const solidsA = solids(figure, a.skeleton);
  const solidsB = solids(figure, b.skeleton);
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

  const surfaces = solids(figure, null);
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
    else {
      const sa = touched(solidsA, la);
      const sb = touched(solidsB, lb);
      mode = sa && sb && sa.on === sb.on && sa.prop === sb.prop ? 'slide' : 'free';
    }
    const plan: LimbPlan = { mode, ...base };
    if (mode === 'free' || mode === 'lift') {
      plan.clear = {
        end: surfaces.map((x) => [x.sdf(la.end), x.sdf(lb.end)]),
        tip: surfaces.map((x) => [la.tip ? x.sdf(la.tip) : 0, lb.tip ? x.sdf(lb.tip) : 0]),
      };
    }
    if (mode === 'free') {
      const sign = signOf(frame, id);
      const from = jointAngle(la, a.torso, sign);
      plan.swing = { from, delta: swingDelta(from, jointAngle(lb, b.torso, sign), la.kind), sign };
    }
    if (mode === 'slide') {
      const ta = tipTouched(solidsA, la);
      const tb = tipTouched(solidsB, lb);
      plan.tipSlides = !!ta && !!tb && ta.on === tb.on && ta.prop === tb.prop;
    }
    if (mode === 'lift') {
      const on = touched(solidsA, la) ?? touched(solidsB, lb);
      plan.lift = {
        height: liftHeight(distance(la.end, lb.end)),
        normal: on ? normalAt(on, on === touched(solidsA, la) ? la.end : lb.end) : [0, 1],
      };
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
        if (!p || !la || !lb || keep) continue;
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
  if (plan.tipStill || (plan.tipSlides && plan.mode === 'slide'))
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

/** How far above a surface a hand (wrist), an ankle or the toes must stay in a frame. */
const CLEARANCE = { end: { arm: 0, leg: 1.5 }, tip: 0 } as const;

/**
 * A point pushed out of the surfaces it dips into: to `level` above each, but never further than the
 * keyframes on either side have it (`keyframes`: its distance from each surface there), so the frames
 * next to a keyframe stay on it.
 */
function pushOut(
  list: readonly Solid[],
  p: Point,
  level: number,
  keyframes: ReadonlyArray<readonly [number, number]> | undefined,
  u: number,
): Point | null {
  let moved: Point | null = null;
  for (const [i, x] of list.entries()) {
    const q: Point = moved ?? p;
    const d = x.sdf(q);
    const [da, db] = keyframes?.[i] ?? [Infinity, Infinity];
    const want = Math.min(level, da + (db - da) * u);
    if (d < want) {
      const n = normalAt(x, q);
      moved = [q[0] + (want - d) * n[0], q[1] + (want - d) * n[1]];
    }
  }
  return moved;
}

/** The pose `u` (0–1, already eased) of the way from `a` to `b` under `plan`, as a pose of joints. */
export function tween(frame: Frame, a: Rig, b: Rig, plan: Plan, u: number): Pose {
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
    case 'toe': {
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
    } else if (p.mode === 'free' && p.swing) {
      const a1 = torso + 180 + (p.swing.from + p.swing.delta * u) * p.swing.sign;
      joint = polar(root, l1, a1);
      end = polar(joint, l2, a1 + lerp(pa.bend, pb.bend, u));
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
      } else {
        target = lerpPoint(pa.end, pb.end, u);
        if (p.lift) {
          const up = p.lift.height * Math.sin(Math.PI * u);
          target = [target[0] + up * p.lift.normal[0], target[1] + up * p.lift.normal[1]];
        }
      }
      ({ joint, end } = reach(root, target, l1, l2, p));
      tip = toeTip ?? tipAt(pa, pb, p, joint, end, u);
    }
    // A hand or foot that swings, lands or is lifted never dips into a surface.
    if (p.mode === 'free' || p.mode === 'lift') {
      const out = pushOut(plan.surfaces, end, CLEARANCE.end[pa.kind], p.clear?.end, u);
      if (out) {
        ({ joint, end } = reach(root, out, l1, l2, { ...p, straight: false }));
        tip = tipAt(pa, pb, p, joint, end, u);
      }
      if (tip) tip = pushOut(plan.surfaces, tip, CLEARANCE.tip, p.clear?.tip, u) ?? tip;
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
