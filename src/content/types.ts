// Types for the explanations and figures in content/ (docs/SPEC.md 9.1, docs/DECISIONS.md D37, D45).
// The files are a layer on top of the programme: names, doses and rules come from program/*.json;
// content/explain/<id>.json explains each step in the app's own words and describes its positions
// in words, and content/figures/<id>.json holds the keyframes the figure system draws and animates.
// One file per track (program/tracks), per routine (program/routines.json) and one for the
// measurements in the sessions (program/measures.json).
import type { SessionKind } from '../engine/types.ts';

/**
 * Format version of every file in content/. A new required field that old files lack needs a new
 * version; an optional one, like »Mærk« (`feel`), does not.
 */
export const CONTENT_FORMAT = 1;

/** The subject of the measurements' files: content/explain/measures.json, ids 'measures.<id>'. */
export const MEASURES = 'measures';

// ---------------------------------------------------------------------------------------------
// Shared vocabulary
// ---------------------------------------------------------------------------------------------

/** The equipment a step can need, with the label the app shows (the programme's equipment list). */
export const EQUIPMENT = {
  wall: 'Væg',
  chair: 'Stol',
  sofa: 'Sofa',
  bed: 'Seng',
  table: 'Bord',
  step: 'Trappetrin',
  books: 'Bøger',
  pillow: 'Pude',
  towel: 'Håndklæde',
  backpack: 'Rygsæk',
  bottles: 'Vandflasker',
} as const;
export type Equipment = keyof typeof EQUIPMENT;

/** What a body part can rest on or touch. Everything but the floor must be in the equipment. */
export const SURFACES = [
  'floor',
  'wall',
  'chair',
  'sofa',
  'bed',
  'table',
  'step',
  'books',
  'pillow',
  'towel',
] as const;
export type Surface = (typeof SURFACES)[number];

/** Body parts that come in pairs: a contact says whether one or both touch (`count`). */
export const PAIRED_PARTS = [
  'hand',
  'forearm',
  'elbow',
  'knee',
  'shin',
  'foot',
  'toes',
  'heel',
] as const;
/** Body parts without a pair: hip = the seat, back/belly/side = lying on it. */
export const SINGLE_PARTS = ['hip', 'back', 'belly', 'side', 'shoulders', 'chest', 'head'] as const;
export type BodyPart = (typeof PAIRED_PARTS)[number] | (typeof SINGLE_PARTS)[number];

// ---------------------------------------------------------------------------------------------
// Explanations: content/explain/<id>.json
// ---------------------------------------------------------------------------------------------

/** A body part touching something in a position; the figure test checks it (milestone 6). */
export interface Contact {
  part: BodyPart;
  on: Surface;
  /** Paired parts only: 1 = one of them (one-arm push-up), 2 = both (the default). */
  count?: 1 | 2;
}

/** A key position in words. The figure file has one keyframe per position id. */
export interface Position {
  /** Lowercase a–z, digits and _, unique in the movement: 'top', 'bottom'. */
  id: string;
  /** Shown under the still image when motion is reduced: »Oppe«, »Nede«. */
  name: string;
  /** Where hands, feet, knees, hip and head are, the angles, and what touches what. */
  text: string;
  /** What touches the floor, wall, chair …; empty = in the air (a jump). */
  contacts: Contact[];
}

/** One part of a repetition: the figure moves to (or stays in) a position in this time. */
export interface Phase {
  /** The position at the end of the phase; the same position as before = a pause or a hold. */
  to: string;
  /**
   * Seconds in the step's tempo (0.2–10). "dose" = as long as the dose says: the hold of a hold
   * step, a part of a round, or a routine item's or measurement's time. With `repeat`: one time
   * out to `to` and back.
   */
  seconds: number | 'dose';
  /** The text under the figure while the phase runs: »3 sek ned«. An »N sek« here is the phase's time. */
  label: string;
  /**
   * Out to `to` and back to the position before, this many times (2–30) – the club sequence's ten
   * micro pumps, twenty squats – or "dose": for as long as the dose lasts (punches in a wall sit).
   * The phase ends where it started.
   */
  repeat?: number | 'dose';
}

interface MovementBase {
  /** Needed when an item has more than one movement (the warm-up's »Mobilisér«). */
  id?: string;
  /** Shown above the figure when there is more than one movement. */
  name?: string;
  /** Routine items only: the movement belongs only to these sessions (pogo-hop in Styrke A). */
  sessions?: SessionKind[];
}

/** A movement: the positions and the phases of one repetition. Starts in positions[0]. */
export interface OwnMovement extends MovementBase {
  positions: Position[];
  phases: Phase[];
}

/**
 * Routine items only: the session's first power step (the warm-up's »Potensér«). The card and the
 * figure show that step's name, positions and phases; without a power block it is left out.
 */
export interface BorrowedMovement extends MovementBase {
  from: 'power';
  name: string;
}

export type Movement = OwnMovement | BorrowedMovement;

export function isBorrowed(movement: Movement): movement is BorrowedMovement {
  return 'from' in movement;
}

export interface Mistake {
  mistake: string;
  fix: string;
}

/** The explanation of one step, routine item or measurement. */
export interface ExplainItem {
  /**
   * A step id ('press.1'), a routine item id ('warmup.1', 'os.3' = routine id + item key) or a
   * measurement id ('measures.hollow' = 'measures.' + the id in program/measures.json).
   */
  id: string;
  /** »Træner«: what the step does for the body and for Muay Thai. One sentence. */
  trains: string;
  /**
   * »Mærk«, shown right after »Træner«: where the step should be felt and maybe where not (»Forsiden
   * af lårene og balderne, ikke knæet.«). One sentence; optional (DECISIONS.md D55).
   */
  feel?: string;
  /** »Udgangsstilling«. 1–2 sentences. */
  start: string;
  /** »Sådan gør du«: 2–4 short, numbered steps in the imperative. */
  steps: string[];
  /** »Tempo«, as in the programme. Every »N sek« here is also a phase. */
  tempo: string;
  /** »Vejrtrækning«. */
  breathing: string;
  /** 2–3 cues of at most six words that can be read from the floor in the middle of a set. */
  cues: string[];
  /** »Typiske fejl«: 2–3, each with how to correct it. */
  mistakes: Mistake[];
  /** »Lettere«: the step below or the programme's own easier variant. */
  easier: string;
  /** »Sværere«: the step above or a harder variant. */
  harder: string;
  /** »Udstyr«; empty = nothing but the floor. */
  equipment: Equipment[];
  /** »Gør klar«: one sentence for the rest before the exercise. */
  getReady: string;
  /** Usually one; one per exercise when an item holds several (the warm-up). */
  movements: Movement[];
}

/**
 * A step explained exactly like another item – in the same file (the EMOM steps E2–E9) or in
 * another (a measurement like its step: 'measures.hollow' like 'core_front.2'). Only when every
 * field fits both, so »Lettere« and »Sværere« name no step.
 */
export interface ExplainLike {
  id: string;
  like: string;
}

export type ExplainEntry = ExplainItem | ExplainLike;

export interface ExplainFile {
  format: typeof CONTENT_FORMAT;
  /** The track id, routine id or 'measures'; the same as the file name. */
  subject: string;
  /** The track's »Hvorfor« in the app's own words: 1–3 short paragraphs, no sources. */
  why: string[];
  /** In the programme's order; steps without an explanation yet are left out. */
  items: ExplainEntry[];
}

export function isLike(entry: ExplainEntry): entry is ExplainLike {
  return 'like' in entry;
}

// ---------------------------------------------------------------------------------------------
// Figures: content/figures/<id>.json – the format of tools/pictos/picto.py as data
// ---------------------------------------------------------------------------------------------

/** A point in figure units: x to the right, y up, the floor at y = 0. */
export type Point = [number, number];

// The segment lengths (BODY) and the front view's widths (FRONT_WIDTH) are in src/content/units.ts:
// this module is part of the start files, and the figure system must not pull them in there.

export type View = 'side' | 'front' | 'top';
export type LimbSide = 'near' | 'far';

/**
 * A limb solved with two-bone IK: the hand (arm) or the ankle (leg) reaches `to`. In side view the
 * elbow or knee bends the anatomical way by itself (see `FigureItem.facing`); in front and top view
 * `bend` picks the side, as picto.py's bend. In side view an arm over the head may have `bend` to
 * turn the elbow the other way, as in a handstand (DECISIONS.md D56).
 */
export interface IkLimb {
  to: Point;
  bend?: 1 | -1;
  /** Foot or hand beyond the ankle or wrist: a point, or an angle in degrees (length BODY.tip). */
  tip?: Point | number;
  /** A shorter upper arm or thigh when it points toward the viewer (the push-up's elbows: 12.5). */
  upper?: number;
  /** A shorter forearm or shin, for the same reason. */
  lower?: number;
}

/** A limb with its joints given, for a limb lying along a surface (forearms in a plank). */
export interface JointLimb {
  joint: Point;
  end: Point;
  tip?: Point;
}

/** null = the limb is hidden; the same limbs must be shown in every keyframe of a figure. */
export type Limb = IkLimb | JointLimb | null;

export interface Pose {
  /** The hip joint. */
  hip: Point;
  /** Direction from the hip to the shoulders in degrees: 0 = +x, 90 = straight up. */
  torso: number;
  /** The head's angle to the torso line in degrees (+ = counterclockwise); default 0. */
  head?: number;
  /** Front view only: shoulder and pelvis width (default FRONT_WIDTH). */
  width?: { shoulders: number; hips: number };
  /**
   * Side view only: the back as a curve whose middle lies this many units off the straight line
   * from the hip to the shoulders, + toward the back (a round back, the cat), − toward the chest
   * (an arched back, the cow); default 0 (DECISIONS.md D56).
   */
  spine?: number;
  arms: Record<LimbSide, Limb>;
  legs: Record<LimbSide, Limb>;
}

/** Where a carried prop sits: a hand, a foot or the back. */
export type Anchor = 'near.hand' | 'far.hand' | 'near.foot' | 'far.foot' | 'back';

export type Prop =
  /** A wall at x; side 1 = the room is to the left (−x), −1 = to the right. */
  | { type: 'wall'; x: number; side: 1 | -1 }
  /** Furniture from x to x + width with its top at y = height; a sofa can have a backrest. */
  | { type: 'chair' | 'bed' | 'table' | 'step'; x: number; width: number; height: number }
  | {
      type: 'sofa';
      x: number;
      width: number;
      height: number;
      back?: number;
      backSide?: 'left' | 'right';
    }
  /** Small things on the floor or on furniture; `at` = the lower left corner. */
  | { type: 'books'; at: Point; width?: number; count?: number }
  | { type: 'pillow'; at: Point; width: number }
  | { type: 'towel'; at: Point; width: number; rolled?: boolean }
  /** A towel under a hand or foot that slides with it (rollout, leg curl). */
  | { type: 'towel'; attach: Anchor; width: number }
  | { type: 'backpack'; at: Point }
  | { type: 'backpack'; attach: Anchor }
  | { type: 'bottles'; attach: Anchor };

export type PropType = Prop['type'];

/** A hand or a foot a figure can lift on the way between two positions (`Transition.lift`). */
export type LiftLimb = 'near.hand' | 'far.hand' | 'near.foot' | 'far.foot';

/**
 * What happens on the way from one position to another, beyond the keyframes (DECISIONS.md D56):
 * hands or feet that leave their surface and land somewhere else (`lift`: a step, the feet jumping
 * back in a burpee, the hands walking toward a wall) go in an arc, and the check lets them move; and
 * the whole figure can move along x (`advance`, figure units, + to the right: bounds that travel
 * forward; with a `repeat` each way out and back is a move of its own), and it can pass through a
 * pose of its own (`via`). It applies every time the movement goes from `from` to `to`, also on the
 * way back to the start.
 */
export interface Transition {
  from: string;
  to: string;
  lift?: LiftLimb[];
  advance?: number;
  /**
   * A pose the figure goes through on the way, without a position of its own in the explanation:
   * the burpee's feet jumping back with the hip high between the squat and the chest (D56).
   */
  via?: Pose;
}

/** The segments drawn in Thai red: the muscles that work; `neck` = between shoulders and head. */
export type Segment = 'torso' | 'neck' | `${LimbSide}.${'upperArm' | 'forearm' | 'thigh' | 'shin'}`;

// ---------------------------------------------------------------------------------------------
// Marks, mistakes and a second view (DECISIONS.md D58): all optional, so older files stay valid
// ---------------------------------------------------------------------------------------------

/**
 * A point of the body a mark refers to: the hip, the shoulder line, the chest (the front of the upper
 * torso), the head, or a hand (wrist), elbow, knee, foot (ankle) or toes of one side.
 */
export type MarkPoint =
  | 'hip'
  | 'shoulder'
  | 'chest'
  | 'head'
  | `${LimbSide}.${'hand' | 'elbow' | 'knee' | 'foot' | 'toes'}`;

/** A joint whose angle a mark shows: between thigh and shin, upper arm and forearm, torso and thigh, torso and upper arm. */
export type MarkJoint = `${LimbSide}.${'knee' | 'elbow' | 'hip' | 'shoulder'}`;

/** Where a mark's text stands beside its point. */
export type MarkPlace = 'right' | 'left' | 'above' | 'below';

interface MarkWhen {
  /** Shown while the figure stands at this position (its hold, and as it arrives and leaves). */
  at?: string;
  /** Shown while this phase runs: its number in the explanation's phases, counted from 1. */
  phase?: number;
}

/**
 * What the figure points out at the right moment (docs/SPEC.md 9.1, DECISIONS.md D58): the way a part
 * moves in a phase (`arrow`), the angle at a joint (`angle`), a short cue of at most three words
 * (`cue`) or a straight guide line between two points (`line`). Exactly one of the four, and exactly
 * one of `at` and `phase`; one mark at a time.
 */
export type Mark = MarkWhen &
  (
    | {
        /** The part whose path in the phase the arrow follows (a curved path gives a curved arrow). */
        arrow: MarkPoint;
        /** The arrow moved off the path, in figure units, so it stands beside the body. */
        offset?: Point;
      }
    | {
        angle: MarkJoint;
        /** The degrees to show (the text's »ca. 90°«); the drawn angle is shown without it. */
        degrees?: number;
      }
    | {
        /** At most three words, without a full stop: »Knæ over tæer«. */
        cue: string;
        /** The point the cue stands by: a part of the body or a point in figure units. */
        point?: MarkPoint | Point;
        place?: MarkPlace;
      }
    | {
        /** From one point to the other: parts of the body or points in figure units. */
        line: [MarkPoint | Point, MarkPoint | Point];
        /** A cue by the middle of the line: »Én planke«. */
        cue?: string;
        place?: MarkPlace;
      }
  );

/** The pose fields a wrong pose changes; a limb given replaces the right pose's limb. */
export interface PoseChange {
  hip?: Point;
  torso?: number;
  head?: number;
  spine?: number;
  width?: { shoulders: number; hips: number };
  arms?: Partial<Record<LimbSide, Limb>>;
  legs?: Partial<Record<LimbSide, Limb>>;
}

/**
 * A typical mistake as a figure (DECISIONS.md D58): the right pose of a position beside the wrong
 * one, shown on the card under »Typiske fejl« with »Rigtigt« and »Forkert«.
 */
export interface Fault {
  /** The mistake in the explanation's `mistakes`, counted from 1. */
  mistake: number;
  /** The position the mistake is shown in: the right pose is its keyframe. */
  at: string;
  /** How the wrong pose differs from the right one. */
  wrong: PoseChange;
  /** The view it is drawn in, the figure's own or its second; the figure's own by default. */
  view?: View;
  /** What the wrong pose touches, when the mistake changes it (a heel that lifts); else the position's. */
  contacts?: Contact[];
}

interface ViewBase {
  props: Prop[];
  /** One pose per position id of the movement in content/explain. */
  keyframes: Record<string, Pose>;
  /** Lifted hands and feet, and the figure moving along x, between positions (D56). */
  transitions?: Transition[];
  /** Arrows, angles, cues and guide lines at the right moment (D58). */
  marks?: Mark[];
}

type Viewpoint =
  | {
      view: 'side';
      /**
       * The way the chest faces when the figure is turned upright without mirroring: 1 = right,
       * −1 = left. Standing with the chest to the right, a push-up or plank with the head to the
       * right, and lying on the back with the head to the left are all 1; a handstand with the
       * chest to the right is −1. It decides which way knees and elbows bend, so it is required.
       */
      facing: 1 | -1;
    }
  | { view: 'front' | 'top' };

/**
 * The same movement seen from another side, drawn beside the figure with the same phases and the
 * same clock (D58): a squat from the side for the hip and the back, and from the front for the
 * knees over the toes. Its red segments are the figure's unless it names its own.
 */
export type SecondView = ViewBase & { highlight?: Segment[] } & Viewpoint;

interface FigureBase extends ViewBase {
  /** The step, routine item or measurement id, as in content/explain. */
  id: string;
  /** The movement's id when the explanation has more than one. */
  movement?: string;
  /** Segments in red, at least one. */
  highlight: Segment[];
  /** Typical mistakes as right and wrong side by side (D58). */
  faults?: Fault[];
  /** A second view beside the first, where one is not enough (D58). */
  second?: SecondView;
}

/** The figure of one step, routine item or measurement (one movement of it). */
export type FigureItem = FigureBase & Viewpoint;

/** A figure drawn exactly like another figure in the same file. */
export interface FigureLike {
  id: string;
  movement?: string;
  like: string;
}

export type FigureEntry = FigureItem | FigureLike;

export interface FigureFile {
  format: typeof CONTENT_FORMAT;
  /** The track id, routine id or 'measures'; the same as the file name and the explanation file. */
  subject: string;
  figures: FigureEntry[];
}

export function isFigureLike(entry: FigureEntry): entry is FigureLike {
  return 'like' in entry;
}
