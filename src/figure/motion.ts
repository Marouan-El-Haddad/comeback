// The figure's motion (docs/SPEC.md 3.8 and 9.1, DECISIONS.md D45 and D48): a movement's phases as a
// timeline, and the pose at any moment of it. Between two keyframes the pose's own numbers are
// interpolated – the hip, the torso and head angles, and the points the hands and feet reach – and
// the limbs are solved again in every frame, so the limbs keep their length, the joints keep bending
// the anatomical way, and a hand or foot with the same point in both keyframes stays planted.
import { FRONT_WIDTH } from '../content/units.ts';
import {
  type FigureItem,
  type IkLimb,
  type JointLimb,
  type Limb,
  type OwnMovement,
  type Phase,
  type Point,
  type Pose,
} from '../content/types.ts';
import {
  bodyPrims,
  carried,
  emptyBox,
  floorPrim,
  propPrims,
  track,
  type Box,
  type Extent,
  type Mode,
  type Prim,
} from './draw.ts';
import {
  angleOf,
  frameOf,
  isJointLimb,
  NOMINAL,
  solve,
  tipPoint,
  type Bone,
  type Frame,
  type Kind,
  type Skeleton,
} from './geometry.ts';

/**
 * Times that are not in the data. In the card a "dose" phase lasts 2 sek and "repeat": "dose" runs 3
 * times (D45); a movement that does not end where it started goes back to the start in 1 sek.
 */
export interface Timing {
  dose: number;
  doseRepeats: number;
  back: number;
}
export const CARD_TIMING: Timing = { dose: 2, doseRepeats: 3, back: 1 };

/** One stretch of the animation: from one position to another (the same = a pause or a hold). */
export interface Move {
  from: string;
  to: string;
  /** Seconds from the start of the movement. */
  start: number;
  seconds: number;
  /** The phase whose label is highlighted; null on the way back to the start. */
  phase: number | null;
}

export interface Timeline {
  moves: Move[];
  /** One repetition, in seconds. */
  total: number;
  /** When each phase starts and how long it lasts, in seconds. */
  phases: Array<{ start: number; seconds: number }>;
}

/** How long one phase runs in the animation, all its repeats included. */
export function phaseSeconds(phase: Phase, timing: Timing = CARD_TIMING): number {
  const once = phase.seconds === 'dose' ? timing.dose : phase.seconds;
  if (phase.repeat === undefined) return once;
  return once * (phase.repeat === 'dose' ? timing.doseRepeats : phase.repeat);
}

/**
 * The phases as moves: a phase goes to `to` in its seconds; a repeated phase goes out to `to` and
 * back to the position before, half its seconds each way, as many times as it repeats. A movement
 * that ends elsewhere than it started gets a way back without a label.
 */
export function timeline(movement: OwnMovement, timing: Timing = CARD_TIMING): Timeline {
  const first = movement.positions[0]?.id ?? '';
  const moves: Move[] = [];
  const phases: Timeline['phases'] = [];
  let at = first;
  let t = 0;
  movement.phases.forEach((phase, i) => {
    const seconds = phaseSeconds(phase, timing);
    phases.push({ start: t, seconds });
    if (phase.repeat === undefined) {
      moves.push({ from: at, to: phase.to, start: t, seconds, phase: i });
      at = phase.to;
    } else {
      const times = phase.repeat === 'dose' ? timing.doseRepeats : phase.repeat;
      const half = seconds / times / 2;
      for (let k = 0; k < times; k++) {
        moves.push({ from: at, to: phase.to, start: t + 2 * k * half, seconds: half, phase: i });
        moves.push({
          from: phase.to,
          to: at,
          start: t + (2 * k + 1) * half,
          seconds: half,
          phase: i,
        });
      }
    }
    t += seconds;
  });
  if (at !== first && moves.length > 0) {
    moves.push({ from: at, to: first, start: t, seconds: timing.back, phase: null });
    t += timing.back;
  }
  return { moves, total: t, phases };
}

/** The move running at `t` seconds; `t` wraps around the total, so the movement loops. */
export function moveAt(line: Timeline, t: number): { move: Move; u: number } | null {
  if (line.moves.length === 0 || line.total <= 0) return null;
  const local = ((t % line.total) + line.total) % line.total;
  let move = line.moves[0] as Move;
  for (const m of line.moves) {
    if (m.start <= local) move = m;
    else break;
  }
  const u = move.seconds > 0 ? Math.min(1, (local - move.start) / move.seconds) : 1;
  return { move, u };
}

/** Slow at both ends of a move, like a body that starts and stops. */
export function ease(u: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * u);
}

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const lerpPoint = (a: Point, b: Point, u: number): Point => [
  lerp(a[0], b[0], u),
  lerp(a[1], b[1], u),
];

/** The shorter way round from one angle to the other. */
export function lerpAngle(a: number, b: number, u: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * u;
}

function lerpTip(
  a: Point | number | undefined,
  b: Point | number | undefined,
  endA: Point,
  endB: Point,
  u: number,
): Point | number | undefined {
  if (a === undefined && b === undefined) return undefined;
  if (typeof a === 'number' && typeof b === 'number') return lerpAngle(a, b, u);
  if (Array.isArray(a) && Array.isArray(b)) return lerpPoint(a, b, u);
  // A tip in only one keyframe keeps its angle; a point and an angle meet as points.
  if (a === undefined || b === undefined) {
    const [tip, end] = a === undefined ? [b, endB] : [a, endA];
    return typeof tip === 'number' ? tip : angleOf(end, tip as Point);
  }
  return lerpPoint(tipPoint(endA, a) as Point, tipPoint(endB, b) as Point, u);
}

function lerpLimb(
  kind: Kind,
  a: Limb,
  b: Limb,
  boneA: Bone | undefined,
  boneB: Bone | undefined,
  u: number,
): Limb {
  if (a === null || b === null) return u < 0.5 ? a : b;
  if (!isJointLimb(a) && !isJointLimb(b)) {
    const nominal = NOMINAL[kind];
    const limb: IkLimb = {
      to: lerpPoint(a.to, b.to, u),
      upper: lerp(a.upper ?? nominal.upper, b.upper ?? nominal.upper, u),
      lower: lerp(a.lower ?? nominal.lower, b.lower ?? nominal.lower, u),
    };
    const bend = u < 0.5 ? a.bend : b.bend;
    if (bend !== undefined) limb.bend = bend;
    const tip = lerpTip(a.tip, b.tip, boneA?.end ?? a.to, boneB?.end ?? b.to, u);
    if (tip !== undefined) limb.tip = tip;
    return limb;
  }
  // A limb given by its joints in one keyframe (or both) moves joint by joint.
  const joints = (l: IkLimb | JointLimb, bone: Bone | undefined): JointLimb =>
    isJointLimb(l) ? l : { joint: bone?.joint ?? l.to, end: bone?.end ?? l.to };
  const ja = joints(a, boneA);
  const jb = joints(b, boneB);
  const limb: JointLimb = {
    joint: lerpPoint(ja.joint, jb.joint, u),
    end: lerpPoint(ja.end, jb.end, u),
  };
  const tipA = isJointLimb(a) ? a.tip : (tipPoint(ja.end, a.tip) ?? undefined);
  const tipB = isJointLimb(b) ? b.tip : (tipPoint(jb.end, b.tip) ?? undefined);
  const tip = lerpTip(tipA, tipB, ja.end, jb.end, u);
  if (tip !== undefined) limb.tip = tipPoint(limb.end, tip) as Point;
  return limb;
}

/** The pose a fraction `u` of the way from `a` to `b`. */
export function lerpPose(
  a: Pose,
  b: Pose,
  u: number,
  solvedA?: Skeleton,
  solvedB?: Skeleton,
): Pose {
  const bone = (s: Skeleton | undefined, side: 'near' | 'far', kind: Kind) =>
    s?.bones.find((x) => x.side === side && x.kind === kind);
  const pose: Pose = {
    hip: lerpPoint(a.hip, b.hip, u),
    torso: lerpAngle(a.torso, b.torso, u),
    head: lerp(a.head ?? 0, b.head ?? 0, u),
    arms: {
      near: lerpLimb(
        'arm',
        a.arms.near,
        b.arms.near,
        bone(solvedA, 'near', 'arm'),
        bone(solvedB, 'near', 'arm'),
        u,
      ),
      far: lerpLimb(
        'arm',
        a.arms.far,
        b.arms.far,
        bone(solvedA, 'far', 'arm'),
        bone(solvedB, 'far', 'arm'),
        u,
      ),
    },
    legs: {
      near: lerpLimb(
        'leg',
        a.legs.near,
        b.legs.near,
        bone(solvedA, 'near', 'leg'),
        bone(solvedB, 'near', 'leg'),
        u,
      ),
      far: lerpLimb(
        'leg',
        a.legs.far,
        b.legs.far,
        bone(solvedA, 'far', 'leg'),
        bone(solvedB, 'far', 'leg'),
        u,
      ),
    },
  };
  if (a.width || b.width) {
    const wa = a.width ?? FRONT_WIDTH;
    const wb = b.width ?? FRONT_WIDTH;
    pose.width = {
      shoulders: lerp(wa.shoulders, wb.shoulders, u),
      hips: lerp(wa.hips, wb.hips, u),
    };
  }
  return pose;
}

// ---------------------------------------------------------------------------------------------
// A figure ready to draw: its timeline, its keyframes solved and the box every frame fits in
// ---------------------------------------------------------------------------------------------

export interface FigureModel {
  figure: FigureItem;
  movement: OwnMovement;
  frame: Frame;
  timeline: Timeline;
  /** Each position's keyframe, solved. */
  solved: Record<string, Skeleton>;
  /** The box every frame and prop fits in (before padding). */
  box: Box;
  /** The props that never move, and the floor line when the figure stands on a floor. */
  still: Prim[];
  /** Whether nothing moves: one position and no phase to highlight. */
  frozen: boolean;
}

/** Whether the figure is drawn on a floor line: side and front view on the floor or furniture. */
function onFloor(figure: FigureItem, movement: OwnMovement): boolean {
  if (figure.view === 'top') return false;
  if (movement.positions.some((p) => p.contacts.some((c) => c.on === 'floor'))) return true;
  return figure.props.some((p) => !carried(p) && (!('at' in p) || p.at[1] <= 0.5));
}

/** The pose at `t` seconds of the loop. */
export function poseAt(model: FigureModel, t: number): Pose {
  const { figure, solved } = model;
  const at = moveAt(model.timeline, t);
  const firstId = model.movement.positions[0]?.id ?? '';
  if (!at) return figure.keyframes[firstId] as Pose;
  const { move, u } = at;
  const a = figure.keyframes[move.from] as Pose;
  if (move.from === move.to) return a;
  const b = figure.keyframes[move.to] as Pose;
  return lerpPose(a, b, ease(u), solved[move.from], solved[move.to]);
}

/** What moves in a frame: the body and the props it carries. */
export function movingPrims(model: FigureModel, pose: Pose, mode: Mode = 'solid'): Prim[] {
  const s = solve(model.frame, pose);
  const extent: Extent = { x0: model.box.x0, x1: model.box.x1, top: model.box.y1 };
  return [
    ...bodyPrims(model.figure, s, mode),
    ...propPrims(model.figure.props, s, extent, model.frame.facing, mode, carried),
  ];
}

/** The phase whose label is highlighted at `t` seconds (null on the way back). */
export function phaseAt(model: FigureModel, t: number): number | null {
  return moveAt(model.timeline, t)?.move.phase ?? null;
}

/** Samples per move when the box is measured: limbs swing outside their keyframes in between. */
const SAMPLES = 8;

export function buildModel(
  figure: FigureItem,
  movement: OwnMovement,
  timing: Timing = CARD_TIMING,
): FigureModel {
  const frame = frameOf(figure);
  const line = timeline(movement, timing);
  const solved: Record<string, Skeleton> = {};
  for (const p of movement.positions) {
    const pose = figure.keyframes[p.id];
    if (pose) solved[p.id] = solve(frame, pose);
  }
  const model: FigureModel = {
    figure,
    movement,
    frame,
    timeline: line,
    solved,
    box: emptyBox(),
    still: [],
    frozen: movement.positions.length < 2 && movement.phases.length < 2,
  };
  // Measure every keyframe and the frames in between, then the props that stand still.
  const box = emptyBox();
  const provisional: Extent = { x0: 0, x1: 0, top: 0 };
  model.box = { x0: 0, y0: 0, x1: 0, y1: 0 };
  for (const p of movement.positions) {
    const pose = figure.keyframes[p.id];
    if (pose) track(box, movingPrims(model, pose));
  }
  // A repeated move (30 punches in a wall sit) passes the same poses: it is measured once.
  const measured = new Set<string>();
  for (const m of line.moves) {
    const key = `${m.from}>${m.to}`;
    if (m.from === m.to || measured.has(key)) continue;
    measured.add(key);
    for (let k = 1; k < SAMPLES; k++)
      track(box, movingPrims(model, poseAt(model, m.start + (m.seconds * k) / SAMPLES)));
  }
  // The props that stand still: measured once, then drawn with the walls reaching above the figure.
  const fixed = (p: Parameters<typeof carried>[0]) => !carried(p);
  track(box, propPrims(figure.props, null, provisional, frame.facing, 'solid', fixed));
  const extent: Extent = { x0: box.x0, x1: box.x1, top: box.y1 };
  const still = propPrims(figure.props, null, extent, frame.facing, 'solid', fixed);
  if (onFloor(figure, movement)) {
    still.unshift(floorPrim({ ...extent, x0: box.x0 - 2, x1: box.x1 + 2 }));
  }
  track(box, still);
  model.box = box;
  model.still = still;
  return model;
}

/** A position's still image: everything in one frame. */
export function stillPrims(model: FigureModel, positionId: string, mode: Mode = 'solid'): Prim[] {
  const pose = model.figure.keyframes[positionId];
  return pose ? [...model.still, ...movingPrims(model, pose, mode)] : model.still;
}

/** The pose of every moment, `step` seconds apart, for the contact sheet's onion skin. */
export function sampledPoses(model: FigureModel, step: number): Pose[] {
  const poses: Pose[] = [];
  for (let t = 0; t < model.timeline.total - 1e-9; t += step) poses.push(poseAt(model, t));
  return poses;
}
