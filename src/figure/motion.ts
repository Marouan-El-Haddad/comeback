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
import {
  clearanceProfile,
  planMove,
  rigOf,
  shiftRig,
  tween,
  type Plan,
  type Rig,
} from './tween.ts';

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
  /** Half of a transition's way through its `via` pose: one end is the via (`viaId`). */
  bridge?: true;
  /**
   * The end of a loop that travelled and came back to its first position (bounds): the figure stands
   * where it got to, and the loop starts over at the start – a cut, not a glide backward.
   */
  cut?: true;
}

/** The id of a transition's `via` pose among the figure's poses: »squat>chest«. */
export const viaId = (from: string, to: string): string => `${from}>${to}`;

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
 * transition from one position to another lifts hands and feet on that way (`lift`), moves the
 * figure along x (`advance`), and goes through a pose of its own on the way (`via`: the move is two
 * halves, each half the time). A movement that ends elsewhere than it started, or moved along x,
 * gets a way back without a label, which a transition can shape too. With `cut` a movement that ends
 * where it started stands its half second at the end too, as the other view of a figure that
 * travels does (L1 in the P1b review): both views then have one loop length.
 */
export function timeline(
  movement: OwnMovement,
  timing: Timing = CARD_TIMING,
  transitions: readonly Transition[] = [],
  cut = false,
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
    const lift = tr?.lift && tr.lift.length > 0 ? tr.lift : undefined;
    // Every move after an advance keeps the figure where it got to, holds too (H1 in the P1a review).
    const halves: Move[] = tr?.via
      ? [
          { ...move, to: viaId(move.from, move.to), seconds: move.seconds / 2, bridge: true },
          {
            ...move,
            from: viaId(move.from, move.to),
            start: move.start + move.seconds / 2,
            seconds: move.seconds / 2,
            bridge: true,
          },
        ]
      : [move];
    for (const half of halves) {
      const d = dx / halves.length;
      if (d !== 0 || x !== 0) half.shift = [x, x + d];
      else delete half.shift;
      if (lift) half.lift = lift;
      x += d;
      moves.push(half);
    }
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
  if (at === first && Math.abs(x) > 1e-9 && moves.length > 0) {
    // Back in its first position after travelling (bounds): it stands a moment where it got to,
    // and the loop starts over at the start – a cut, never a glide backward in the same pose.
    const seconds = timing.back / 2;
    moves.push({ from: at, to: at, start: t, seconds, phase: null, shift: [x, x], cut: true });
    return { moves, total: t + seconds, phases };
  }
  if (cut && at === first && moves.length > 0) {
    // The other view of a figure that travels: the same half second at the end, where it stands.
    const seconds = timing.back / 2;
    moves.push({ from: at, to: at, start: t, seconds, phase: null, cut: true });
    return { moves, total: t + seconds, phases };
  }
  if ((at !== first || Math.abs(x) > 1e-9) && moves.length > 0) {
    const back: Move = { from: at, to: first, start: t, seconds: timing.back, phase: null };
    const tr = at !== first ? transitions.find((y) => y.from === at && y.to === first) : undefined;
    // The way back goes all the way to the start, also along x; a transition can lift and shape it.
    const halves: Move[] = tr?.via
      ? [
          { ...back, to: viaId(at, first), seconds: back.seconds / 2, bridge: true },
          {
            ...back,
            from: viaId(at, first),
            start: back.start + back.seconds / 2,
            seconds: back.seconds / 2,
            bridge: true,
          },
        ]
      : [back];
    halves.forEach((half, k) => {
      const from = x - (x * k) / halves.length;
      const to = x - (x * (k + 1)) / halves.length;
      if (Math.abs(x) > 1e-9) half.shift = [from, to];
      if (tr?.lift && tr.lift.length > 0) half.lift = tr.lift;
      moves.push(half);
    });
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

/** The figure's offset along x `u` (0–1, not eased) of the way through a move. */
export function shiftAt(move: Move, u: number): number {
  const [s0, s1] = move.shift ?? [0, 0];
  return s0 + (s1 - s0) * ease(Math.max(0, Math.min(1, u)));
}

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
  /** Every pose the figure moves through: its keyframes, and its transitions' `via` poses. */
  poses: Record<string, Pose>;
  /**
   * The box of the figure without its travel along x (`advance`): still images and the contact
   * sheet's cells show each position and the middle of each move in it, at the same size as a
   * figure that does not travel. The same as `box` when nothing travels.
   */
  stillBox: Box;
  /** The box every frame and prop fits in (before padding). */
  box: Box;
  /** The props that never move, and the floor line when the figure stands on a floor. */
  still: Prim[];
  /** Whether nothing moves: one position and no phase to highlight. */
  frozen: boolean;
  /** How far along x the figure travels in the loop (`advance`), or null when it stays. */
  travel: { min: number; max: number } | null;
  /** Whether it has props that stand still (walls, furniture), so its frame cannot pan. */
  fixed: boolean;
  /**
   * Small marks under the floor line every few units, drawn by the animation when the figure travels:
   * when its frame pans, they show the way it goes (DECISIONS.md D58).
   */
  ticks: Prim[];
}

/** Whether the figure is drawn on a floor line: side and front view on the floor or furniture. */
function onFloor(figure: FigureItem, movement: OwnMovement): boolean {
  if (figure.view === 'top') return false;
  if (movement.positions.some((p) => p.contacts.some((c) => c.on === 'floor'))) return true;
  return figure.props.some((p) => !carried(p) && (!('at' in p) || p.at[1] <= 0.5));
}

/** The pose `u` of the way through a move without the figure's travel along x: for still images. */
export function movePoseLocal(model: FigureModel, move: Move, u: number): Pose {
  return shiftPose(movePose(model, move, u), -shiftAt(move, u));
}

/** The pose `u` (0–1, not eased) of the way through a move. */
export function movePose(model: FigureModel, move: Move, u: number): Pose {
  const a = model.poses[move.from] as Pose;
  const shift = move.shift ?? [0, 0];
  const step = model.steps.get(move);
  if (move.from === move.to || !step) {
    return shiftPose(a, shift[0] + (shift[1] - shift[0]) * ease(u));
  }
  if (u <= 0) return shiftPose(a, shift[0]);
  if (u >= 1) return shiftPose(model.poses[move.to] as Pose, shift[1]);
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

/** The floor's marks under a traveling figure stand this far apart. */
const TICK = 12;

/** Samples per move when the box is measured: limbs swing outside their keyframes in between. */
const SAMPLES = 8;

/**
 * A view of a figure ready to draw. `cut`: it stands half a second at its first position at the end
 * of the loop, as the other view that travels does (viewModels in views.ts).
 */
export function buildModel(
  figure: FigureItem,
  movement: OwnMovement,
  timing: Timing = CARD_TIMING,
  cut = false,
): FigureModel {
  const frame = frameOf(figure);
  const line = timeline(movement, timing, figure.transitions, cut);
  const solved: Record<string, Skeleton> = {};
  const rigs: Record<string, Rig> = {};
  const poses: Record<string, Pose> = { ...figure.keyframes };
  for (const tr of figure.transitions ?? []) {
    if (tr.via) poses[viaId(tr.from, tr.to)] = tr.via;
  }
  for (const [id, pose] of Object.entries(poses)) {
    const s = solve(frame, pose);
    solved[id] = s;
    rigs[id] = rigOf(pose, s);
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
    // With props the figure's place among them counts, so the key holds the offset itself.
    const where = figure.props.length > 0 ? `${s0}>${s1}` : `${s1 - s0}`;
    const key = `${m.from}>${m.to}>${where}>${(m.lift ?? []).join(',')}`;
    let plan = plans.get(key);
    if (!plan) {
      // On the way to or from a via, a lifted hand or foot swings without an arc: the via shapes it.
      plan = planMove(figure, frame, a, b, m.lift, !m.bridge);
      clearanceProfile(frame, a, b, plan);
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
    poses,
    stillBox: emptyBox(),
    box: emptyBox(),
    still: [],
    frozen: movement.positions.length < 2 && movement.phases.length < 2,
    travel: null,
    fixed: figure.props.some((p) => !carried(p)),
    ticks: [],
  };
  for (const m of line.moves) {
    if (!m.shift) continue;
    const t = model.travel ?? { min: 0, max: 0 };
    model.travel = {
      min: Math.min(t.min, m.shift[0], m.shift[1]),
      max: Math.max(t.max, m.shift[0], m.shift[1]),
    };
  }
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
  // Without the travel along x: each position and the middle of each move where it stands.
  const travels = line.moves.some((m) => m.shift !== undefined);
  const stillBox = emptyBox();
  if (travels) {
    for (const p of movement.positions) {
      const pose = figure.keyframes[p.id];
      if (pose) track(stillBox, movingPrims(model, pose));
    }
    for (const m of line.moves) {
      if (m.from === m.to) continue;
      for (let k = 1; k < SAMPLES; k++) {
        track(stillBox, movingPrims(model, movePoseLocal(model, m, k / SAMPLES)));
      }
    }
  }
  // The props that stand still: measured once, then drawn with the walls reaching above the figure.
  const fixed = (p: Parameters<typeof carried>[0]) => !carried(p);
  track(box, propPrims(figure.props, null, provisional, frame.facing, 'solid', fixed));
  if (travels) {
    track(stillBox, propPrims(figure.props, null, provisional, frame.facing, 'solid', fixed));
  }
  const extent: Extent = { x0: box.x0, x1: box.x1, top: box.y1 };
  const still = propPrims(figure.props, null, extent, frame.facing, 'solid', fixed);
  if (onFloor(figure, movement)) {
    still.unshift(floorPrim({ ...extent, x0: box.x0 - 2, x1: box.x1 + 2 }));
  }
  track(box, still);
  if (model.travel && !model.fixed && still.some((p) => p.key === 'floor')) {
    for (let x = Math.ceil(box.x0 / TICK) * TICK, k = 0; x <= box.x1; x += TICK, k++) {
      model.ticks.push({
        key: `tick${k}`,
        z: 0,
        t: 'line',
        a: [x, -1.9],
        b: [x, -4.4],
        w: 1.2,
        s: 'prop',
        butt: true,
      });
    }
    track(box, model.ticks);
  }
  model.box = box;
  model.still = still;
  if (travels) {
    // The floor line under the figure, 2 wider on each side, as for a figure that does not travel.
    const floor = still.find((p) => p.key === 'floor');
    if (floor && floor.t === 'line') {
      const a: Point = [stillBox.x0 - 2, floor.a[1]];
      const b: Point = [stillBox.x1 + 2, floor.b[1]];
      track(stillBox, [{ ...floor, a, b }]);
    }
    model.stillBox = stillBox;
  } else model.stillBox = box;
  return model;
}

/** The figure's offset along x at `t` seconds of the loop (its travel, `advance`). */
export function shiftAtTime(model: FigureModel, t: number): number {
  const at = moveAt(model.timeline, t);
  return at ? shiftAt(at.move, at.u) : 0;
}

/** The padding around a drawing, as picto.py and viewBox(). */
const PAD = 3;
/** A figure that cannot cross all its travel on screen at full size crosses at least this share. */
const SHOWN_TRAVEL = 0.25;

/**
 * The part of the scene a drawing shows at `t` seconds, for a drawing `aspect` wide (its width over
 * its height in px). A figure that travels along x (`advance`) without props that stand still gets a
 * frame as tall as the figure itself that follows it: it stays as big as when it stands still and
 * crosses the frame while the frame pans the rest of the way, so nothing is cut off; the floor's
 * marks (`ticks`) show the way it goes. When it cannot cross at least a quarter of its travel on
 * screen, the frame grows (the figure gets a little smaller) until it can; when all of it fits, the whole scene is shown. Every other figure shows the whole scene
 * (`box`), as do figures with walls or furniture, which a panning frame would cut.
 */
export function frameBox(model: FigureModel, t: number | null, aspect: number): Box {
  const travel = model.travel;
  if (!travel || model.fixed || !(aspect > 0)) return model.box;
  const still = model.stillBox;
  const w = still.x1 - still.x0 + 2 * PAD;
  const h = still.y1 - still.y0 + 2 * PAD;
  const range = travel.max - travel.min;
  const whole = model.box.x1 - model.box.x0 + 2 * PAD;
  let height = h;
  if (aspect * height - w < SHOWN_TRAVEL * range) height = (w + SHOWN_TRAVEL * range) / aspect;
  const width = aspect * height;
  if (width >= whole || range <= 0) return model.box;
  // The figure's left edge at its leftmost travel stands at the frame's left edge, and at its
  // rightmost at the right edge; in between the frame pans with the share it cannot cross.
  const s = t === null ? 0 : shiftAtTime(model, t);
  const left = still.x0 - PAD + travel.min;
  const pan = 1 - (width - w) / range;
  const x = left + (s - travel.min) * pan;
  const y = still.y0 - PAD - (height - h) / 2;
  return { x0: x + PAD, x1: x + width - PAD, y0: y + PAD, y1: y + height - PAD };
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
