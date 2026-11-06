// The figure system's quality checks (docs/SPEC.md 9.1, DECISIONS.md D48): run on every figure by
// Vitest, by `node scripts/check-explain.ts <figurfil>` after the format check, and drawn on the
// contact sheet (scripts/figure-sheet.ts).
//
// - Joints bend the right way: in side view a knee turns the shin toward the back and an elbow the
//   forearm toward the front, judged from `facing`, in every keyframe and in the frames between.
// - The contacts in the explanation fit the figure: what a position says touches the floor, a wall
//   or a chair does, and nothing else clearly does; nothing goes into a surface.
// - Hands and feet that stand on something in two positions in a row stand on the same point, so
//   they do not slide (on a wall they may: wall slides, the back in a wall sit).
// - A hand or ankle reaches its point, limbs given by their joints have about their length, a foot
//   points forward, and a red segment is a segment the figure shows.
// The messages are short and in Danish, like the format check's: the figure agents read them.
import {
  BODY,
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
  type Prop,
  type Surface,
} from '../content/types.ts';
import type { Problem } from '../content/validate.ts';
import {
  cross,
  distance,
  frameOf,
  NOMINAL,
  solve,
  sub,
  type Bone,
  type Frame,
  type Skeleton,
} from './geometry.ts';
import { SOFA_LOW } from './draw.ts';
import { buildModel, lerpPose, ease } from './motion.ts';

// ---------------------------------------------------------------------------------------------
// Surfaces as solids: a signed distance, positive outside
// ---------------------------------------------------------------------------------------------

export interface Solid {
  on: Surface;
  /** The prop's index in the figure's props, or -1 for the floor. */
  prop: number;
  sdf: (p: Point) => number;
}

function boxSdf(p: Point, x: number, y: number, w: number, h: number): number {
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

/** The surfaces a body can touch in a frame: the floor (not seen from above) and the props. */
export function solids(figure: FigureItem, s: Skeleton): Solid[] {
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
          const end = anchorEnd(s, prop.attach);
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

// ---------------------------------------------------------------------------------------------
// What touches: the points of the body and their ranges
// ---------------------------------------------------------------------------------------------

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

const inRange = (d: number, kind: PointKind) => d >= TOUCH[kind][0] && d <= TOUCH[kind][1];

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

function nearest(solidsOn: readonly Solid[], p: Point): number {
  return Math.min(...solidsOn.map((x) => x.sdf(p)));
}

/** Whether one limb (or the body, for parts without a pair) touches with `part`. */
function partTouches(
  part: BodyPart,
  s: Skeleton,
  bone: Bone | null,
  on: readonly Solid[],
): boolean {
  if (on.length === 0) return false;
  const d = (p: Point) => nearest(on, p);
  switch (part) {
    case 'hand':
      return (
        !!bone && (inRange(d(bone.end), 'hand') || (!!bone.tip && inRange(d(bone.tip), 'hand')))
      );
    case 'forearm':
      return !!bone && inRange(d(bone.joint), 'elbow') && inRange(d(bone.end), 'elbow');
    case 'elbow':
      return !!bone && inRange(d(bone.joint), 'elbow');
    case 'knee':
      return !!bone && inRange(d(bone.joint), 'knee');
    case 'shin':
      return !!bone && inRange(d(bone.joint), 'knee') && inRange(d(bone.end), 'ankle');
    case 'foot':
      return !!bone && inRange(d(bone.end), 'ankle') && (!bone.tip || inRange(d(bone.tip), 'toe'));
    case 'toes':
      return !!bone && (bone.tip ? inRange(d(bone.tip), 'toe') : inRange(d(bone.end), 'ankle'));
    case 'heel':
      return !!bone && inRange(d(bone.end), 'ankle');
    case 'hip':
      return inRange(d(s.hip), 'hip');
    case 'back':
    case 'belly':
    case 'side':
      return inRange(d(s.hip), 'shoulder') && inRange(d(s.shoulder), 'shoulder');
    case 'shoulders':
    case 'chest':
      return inRange(d(s.shoulder), 'shoulder');
    case 'head':
      return inRange(d(s.head), 'head');
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

function pointsOf(part: BodyPart, s: Skeleton, bones: readonly Bone[]): Point[] {
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
    case 'side':
      return [s.hip, s.shoulder];
    case 'shoulders':
    case 'chest':
      return [s.shoulder];
    case 'head':
      return [s.head];
  }
}

/** The body's points of one kind, with the limb they belong to. */
function bodyPoints(s: Skeleton, kind: PointKind): Array<{ limb: string; p: Point }> {
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
      return [{ limb: 'hip', p: s.hip }];
    case 'shoulder':
      return [{ limb: 'shoulder', p: s.shoulder }];
    case 'head':
      return [{ limb: 'head', p: s.head }];
  }
}

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
    const touchingBones = bones.filter((b) => on.length > 0 && partTouches(c.part, s, b, on));
    const ringed = c.count === 1 && touchingBones.length > 0 ? touchingBones : bones;
    const points = pointsOf(c.part, s, ringed);
    if (on.length === 0) {
      results.push({ contact: c, ok: false, points });
      continue; // the format check reports a surface without its prop
    }
    let ok: boolean;
    let what = PART_NAME[c.part];
    if (paired(c.part)) {
      if (bones.length === 0) {
        problems.push(`${what} skal røre ${SURFACE_NAME[c.on]}, men begge er skjult (null)`);
        results.push({ contact: c, ok: false, points });
        continue;
      }
      const touching = touchingBones.length;
      const count = c.count ?? 2;
      ok = count === 2 ? touching === bones.length : touching >= 1;
      if (!ok) {
        what = count === 2 && bones.length === 2 ? `${what} (begge)` : what;
        const d = Math.min(...points.map((p) => nearest(on, p)));
        problems.push(
          `${what} skal røre ${SURFACE_NAME[c.on]}, men er ${num(d)} fra (${touching} af ${bones.length} gør)`,
        );
      }
    } else {
      ok = partTouches(c.part, s, null, on);
      if (!ok) {
        const d = Math.min(...points.map((p) => nearest(on, p)));
        problems.push(`${what} skal røre ${SURFACE_NAME[c.on]}, men er ${num(d)} fra`);
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
        for (const { limb, p } of bodyPoints(s, k)) {
          const d = nearest(these, p);
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
    for (const k of Object.keys(TOUCH) as PointKind[]) {
      for (const { limb, p } of bodyPoints(s, k)) {
        const d = nearest(these, p);
        if (d < TOUCH[k][0]) {
          problems.push(
            `${limb.includes('.') ? limb : KIND_NAME[k]} går ${num(-d)} ind i ${SURFACE_NAME[on]}`,
          );
        }
      }
    }
  }
  return { contacts: results, problems: [...new Set(problems)] };
}

// ---------------------------------------------------------------------------------------------
// Limbs: bending, reach, length, feet
// ---------------------------------------------------------------------------------------------

/** How far a joint turns from the first segment to the second, in degrees (+ = counterclockwise). */
export function turn(root: Point, joint: Point, end: Point): number {
  const a = sub(joint, root);
  const b = sub(end, joint);
  return (Math.atan2(cross(a, b), a[0] * b[0] + a[1] * b[1]) * 180) / Math.PI;
}

/** A straight limb may overstretch this much the wrong way (knees and elbows can, a little). */
export const HYPEREXTENSION = 8;

/** The bend problems of a frame in side view: a knee or an elbow that bends the wrong way. */
export function bendProblems(frame: Frame, s: Skeleton): string[] {
  if (frame.view !== 'side' || frame.facing === null) return [];
  const problems: string[] = [];
  for (const b of s.bones) {
    const t = turn(b.root, b.joint, b.end) * frame.facing;
    // Knees turn clockwise (facing 1), elbows counterclockwise.
    const wrong = b.kind === 'leg' ? t > HYPEREXTENSION : t < -HYPEREXTENSION;
    if (wrong) {
      const joint = b.kind === 'leg' ? 'knæet' : 'albuen';
      problems.push(
        `${b.side}.${b.kind === 'leg' ? 'legs' : 'arms'}: ${joint} bøjer den forkerte vej (${num(Math.abs(t))}°); tjek »facing« og leddene`,
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
    const name = `${b.side}.${b.kind === 'arm' ? 'arms' : 'legs'}`;
    if (b.short > 1) {
      problems.push(
        `${name} når ikke sit punkt: ${num(b.short)} for langt; flyt »to« tættere på ${b.kind === 'arm' ? 'skulderen' : 'hoften'}`,
      );
    }
  }
  return problems;
}

function jointLimbProblems(figure: FigureItem, pose: Pose, s: Skeleton): string[] {
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
  void figure;
  return problems;
}

// ---------------------------------------------------------------------------------------------
// A figure and a file
// ---------------------------------------------------------------------------------------------

/** Contacts on the same surface in two positions in a row: the hand or foot must not slide. */
function slideProblems(
  figure: FigureItem,
  movement: OwnMovement,
  frame: Frame,
): Array<{ where: string; message: string }> {
  const problems: Array<{ where: string; message: string }> = [];
  const positions = new Map(movement.positions.map((p) => [p.id, p]));
  const carriedOn = new Set<string>(
    figure.props.flatMap((p) => (p.type === 'towel' && 'attach' in p ? [p.attach] : [])),
  );
  const pairs = new Set<string>();
  let at = movement.positions[0]?.id ?? '';
  for (const phase of movement.phases) {
    if (phase.to !== at) pairs.add([at, phase.to].sort().join('|'));
    if (phase.repeat === undefined) at = phase.to;
  }
  for (const pair of pairs) {
    const [a, b] = pair.split('|') as [string, string];
    const pa = figure.keyframes[a];
    const pb = figure.keyframes[b];
    const ca = positions.get(a)?.contacts ?? [];
    const cb = positions.get(b)?.contacts ?? [];
    if (!pa || !pb) continue;
    const sa = solve(frame, pa);
    const sb = solve(frame, pb);
    const soa = solids(figure, sa);
    const sob = solids(figure, sb);
    for (const ba of sa.bones) {
      const bb = sb.bones.find((x) => x.side === ba.side && x.kind === ba.kind);
      if (!bb) continue;
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
        for (const surface of new Set(soa.map((x) => x.on))) {
          if (surface === 'wall') continue; // sliding along a wall is part of the movement
          const named = (cs: readonly Contact[]) =>
            cs.some((c) => c.on === surface && parts.includes(c.part));
          if (!named(ca) || !named(cb)) continue;
          const da = nearest(
            soa.filter((x) => x.on === surface),
            p,
          );
          const db = nearest(
            sob.filter((x) => x.on === surface),
            q,
          );
          if (!inRange(da, kind) || !inRange(db, kind)) continue;
          const moved = distance(p, q);
          if (moved > 1) {
            problems.push({
              where: `${a} → ${b}`,
              message: `${anchor} glider ${num(moved)} på ${SURFACE_NAME[surface]}; giv den samme punkt i begge positioner`,
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

  // Hands and feet: a tip in every keyframe or in none, so it never pops in and out.
  for (const kind of ['arms', 'legs'] as const) {
    for (const side of ['near', 'far'] as const) {
      const tips = movement.positions.map((p) => {
        const limb = figure.keyframes[p.id]?.[kind][side];
        return limb ? limb.tip !== undefined : null;
      });
      const shown = tips.filter((t) => t !== null);
      if (shown.length > 0 && shown.some((t) => t !== shown[0])) {
        add('', `${side}.${kind} har »tip« i nogle positioner og ikke i andre`);
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
      ...limbProblems(s),
      ...jointLimbProblems(figure, pose, s),
      ...evaluatePose(figure, pose, position.contacts, frame).problems,
    ]) {
      add(position.id, message);
    }
  }

  // The frames between the keyframes bend the right way too.
  const model = buildModel(figure, movement);
  const seen = new Set<string>();
  for (const m of model.timeline.moves) {
    if (m.from === m.to || seen.has(`${m.from}|${m.to}`)) continue;
    seen.add(`${m.from}|${m.to}`);
    const a = figure.keyframes[m.from];
    const b = figure.keyframes[m.to];
    if (!a || !b) continue;
    for (const u of [0.25, 0.5, 0.75]) {
      const pose = lerpPose(a, b, ease(u), model.solved[m.from], model.solved[m.to]);
      for (const message of bendProblems(frame, solve(frame, pose))) {
        add(`${m.from} → ${m.to}`, `undervejs: ${message}`);
      }
    }
  }

  for (const p of slideProblems(figure, movement, frame)) add(p.where, p.message);
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
