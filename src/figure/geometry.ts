// The figure system's geometry (docs/SPEC.md 5 and 9.1, DECISIONS.md D48): a TypeScript port of the
// pictogram engine in tools/pictos/picto.py. Figure units with y up and the floor at y = 0. A pose is
// a hip, a torso angle, a head angle and four limbs; a limb with `to` is solved with two-bone inverse
// kinematics like picto.py's ik(). In side view the elbows and knees bend the anatomical way by
// themselves, from the figure's `facing`; in front and top view the limb's `bend` picks the side.
// Pure functions without DOM: the app, the tests and the contact sheet share them.
import { BODY, FRONT_WIDTH } from '../content/units.ts';
import {
  type FigureItem,
  type IkLimb,
  type JointLimb,
  type Limb,
  type LimbSide,
  type Point,
  type Pose,
  type View,
} from '../content/types.ts';

export type Kind = 'arm' | 'leg';

/** A limb as drawn: root (shoulder or hip), middle joint (elbow or knee), end (wrist or ankle). */
export interface Bone {
  side: LimbSide;
  kind: Kind;
  root: Point;
  joint: Point;
  end: Point;
  /** Hand or foot beyond the wrist or ankle, or null. */
  tip: Point | null;
  /** How far an IK limb's `to` was out of reach (0 when the hand or ankle reached it). */
  short: number;
}

export interface Skeleton {
  hip: Point;
  shoulder: Point;
  head: Point;
  /** Front view: the ends of the pelvis and of the shoulder line, [far side, near side]. */
  pelvis?: [Point, Point];
  shoulders?: [Point, Point];
  /** In drawing order of picto.py: far leg, far arm, near leg, near arm (hidden limbs left out). */
  bones: Bone[];
}

/** What the solver needs to know about a figure: its view and, in side view, where the chest faces. */
export interface Frame {
  view: View;
  facing: 1 | -1 | null;
}

export function frameOf(figure: FigureItem): Frame {
  return { view: figure.view, facing: figure.view === 'side' ? figure.facing : null };
}

export function polar(p: Point, length: number, degrees: number): Point {
  const a = (degrees * Math.PI) / 180;
  return [p[0] + length * Math.cos(a), p[1] + length * Math.sin(a)];
}

export function angleOf(a: Point, b: Point): number {
  return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** z of the cross product: > 0 when `b` turns counterclockwise from `a`. */
export function cross(a: Point, b: Point): number {
  return a[0] * b[1] - a[1] * b[0];
}

export function sub(a: Point, b: Point): Point {
  return [a[0] - b[0], a[1] - b[1]];
}

/**
 * Two-bone IK as picto.py's ik(): bend = 1 puts the middle joint counterclockwise of the line from
 * the root to the target (the limb then turns clockwise at the joint), −1 clockwise. A target out of
 * reach gives a straight limb pointing at it.
 */
export function ik(
  root: Point,
  target: Point,
  l1: number,
  l2: number,
  bend: 1 | -1,
): { joint: Point; end: Point; short: number } {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const d = Math.hypot(dx, dy);
  const base = Math.atan2(dy, dx);
  if (d > l1 + l2) {
    const joint: Point = [root[0] + l1 * Math.cos(base), root[1] + l1 * Math.sin(base)];
    const end: Point = [root[0] + (l1 + l2) * Math.cos(base), root[1] + (l1 + l2) * Math.sin(base)];
    return { joint, end, short: d - (l1 + l2) };
  }
  const reach = Math.max(Math.min(d, l1 + l2 - 1e-6), Math.abs(l1 - l2) + 1e-6);
  const cosA = (l1 * l1 + reach * reach - l2 * l2) / (2 * l1 * reach);
  const a = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const joint: Point = [
    root[0] + l1 * Math.cos(base + bend * a),
    root[1] + l1 * Math.sin(base + bend * a),
  ];
  const toward = Math.atan2(target[1] - joint[1], target[0] - joint[0]);
  const end: Point = [joint[0] + l2 * Math.cos(toward), joint[1] + l2 * Math.sin(toward)];
  return { joint, end, short: Math.max(0, distance(end, target) - 1e-6) };
}

/**
 * The bend of an IK limb. Side view: anatomical from `facing` – a knee turns the shin toward the
 * back (bend = facing), an elbow turns the forearm toward the front (bend = −facing). Front and top
 * view: the limb's own `bend`.
 */
export function bendOf(frame: Frame, kind: Kind, limb: IkLimb): 1 | -1 {
  if (frame.view === 'side' && frame.facing !== null) {
    return kind === 'leg' ? frame.facing : frame.facing === 1 ? -1 : 1;
  }
  return limb.bend ?? 1;
}

export const NOMINAL: Record<Kind, { upper: number; lower: number }> = {
  arm: { upper: BODY.upperArm, lower: BODY.forearm },
  leg: { upper: BODY.thigh, lower: BODY.shin },
};

export function isJointLimb(limb: IkLimb | JointLimb): limb is JointLimb {
  return 'joint' in limb;
}

/** A tip given as a point is that point; as an angle it is BODY.tip long from the end. */
export function tipPoint(end: Point, tip: Point | number | undefined): Point | null {
  if (tip === undefined) return null;
  return typeof tip === 'number' ? polar(end, BODY.tip, tip) : tip;
}

function bone(frame: Frame, side: LimbSide, kind: Kind, root: Point, limb: Limb): Bone | null {
  if (limb === null) return null;
  if (isJointLimb(limb)) {
    return { side, kind, root, joint: limb.joint, end: limb.end, tip: limb.tip ?? null, short: 0 };
  }
  const nominal = NOMINAL[kind];
  const solved = ik(
    root,
    limb.to,
    limb.upper ?? nominal.upper,
    limb.lower ?? nominal.lower,
    bendOf(frame, kind, limb),
  );
  return {
    side,
    kind,
    root,
    joint: solved.joint,
    end: solved.end,
    tip: tipPoint(solved.end, limb.tip),
    short: solved.short,
  };
}

/** The joints of a pose: hip, shoulder, head centre and the four limbs. */
export function solve(frame: Frame, pose: Pose): Skeleton {
  const hip = pose.hip;
  const shoulder = polar(hip, BODY.torso, pose.torso);
  const head = polar(shoulder, BODY.neck, pose.torso + (pose.head ?? 0));
  const skeleton: Skeleton = { hip, shoulder, head, bones: [] };
  let roots: Record<Kind, Record<LimbSide, Point>> = {
    arm: { near: shoulder, far: shoulder },
    leg: { near: hip, far: hip },
  };
  if (frame.view === 'front') {
    // The near side is to the right of the torso direction (+x when the figure stands upright).
    const width = pose.width ?? FRONT_WIDTH;
    const right = pose.torso - 90;
    const pelvis: [Point, Point] = [
      polar(hip, width.hips / 2, right + 180),
      polar(hip, width.hips / 2, right),
    ];
    const shoulders: [Point, Point] = [
      polar(shoulder, width.shoulders / 2, right + 180),
      polar(shoulder, width.shoulders / 2, right),
    ];
    skeleton.pelvis = pelvis;
    skeleton.shoulders = shoulders;
    roots = {
      arm: { far: shoulders[0], near: shoulders[1] },
      leg: { far: pelvis[0], near: pelvis[1] },
    };
  }
  const order: Array<[LimbSide, Kind]> = [
    ['far', 'leg'],
    ['far', 'arm'],
    ['near', 'leg'],
    ['near', 'arm'],
  ];
  for (const [side, kind] of order) {
    const limb = kind === 'arm' ? pose.arms[side] : pose.legs[side];
    const b = bone(frame, side, kind, roots[kind][side], limb);
    if (b) skeleton.bones.push(b);
  }
  return skeleton;
}

/**
 * The direction the chest faces in degrees, in side view: the torso direction turned 90° clockwise
 * when facing = 1 (to the right for a standing figure), counterclockwise when −1.
 */
export function chestDirection(frame: Frame, pose: Pose): number | null {
  if (frame.view !== 'side' || frame.facing === null) return null;
  return pose.torso - 90 * frame.facing;
}
