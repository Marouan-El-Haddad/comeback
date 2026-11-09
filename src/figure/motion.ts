// The figure's motion (docs/SPEC.md 3.8 and 9.1, DECISIONS.md D45, D48 and D56): a movement's phases
// as a timeline, and the pose at any moment of it. Between two keyframes the body moves as joint
// angles with forward kinematics from the point that stands still (tween.ts), so the limbs keep their
// length, a straight joint stays straight, the joints keep bending the anatomical way, and a hand or
// foot with the same point in both keyframes stays planted. The figure's transitions can lift hands
// and feet on the way between two positions (`lift`) and move the whole figure along x (`advance`).
import {
  type FigureItem,
  type LiftLimb,
  type Limb,
  type OwnMovement,
  type Phase,
  type Point,
  type Pose,
  type Transition,
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
import { frameOf, isJointLimb, solve, type Frame, type Skeleton } from './geometry.ts';
import { planMove, rigOf, shiftRig, tween, type Plan, type Rig } from './tween.ts';

export { lerpAngle } from './geometry.ts';

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
  /** The figure's offset along x at the start and the end of the move (a transition's `advance`). */
  shift?: [number, number];
  /** The hands and feet lifted on the way (a transition's `lift`). */
  lift?: readonly LiftLimb[];
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
 * back to the position before, half its seconds each way, as many times as it repeats. A figure's
 * transition from one position to another lifts hands and feet on that way (`lift`) and moves the
 * figure along x (`advance`). A movement that ends elsewhere than it started, or moved along x, gets
 * a way back without a label.
 */
export function timeline(
  movement: OwnMovement,
  timing: Timing = CARD_TIMING,
  transitions: readonly Transition[] = [],
): Timeline {
  const first = movement.positions[0]?.id ?? '';
  const moves: Move[] = [];
  const phases: Timeline['phases'] = [];
  let at = first;
  let t = 0;
  let x = 0;
  const push = (move: Move) => {
    const tr =
      move.from === move.to
        ? undefined
        : transitions.find((y) => y.from === move.from && y.to === move.to);
    const dx = tr?.advance ?? 0;
    if (dx !== 0) move.shift = [x, x + dx];
    if (tr?.lift && tr.lift.length > 0) move.lift = tr.lift;
    x += dx;
    moves.push(move);
  };
  movement.phases.forEach((phase, i) => {
    const seconds = phaseSeconds(phase, timing);
    phases.push({ start: t, seconds });
    if (phase.repeat === undefined) {
      push({ from: at, to: phase.to, start: t, seconds, phase: i });
      at = phase.to;
    } else {
      const times = phase.repeat === 'dose' ? timing.doseRepeats : phase.repeat;
      const half = seconds / times / 2;
      for (let k = 0; k < times; k++) {
        push({ from: at, to: phase.to, start: t + 2 * k * half, seconds: half, phase: i });
        push({ from: phase.to, to: at, start: t + (2 * k + 1) * half, seconds: half, phase: i });
      }
    }
    t += seconds;
  });
  if ((at !== first || Math.abs(x) > 1e-9) && moves.length > 0) {
    const back: Move = { from: at, to: first, start: t, seconds: timing.back, phase: null };
    if (Math.abs(x) > 1e-9) back.shift = [x, 0];
    const lift = transitions.find((y) => y.from === at && y.to === first)?.lift;
    if (lift && lift.length > 0 && at !== first) back.lift = lift;
    moves.push(back);
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

/** A pose moved `dx` along x (a phase's `advance`). */
export function shiftPose(pose: Pose, dx: number): Pose {
  if (dx === 0) return pose;
  const move = (p: Point): Point => [p[0] + dx, p[1]];
  const limb = (l: Limb): Limb => {
    if (l === null) return null;
    if (isJointLimb(l)) {
      const moved = { ...l, joint: move(l.joint), end: move(l.end) };
      if (l.tip) moved.tip = move(l.tip);
      return moved;
    }
    const moved = { ...l, to: move(l.to) };
    if (Array.isArray(l.tip)) moved.tip = move(l.tip);
    return moved;
  };
  return {
    ...pose,
    hip: move(pose.hip),
    arms: { near: limb(pose.arms.near), far: limb(pose.arms.far) },
    legs: { near: limb(pose.legs.near), far: limb(pose.legs.far) },
  };
}

// ---------------------------------------------------------------------------------------------
// A figure ready to draw: its timeline, its keyframes solved and the box every frame fits in
// ---------------------------------------------------------------------------------------------

/** A move between two different positions: its keyframes as rigs (moved by any `advance`) and its plan. */
export interface Step {
  a: Rig;
  b: Rig;
  plan: Plan;
}

export interface FigureModel {
  figure: FigureItem;
  movement: OwnMovement;
  frame: Frame;
  timeline: Timeline;
  /** Each position's keyframe, solved. */
  solved: Record<string, Skeleton>;
  /** Each move between two different positions, ready for tween(). */
  steps: Map<Move, Step>;
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

/** The pose `u` (0–1, not eased) of the way through a move. */
export function movePose(model: FigureModel, move: Move, u: number): Pose {
  const a = model.figure.keyframes[move.from] as Pose;
  const shift = move.shift ?? [0, 0];
  const step = model.steps.get(move);
  if (move.from === move.to || !step) {
    return shiftPose(a, shift[0] + (shift[1] - shift[0]) * ease(u));
  }
  if (u <= 0) return shiftPose(a, shift[0]);
  if (u >= 1) return shiftPose(model.figure.keyframes[move.to] as Pose, shift[1]);
  return tween(model.frame, step.a, step.b, step.plan, ease(u));
}

/** The pose at `t` seconds of the loop. */
export function poseAt(model: FigureModel, t: number): Pose {
  const at = moveAt(model.timeline, t);
  const firstId = model.movement.positions[0]?.id ?? '';
  if (!at) return model.figure.keyframes[firstId] as Pose;
  return movePose(model, at.move, at.u);
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
  const line = timeline(movement, timing, figure.transitions);
  const solved: Record<string, Skeleton> = {};
  const rigs: Record<string, Rig> = {};
  for (const p of movement.positions) {
    const pose = figure.keyframes[p.id];
    if (!pose) continue;
    const s = solve(frame, pose);
    solved[p.id] = s;
    rigs[p.id] = rigOf(pose, s);
  }
  // Every move between two positions gets its plan; moves alike share it (30 punches, 20 squats).
  const steps = new Map<Move, Step>();
  const plans = new Map<string, Plan>();
  for (const m of line.moves) {
    const ra = rigs[m.from];
    const rb = rigs[m.to];
    if (m.from === m.to || !ra || !rb) continue;
    const [s0, s1] = m.shift ?? [0, 0];
    const a = shiftRig(ra, s0);
    const b = shiftRig(rb, s1);
    const key = `${m.from}>${m.to}>${s1 - s0}>${(m.lift ?? []).join(',')}`;
    let plan = plans.get(key);
    if (!plan) {
      plan = planMove(figure, frame, a, b, m.lift);
      plans.set(key, plan);
    }
    steps.set(m, { a, b, plan });
  }
  const model: FigureModel = {
    figure,
    movement,
    frame,
    timeline: line,
    solved,
    steps,
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
  // A repeated move (30 punches in a wall sit) passes the same poses: it is measured once, unless
  // the figure moves along x (bounds).
  const measured = new Set<string>();
  for (const m of line.moves) {
    const key = `${m.from}>${m.to}>${(m.shift ?? [0, 0]).join(',')}`;
    if ((m.from === m.to && !m.shift) || measured.has(key)) continue;
    measured.add(key);
    for (let k = 0; k <= SAMPLES; k++)
      track(box, movingPrims(model, movePose(model, m, k / SAMPLES)));
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
