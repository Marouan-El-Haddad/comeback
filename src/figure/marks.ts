// Marks on a figure (docs/SPEC.md 3.8 and 9.1, DECISIONS.md D58): what to look for, at the right
// moment. An arrow follows a part of the body through a phase (a curved way gives a curved arrow),
// an angle shows the arc and the degrees at a joint, a cue of at most three words stands by a point,
// and a guide line runs straight between two points. A mark with `at` is shown while the figure
// stands at that position (its holds and pauses there); one with `phase` while that phase runs. The
// drawing is in the figure's own colours (Thai red) and stands still while the mark is shown; the
// text (a cue, the degrees) is set by the app in HTML at the size the session needs (SPEC 6).
// Pure functions without DOM: the app, the checks and the contact sheet share them.
import type {
  LimbSide,
  Mark,
  MarkJoint,
  MarkPlace,
  MarkPoint,
  OwnMovement,
  Point,
  Pose,
} from '../content/types.ts';
import type { Prim } from './draw.ts';
import {
  angleOf,
  chestDirection,
  distance,
  lerpPoint,
  polar,
  solve,
  type Frame,
  type Skeleton,
} from './geometry.ts';
import { movePose, movePoseLocal, shiftPose, type FigureModel, type Move } from './motion.ts';
import { VIEW_NAME } from './views.ts';

/** Marks are drawn above the body. */
const Z = 30;
/** The radius of an angle's arc, and how far its degrees stand outside it. */
const ARC = { r: 6, text: 4.8 } as const;
/** A cue's dot on its point. */
const DOT = 1.7;
/** An arrow's shaft and head. */
const ARROW = { width: 1.8, head: 5, headWidth: 4.8 } as const;
/** How far a guide line runs past its two points. */
const OVER = 3;

export type MarkKind = 'arrow' | 'angle' | 'cue' | 'line';

export function markKind(mark: Mark): MarkKind {
  if ('arrow' in mark) return 'arrow';
  if ('angle' in mark) return 'angle';
  if ('line' in mark) return 'line';
  return 'cue';
}

/** Where a mark's text stands: beside its point, centred on it (degrees), or in the corner. */
export type LabelPlace = MarkPlace | 'center' | 'corner';

export interface MarkLabel {
  text: string;
  /** The point it stands by, in figure units; null = the drawing's top left corner. */
  at: Point | null;
  place: LabelPlace;
}

/** A mark as drawn at one moment: its shapes and its text. */
export interface MarkDraw {
  prims: Prim[];
  label: MarkLabel | null;
  /** An arrow's way from start to end (the text alternative names its direction). */
  chord?: Point;
  /** The angle the figure draws at the joint, in degrees. */
  measured?: number;
}

/** A mark shown from `start` to `end` seconds of the timeline, as drawn then. */
export interface MarkShow extends MarkDraw {
  start: number;
  end: number;
}

export interface MarkPlan {
  /** The mark's place in the view's `marks`. */
  index: number;
  mark: Mark;
  shows: MarkShow[];
}

// ---------------------------------------------------------------------------------------------
// Points and angles of the body
// ---------------------------------------------------------------------------------------------

function boneOf(s: Skeleton, side: LimbSide, kind: 'arm' | 'leg') {
  return s.bones.find((b) => b.side === side && b.kind === kind);
}

/**
 * A point a mark refers to: a part of the body in this frame, or a point in figure units, which moves
 * with the figure's travel along x (`dx`). The chest is the front of the upper torso from the side,
 * and the upper torso from the front and above.
 */
export function pointOf(frame: Frame, s: Skeleton, name: MarkPoint | Point, dx = 0): Point | null {
  if (Array.isArray(name)) return [name[0] + dx, name[1]];
  switch (name) {
    case 'hip':
      return s.hip;
    case 'shoulder':
      return s.shoulder;
    case 'head':
      return s.head;
    case 'chest': {
      const base = lerpPoint(s.shoulder, s.hip, frame.view === 'side' ? 1 / 3 : 1 / 4);
      const chest = chestDirection(frame, { torso: angleOf(s.hip, s.shoulder) });
      return chest === null ? base : polar(base, 5.8, chest);
    }
  }
  const [side, part] = name.split('.') as [LimbSide, string];
  const arm = part === 'hand' || part === 'elbow';
  const b = boneOf(s, side, arm ? 'arm' : 'leg');
  if (!b) return null;
  if (part === 'elbow' || part === 'knee') return b.joint;
  if (part === 'toes') return b.tip ?? b.end;
  return b.end;
}

/**
 * The angle at a joint: between thigh and shin (knee), upper arm and forearm (elbow), torso and thigh
 * (hip) or torso and upper arm (shoulder). `a` and `b` are the two directions from the joint in
 * degrees; `degrees` the angle between them, 180 = straight.
 */
export function jointAngle(
  s: Skeleton,
  joint: MarkJoint,
): { at: Point; a: number; b: number; degrees: number } | null {
  const [side, part] = joint.split('.') as [LimbSide, string];
  const leg = boneOf(s, side, 'leg');
  const arm = boneOf(s, side, 'arm');
  let at: Point;
  let pa: Point;
  let pb: Point;
  if (part === 'knee' || part === 'hip') {
    if (!leg) return null;
    if (part === 'knee') [at, pa, pb] = [leg.joint, leg.root, leg.end];
    else {
      at = leg.root;
      pa = [at[0] + s.shoulder[0] - s.hip[0], at[1] + s.shoulder[1] - s.hip[1]];
      pb = leg.joint;
    }
  } else {
    if (!arm) return null;
    if (part === 'elbow') [at, pa, pb] = [arm.joint, arm.root, arm.end];
    else {
      at = arm.root;
      pa = [at[0] + s.hip[0] - s.shoulder[0], at[1] + s.hip[1] - s.shoulder[1]];
      pb = arm.joint;
    }
  }
  const a = angleOf(at, pa);
  const b = angleOf(at, pb);
  return { at, a, b, degrees: Math.abs(turnBetween(a, b)) };
}

/** The shorter turn from direction a to direction b, −180–180. */
function turnBetween(a: number, b: number): number {
  return ((((b - a) % 360) + 540) % 360) - 180;
}

// ---------------------------------------------------------------------------------------------
// Drawing a mark
// ---------------------------------------------------------------------------------------------

/** The phase each phase starts in: the position before it (a repeat ends where it started). */
export function phaseStarts(movement: OwnMovement): string[] {
  let at = movement.positions[0]?.id ?? '';
  return movement.phases.map((phase) => {
    const from = at;
    if (phase.repeat === undefined) at = phase.to;
    return from;
  });
}

/** The moves of one way through a phase: all of it, or one way out for a repeat. */
function phaseWay(model: FigureModel, index: number): Move[] {
  const phase = model.movement.phases[index];
  const moves = model.timeline.moves.filter((m) => m.phase === index && m.from !== m.to);
  if (!phase || phase.repeat === undefined) return moves;
  const out: Move[] = [];
  for (const m of moves) {
    out.push(m);
    if (m.to === phase.to) break;
  }
  return out;
}

/** The point a little way back along a path from its end (for an arrow head's direction). */
function backAlong(pts: readonly Point[], from: number, step: -1 | 1, length: number): Point {
  const end = pts[from] as Point;
  for (let i = from + step; i >= 0 && i < pts.length; i += step) {
    if (distance(pts[i] as Point, end) >= length) return pts[i] as Point;
  }
  return pts[from - step] ?? end;
}

function arrowHead(tip: Point, toward: number, key: string): Prim {
  const base = polar(tip, ARROW.head, toward + 180);
  return {
    key,
    z: Z + 0.1,
    t: 'poly',
    pts: [
      tip,
      polar(base, ARROW.headWidth / 2, toward + 90),
      polar(base, ARROW.headWidth / 2, toward - 90),
    ],
    s: 'hi',
    f: 'hi',
    w: 0.6,
  };
}

/** An arrow along a part's way through a phase; a repeat gets a head at both ends. */
function arrowPrims(
  model: FigureModel,
  index: number,
  point: MarkPoint,
  offset: Point,
  key: string,
  local: boolean,
): { prims: Prim[]; chord: Point } {
  const way = phaseWay(model, index);
  const pts: Point[] = [];
  for (const m of way) {
    for (let k = 0; k <= 12; k++) {
      const pose = local ? movePoseLocal(model, m, k / 12) : movePose(model, m, k / 12);
      const p = pointOf(model.frame, solve(model.frame, pose), point);
      if (!p) continue;
      const q: Point = [p[0] + offset[0], p[1] + offset[1]];
      const last = pts[pts.length - 1];
      if (!last || distance(last, q) > 0.05) pts.push(q);
    }
  }
  const first = pts[0];
  const end = pts[pts.length - 1];
  if (!first || !end || pts.length < 2) return { prims: [], chord: [0, 0] };
  const chord: Point = [end[0] - first[0], end[1] - first[1]];
  const both = model.movement.phases[index]?.repeat !== undefined;
  const headTo = angleOf(backAlong(pts, pts.length - 1, -1, 3), end);
  // The shaft stops under the head, so the head's point is the arrow's end.
  const trim = (list: Point[], from: Point, toward: number) => {
    const base = polar(from, ARROW.head * 0.8, toward + 180);
    return [...list, base];
  };
  let shaft = pts.filter((p) => distance(p, end) >= ARROW.head * 0.8);
  shaft = trim(shaft, end, headTo);
  const prims: Prim[] = [];
  if (both) {
    const headFrom = angleOf(backAlong(pts, 0, 1, 3), first);
    shaft = shaft.filter((p) => distance(p, first) >= ARROW.head * 0.8);
    shaft.unshift(polar(first, ARROW.head * 0.8, headFrom + 180));
    prims.push(arrowHead(first, headFrom, `${key}.head0`));
  }
  prims.unshift({ key: `${key}.shaft`, z: Z, t: 'path', pts: shaft, w: ARROW.width, s: 'hi' });
  prims.push(arrowHead(end, headTo, `${key}.head`));
  return { prims, chord };
}

/** Beside the point, on the side away from the middle of the body. */
function sideOf(s: Skeleton, p: Point): MarkPlace {
  return p[0] >= (s.hip[0] + s.shoulder[0]) / 2 ? 'right' : 'left';
}

const degreesText = (mark: { degrees?: number }, measured: number) =>
  `${mark.degrees ?? Math.round(measured / 5) * 5}°`;

/**
 * A mark as drawn from a pose. `phase` is the phase it belongs to (an arrow's way), `dx` the
 * figure's travel along x at the time, and `local` leaves the travel out (still images).
 */
export function markDraw(
  model: FigureModel,
  mark: Mark,
  index: number,
  pose: Pose,
  dx: number,
  phase: number | null,
  local: boolean,
): MarkDraw {
  const frame = model.frame;
  const s = solve(frame, pose);
  const key = `mark${index}`;
  if ('arrow' in mark) {
    if (phase === null) return { prims: [], label: null };
    const { prims, chord } = arrowPrims(
      model,
      phase,
      mark.arrow,
      mark.offset ?? [0, 0],
      key,
      local,
    );
    return { prims, label: null, chord };
  }
  if ('angle' in mark) {
    const angle = jointAngle(s, mark.angle);
    if (!angle) return { prims: [], label: null };
    const sweep = turnBetween(angle.a, angle.b);
    const pts = Array.from({ length: 13 }, (_, i) =>
      polar(angle.at, ARC.r, angle.a + (sweep * i) / 12),
    );
    return {
      prims: [{ key: `${key}.arc`, z: Z, t: 'path', pts, w: 1.4, s: 'hi' }],
      label: {
        text: degreesText(mark, angle.degrees),
        at: polar(angle.at, ARC.r + ARC.text, angle.a + sweep / 2),
        place: 'center',
      },
      measured: angle.degrees,
    };
  }
  if ('line' in mark) {
    const [pa, pb] = mark.line.map((p) => pointOf(frame, s, p, local ? 0 : dx));
    if (!pa || !pb) return { prims: [], label: null };
    const along = angleOf(pa, pb);
    const a = polar(pa, OVER, along + 180);
    const b = polar(pb, OVER, along);
    return {
      prims: [{ key: `${key}.line`, z: Z, t: 'line', a, b, w: 1.3, s: 'hi', dash: '3 2.2' }],
      label: mark.cue
        ? { text: mark.cue, at: lerpPoint(pa, pb, 0.5), place: mark.place ?? 'above' }
        : null,
    };
  }
  const at = mark.point === undefined ? null : pointOf(frame, s, mark.point, local ? 0 : dx);
  return {
    prims: at ? [{ key: `${key}.dot`, z: Z, t: 'circle', c: at, r: DOT, f: 'hi' }] : [],
    label: {
      text: mark.cue,
      at,
      place: at ? (mark.place ?? sideOf(s, at)) : 'corner',
    },
  };
}

/** The figure's travel along x `u` of the way through a move (0 without travel). */
const travel = (m: Move, u: number) => (m.shift ? m.shift[0] + (m.shift[1] - m.shift[0]) * u : 0);

/**
 * When a mark is shown in the figure's timeline and how it is drawn then: a phase's mark for the
 * whole phase, drawn from where the phase starts; a position's mark in each hold or pause at it,
 * drawn from the keyframe where the figure stands.
 */
export function markShows(model: FigureModel, mark: Mark, index: number): MarkShow[] {
  if (mark.phase !== undefined) {
    const i = mark.phase - 1;
    const time = model.timeline.phases[i];
    const first = model.timeline.moves.find((m) => m.phase === i);
    if (!time || !first) return [];
    const draw = markDraw(
      model,
      mark,
      index,
      movePose(model, first, 0),
      travel(first, 0),
      i,
      false,
    );
    return [{ start: time.start, end: time.start + time.seconds, ...draw }];
  }
  const pose = mark.at === undefined ? undefined : model.figure.keyframes[mark.at];
  if (!pose) return [];
  const shows: Array<MarkShow & { dx: number }> = [];
  for (const m of model.timeline.moves) {
    if (m.from !== mark.at || m.to !== mark.at) continue;
    const dx = travel(m, 0);
    const prev = shows[shows.length - 1];
    if (prev && Math.abs(prev.end - m.start) < 1e-9 && Math.abs(prev.dx - dx) < 1e-9) {
      prev.end = m.start + m.seconds;
      continue;
    }
    const draw = markDraw(model, mark, index, shiftPose(pose, dx), dx, null, false);
    shows.push({ start: m.start, end: m.start + m.seconds, dx, ...draw });
  }
  for (const show of shows) delete (show as Partial<typeof show>).dx;
  return shows;
}

/** Every mark of a view with when it is shown. */
export function markPlans(model: FigureModel): MarkPlan[] {
  return (model.figure.marks ?? []).map((mark, index) => ({
    index,
    mark,
    shows: markShows(model, mark, index),
  }));
}

/** The mark shown at `t` seconds of the loop, or null. One at a time: the first that fits. */
export function markAt(
  plans: readonly MarkPlan[],
  total: number,
  t: number | null,
): { plan: MarkPlan; show: MarkShow } | null {
  if (t === null || total <= 0) return null;
  const local = ((t % total) + total) % total;
  for (const plan of plans) {
    for (const show of plan.shows) {
      if (local >= show.start - 1e-9 && local < show.end - 1e-9) return { plan, show };
    }
  }
  return null;
}

/**
 * The marks on a position's still image (reduced motion, the contact sheet): its own (`at`) and
 * those of the phases that start there – an arrow from there – drawn without the travel along x.
 */
export function stillMarks(model: FigureModel, positionId: string): MarkDraw[] {
  const pose = model.figure.keyframes[positionId];
  if (!pose) return [];
  const starts = phaseStarts(model.movement);
  return (model.figure.marks ?? []).flatMap((mark, index) => {
    if (mark.at === positionId) return [markDraw(model, mark, index, pose, 0, null, true)];
    if (mark.phase === undefined || starts[mark.phase - 1] !== positionId) return [];
    return [markDraw(model, mark, index, pose, 0, mark.phase - 1, true)];
  });
}

// ---------------------------------------------------------------------------------------------
// The text alternative (docs/SPEC.md 6)
// ---------------------------------------------------------------------------------------------

const POINT_NAME: Record<string, string> = {
  hip: 'hoften',
  shoulder: 'skulderen',
  chest: 'brystet',
  head: 'hovedet',
  hand: 'hånden',
  elbow: 'albuen',
  knee: 'knæet',
  foot: 'foden',
  toes: 'tæerne',
};

function pointName(p: MarkPoint | Point): string {
  if (Array.isArray(p)) return 'et punkt';
  return POINT_NAME[p.split('.').pop() ?? p] ?? p;
}

/** An arrow's direction in words: up, down, forward (where the chest faces), back or to the side. */
export function directionText(frame: Frame, chord: Point): string {
  const ahead = frame.view === 'side' && frame.facing !== null;
  const x = ahead ? chord[0] * (frame.facing as number) : Math.abs(chord[0]);
  const deg = (Math.atan2(chord[1], x) * 180) / Math.PI;
  if (!ahead) {
    if (deg > 67.5) return 'op';
    if (deg < -67.5) return 'ned';
    if (deg > 22.5) return 'skråt op';
    if (deg < -22.5) return 'skråt ned';
    return 'til siden';
  }
  const words = [
    'tilbage',
    'skråt ned og tilbage',
    'ned',
    'skråt ned og frem',
    'frem',
    'skråt op og frem',
    'op',
    'skråt op og tilbage',
    'tilbage',
  ];
  return words[Math.round((deg + 180) / 45)] ?? 'frem';
}

/** One mark in words: »i »3 sek ned« en pil ned ved brystet«, »ved Nede albuen 90°«. */
function markText(model: FigureModel, plan: MarkPlan, view: string): string {
  const mark = plan.mark;
  const position = model.movement.positions.find((p) => p.id === mark.at);
  const phase = mark.phase === undefined ? undefined : model.movement.phases[mark.phase - 1];
  const when = position ? `ved ${position.name}` : phase ? `i »${phase.label}«` : '';
  const show = plan.shows[0];
  let what: string;
  if ('arrow' in mark) {
    const chord = show?.chord ?? [0, 0];
    what = `en pil ${directionText(model.frame, chord)} ved ${pointName(mark.arrow)}`;
  } else if ('angle' in mark) {
    const part = mark.angle.split('.')[1] ?? '';
    what = `${POINT_NAME[part] ?? part} ${degreesText(mark, show?.measured ?? 0)}`;
  } else if ('line' in mark) {
    what = `en lige linje fra ${pointName(mark.line[0])} til ${pointName(mark.line[1])}${mark.cue ? `: »${mark.cue}«` : ''}`;
  } else {
    const by =
      mark.point !== undefined && !Array.isArray(mark.point) ? ` ved ${pointName(mark.point)}` : '';
    what = `»${mark.cue}«${by}`;
  }
  return [view, when, what].filter(Boolean).join(' ');
}

/**
 * The views and the marks in words, for the figure's text alternative: »Tegnet fra siden og forfra.
 * Markeringer: i »Sæt dig ned« en pil skråt ned og tilbage ved hoften; forfra ved Landing »Knæ over
 * tæer« ved knæet.«
 */
export function viewsAndMarksText(
  views: ReadonlyArray<{ model: FigureModel; plans: readonly MarkPlan[] }>,
): string {
  const sentences: string[] = [];
  if (views.length > 1) {
    const names = views.map((v) => VIEW_NAME[v.model.figure.view].toLocaleLowerCase('da-DK'));
    sentences.push(`Tegnet ${names.join(' og ')}.`);
  }
  const marks = views.flatMap(({ model, plans }, i) =>
    plans.map((plan) =>
      markText(model, plan, i === 0 ? '' : VIEW_NAME[model.figure.view].toLocaleLowerCase('da-DK')),
    ),
  );
  if (marks.length > 0) sentences.push(`Markeringer: ${marks.join('; ')}.`);
  return sentences.join(' ');
}
