// Types for the programme data (program/*.json), the user's event log and the derived state.
// docs/ENGINE.md sections 2, 3 and 7 describe them; deviations are noted where they occur.

export type ISODate = string; // 'YYYY-MM-DD' in Europe/Copenhagen
export type Level = 'basis' | 'staerk' | 'imponerende' | 'boss';
export type SessionKind = 'A' | 'B' | 'motor' | 'os' | 'travel';
export type Phase = 'fundament' | 'opbygning' | 'kampform' | 'let';
export type Light = 'green' | 'yellow' | 'red';
export type SessionStatus = 'green' | 'yellow' | 'red' | 'travel';
export type Rir = 0 | 1 | 2 | 3;
export type Pain = 'light' | 'sharp' | 'stop';
export type Side = 'L' | 'R';

// ---------------------------------------------------------------------------------------------
// Programme content
// ---------------------------------------------------------------------------------------------

/** What "per side" means for a dose: per side, per leg or per direction (neck). */
export type Per = 'side' | 'ben' | 'retning';

/**
 * A step's dose as written in the source table ("3 × 6–12 pr. side"). The number of sets in a
 * session comes from the week table and the block (docs/ENGINE.md 6.3), not from `sets` here.
 */
export type Dose =
  | { kind: 'reps'; sets: [number, number]; reps: [number, number]; per?: Per }
  | { kind: 'hold'; sets: [number, number]; seconds: [number, number]; per?: Per }
  | { kind: 'power'; sets: [number, number]; reps: [number, number]; per?: Per }
  | { kind: 'fixed'; sets: number; reps: number; per?: Per }
  | { kind: 'rounds'; sets: number; rounds: [number, number]; text: string }
  | { kind: 'emom'; minutes: number; reps: number }
  | { kind: 'always'; text: string };

export type Progression =
  'double' | 'hold' | 'power' | 'emom' | 'rounds' | 'neck' | 'load' | 'manual';

export interface Step {
  id: string;
  key: string;
  name: string;
  level?: Level;
  dose: Dose;
  execution: string;
  cues: string[];
  pdfPage: number;
  note?: string;
  /** Rule tags, e.g. 'nordic' (no Nordic the day before an event). */
  tags?: string[];
  /** This step is done after the given step's dose in the same block (shoulder 3, P17). */
  with?: string;
  /** One round as timed parts; 0 seconds = until the user taps (wall sit W3, W5; P49). */
  round?: Array<{ label: string; seconds: number }>;
}

export interface Track {
  id: string;
  name: string;
  /** Short label for lists, e.g. "Pres". */
  short: string;
  pdfPage: number;
  progression: Progression;
  /** 'ladder' = one of the ten ladders, 'power' = the three power tracks, 'extra' = the rest. */
  category: 'ladder' | 'power' | 'extra';
  /** Rule tags, e.g. 'heavy_legs' (left out the day before an event). */
  tags?: string[];
  /** Text under the table in the source (e.g. "Trin 5–7 kræver glat gulv"). */
  note?: string;
  /** Cue shown with pain on this track (page 46: push-ups on the knuckles for wrist pain). */
  painCue?: string;
  /** The page's Coach/Fysio/Evidens boxes, shown under »Hvorfor« (docs/SPEC.md 3.2). */
  why?: Array<{ kind: 'coach' | 'fysio' | 'evidens'; text: string }>;
  steps: Step[];
}

export type BlockRole = 'warmup' | 'power' | 'pair' | 'triset' | 'finisher' | 'neck';

export interface Block {
  id: string;
  trackId: string;
  role: BlockRole;
  group?: 'pair1' | 'pair2' | 'pair3' | 'triset';
  setsRule: 'par12' | 'other' | 'power' | 'fixed';
  fixedSets?: [number, number];
  restSec?: number;
  inYellow: boolean;
  /** The highest step this block uses (the travel session's split squats: S-WEEK-12). */
  maxStep?: string;
}

export interface SessionTemplate {
  id: SessionKind;
  name: string;
  defaultWeekday: number; // 1 = Monday … 7 = Sunday; 0 = every day (Open & Strong)
  durationMin: [number, number];
  blocks: Block[];
}

/** A fixed routine without a ladder: the warm-up and Open & Strong. */
export interface RoutineItem {
  key: string;
  name: string;
  dose: string;
  execution: string;
  /** Seconds the guided clock gives the item. */
  seconds: number;
  picto?: string;
  /** Cue that replaces `execution` after four completed Open & Strong weeks (S-OS-01). */
  laterCue?: string;
}

export interface Routine {
  id: 'warmup' | 'os';
  name: string;
  minutes: number;
  pdfPage: number;
  items: RoutineItem[];
}

export type MotorPlan =
  | { type: 'base'; minutes: number; strides?: number }
  | { type: 'base_check'; minutes: number }
  | { type: 'intervals_30_15'; series: number; reps: number }
  | { type: 'fight_rounds'; rounds: number; sprints: boolean }
  | { type: 'cooper_or_base'; cooperOnly?: boolean };

export interface Week {
  pw: number;
  phase: Phase;
  light: boolean;
  sets: { par12: number; other: number; optionalPlusOne?: boolean };
  rirPlan: 1 | 2 | 3;
  powerSets: number;
  powerOptionalPlusOne?: boolean;
  motor: MotorPlan;
  /** Highest EMOM step this week ('burpee_emom.E4'), or 'test' in light weeks. */
  emomCap: string;
  /** Week 1 is locked to E1 (P5). */
  emomFixed?: boolean;
  measurements: boolean;
  bossAllowed?: boolean;
  /** The source's wording (docs/PROGRAM_KILDE.md, pages 37–38). */
  text: {
    from: string;
    phase: string;
    strength: string;
    power: string;
    motor: string;
    burpees: string;
    note: string;
  };
}

export type MeasurePlacement =
  | { type: 'replace_first_set'; trackId: string }
  | { type: 'standalone'; before?: string; after?: string }
  | { type: 'before_warmup' }
  | { type: 'replace_finisher' }
  | { type: 'motor' }
  | { type: 'after_block'; trackId: string; minStep: string };

export interface Measure {
  id: string;
  name: string;
  how: string;
  unit: 'cm' | 'reps' | 'sec' | 'm' | 'depth';
  weekday: 2 | 4 | 5;
  placement: MeasurePlacement;
  levels?: { basis: number; staerk: number; imponerende: number; lowerIsBetter?: boolean };
  weeks: 'all_light_and_1' | 'light_only';
  optional?: boolean;
  /** Labels for the 'depth' unit (Nordic). */
  depthLabels?: string[];
}

/** One row of Målbrættet (page 41). */
export interface BoardRow {
  name: string;
  measureId?: string;
  derived?: 'legs';
  basis: string;
  staerk: string;
  imponerende: string;
}

export interface OverlayMove {
  kind: SessionKind;
  default: ISODate;
  alternative: ISODate;
  /** The motor session on the default date is the calm base. */
  calmBase?: boolean;
}

export interface Overlay {
  id: string;
  /** Monday of the calendar week the overlay belongs to. */
  week: ISODate;
  onlyIfLight?: boolean;
  /** The overlay moves the week's measurements (newyear). */
  measurements?: boolean;
  moves: OverlayMove[];
  label: string;
  alternativeLabel: string;
}

export type Requires =
  | { type: 'always' }
  | { type: 'step'; trackId: string; minStep: string }
  | { type: 'measure'; measureId: string; min: number }
  | {
      type: 'performance';
      trackId: string;
      stepId: string;
      sets: number;
      reps?: number;
      seconds?: number;
    }
  | { type: 'clean'; trackId: string; stepId: string };

export interface Requirement {
  id: string;
  name: string;
  how: string;
  /** The source's wording of the requirement ("Klar når" / the Hero text). */
  ready: string;
  requires: Requires;
  group?: string;
}

export interface Boss {
  id: string;
  name: string;
  how: string;
  staerk: string;
  imponerende: string;
}

export interface PictoRef {
  picto: string;
  /** True when the step uses the nearest step's pictogram (docs/PLAN.md milestone 6). */
  fallback: boolean;
}

export interface Program {
  programVersion: string;
  startDate: ISODate;
  tracks: Track[];
  sessions: SessionTemplate[];
  routines: Routine[];
  weeks: Week[];
  measures: Measure[];
  board: BoardRow[];
  overlays: Overlay[];
  impress: Requirement[];
  heroes: Requirement[];
  sideBranches: Requirement[];
  bosses: Boss[];
  pictos: Record<string, PictoRef>;
  /** Removed step id → nearest lower step id (S-DATA-05). */
  migrations: Record<string, string>;
  /** The standard club week (page 6): Muay Thai days and times, optional clinch. */
  club: {
    days: Array<{ weekday: number; time: string }>;
    clinch: { weekday: number; time: string };
  };
}

// ---------------------------------------------------------------------------------------------
// Events (docs/ENGINE.md 3.1). All events are appended; nothing is edited or deleted.
// ---------------------------------------------------------------------------------------------

export interface EventBase {
  id: string;
  /** ISO timestamp of when the event was written. */
  at: string;
  /** The date the event belongs to (Europe/Copenhagen). */
  date: ISODate;
  v: 1;
}

/** A block as planned when the session started; the replay judges the session against it. */
export interface PlannedBlockRef {
  blockId: string;
  trackId: string;
  stepId: string;
  /** Working sets (per side for per-side steps), without a measurement set. */
  sets: number;
  target: number;
  rirPlan: 1 | 2 | 3;
  group?: string;
  measureId?: string;
}

export type ClubContent = 'teknik' | 'power' | 'fart' | 'sparring' | 'mix';
export type Hardness = 'easy' | 'medium' | 'hard';
export type Freshness = 'fresh' | 'ok' | 'flat';
export type StatusKind = 'ill' | 'travel' | 'holiday' | 'club_closed';

export type EventBody =
  | { type: 'onboarding_completed'; startDate: ISODate; completedWeeks: ISODate[] }
  | {
      type: 'step_set';
      trackId: string;
      stepId: string;
      target?: number;
      load?: number;
      reason: 'onboarding' | 'user_choice';
      explanation: string;
    }
  | {
      type: 'session_started';
      sessionId: string;
      kind: SessionKind;
      light: Light;
      answers: [boolean, boolean, boolean];
      programWeek: number;
      round: number;
      blocks: PlannedBlockRef[];
      /** The motor session runs the calm base instead of intervals. */
      calmBase?: boolean;
      boss?: boolean;
    }
  | {
      type: 'set_logged';
      sessionId: string;
      blockId: string;
      trackId: string;
      stepId: string;
      setIndex: number;
      side?: Side;
      reps?: number;
      seconds?: number;
      rir: Rir;
      pain?: Pain;
      asPlanned: boolean;
      measureId?: string;
    }
  | {
      type: 'block_result';
      sessionId: string;
      blockId: string;
      trackId: string;
      stepId: string;
      result: BlockResult;
    }
  | {
      type: 'session_completed';
      sessionId: string;
      status: SessionStatus;
      aborted: boolean;
      done: boolean;
    }
  | { type: 'session_skipped'; kind: SessionKind; forDate: ISODate; reason: 'user' | 'missed' }
  | { type: 'session_moved'; kind: SessionKind; fromDate: ISODate; toDate: ISODate; short: boolean }
  | {
      type: 'step_changed';
      trackId: string;
      from: string;
      to: string;
      by: 'engine' | 'user';
      reason: 'progression' | 'pain' | 'restore' | 'absence' | 'user_choice';
      explanation: string;
      until?: ISODate;
      /** Programme week of an EMOM step-up (R-EMOM: at most one per programme week). */
      week?: { round: number; pw: number };
      /** The session whose result caused the change. */
      sessionId?: string;
    }
  | {
      type: 'load_changed';
      trackId: string;
      from: number;
      to: number;
      by: 'engine' | 'user';
      explanation: string;
      sessionId?: string;
    }
  | {
      type: 'measurement_logged';
      measureId: string;
      value: number;
      programWeek: number;
      round: number;
    }
  | {
      type: 'club_logged';
      attended: boolean;
      content?: ClubContent[];
      hardness?: Hardness;
      freshness?: Freshness;
      technique?: number;
    }
  | {
      type: 'sunday_check';
      weekStart: ISODate;
      sleepAvg?: number;
      painTracks?: string[];
      tooHeavy?: string[];
    }
  | { type: 'status_set'; status: StatusKind; from: ISODate; to: ISODate }
  | { type: 'calendar_event_added'; label: string; eventDate: ISODate }
  | { type: 'schedule_changed'; clubDays: number[]; clinch: boolean }
  | { type: 'overlay_choice'; overlayId: string; choice: 'default' | 'alternative' }
  | { type: 'os_done' }
  | { type: 'turbo_chosen'; exerciseId: string | null }
  | { type: 'turbo_logged'; sets: number }
  | { type: 'side_branch_set'; branchId: string | null }
  | { type: 'variant_set'; stepId: string }
  | { type: 'hero_checked'; heroId: string; checked: boolean }
  | { type: 'boss_logged'; bossId: string; result: string; level: 'staerk' | 'imponerende' | null }
  | { type: 'backup_exported' };

export type BlockResult =
  | { quality: boolean } // power
  | { clean: boolean; rest20: boolean } // EMOM
  | { clean: boolean } // club sequence, W3
  | { feel: 'easy' | 'ok' | 'hard' }; // neck

export type AppEvent = EventBase & EventBody;
export type EventOf<T extends AppEvent['type']> = Extract<AppEvent, { type: T }>;

/** Creates complete events from bodies; supplied by the app (ids are ULIDs) or by tests. */
export interface EventFactory {
  (body: EventBody, date: ISODate): AppEvent;
}

// ---------------------------------------------------------------------------------------------
// Derived state (docs/ENGINE.md 3.2)
// ---------------------------------------------------------------------------------------------

export interface LoggedSet {
  blockId: string;
  trackId: string;
  stepId: string;
  setIndex: number;
  side?: Side;
  reps?: number;
  seconds?: number;
  rir: Rir;
  pain?: Pain;
  asPlanned: boolean;
  measureId?: string;
}

export interface TrackState {
  stepId: string;
  /** Working number: reps or seconds per set. */
  target: number;
  /** Consecutive qualifying sessions with a hit. */
  hits: number;
  /** Kilograms in the backpack (load tracks and legs.3). */
  load: number;
  tempDown?: {
    originalStepId: string;
    until: ISODate;
    sharpSince: ISODate;
    /** Step 1 cannot go down: the lighter variant is used instead (S-PAIN-04). */
    lighter: boolean;
    physio: boolean;
  };
  last?: { date: ISODate; stepId: string; sets: LoggedSet[] };
  /** The user has seen the warning about choosing a harder step (R-USER-STEP). */
  warnedUp?: boolean;
}

export interface SessionSummary {
  sessionId: string;
  kind: SessionKind;
  date: ISODate;
  light: Light;
  answers: [boolean, boolean, boolean];
  pw: number;
  round: number;
  blocks: PlannedBlockRef[];
  sets: LoggedSet[];
  results: Array<{ blockId: string; trackId: string; stepId: string; result: BlockResult }>;
  completed: boolean;
  status?: SessionStatus;
  aborted?: boolean;
  done?: boolean;
  calmBase?: boolean;
  boss?: boolean;
  /** How each block counted for progression (filled when the session is completed). */
  evaluations: Record<string, BlockEvaluation>;
  /** Explanations of the engine's decisions caused by this session. */
  decisions: Array<{ trackId: string; explanation: string }>;
}

export interface BlockEvaluation {
  trackId: string;
  stepId: string;
  /** Counted for progression (green, not a light week, fully logged, no sharp pain). */
  qualifying: boolean;
  hit: boolean;
  pain: boolean;
  targetBefore: number;
  targetAfter: number;
  hitsAfter: number;
}

export interface WeekInfo {
  k: number;
  monday: ISODate;
  pw: number;
  round: number;
  /** null while the week is running. */
  completed: boolean | null;
  flat: boolean;
  volumeFactor: 1 | 0.67;
}

export interface StatusRange {
  status: StatusKind;
  from: ISODate;
  to: ISODate;
}

export interface CalendarEvent {
  label: string;
  eventDate: ISODate;
}

export interface Decision {
  date: ISODate;
  at: string;
  trackId: string;
  from: string;
  to: string;
  by: 'engine' | 'user';
  reason: string;
  explanation: string;
}

export interface State {
  onboarded: boolean;
  /** Monday of programme week 1. */
  startDate: ISODate;
  today: ISODate;
  round: number;
  tracks: Record<string, TrackState>;
  emom: {
    stepId: string;
    pendingUp: boolean;
    lastStepUpWeek?: { round: number; pw: number };
    stepAtRoundStart: string;
  };
  burpeeVariant: string;
  sideBranch: string | null;
  schedule: { clubDays: number[]; clinch: boolean };
  statuses: StatusRange[];
  events: CalendarEvent[];
  weeks: WeekInfo[];
  sessions: SessionSummary[];
  club: Array<{
    date: ISODate;
    attended: boolean;
    hardness?: Hardness;
    freshness?: Freshness;
    technique?: number;
    content?: ClubContent[];
    /** When the log was written (ISO): the Sunday check writes Saturday's grade the day after. */
    at: string;
  }>;
  measurements: Array<{
    date: ISODate;
    measureId: string;
    value: number;
    pw: number;
    round: number;
  }>;
  /** One per week: the newest check, which replaces the earlier ones (R-PAIN-SUNDAY). */
  sundayChecks: Array<{
    date: ISODate;
    weekStart: ISODate;
    painTracks: string[];
    tooHeavy: string[];
    sleepAvg?: number;
    /** Every track a check of the week named under pain or »for tungt«: not taken down again. */
    taken: string[];
    /** The tracks a check of the week named under »for tungt« (S-PAIN-11). */
    takenHeavy: string[];
  }>;
  /** Moves of the week's sessions; `on` is the day the move was made. */
  moves: Array<{
    kind: SessionKind;
    fromDate: ISODate;
    toDate: ISODate;
    short: boolean;
    on: ISODate;
  }>;
  skipped: Array<{ kind: SessionKind; forDate: ISODate; reason: 'user' | 'missed' }>;
  overlayChoices: Record<string, 'default' | 'alternative'>;
  heroes: Record<string, boolean>;
  turbo: { exerciseId: string | null; log: Record<ISODate, number> };
  osByWeek: Record<ISODate, number>;
  completedOsWeeks: number;
  bossLog: Array<{
    date: ISODate;
    bossId: string;
    result: string;
    level: 'staerk' | 'imponerende' | null;
  }>;
  lastBackup?: ISODate;
  decisions: Decision[];
  /** Neck blocks stopped by "Stop" (R-NECK: two stops repeat the warning on I dag). */
  neckStops: number;
  /** Dates of the absence step-downs already written (R-ABSENCE-3: once per absence period). */
  absenceApplied: ISODate[];
  /** Mondays declared completed in the onboarding (T2). */
  declaredWeeks: ISODate[];
  /** Date the onboarding was completed. */
  onboardedOn?: ISODate;
}
