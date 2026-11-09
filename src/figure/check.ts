// The figure system's quality checks (docs/SPEC.md 9.1, DECISIONS.md D48 and D56): run on every
// figure by Vitest, by `node scripts/check-explain.ts <figurfil>` after the format check, and drawn on
// the contact sheet (scripts/figure-sheet.ts).
//
// - Joints bend the right way: in side view a knee turns the shin toward the back and an elbow the
//   forearm toward the front, judged from `facing`, in every keyframe and in the frames between. Every
//   leg in side view has a foot (`tip`), and the foot points the way the chest faces.
// - The contacts in the explanation fit the figure: what a position says touches the floor, a wall
//   or a chair does, and nothing else clearly does; nothing goes into a surface. Lying on the back,
//   the belly or the side means that part of the torso touches; the rest may lift.
// - Between the keyframes no joint bends more than in the keyframes on either side, the segments
//   keep their length, and nothing goes into a surface – the body, and the backpack or bottles it
//   carries.
// - Hands and feet that stand on something in two positions in a row stand on the same point, so
//   they do not slide (on a wall or a towel they may, and a phase can lift them: `lift`).
// - A joint the position's text calls straight is straight; a hand or ankle reaches its point; limbs
//   given by their joints have about their length; a red segment is a segment the figure shows.
// The messages are short and in Danish, like the format check's: the figure agents read them.
import { BODY } from '../content/units.ts';
import {
  isFigureLike,
  isBorrowed,
  isLike,
  PAIRED_PARTS,
  type BodyPart,
  type Contact,
  type ExplainFile,
  type FigureFile,
  type FigureItem,
  type OwnMovement,
  type Point,
  type Pose,
  type Position,
  type Prop,
  type Surface,
} from '../content/types.ts';
import type { Problem } from '../content/validate.ts';
import {
  angleOf,
  distance,
  frameOf,
  NOMINAL,
  polar,
  solve,
  spinePoints,
  turn,
  wrap,
  type Bone,
  type Frame,
  type Skeleton,
} from './geometry.ts';
import { carried, outline, propPrims } from './draw.ts';
import { buildModel, movePose, type FigureModel, type Move } from './motion.ts';
import { inRange, nearest, REST, solids, TOUCH, type PointKind, type Solid } from './surfaces.ts';
import { limbOfLift, type LimbId } from './tween.ts';

export { solids, TOUCH, type PointKind, type Solid } from './surfaces.ts';
export { turn } from './geometry.ts';

// ---------------------------------------------------------------------------------------------
// What touches: the points of the body and their ranges
// ---------------------------------------------------------------------------------------------

/** Closer than this is a clear touch: a contact the position must name. */
export const CLEAR: Record<PointKind, number> = {
  hand: 1,
  elbow: 3,
  knee: 3,
  ankle: 2,
  toe: 1,
  hip: 5,
  shoulder: 5,
  head: BODY.headRadius + 0.5,
};

/** The parts that put a point on a surface: an undeclared clear touch is a mistake. */
const GROUPS: Array<{ kind: PointKind; parts: readonly BodyPart[] }> = [
  { kind: 'hand', parts: ['hand', 'forearm'] },
  { kind: 'elbow', parts: ['elbow', 'forearm'] },
  { kind: 'knee', parts: ['knee', 'shin'] },
  { kind: 'ankle', parts: ['foot', 'toes', 'heel', 'shin'] },
  { kind: 'hip', parts: ['hip', 'back', 'belly', 'side'] },
  { kind: 'shoulder', parts: ['shoulders', 'back', 'belly', 'side', 'chest'] },
  { kind: 'head', parts: ['head'] },
];

const PART_NAME: Record<BodyPart, string> = {
  hand: 'hånden',
  forearm: 'underarmen',
  elbow: 'albuen',
  knee: 'knæet',
  shin: 'skinnebenet',
  foot: 'foden',
  toes: 'tæerne',
  heel: 'hælen',
  hip: 'hoften',
  back: 'ryggen',
  belly: 'maven',
  side: 'siden',
  shoulders: 'skuldrene',
  chest: 'brystet',
  head: 'hovedet',
};

const SURFACE_NAME: Record<Surface, string> = {
  floor: 'gulvet',
  wall: 'væggen',
  chair: 'stolen',
  sofa: 'sofaen',
  bed: 'sengen',
  table: 'bordet',
  step: 'trappetrinnet',
  books: 'bøgerne',
  pillow: 'puden',
  towel: 'håndklædet',
};

const KIND_NAME: Record<PointKind, string> = {
  hand: 'hånd',
  elbow: 'albue',
  knee: 'knæ',
  ankle: 'fod',
  toe: 'tå',
  hip: 'hofte',
  shoulder: 'skulder',
  head: 'hoved',
};

const KIND_PLURAL: Record<PointKind, string> = {
  hand: 'hænder',
  elbow: 'albuer',
  knee: 'knæ',
  ankle: 'fødder',
  toe: 'fødder',
  hip: 'hofter',
  shoulder: 'skuldre',
  head: 'hoveder',
};

const num = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');

function nearestOf(solidsOn: readonly Solid[], p: Point): number {
  return nearest(solidsOn, p);
}

/** The points of a part on one limb, each with the kind whose range it must be in. */
function partPoints(part: BodyPart, bone: Bone): Array<{ p: Point; kind: PointKind }> {
  switch (part) {
    case 'hand':
      return [{ p: bone.end, kind: 'hand' }];
    case 'forearm':
      return [
        { p: bone.joint, kind: 'elbow' },
        { p: bone.end, kind: 'elbow' },
      ];
    case 'elbow':
      return [{ p: bone.joint, kind: 'elbow' }];
    case 'knee':
      return [{ p: bone.joint, kind: 'knee' }];
    case 'shin':
      return [
        { p: bone.joint, kind: 'knee' },
        { p: bone.end, kind: 'ankle' },
      ];
    case 'foot':
      return bone.tip
        ? [
            { p: bone.end, kind: 'ankle' },
            { p: bone.tip, kind: 'toe' },
          ]
        : [{ p: bone.end, kind: 'ankle' }];
    case 'toes':
      return bone.tip ? [{ p: bone.tip, kind: 'toe' }] : [{ p: bone.end, kind: 'ankle' }];
    case 'heel':
      return [{ p: bone.end, kind: 'ankle' }];
    default:
      return [];
  }
}

/** Whether one limb touches with `part`. A hand touches with the wrist or the fingers. */
function limbTouches(part: BodyPart, bone: Bone, on: readonly Solid[]): boolean {
  if (on.length === 0) return false;
  const d = (p: Point) => nearestOf(on, p);
  if (part === 'hand') {
    return inRange(d(bone.end), 'hand') || (!!bone.tip && inRange(d(bone.tip), 'hand'));
  }
  return partPoints(part, bone).every((x) => inRange(d(x.p), x.kind));
}

/**
 * How far a limb's part is from touching: the point furthest from where it rests, + above the
 * surface, − into it (beyond what counts).
 */
function missBy(part: BodyPart, bone: Bone, on: readonly Solid[]): number {
  const points = part === 'hand' && bone.tip ? [{ p: bone.tip, kind: 'hand' as const }] : [];
  const all = [...partPoints(part, bone), ...points];
  let worst = 0;
  for (const { p, kind } of all) {
    const d = nearestOf(on, p);
    const off = d < TOUCH[kind][0] ? d - TOUCH[kind][0] : d > TOUCH[kind][1] ? d - REST[kind] : 0;
    if (Math.abs(off) > Math.abs(worst)) worst = off;
  }
  return worst;
}

/** The torso as the points along the back (hip to shoulder; the curve when the back is round). */
function torsoPoints(frame: Frame, s: Skeleton): Point[] {
  return spinePoints(frame, s);
}

/** Whether a part without a pair touches: the seat, the shoulders, the head, or lying on the torso. */
function bodyTouches(frame: Frame, part: BodyPart, s: Skeleton, on: readonly Solid[]): boolean {
  if (on.length === 0) return false;
  const d = (p: Point) => nearestOf(on, p);
  switch (part) {
    case 'hip':
      return inRange(d(s.hip), 'hip');
    case 'back':
    case 'belly':
    case 'side':
      // Lying on it: that part of the torso touches somewhere; the rest may lift (DECISIONS.md D56).
      return torsoPoints(frame, s).some((p) => inRange(d(p), 'shoulder'));
    case 'shoulders':
    case 'chest':
      return inRange(d(s.shoulder), 'shoulder');
    case 'head':
      return inRange(d(s.head), 'head');
    default:
      return false;
  }
}

function bodyDistance(frame: Frame, part: BodyPart, s: Skeleton, on: readonly Solid[]): number {
  const d = (p: Point) => nearestOf(on, p);
  switch (part) {
    case 'hip':
      return d(s.hip) - REST.hip;
    case 'back':
    case 'belly':
    case 'side':
      return Math.min(...torsoPoints(frame, s).map(d)) - REST.shoulder;
    case 'shoulders':
    case 'chest':
      return d(s.shoulder) - REST.shoulder;
    case 'head':
      return d(s.head) - REST.head;
    default:
      return 0;
  }
}

const ARM_PARTS = new Set<BodyPart>(['hand', 'forearm', 'elbow']);
const paired = (part: BodyPart) => (PAIRED_PARTS as readonly string[]).includes(part);

/** A contact in a position and whether the figure keeps it. */
export interface ContactResult {
  contact: Contact;
  ok: boolean;
  /** The points that were checked, for the contact sheet's rings. */
  points: Point[];
}

export interface PoseReport {
  contacts: ContactResult[];
  problems: string[];
}

function pointsOf(
  frame: Frame,
  part: BodyPart,
  s: Skeleton,
  bones: readonly Bone[],
  on: readonly Solid[],
): Point[] {
  switch (part) {
    case 'hand':
    case 'heel':
      return bones.map((b) => b.end);
    case 'toes':
      return bones.map((b) => b.tip ?? b.end);
    case 'foot':
      return bones.flatMap((b) => (b.tip ? [b.end, b.tip] : [b.end]));
    case 'forearm':
    case 'shin':
      return bones.flatMap((b) => [b.joint, b.end]);
    case 'elbow':
    case 'knee':
      return bones.map((b) => b.joint);
    case 'hip':
      return [s.hip];
    case 'back':
    case 'belly':
    case 'side': {
      // The point of the torso nearest the surface: the one that touches.
      const points = torsoPoints(frame, s);
      const d = (p: Point) => (on.length > 0 ? nearestOf(on, p) : p[1]);
      return [points.reduce((best, p) => (d(p) < d(best) ? p : best), points[0] as Point)];
    }
    case 'shoulders':
    case 'chest':
      return [s.shoulder];
    case 'head':
      return [s.head];
  }
}

/** The body's points of one kind, with the limb they belong to. */
function bodyPoints(frame: Frame, s: Skeleton, kind: PointKind): Array<{ limb: string; p: Point }> {
  const arms = s.bones.filter((b) => b.kind === 'arm');
  const legs = s.bones.filter((b) => b.kind === 'leg');
  switch (kind) {
    case 'hand':
      return arms.flatMap((b) => [
        { limb: `${b.side}.hand`, p: b.end },
        ...(b.tip ? [{ limb: `${b.side}.hand`, p: b.tip }] : []),
      ]);
    case 'elbow':
      return arms.map((b) => ({ limb: `${b.side}.elbow`, p: b.joint }));
    case 'knee':
      return legs.map((b) => ({ limb: `${b.side}.knee`, p: b.joint }));
    case 'ankle':
      return legs.map((b) => ({ limb: `${b.side}.foot`, p: b.end }));
    case 'toe':
      return legs.flatMap((b) => (b.tip ? [{ limb: `${b.side}.foot`, p: b.tip }] : []));
    case 'hip':
      // A round back: the points along it count as the hip for what goes into a surface.
      return [
        { limb: 'hip', p: s.hip },
        ...(s.spine !== 0
          ? torsoPoints(frame, s)
              .slice(1, -1)
              .map((p) => ({ limb: 'ryg', p }))
          : []),
      ];
    case 'shoulder':
      return [{ limb: 'shoulder', p: s.shoulder }];
    case 'head':
      return [{ limb: 'head', p: s.head }];
  }
}

const POINT_NAME: Record<string, string> = { ryg: 'ryggen' };

/** What goes more than allowed into a surface in a frame: name, surface and depth. */
function intoSurfaces(
  frame: Frame,
  s: Skeleton,
  all: readonly Solid[],
): Array<{ limb: string; kind: PointKind; on: Surface; depth: number }> {
  const found: Array<{ limb: string; kind: PointKind; on: Surface; depth: number }> = [];
  for (const k of Object.keys(TOUCH) as PointKind[]) {
    for (const { limb, p } of bodyPoints(frame, s, k)) {
      for (const x of all) {
        const d = x.sdf(p);
        if (d < TOUCH[k][0]) {
          // The head is a circle round its centre; the other points sit on the surface.
          found.push({ limb, kind: k, on: x.on, depth: k === 'head' ? BODY.headRadius - d : -d });
        }
      }
    }
  }
  return found;
}

const pointName = (limb: string, kind: PointKind) =>
  POINT_NAME[limb] ?? (limb.includes('.') ? limb : KIND_NAME[kind]);

/** The contacts of one position checked against its keyframe. */
export function evaluatePose(
  figure: FigureItem,
  pose: Pose,
  contacts: readonly Contact[],
  frame: Frame = frameOf(figure),
): PoseReport {
  const s = solve(frame, pose);
  const all = solids(figure, s);
  const problems: string[] = [];
  const results: ContactResult[] = [];
  if (figure.view === 'top') return { contacts: [], problems }; // the floor is the picture itself

  for (const c of contacts) {
    const on = all.filter((x) => x.on === c.on);
    const kind = ARM_PARTS.has(c.part) ? 'arm' : 'leg';
    const bones = paired(c.part) ? s.bones.filter((b) => b.kind === kind) : [];
    // One of two (count 1): ring the limb that touches, not the free one.
    const touchingBones = bones.filter((b) => on.length > 0 && limbTouches(c.part, b, on));
    const ringed = c.count === 1 && touchingBones.length > 0 ? touchingBones : bones;
    const points = pointsOf(frame, c.part, s, ringed, on);
    if (on.length === 0) {
      results.push({ contact: c, ok: false, points });
      continue; // the format check reports a surface without its prop
    }
    let ok: boolean;
    const surface = SURFACE_NAME[c.on];
    const how = (d: number) =>
      d < 0
        ? `går ${num(-d)} ind i ${surface}`
        : `er ${num(d)} ${c.on === 'floor' ? 'over' : 'fra'}`;
    if (paired(c.part)) {
      if (bones.length === 0) {
        problems.push(`${PART_NAME[c.part]} skal røre ${surface}, men begge er skjult (null)`);
        results.push({ contact: c, ok: false, points });
        continue;
      }
      const touching = touchingBones.length;
      const count = c.count ?? 2;
      ok = count === 2 ? touching === bones.length : touching >= 1;
      if (!ok) {
        const part = c.part === 'toes' ? 'toes' : c.part;
        const off = bones.filter((b) => !touchingBones.includes(b));
        if (count === 2) {
          // Each limb that does not touch, with its own distance (L3).
          for (const b of off) {
            problems.push(
              `${b.side}.${part} skal røre ${surface}, men ${how(missBy(c.part, b, on))} (${touching} af ${bones.length} gør)`,
            );
          }
        } else {
          const each = off.map((b) => `${b.side}.${part} ${how(missBy(c.part, b, on))}`);
          problems.push(`${PART_NAME[c.part]} (én) skal røre ${surface}, men ${each.join(' og ')}`);
        }
      }
    } else {
      ok = bodyTouches(frame, c.part, s, on);
      if (!ok) {
        problems.push(
          `${PART_NAME[c.part]} skal røre ${surface}, men ${how(bodyDistance(frame, c.part, s, on))}`,
        );
      }
    }
    results.push({ contact: c, ok, points });
  }

  // Nothing touches clearly that the position does not name, and nothing goes into a surface.
  const surfaces = [...new Set(all.map((x) => x.on))];
  for (const on of surfaces) {
    const these = all.filter((x) => x.on === on);
    for (const g of GROUPS) {
      const declared = contacts.filter((c) => c.on === on && g.parts.includes(c.part));
      const allowed = Math.min(
        2,
        declared.reduce((n, c) => n + (paired(c.part) ? (c.count ?? 2) : 2), 0),
      );
      const kinds: PointKind[] = g.kind === 'ankle' ? ['ankle', 'toe'] : [g.kind];
      const clear = new Map<string, number>();
      for (const k of kinds) {
        for (const { limb, p } of bodyPoints(frame, s, k)) {
          if (limb === 'ryg') continue;
          const d = nearestOf(these, p);
          if (d <= CLEAR[k]) clear.set(limb, Math.min(clear.get(limb) ?? Infinity, d));
        }
      }
      if (clear.size > allowed && allowed > 0) {
        // One of two named (count 1), and both touch.
        problems.push(
          `begge ${KIND_PLURAL[g.kind]} rører ${SURFACE_NAME[on]}, men positionen siger én: løft den ene`,
        );
      } else if (clear.size > allowed) {
        const [limb, d] = [...clear.entries()].sort((a, b) => a[1] - b[1])[0] ?? ['', 0];
        const name = limb.includes('.') ? limb : KIND_NAME[g.kind];
        problems.push(
          `${name} rører ${SURFACE_NAME[on]} (${num(d)} fra), men positionen siger det ikke: flyt den, eller tilføj kontakten i forklaringen`,
        );
      }
    }
  }
  for (const x of intoSurfaces(frame, s, all)) {
    problems.push(`${pointName(x.limb, x.kind)} går ${num(x.depth)} ind i ${SURFACE_NAME[x.on]}`);
  }
  for (const message of propProblems(figure, frame, s, all)) problems.push(message);
  return { contacts: results, problems: [...new Set(problems)] };
}

/** Carried props and a backpack on the floor are boxes that must not go into a surface (M1). */
const PROP_NAME: Record<string, string> = {
  backpack: 'rygsækken',
  bottles: 'flasken',
};

function propProblems(
  figure: FigureItem,
  frame: Frame,
  s: Skeleton,
  all: readonly Solid[],
): string[] {
  const boxes = (p: Prop) => p.type === 'backpack' || p.type === 'bottles';
  if (!figure.props.some(boxes)) return [];
  const prims = propPrims(figure.props, s, { x0: 0, x1: 0, top: 0 }, frame.facing, 'solid', boxes);
  // A towel that slides under a hand or foot lies on the floor; nothing else rests on it.
  const fixed = all.filter((x) => {
    const prop = x.prop >= 0 ? figure.props[x.prop] : undefined;
    return !(prop && carried(prop));
  });
  const problems: string[] = [];
  for (const prim of prims) {
    const index = Number(prim.key.slice(4).split('.')[0]);
    const prop = figure.props[index];
    if (!prop) continue;
    let worst: { depth: number; on: Surface } | null = null;
    for (const p of outline(prim)) {
      for (const x of fixed) {
        const d = x.sdf(p);
        if (d < -1.5 && (!worst || -d > worst.depth)) worst = { depth: -d, on: x.on };
      }
    }
    if (worst) {
      problems.push(
        `${PROP_NAME[prop.type] ?? prop.type} går ${num(worst.depth)} ind i ${SURFACE_NAME[worst.on]}`,
      );
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------
// Limbs: bending, reach, length, feet
// ---------------------------------------------------------------------------------------------

/** A straight limb may overstretch this much the wrong way (knees and elbows can, a little). */
export const HYPEREXTENSION = 8;

/** Between two keyframes a joint may bend this much more than in either of them. */
export const BEND_SLACK = 8;

/** A joint the text calls straight turns at most this much. */
export const STRAIGHT = 5;

const limbName = (b: Pick<Bone, 'side' | 'kind'>) =>
  `${b.side}.${b.kind === 'leg' ? 'legs' : 'arms'}`;
const jointName = (b: Pick<Bone, 'kind'>) => (b.kind === 'leg' ? 'knæet' : 'albuen');

/**
 * The bend problems of a frame in side view: a knee or an elbow that bends the wrong way, and a
 * foot that points backward. An arm with its own `bend` over the head (`flip`, a handstand) may turn
 * its elbow the other way; `flipped` names such arms in frames between keyframes.
 */
export function bendProblems(
  frame: Frame,
  s: Skeleton,
  flipped: ReadonlySet<string> = new Set(),
): string[] {
  if (frame.view !== 'side' || frame.facing === null) return [];
  const problems: string[] = [];
  for (const b of s.bones) {
    const t = turn(b.root, b.joint, b.end) * frame.facing;
    const flip = b.flip === true || flipped.has(`${b.side}.${b.kind}`);
    // Knees turn clockwise (facing 1), elbows counterclockwise.
    const wrong =
      b.kind === 'leg' ? t > HYPEREXTENSION : flip ? t > HYPEREXTENSION : t < -HYPEREXTENSION;
    if (wrong) {
      problems.push(
        `${limbName(b)}: ${jointName(b)} bøjer den forkerte vej (${num(Math.abs(t))}°); tjek »facing« og leddene`,
      );
    }
    if (b.kind === 'leg' && b.tip) {
      // The foot points forward from the shin: it turns the same way as the elbow.
      const foot = turn(b.joint, b.end, b.tip) * frame.facing;
      if (foot < -10) {
        problems.push(
          `${b.side}.legs: foden peger bagud (${num(-foot)}°); tæerne skal pege samme vej som brystet`,
        );
      }
    }
  }
  return problems;
}

function limbProblems(s: Skeleton): string[] {
  const problems: string[] = [];
  for (const b of s.bones) {
    if (b.short > 1) {
      problems.push(
        `${limbName(b)} når ikke sit punkt: ${num(b.short)} for langt; flyt »to« tættere på ${b.kind === 'arm' ? 'skulderen' : 'hoften'}`,
      );
    }
  }
  return problems;
}

function jointLimbProblems(pose: Pose, s: Skeleton): string[] {
  const problems: string[] = [];
  for (const kind of ['arms', 'legs'] as const) {
    for (const side of ['near', 'far'] as const) {
      const limb = pose[kind][side];
      if (!limb || !('joint' in limb)) continue;
      const b = s.bones.find(
        (x) => x.side === side && x.kind === (kind === 'arms' ? 'arm' : 'leg'),
      );
      if (!b) continue;
      const nominal = NOMINAL[b.kind];
      for (const [segment, length, want] of [
        ['overarm/lår', distance(b.root, b.joint), nominal.upper],
        ['underarm/skinneben', distance(b.joint, b.end), nominal.lower],
      ] as const) {
        if (length < want / 2 || length > want * 1.15) {
          problems.push(
            `${side}.${kind}: ${segment} er ${num(length)} lang (normalt ${want}); flyt »joint« eller »end«`,
          );
        }
      }
    }
  }
  return problems;
}

/** A hip bends back (extends) at most this much; more means the chest faces the other way. */
export const HIP_EXTENSION = 70;

/**
 * Side view: a thigh more than HIP_EXTENSION behind the body, which no hip can do – the figure's
 * `facing` is the wrong way round (M1), even when the feet were mirrored with it.
 */
function hipProblems(frame: Frame, pose: Pose, s: Skeleton): string[] {
  if (frame.view !== 'side' || frame.facing === null) return [];
  const problems: string[] = [];
  for (const b of s.bones) {
    if (b.kind !== 'leg') continue;
    const back = -wrap((angleOf(b.root, b.joint) - pose.torso - 180) * frame.facing);
    if (back > HIP_EXTENSION) {
      problems.push(
        `${limbName(b)}: låret står ${num(back)}° bag kroppen, mere end en hofte kan; tjek »facing« (brystets retning)`,
      );
    }
  }
  return problems;
}

/** Side view: an arm's own `bend` only with the arm over the head (a handstand, a pike), D56. */
function armBendProblems(frame: Frame, pose: Pose, s: Skeleton): string[] {
  if (frame.view !== 'side') return [];
  const problems: string[] = [];
  for (const side of ['near', 'far'] as const) {
    const limb = pose.arms[side];
    if (!limb || 'joint' in limb || limb.bend === undefined) continue;
    const b = s.bones.find((x) => x.side === side && x.kind === 'arm');
    if (!b) continue;
    const up = polar([0, 0], 1, pose.torso);
    const hand: Point = [b.end[0] - b.root[0], b.end[1] - b.root[1]];
    if (up[0] * hand[0] + up[1] * hand[1] <= 0) {
      problems.push(
        `${side}.arms: »bend« i sidebilledet kun med armen over hovedet (håndstand, pike); ellers bøjer albuen selv`,
      );
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------
// Straight joints in the text (M2)
// ---------------------------------------------------------------------------------------------

/** What a position's text says is straight: arms or legs, both or (at least) one. */
export function straightInText(
  text: string,
): Array<{ kind: 'arm' | 'leg'; both: boolean; words: string }> {
  const found: Array<{ kind: 'arm' | 'leg'; both: boolean; words: string }> = [];
  const t = text.toLocaleLowerCase('da-DK');
  const rules: Array<[RegExp, 'arm' | 'leg', boolean]> = [
    [/(?<!næsten |let )\bstrakte arme\b/, 'arm', true],
    [/\b(?:armene|begge arme|arme) (?:er )?(?:stadig )?strakte?\b/, 'arm', true],
    [/(?<!næsten |let )\bstrakte albuer\b/, 'arm', true],
    [/\balbuerne (?:er )?(?:stadig )?strakte?\b/, 'arm', true],
    [/(?<!næsten |let )\bstrakt arm\b/, 'arm', false],
    [/\barm (?:er )?(?:stadig )?strakt\b/, 'arm', false],
    [/(?<!næsten |let )\bstrakte ben\b/, 'leg', true],
    [/\bbenene (?:er )?(?:stadig )?strakte?\b/, 'leg', true],
    [/(?<!næsten |let )\bstrakte knæ\b/, 'leg', true],
    [/\bknæene (?:er )?(?:stadig )?strakte?\b/, 'leg', true],
    [/\bknæ og hofte er strakte\b/, 'leg', true],
    [/(?<!næsten |let )\bstrakt knæ\b/, 'leg', false],
    [/\bknæet (?:er )?(?:stadig )?strakt\b/, 'leg', false],
    [/\bben (?:er )?(?:løftet )?strakt\b/, 'leg', false],
    [/(?<!næsten |let )\bstrakt ben\b/, 'leg', false],
  ];
  for (const [re, kind, both] of rules) {
    const m = t.match(re);
    if (m) found.push({ kind, both, words: m[0] });
  }
  return found;
}

function straightProblems(position: Position, s: Skeleton): string[] {
  const problems: string[] = [];
  const said = straightInText(`${position.name}. ${position.text}`);
  for (const kind of ['arm', 'leg'] as const) {
    const these = said.filter((x) => x.kind === kind);
    if (these.length === 0) continue;
    const both = these.some((x) => x.both);
    const words = (these.find((x) => x.both) ?? these[0])?.words ?? '';
    const bones = s.bones.filter((b) => b.kind === kind);
    if (bones.length === 0) continue;
    const bent = bones.filter((b) => Math.abs(turn(b.root, b.joint, b.end)) > STRAIGHT);
    const fails = both ? bent : bent.length === bones.length ? bent : [];
    for (const b of fails) {
      const angle = Math.abs(turn(b.root, b.joint, b.end));
      problems.push(
        `teksten siger »${words}«, men ${limbName(b)} er bøjet ${num(angle)}°: læg »to« på fuld længde (${kind === 'arm' ? 'arm 31 fra skulderen' : 'ben 47 fra hoften'}, op til 1 over)`,
      );
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------
// A figure: its keyframes, the frames between them, and the hands and feet that must not slide
// ---------------------------------------------------------------------------------------------

/** The moves between two different positions, one of each kind (repeats share one). */
function distinctSteps(model: FigureModel): Move[] {
  const seen = new Set<string>();
  const moves: Move[] = [];
  for (const m of model.timeline.moves) {
    if (m.from === m.to || !model.steps.has(m)) continue;
    const shift = m.shift ? m.shift[1] - m.shift[0] : 0;
    const key = `${m.from}>${m.to}>${shift}>${(m.lift ?? []).join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    moves.push(m);
  }
  return moves;
}

const SEGMENT = { arm: ['overarmen', 'underarmen'], leg: ['låret', 'skinnebenet'] } as const;

/** The frames between two keyframes: bending, length and surfaces (H1). */
function betweenProblems(figure: FigureItem, model: FigureModel, move: Move): string[] {
  const step = model.steps.get(move);
  if (!step) return [];
  const frame = model.frame;
  const a = step.a.skeleton;
  const b = step.b.skeleton;
  const flipped = new Set(
    [...a.bones, ...b.bones].filter((x) => x.flip).map((x) => `${x.side}.${x.kind}`),
  );
  const worst = new Map<string, { value: number; message: (v: number) => string }>();
  const note = (key: string, value: number, message: (v: number) => string) => {
    const old = worst.get(key);
    if (!old || value > old.value) worst.set(key, { value, message });
  };
  // A message's number (degrees or depth), so each problem is told once, at its worst.
  const amount = (message: string) =>
    Number((/(\d+(?:,\d+)?)/.exec(message)?.[1] ?? '0').replace(',', '.'));
  const worstOf = (message: string, key: string) => note(key, amount(message), () => message);
  for (let k = 1; k < 8; k++) {
    const pose = movePose(model, move, k / 8);
    const s = solve(frame, pose);
    for (const message of bendProblems(frame, s, flipped)) {
      worstOf(message, `way:${message.replace(/\(\d+(?:,\d+)?°\)/, '')}`);
    }
    for (const bone of s.bones) {
      const ka = a.bones.find((x) => x.side === bone.side && x.kind === bone.kind);
      const kb = b.bones.find((x) => x.side === bone.side && x.kind === bone.kind);
      if (!ka || !kb) continue;
      const id = `${bone.side}.${bone.kind}`;
      // No joint bends more than in the keyframes on either side.
      const bend = Math.abs(turn(bone.root, bone.joint, bone.end));
      const ba = Math.abs(turn(ka.root, ka.joint, ka.end));
      const bb = Math.abs(turn(kb.root, kb.joint, kb.end));
      const most = Math.max(ba, bb);
      if (bend > most + BEND_SLACK) {
        note(`bend:${id}`, bend - most, (v) =>
          most <= 10
            ? `${limbName(bone)}: ${jointName(bone)} bøjer ${num(v)}° mellem to strakte positioner`
            : `${limbName(bone)}: ${jointName(bone)} bøjer ${num(v)}° mere end i positionerne`,
        );
      }
      // The segments keep their length.
      const lengths: Array<[number, number, number]> = [
        [distance(bone.root, bone.joint), distance(ka.root, ka.joint), distance(kb.root, kb.joint)],
        [distance(bone.joint, bone.end), distance(ka.joint, ka.end), distance(kb.joint, kb.end)],
      ];
      lengths.forEach(([now, la, lb], i) => {
        const off = now < Math.min(la, lb) ? Math.min(la, lb) - now : now - Math.max(la, lb);
        if (off > 0.5) {
          note(
            `len:${id}:${i}`,
            off,
            () =>
              `${limbName(bone)}: ${SEGMENT[bone.kind][i]} er ${num(now)} lang (${num(Math.min(la, lb))}${Math.abs(la - lb) > 0.05 ? `–${num(Math.max(la, lb))}` : ''} i positionerne)`,
          );
        }
      });
    }
    // Nothing goes into a surface: the body and what it carries (seen from above, the body lies on
    // the floor and its props, so nothing is checked).
    if (figure.view === 'top') continue;
    const all = solids(figure, s);
    for (const x of intoSurfaces(frame, s, all)) {
      note(
        `into:${x.limb}:${x.on}`,
        x.depth,
        (v) => `${pointName(x.limb, x.kind)} går ${num(v)} ind i ${SURFACE_NAME[x.on]}`,
      );
    }
    for (const message of propProblems(figure, frame, s, all)) {
      worstOf(message, `prop:${message.split(' ')[0] ?? ''}`);
    }
  }
  return [...worst.values()].map((w) => `undervejs: ${w.message(w.value)}`);
}

/** A joint that bends to one side in one position and to the other in the next (M1). */
function sideProblems(model: FigureModel, move: Move): string[] {
  const step = model.steps.get(move);
  if (!step) return [];
  const problems: string[] = [];
  for (const ka of step.a.skeleton.bones) {
    const kb = step.b.skeleton.bones.find((x) => x.side === ka.side && x.kind === ka.kind);
    if (!kb) continue;
    const ta = turn(ka.root, ka.joint, ka.end);
    const tb = turn(kb.root, kb.joint, kb.end);
    if (Math.abs(ta) >= 10 && Math.abs(tb) >= 10 && Math.sign(ta) !== Math.sign(tb)) {
      problems.push(
        `${limbName(ka)}: ${jointName(ka)} bøjer til hver sin side i de to positioner og skifter side undervejs; giv dem samme »bend«`,
      );
    }
  }
  return problems;
}

/** Contacts on the same surface in two positions in a row: the hand or foot must not slide. */
function slideProblems(
  figure: FigureItem,
  movement: OwnMovement,
  model: FigureModel,
): Array<{ where: string; message: string }> {
  const problems: Array<{ where: string; message: string }> = [];
  const positions = new Map(movement.positions.map((p) => [p.id, p]));
  const carriedOn = new Set<string>(
    figure.props.flatMap((p) => (p.type === 'towel' && 'attach' in p ? [p.attach] : [])),
  );
  for (const move of distinctSteps(model)) {
    const step = model.steps.get(move);
    // The way back to the start is not a phase of the exercise: it may slide.
    if (!step || move.phase === null) continue;
    const lifted = new Set<LimbId>((move.lift ?? []).map(limbOfLift));
    const [x, y] = [move.from, move.to].sort() as [string, string];
    const where = `${x} → ${y}`;
    const ca = positions.get(move.from)?.contacts ?? [];
    const cb = positions.get(move.to)?.contacts ?? [];
    const sa = step.a.skeleton;
    const sb = step.b.skeleton;
    const soa = solids(figure, sa);
    const sob = solids(figure, sb);
    for (const ba of sa.bones) {
      const bb = sb.bones.find((q) => q.side === ba.side && q.kind === ba.kind);
      if (!bb || lifted.has(`${ba.side}.${ba.kind}`)) continue;
      const anchor = `${ba.side}.${ba.kind === 'arm' ? 'hand' : 'foot'}`;
      if (carriedOn.has(anchor)) continue; // a towel under it slides on purpose
      const checks: Array<[Point, Point, 'hand' | 'ankle' | 'toe', readonly BodyPart[]]> =
        ba.kind === 'arm'
          ? [[ba.end, bb.end, 'hand', ['hand', 'forearm']]]
          : [
              [ba.end, bb.end, 'ankle', ['foot', 'heel', 'shin']],
              ...(ba.tip && bb.tip
                ? [[ba.tip, bb.tip, 'toe', ['foot', 'toes']] as [Point, Point, 'toe', BodyPart[]]]
                : []),
            ];
      for (const [p, q, kind, parts] of checks) {
        for (const surface of new Set(soa.map((s) => s.on))) {
          if (surface === 'wall') continue; // sliding along a wall is part of the movement
          const named = (cs: readonly Contact[]) =>
            cs.some((c) => c.on === surface && parts.includes(c.part));
          if (!named(ca) || !named(cb)) continue;
          const da = nearestOf(
            soa.filter((s) => s.on === surface),
            p,
          );
          const db = nearestOf(
            sob.filter((s) => s.on === surface),
            q,
          );
          if (!inRange(da, kind) || !inRange(db, kind)) continue;
          const moved = distance(p, q);
          if (moved > 1) {
            problems.push({
              where,
              message: `${anchor} glider ${num(moved)} på ${SURFACE_NAME[surface]}; giv den samme punkt i begge positioner, eller løft den (»transitions« med »lift«)`,
            });
          }
        }
      }
    }
  }
  return problems;
}

/** Every problem of one figure (one movement of an item). `where` starts each message's place. */
export function checkFigure(figure: FigureItem, movement: OwnMovement, where: string): Problem[] {
  const frame = frameOf(figure);
  const problems: Problem[] = [];
  const add = (place: string, message: string) =>
    problems.push({ where: place ? `${where} › ${place}` : where, message });

  // Hands and feet: a tip in every keyframe or in none, so it never pops in and out; in side view
  // every leg has a foot, so the foot's direction shows `facing` (M1).
  for (const kind of ['arms', 'legs'] as const) {
    for (const side of ['near', 'far'] as const) {
      const tips = movement.positions.map((p) => {
        const limb = figure.keyframes[p.id]?.[kind][side];
        return limb ? limb.tip !== undefined : null;
      });
      const shown = tips.filter((t) => t !== null);
      if (shown.length > 0 && shown.some((t) => t !== shown[0])) {
        add('', `${side}.${kind} har »tip« i nogle positioner og ikke i andre`);
      } else if (kind === 'legs' && frame.view === 'side' && shown.length > 0 && !shown[0]) {
        add(
          '',
          `${side}.legs mangler »tip«: i sidebilledet har hvert synligt ben en fod, så tæerne viser, hvilken vej brystet vender`,
        );
      }
    }
  }
  // A red segment is one the figure shows.
  const first = figure.keyframes[movement.positions[0]?.id ?? ''];
  if (first) {
    for (const h of figure.highlight) {
      if (h === 'torso' || h === 'neck') continue;
      const [side, segment] = h.split('.') as ['near' | 'far', string];
      const kind = segment === 'upperArm' || segment === 'forearm' ? 'arms' : 'legs';
      if (first[kind][side] === null)
        add('highlight', `»${h}« er rød, men ${side}.${kind} er skjult`);
    }
  }

  for (const position of movement.positions) {
    const pose = figure.keyframes[position.id];
    if (!pose) continue;
    const s = solve(frame, pose);
    for (const message of [
      ...bendProblems(frame, s),
      ...hipProblems(frame, pose, s),
      ...armBendProblems(frame, pose, s),
      ...limbProblems(s),
      ...jointLimbProblems(pose, s),
      ...straightProblems(position, s),
      ...evaluatePose(figure, pose, position.contacts, frame).problems,
    ]) {
      add(position.id, message);
    }
  }

  // The frames between the keyframes (H1).
  const model = buildModel(figure, movement);
  for (const move of distinctSteps(model)) {
    const place = `${move.from} → ${move.to}`;
    for (const message of [...sideProblems(model, move), ...betweenProblems(figure, model, move)]) {
      add(place, message);
    }
  }

  for (const p of slideProblems(figure, movement, model)) add(p.where, p.message);
  return dedupe(problems);
}

function dedupe(problems: Problem[]): Problem[] {
  const seen = new Set<string>();
  return problems.filter((p) => {
    const key = `${p.where}\n${p.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The figure's movement in the explanation, or null when it has none of its own. */
export function movementFor(
  explain: ExplainFile,
  id: string,
  movement: string | undefined,
): OwnMovement | null {
  const entry = explain.items.find((e) => e.id === id);
  if (!entry || isLike(entry)) return null;
  const m =
    entry.movements.length === 1 && movement === undefined
      ? entry.movements[0]
      : entry.movements.find((x) => x.id === movement);
  return m && !isBorrowed(m) ? m : null;
}

/**
 * The quality problems of a figure file whose format is valid (validateFigureFile), checked against
 * its explanation. A figure drawn »like« another is checked as that one.
 */
export function checkFigureFile(file: FigureFile, explain: ExplainFile): Problem[] {
  const problems: Problem[] = [];
  for (const entry of file.figures) {
    if (isFigureLike(entry)) continue;
    const movement = movementFor(explain, entry.id, entry.movement);
    if (!movement) continue;
    const where = entry.movement ? `${entry.id} › ${entry.movement}` : entry.id;
    problems.push(...checkFigure(entry, movement, where));
  }
  return problems;
}

/** The interior angle of a knee or an elbow in degrees: 180 = straight. */
export function jointDegrees(b: Pick<Bone, 'root' | 'joint' | 'end'>): number {
  return 180 - Math.abs(turn(b.root, b.joint, b.end));
}
